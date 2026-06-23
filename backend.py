"""
DRÄXIE API  —  FastAPI + LangChain RAG pipeline.
Run with:  uvicorn backend:app --reload
"""
import base64
import io
import json
import math
import os
import re
import sqlite3
import tempfile
from pathlib import Path

import httpx
from fastapi import BackgroundTasks, FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from docling.datamodel.base_models import DocItemLabel
from docling.datamodel.document import DoclingDocument, PictureItem
from docling.document_converter import DocumentConverter
from docling_core.transforms.chunker import HybridChunker
from langchain_community.chat_message_histories import SQLChatMessageHistory
from langchain_core.documents import Document
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_core.output_parsers import StrOutputParser
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.runnables.history import RunnableWithMessageHistory
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_ollama import ChatOllama
from langchain_qdrant import FastEmbedSparse, QdrantVectorStore, RetrievalMode
from langchain_text_splitters import RecursiveCharacterTextSplitter
from qdrant_client import QdrantClient
from PIL import Image as PILImage

import config

# ── Databases ─────────────────────────────────────────────────────────────────

CONV_DB  = "sqlite:///conversations.db"
META_DB  = "draxie.db"


def init_db() -> None:
    con = sqlite3.connect(META_DB)
    con.executescript("""
        CREATE TABLE IF NOT EXISTS feedback (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            conversation_id TEXT,
            rating          TEXT,
            question        TEXT,
            answer          TEXT,
            created_at      DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS ingestion_log (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            filename    TEXT,
            chunks      INTEGER,
            status      TEXT,
            error       TEXT,
            created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    """)
    con.commit()
    con.close()


init_db()


def get_session_history(session_id: str) -> SQLChatMessageHistory:
    return SQLChatMessageHistory(session_id=session_id, connection=CONV_DB)


def _ensure_conv_tables(con: sqlite3.Connection) -> None:
    con.execute("""
        CREATE TABLE IF NOT EXISTS message_sources (
            conversation_id TEXT NOT NULL,
            msg_index       INTEGER NOT NULL,
            sources         TEXT,
            chunks          TEXT,
            PRIMARY KEY (conversation_id, msg_index)
        )
    """)
    con.execute("""
        CREATE TABLE IF NOT EXISTS conversation_titles (
            conversation_id TEXT PRIMARY KEY,
            title           TEXT NOT NULL,
            created_at      DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    """)


def _save_message_sources(conv_id: str, msg_idx: int, sources: list, chunks: list) -> None:
    con = sqlite3.connect("conversations.db")
    _ensure_conv_tables(con)
    con.execute(
        "INSERT OR REPLACE INTO message_sources (conversation_id, msg_index, sources, chunks) VALUES (?,?,?,?)",
        (conv_id, msg_idx, json.dumps(sources), json.dumps(chunks)),
    )
    con.commit()
    con.close()


# ── Ingestion helpers (shared by create_database path and POST /documents) ────

_VISUAL_LABELS   = {DocItemLabel.PICTURE, DocItemLabel.CHART}

# Heuristic thresholds for decorative-image rejection at ingestion time.
# Images that fail either check are never saved to disk or described by the vision model.
_IMG_MIN_DIM     = 150    # skip if BOTH width and height are below this (icons, bullets)
_IMG_MAX_ASPECT  = 10.0   # skip if max/min dimension ratio exceeds this (decorative lines)

# Relevance gate — if the best text-chunk score for a question is below this, the LLM
# is never called and the no-answer string is streamed directly.  Tune downward if
# legitimate questions are being blocked; tune upward to reject more off-topic queries.
_MIN_TEXT_RELEVANCE = 0.40

# One converter instance — reused for both startup indexing and live uploads.
_converter = DocumentConverter()

_splitter = RecursiveCharacterTextSplitter(
    chunk_size=config.CHUNK_SIZE,
    chunk_overlap=config.CHUNK_OVERLAP,
    separators=["\n## ", "\n### ", "\n\n", "\n", " ", ""],
)


def _extract_images(
    dl_doc: DoclingDocument,
    source_stem: str,
) -> dict[str, str]:
    """Save PictureItems as PNG and return {self_ref -> image_path}.

    Images are filtered before saving:
    - Skipped if both dimensions are below _IMG_MIN_DIM (icons, bullet points).
    - Skipped if the aspect ratio exceeds _IMG_MAX_ASPECT (decorative lines/banners).
    """
    image_store = Path(config.IMAGE_STORE_PATH)
    image_store.mkdir(parents=True, exist_ok=True)
    ref_to_path: dict[str, str] = {}
    fig_idx = 0
    for item, _level in dl_doc.iterate_items():
        if isinstance(item, PictureItem):
            try:
                img = item.get_image(dl_doc)
            except Exception:
                fig_idx += 1
                continue

            if img is None:
                fig_idx += 1
                continue

            w, h = img.size
            # Reject degenerate images
            if w == 0 or h == 0:
                fig_idx += 1
                continue
            # Reject tiny decorative images (icons, bullets, small logos)
            if w < _IMG_MIN_DIM and h < _IMG_MIN_DIM:
                fig_idx += 1
                continue
            # Reject extreme-aspect-ratio images (horizontal/vertical decorative lines)
            if max(w, h) / min(w, h) > _IMG_MAX_ASPECT:
                fig_idx += 1
                continue

            out_path = image_store / f"{source_stem}__fig{fig_idx:04d}.png"
            img.save(out_path, "PNG")
            ref_to_path[item.self_ref] = str(out_path)
            fig_idx += 1
    return ref_to_path


def _build_chunks(
    dl_doc: DoclingDocument,
    source_name: str,
    ref_to_path: dict[str, str],
) -> list[Document]:
    """
    Produce LangChain Documents from a DoclingDocument.
    Figure chunks keep chunk_type='figure' + image_path and are NOT re-split.
    Text chunks get chunk_type='text' and pass through the RecursiveCharacterTextSplitter.
    """
    chunker = HybridChunker()
    text_docs: list[Document]   = []
    figure_docs: list[Document] = []

    for raw_chunk in chunker.chunk(dl_doc):
        text = chunker.contextualize(raw_chunk)
        if not text.strip():
            continue

        image_path: str | None = None
        for doc_item in raw_chunk.meta.doc_items:
            if doc_item.label in _VISUAL_LABELS:
                image_path = ref_to_path.get(doc_item.self_ref)
                if image_path:
                    break

        if image_path:
            figure_docs.append(Document(
                page_content=text,
                metadata={"source": source_name, "chunk_type": "figure", "image_path": image_path},
            ))
        else:
            text_docs.append(Document(
                page_content=text,
                metadata={"source": source_name, "chunk_type": "text"},
            ))

    # Stub chunks for any PictureItem HybridChunker produced no text for
    chunked_refs = {
        doc_item.self_ref
        for raw_chunk in chunker.chunk(dl_doc)
        for doc_item in raw_chunk.meta.doc_items
        if doc_item.label in _VISUAL_LABELS
    }
    for ref, img_path in ref_to_path.items():
        if ref not in chunked_refs:
            figure_docs.append(Document(
                page_content=f"[Abbildung aus {source_name}]",
                metadata={"source": source_name, "chunk_type": "figure", "image_path": img_path},
            ))

    # Generate vision descriptions for all figure chunks so they are retrievable
    for doc in figure_docs:
        img_path = doc.metadata.get("image_path", "")
        if not img_path:
            continue
        surrounding = doc.page_content if not doc.page_content.startswith("[Abbildung") else ""
        description = _describe_image(img_path, surrounding)
        if description:
            doc.page_content = description
            doc.metadata["image_description"] = description

    split_text = _splitter.split_documents(text_docs)
    for c in split_text:
        c.metadata.setdefault("chunk_type", "text")

    return split_text + figure_docs


def _extract_docx_links(file_path: str, source_name: str) -> list[Document]:
    """Return a Document chunk listing all hyperlinks found in a DOCX file."""
    from docx import Document as DocxDocument
    from docx.oxml.ns import qn

    links: list[tuple[str, str]] = []
    try:
        doc = DocxDocument(file_path)
        for paragraph in doc.paragraphs:
            for hyperlink in paragraph._element.iter(qn("w:hyperlink")):
                r_id = hyperlink.get(qn("r:id"))
                if r_id and r_id in doc.part.rels:
                    rel = doc.part.rels[r_id]
                    if "hyperlink" in rel.reltype:
                        url = rel.target_ref
                        text = "".join(t.text for t in hyperlink.iter(qn("w:t"))).strip()
                        if url:
                            links.append((text, url))
    except Exception:
        pass

    if not links:
        return []

    link_lines = "\n".join(
        f"- {text}: {url}" if text else f"- {url}" for text, url in links
    )
    return [Document(
        page_content=f"Verweise und Links in {source_name}:\n{link_lines}",
        metadata={"source": source_name, "chunk_type": "text"},
    )]


# ── Vision helpers ─────────────────────────────────────────────────────────────

def _image_to_b64(image_path: str) -> str | None:
    """Load an image, resize to VISION_TOKEN_BUDGET, return base64 PNG string."""
    try:
        img = PILImage.open(image_path).convert("RGB")
        max_pixels = config.VISION_TOKEN_BUDGET * 512
        w, h = img.size
        if w * h > max_pixels:
            scale = math.sqrt(max_pixels / (w * h))
            img = img.resize((max(1, int(w * scale)), max(1, int(h * scale))), PILImage.LANCZOS)
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        return base64.b64encode(buf.getvalue()).decode()
    except Exception as e:
        print(f"[image_to_b64] FAILED {image_path}: {e}", flush=True)
        return None


def _describe_image(image_path: str, surrounding_text: str = "") -> str:
    """Call Gemma vision to generate a German description of an image for retrieval."""
    b64 = _image_to_b64(image_path)
    if not b64:
        return ""
    ctx = f"\n\nUmliegender Textkontext aus dem Dokument:\n{surrounding_text[:800]}" if surrounding_text.strip() else ""
    prompt = (
        "Beschreibe dieses Bild auf Deutsch ausführlich für ein technisches Dokumentensystem. "
        "Nenne: Art der Visualisierung, alle sichtbaren Zahlen und Bezeichnungen, "
        "den wesentlichen Inhalt und welche Schlussfolgerung es vermittelt."
        + ctx
    )
    try:
        response = llm.invoke([HumanMessage(content=[
            {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{b64}"}},
            {"type": "text",      "text": prompt},
        ])])
        return response.content.strip()
    except Exception as e:
        print(f"[describe_image] FAILED {image_path}: {e}", flush=True)
        return ""


# ── RAG pipeline ──────────────────────────────────────────────────────────────

_embeddings = HuggingFaceEmbeddings(
    model_name="BAAI/bge-m3",
    model_kwargs={"device": config.EMBED_DEVICE},
)

_qdrant_client = QdrantClient(path=config.QDRANT_PATH)

vectorstore = QdrantVectorStore(
    client=_qdrant_client,
    collection_name=config.COLLECTION,
    embedding=_embeddings,
    sparse_embedding=FastEmbedSparse(model_name="Qdrant/bm25"),
    retrieval_mode=RetrievalMode.HYBRID,
)

llm = ChatOllama(
    base_url=config.OLLAMA_BASE_URL,
    model=config.LLM_MODEL,
    temperature=0.3,
    num_ctx=config.LLM_NUM_CTX,
)

base_retriever = vectorstore.as_retriever(search_kwargs={"k": config.TOP_K})

_expand_chain = (
    ChatPromptTemplate.from_template(
        "You are a multilingual query expansion assistant for a bilingual (German/English) document corpus.\n"
        "Detect the language of the search query below.\n"
        "Generate exactly 3 alternative phrasings following this rule:\n"
        "  - If the query is in German: produce 2 alternatives in German and 1 alternative translated into English.\n"
        "  - If the query is in English: produce 2 alternatives in English and 1 alternative translated into German.\n"
        "The cross-language alternative must be the last element.\n"
        "Return ONLY a valid JSON array of exactly 3 strings, with no extra text:\n"
        "[\"alternative1\", \"alternative2\", \"cross_language_alternative\"]\n\n"
        "Query: {question}"
    )
    | llm
    | StrOutputParser()
)


def _parse_expand_alternatives(raw: str) -> list[str]:
    """Extract JSON array of alternative queries from LLM output."""
    start = raw.find("[")
    end   = raw.rfind("]")
    if start == -1 or end == -1:
        return []
    try:
        items = json.loads(raw[start:end + 1])
        return [s.strip() for s in items if isinstance(s, str) and s.strip()]
    except Exception:
        # Fallback: treat each non-empty line as an alternative
        return [ln.strip() for ln in raw.splitlines() if ln.strip()]

_suggest_chain = (
    ChatPromptTemplate.from_template(
        "You are a DRÄXLMAIER sales onboarding assistant.\n"
        "Based on the context and answer below, generate exactly 3 short follow-up questions "
        "in the same language as the answer, that the user might ask next and that are answerable from the context.\n"
        "Return ONLY a JSON array, e.g.: [\"Question 1?\", \"Question 2?\", \"Question 3?\"]\n\n"
        "Context:\n{context}\n\nAnswer:\n{answer}"
    )
    | ChatOllama(
        base_url=config.OLLAMA_BASE_URL,
        model=config.LLM_MODEL,
        temperature=0.1,
    )
    | StrOutputParser()
)


def _parse_suggestions(raw: str) -> list[str]:
    """Extract JSON array of strings from LLM output, tolerating surrounding text."""
    start = raw.find("[")
    end   = raw.rfind("]")
    if start == -1 or end == -1:
        return []
    try:
        items = json.loads(raw[start:end + 1])
        return [s for s in items if isinstance(s, str)][:3]
    except Exception:
        return []

def multi_retrieve(question: str) -> tuple[list, list]:
    """Return (text_docs, figure_docs).

    Text docs: retrieved by hybrid search — these are the ground-truth sources.
    Figure docs: fetched from Qdrant by source name match — images from the
    same documents that were cited, NOT ranked by query similarity. This means
    images appear because their document was relevant, not because the image
    description happened to score well.
    """
    raw_expand  = _expand_chain.invoke({"question": question})
    alternatives = _parse_expand_alternatives(raw_expand)          # 3 items: 2 same-lang + 1 cross-lang
    queries = [question] + alternatives                             # 4 queries total
    seen, text_docs = set(), []
    for q in queries:
        for doc in base_retriever.invoke(q):
            if doc.metadata.get("chunk_type") == "figure":
                continue  # never retrieve figures by query score
            if doc.page_content not in seen:
                seen.add(doc.page_content)
                text_docs.append(doc)

    # Score-gated figure retrieval — only images that genuinely match the query
    # clear the threshold; everything else is silently dropped.
    figure_docs: list = []
    try:
        from qdrant_client.models import Filter, FieldCondition, MatchValue
        fig_filter = Filter(must=[
            FieldCondition(key="metadata.chunk_type", match=MatchValue(value="figure"))
        ])
        fig_results = vectorstore.similarity_search_with_relevance_scores(
            query=question,
            k=20,
            filter=fig_filter,
        )
        for doc, score in fig_results:
            if score <= _MIN_FIGURE_SCORE:
                continue
            img = doc.metadata.get("image_path", "")
            if not img or not Path(img).exists():
                continue
            figure_docs.append(doc)
            if len(figure_docs) >= _MAX_FIGURE_RESULTS:
                break
    except Exception:
        pass

    return text_docs, figure_docs


def format_docs(docs: list) -> str:
    """Context string for Gemma — text chunks only, no image descriptions."""
    return "\n\n".join(f"[{i+1}] {d.page_content}" for i, d in enumerate(docs))


_PIPE_BEFORE_CITE = re.compile(r'\s*\|\s*(?=\[\d)')
_JAMMED_CITES = re.compile(r'\](\[\d+\])')
_LONE_CITE_PERIOD = re.compile(r'((?:\[\d+\]\s*)+)\.\s*$', re.MULTILINE)


def repair_gemma_formatting(text: str) -> str:
    """Fix Gemma's broken bullet+pipe pattern before streaming to the frontend."""
    lines = text.split('\n')
    result: list[str] = []
    in_fence = False
    for line in lines:
        if line.strip().startswith('```'):
            in_fence = not in_fence
            result.append(line)
            continue
        if not in_fence:
            line = _PIPE_BEFORE_CITE.sub(' ', line)
        result.append(line)
    text = '\n'.join(result)
    text = _JAMMED_CITES.sub(r'] \1', text)
    text = _LONE_CITE_PERIOD.sub(lambda m: m.group(1).rstrip(), text)
    return text


_SYSTEM_PROMPT = """\
You are DRÄXIE, a precise onboarding assistant for DRÄXLMAIER sales staff.

GROUNDING RULES — ABSOLUTE, NO EXCEPTIONS
- You have NO general knowledge. Your training data does not exist in this context. The ONLY facts you may state are those explicitly present in the document excerpts provided below.
- NEVER answer from memory, training data, or world knowledge — even if you are certain of the answer. This applies to every topic: people, companies, history, science, politics, geography, or anything else.
- If the question cannot be answered from the excerpts alone, you MUST use the no-answer sentence. No partial guesses. No "based on general knowledge". Silence on everything outside the excerpts.
- Every sentence that states a fact MUST end with its source marker [N] (e.g. [1], [2]). No exceptions. If a sentence draws on multiple excerpts, cite each separately with no space: [1][3]. Never write [1, 3] or [1,3].
- Use only sequential [1], [2], [3] … markers — they correspond to the numbered Quellen entries shown to the user.
- When asked for specific numbers, deadlines, names, or lists, state them directly and exactly as they appear in the documents.
- Some excerpts are marked [Abbildung aus …]. These indicate a figure or diagram exists in the source. You may cite them with [N] to point the user to the visual, but do not invent or describe their contents — only text excerpts are authoritative.

LINKS AND REFERENCES
- If the document excerpts contain hyperlinks or references to other documents, always include them verbatim in your answer so the user can follow them directly.

WHEN THE DOCUMENTS ARE INCOMPLETE OR OFF-TOPIC
- If the question is about a person, event, organization, or topic that does not appear anywhere in the excerpts, respond IMMEDIATELY with only the no-answer sentence. Do not attempt to answer.
- If the documents fully answer the question, answer completely.
- If the documents only partially answer it, give what the documents support, then clearly state what is missing. If relevant links to further resources appear in the excerpts, include them.
- If the documents do not answer the question at all, use this exact sentence (German): "Dazu habe ich in den verfügbaren Unterlagen leider nichts gefunden." — do not paraphrase it.
  English equivalent: "I couldn't find anything on that in the available documents."
- Do not include source citations in a no-answer response.

FORBIDDEN WORDS — never use these in any response, in any language:
- "Kontext" → use "die Unterlagen", "die Dokumente", or "die Auszüge" instead
- "Prompt" → never say this to users
- "Token" → never say this to users
- "Embedding" → never say this to users
- "Chunk" / "Chunks" → use "Abschnitt" or "Auszug" if referring to a passage
- "Query" (as a technical term) → use "Ihre Frage" or "Ihre Anfrage"
- "Retrieval" → never say this to users
- "Vektor" / "Vector" (in the AI/search sense) → never say this to users
Speak like a knowledgeable colleague, not a software system.

PLAIN LANGUAGE
Use domain-specific terminology (Fahrzeugprogramm, Baureihe, OEM, Sonderausstattung, etc.) when appropriate
for DRÄXLMAIER sales staff. Never use IT or computing terminology (algorithms, APIs, databases, etc.) —
the FORBIDDEN WORDS list above covers the most common cases.
Write like a knowledgeable automotive colleague, not a software system.

FORMAT
- Default to clear prose. Use a table or bullet list only when the content is genuinely a list, comparison, or set of steps — not for single facts.
- NEVER use raw markdown pipe-table syntax (lines containing "|"). It will not render correctly.
- When the answer is best shown as a table, emit a fenced block with this EXACT syntax (nothing else inside the fence):
  ```ui-table
    {{"title": "optional title", "columns": ["Col A", "Col B"], "rows": [["Val 1", "Val 2"], ["Val 3", "Val 4"]]}}
  ```
  Put normal prose before and after the block. Only use it for genuine tabular data.
- For glossary-style answers with multiple terms and definitions, use plain bullet list format: **Term:** definition. Do NOT use a table for this.
- [N] markers correspond to the numbered document excerpts provided.
- NEVER place a "|" pipe character inside a bullet point or numbered list item. A line starting with "-" or "1." must contain only prose text — never table columns.

CITATION PLACEMENT
- [N] markers go ONLY at the very end of a complete sentence. Correct: "Bauteile werden verwendet. [1]" — Wrong: "Bauteile [1] werden verwendet." or "| [1]. text |"
- NEVER place [N] at the start or middle of a sentence, or at the start of any content block.
- When multiple citations follow each other, write them with no period between: "[1][2]" not "[1]. [2]" or "[1][2].".
- A lone citation with only a period ("| [10].") is forbidden — every citation must follow a complete sentence of prose.

MULTI-DEFINITION FORMAT
When a term has multiple distinct meanings, ALWAYS use this numbered list format — never a table, never mixed bullet+pipe:
1. **Bedeutung A:** Vollständiger Erklärungssatz in Prosa. [N]
2. **Bedeutung B:** Vollständiger Erklärungssatz in Prosa. [N]

ANTWORTFORMAT — BEISPIELE (STRIKT EINHALTEN)

FALSCH — so NICHT (Aufzählung mit Pipe-Spalten und Zitationen mittendrin):
- **COP:** Erklärung Teil 1 | [1][3][7]. Erklärung Teil 2 | [1][8]. Erklärung Teil 3 | [8].
- **Conformity of Production:** [2][3].

RICHTIG — so JA (nummerierte Liste, vollständige Sätze, Zitationen am Satzende):
Der Begriff **COP** hat folgende Bedeutungen:

1. **Carry Over Part (Übernahmeteil):** Bauteile, die unverändert in verschiedenen Produkten verwendet werden, aber keine Normteile sind. [1] Sie senken Entwicklungskosten und sind Kern des Plattformkonzepts. [3]

2. **Conformity of Production:** Übereinstimmung der Serienproduktion mit dem genehmigten Typ. [2]

3. **Central Ordering Process (KOVP):** Zentraler Bestellprozess bei DRÄXLMAIER. [3]

REGEL: Jedes Listenelement enthält vollständige Sätze. Zitationen [N] stehen IMMER am Ende eines vollständigen Satzes — niemals am Satzanfang, niemals zwischen Wörtern, niemals nach einem Pipe-Zeichen.

SINGLE ANSWER
Give one single direct answer. Do not list multiple possibilities when you can give a clear answer.
Express uncertainty once and clearly — never format it as a bullet list of options.

LANGUAGE
- Always reply in the same language as the user's question. German question → German answer. English question → English answer.

CONVERSATION
- Use earlier messages in the conversation for context when relevant.
"""

_answer_prompt = ChatPromptTemplate.from_messages([
    ("system", _SYSTEM_PROMPT),
    MessagesPlaceholder(variable_name="history"),
    ("human", "Unterlagen:\n{context}\n\nANWEISUNG: Beantworte ausschließlich auf Basis der Unterlagen oben. Wenn das Thema der Frage dort nicht vorkommt, antworte NUR mit: \"Dazu habe ich in den verfügbaren Unterlagen leider nichts gefunden.\" Kein Allgemeinwissen, keine eigene Recherche.\n\nFrage: {question}"),
])

_chain_with_history = RunnableWithMessageHistory(
    _answer_prompt | llm | StrOutputParser(),
    get_session_history,
    input_messages_key="question",
    history_messages_key="history",
)

# ── FastAPI ───────────────────────────────────────────────────────────────────

app = FastAPI(title="DRÄXIE API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/assets", StaticFiles(directory="frontend/dist/assets"), name="assets")

# Serve extracted images
_images_dir = Path(config.IMAGE_STORE_PATH)
_images_dir.mkdir(parents=True, exist_ok=True)
app.mount("/images", StaticFiles(directory=str(_images_dir)), name="images")

# Serve original uploaded files so the in-app document viewer can open them
_uploads_dir = Path("./data/uploads")
_uploads_dir.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(_uploads_dir)), name="uploads")


# ── Models ────────────────────────────────────────────────────────────────────

class ChatRequest(BaseModel):
    question: str
    conversation_id: str


class FeedbackRequest(BaseModel):
    conversation_id: str
    rating: str          # "up" or "down"
    question: str
    answer: str


# ── Routes ────────────────────────────────────────────────────────────────────

@app.get("/")
async def root():
    return FileResponse("frontend/dist/index.html")


@app.get("/draexie-mascot.js")
async def mascot_js():
    return FileResponse("frontend/dist/draexie-mascot.js", media_type="application/javascript")


_NO_ANSWER_DE = "Dazu habe ich in den verfügbaren Unterlagen leider nichts gefunden."
_NO_ANSWER_EN = "I couldn't find anything on that in the available documents."

# Phrases the LLM produces when it can't find an answer (instead of our canonical text).
_NO_ANSWER_TRIGGERS = [
    "keine informationen", "nicht gefunden", "nicht in den unterlagen",
    "nicht in den bereitgestellten", "nicht in meinen", "leider nichts",
    "keine angaben", "nicht enthalten", "nicht verfügbar", "nicht vorhanden",
    "i couldn't find", "no information", "not found in", "cannot find",
    "not available in", "not mentioned in", "no relevant", "nothing found",
    "keine relevanten", "nicht erwähnt", "nicht behandelt",
]


_EN_MARKERS = {"what", "who", "where", "when", "why", "how", "is", "are",
               "was", "were", "does", "did", "can", "could", "would", "tell",
               "explain", "describe", "give", "show", "list", "find", "the", "a"}


def _detect_language(text: str) -> str:
    """Return 'en' if the text is predominantly English, otherwise 'de'."""
    words = set(re.findall(r"[a-zA-ZäöüÄÖÜß]+", text.lower()))
    en_hits = len(words & _EN_MARKERS)
    # Common unambiguous German words that don't appear in English
    de_hits = len(words & {"wie", "welche", "welcher", "welches", "warum",
                            "wann", "können", "gibt", "sind", "haben", "bitte",
                            "erkläre", "zeige", "nenne", "beschreibe"})
    return "en" if en_hits > de_hits else "de"


def _normalize_no_answer(text: str, question: str) -> str:
    """Replace LLM no-answer paraphrases with our canonical sentence.

    If the response contains citation markers ([1], [2] …) it found relevant
    content — leave it untouched.  Otherwise, if it matches any known
    no-answer phrasing, replace with the correct DE or EN canonical string.
    """
    if re.search(r'\[\d+\]', text):
        return text  # has citations → real answer, don't touch
    lower = text.lower()
    if any(t in lower for t in _NO_ANSWER_TRIGGERS):
        return _NO_ANSWER_EN if _detect_language(question) == "en" else _NO_ANSWER_DE
    return text


def _best_text_score(question: str) -> float:
    """Return the highest relevance score any text chunk scores against the question.
    Used as a fast off-topic gate — avoids calling the LLM for irrelevant queries."""
    try:
        from qdrant_client.models import Filter, FieldCondition, MatchValue
        results = vectorstore.similarity_search_with_relevance_scores(
            question, k=1,
            filter=Filter(must=[FieldCondition(key="metadata.chunk_type", match=MatchValue(value="text"))])
        )
        return results[0][1] if results else 0.0
    except Exception:
        return 1.0  # fail open — let the LLM handle it


@app.post("/chat")
def chat(req: ChatRequest):
    # Off-topic gate: if no text chunk scores above the threshold, skip the LLM entirely.
    best_score = _best_text_score(req.question)
    if best_score < _MIN_TEXT_RELEVANCE:
        no_ans = _NO_ANSWER_EN if _detect_language(req.question) == "en" else _NO_ANSWER_DE
        def _nope():
            yield f"data: {json.dumps({'sources': [], 'chunks': []})}\n\n"
            yield f"data: {json.dumps({'token': no_ans})}\n\n"
            yield f"data: {json.dumps({'done': True, 'suggestions': []})}\n\n"
        return StreamingResponse(_nope(), media_type="text/event-stream")

    text_docs, figure_docs = multi_retrieve(req.question)

    # Sources: unique filenames from text docs only (ground truth)
    sources = list(dict.fromkeys(
        Path(d.metadata.get("source", "unknown")).name for d in text_docs
    ))

    # Chunks: text chunks numbered [1..N], figure chunks appended after (no number in context)
    all_docs = text_docs + figure_docs
    chunks = [
        {
            "num": i + 1,
            "source": Path(d.metadata.get("source", "unknown")).name,
            "text": d.page_content[:500] if d.metadata.get("chunk_type") != "figure" else "",
            "image_url": (
                f"/images/{Path(d.metadata['image_path']).name}"
                if d.metadata.get("chunk_type") == "figure"
                   and d.metadata.get("image_path")
                   and Path(d.metadata["image_path"]).exists()
                else None
            ),
        }
        for i, d in enumerate(all_docs)
    ]

    # Context for Gemma: text chunks only — figure descriptions never sent to LLM
    context = format_docs(text_docs)

    # Image paths for multimodal path (from cited source documents)
    image_paths: list[str] = []
    seen_paths: set[str] = set()
    for d in figure_docs:
        p = d.metadata.get("image_path", "")
        if p and p not in seen_paths and Path(p).exists():
            image_paths.append(p)
            seen_paths.add(p)

    def generate():
        yield f"data: {json.dumps({'sources': sources, 'chunks': chunks})}\n\n"

        if image_paths:
            # ── Multimodal path ───────────────────────────────────────────────
            # Build base64 payloads (resized to VISION_TOKEN_BUDGET)
            b64_images = [b for p in image_paths if (b := _image_to_b64(p)) is not None]

            history_obj  = get_session_history(req.conversation_id)
            # Keep only the last 10 messages (5 turns) so old history never blows the context window
            history_msgs = history_obj.messages[-10:]

            # Gemma 4: images before text for optimal multimodal attention
            human_content: list[dict] = [
                {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{b}"}}
                for b in b64_images
            ] + [
                {"type": "text", "text": f"Kontext:\n{context}\n\nANWEISUNG: Beantworte ausschließlich auf Basis der Unterlagen oben. Wenn das Thema der Frage dort nicht vorkommt, antworte NUR mit: \"Dazu habe ich in den verfügbaren Unterlagen leider nichts gefunden.\" Kein Allgemeinwissen, keine eigene Recherche.\n\nFrage: {req.question}"},
            ]

            messages = [
                SystemMessage(content=_SYSTEM_PROMPT),
                *history_msgs,
                HumanMessage(content=human_content),
            ]

            full_answer = ""
            for chunk in llm.stream(messages):
                tok = chunk.content if hasattr(chunk, "content") else str(chunk)
                if tok:
                    full_answer += tok
            full_answer = _normalize_no_answer(repair_gemma_formatting(full_answer), req.question)
            yield f"data: {json.dumps({'token': full_answer})}\n\n"

            # Persist turn to conversation history manually
            history_obj.add_user_message(req.question)
            history_obj.add_ai_message(full_answer)
            ai_msg_idx = len(history_obj.messages) - 1
            _save_message_sources(req.conversation_id, ai_msg_idx, sources, chunks)

        else:
            # ── Text-only path ────────────────────────────────────────────────
            full_answer = ""
            for token in _chain_with_history.stream(
                {"context": context, "question": req.question},
                config={"configurable": {"session_id": req.conversation_id}},
            ):
                full_answer += token
            full_answer = _normalize_no_answer(repair_gemma_formatting(full_answer), req.question)
            yield f"data: {json.dumps({'token': full_answer})}\n\n"
            history_after = get_session_history(req.conversation_id)
            _save_message_sources(req.conversation_id, len(history_after.messages) - 1, sources, chunks)

        # ── Suggested follow-up questions (generated before done) ────────────
        suggestions: list[str] = []
        try:
            raw = _suggest_chain.invoke({"context": context, "answer": full_answer})
            suggestions = _parse_suggestions(raw)
        except Exception:
            pass

        yield f"data: {json.dumps({'done': True, 'suggestions': suggestions})}\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")


# ── Conversations ─────────────────────────────────────────────────────────────

@app.get("/conversations")
def list_conversations():
    db_path = Path("conversations.db")
    if not db_path.exists():
        return []

    con = sqlite3.connect(db_path)
    _ensure_conv_tables(con)
    rows = con.execute("""
        SELECT m.session_id, MIN(m.id) as first_id, MAX(m.id) as last_id,
               COUNT(*) as cnt, t.title
        FROM message_store m
        LEFT JOIN conversation_titles t ON t.conversation_id = m.session_id
        GROUP BY m.session_id
        ORDER BY last_id DESC
    """).fetchall()
    con.close()

    result = []
    for session_id, first_id, last_id, cnt, stored_title in rows:
        if stored_title:
            title = stored_title
        else:
            history = get_session_history(session_id)
            msgs = history.messages
            if not msgs:
                continue
            title = next(
                (m.content[:80] for m in msgs if isinstance(m, HumanMessage)),
                "Unbenanntes Gespräch",
            )
        result.append({
            "id": session_id,
            "title": title,
            "created_at": str(last_id),
            "message_count": cnt,
        })
    return result


@app.post("/conversations/{conversation_id}/title")
def generate_title(conversation_id: str):
    history = get_session_history(conversation_id)
    first_human = next(
        (m.content for m in history.messages if isinstance(m, HumanMessage)),
        None,
    )
    if not first_human:
        return {"title": "Unbenanntes Gespräch"}

    try:
        resp = llm.invoke([HumanMessage(content=(
            f"Erstelle einen kurzen deutschen Titel (maximal 6 Wörter, keine Anführungszeichen) "
            f"für ein Gespräch, das mit dieser Frage beginnt:\n\n{first_human[:300]}"
        ))])
        title = resp.content.strip().strip('"').strip("'")[:80] or first_human[:60]
    except Exception:
        title = first_human[:60]

    con = sqlite3.connect("conversations.db")
    _ensure_conv_tables(con)
    con.execute(
        "INSERT OR REPLACE INTO conversation_titles (conversation_id, title) VALUES (?,?)",
        (conversation_id, title),
    )
    con.commit()
    con.close()
    return {"title": title}


@app.get("/conversations/search")
def search_conversations(q: str):
    db_path = Path("conversations.db")
    if not db_path.exists() or not q.strip():
        return []

    con = sqlite3.connect(db_path)
    _ensure_conv_tables(con)
    like_q = f"%{q}%"
    seen: dict[str, dict] = {}

    def _msg_text(raw: str) -> str:
        """Extract plain text from LangChain's JSON message format."""
        try:
            return json.loads(raw).get("data", {}).get("content", raw)
        except Exception:
            return raw

    def _make_entry(
        session_id: str, text: str, stored_title: str | None,
        msg_idx: int, created_at: str | None = None,
    ) -> dict | None:
        idx = text.lower().find(q.lower())
        if idx == -1:
            return None
        start = max(0, idx - 55)
        end   = min(len(text), idx + len(q) + 55)
        excerpt = ("…" if start > 0 else "") + text[start:end] + ("…" if end < len(text) else "")
        return {
            "id":          session_id,
            "title":       stored_title or text[:80],
            "excerpt":     excerpt,
            "match_start": idx - start + (1 if start > 0 else 0),
            "match_len":   len(q),
            "msg_index":   msg_idx,
            "created_at":  created_at,
        }

    # 1. Message content (column is 'message', stores JSON)
    for session_id, raw_msg, stored_title, msg_idx, created_at in con.execute("""
        SELECT m.session_id, m.message, t.title,
               (SELECT COUNT(*) FROM message_store m2
                WHERE m2.session_id = m.session_id AND m2.id <= m.id) - 1,
               t.created_at
        FROM message_store m
        LEFT JOIN conversation_titles t ON t.conversation_id = m.session_id
        WHERE m.message LIKE ?
        ORDER BY m.id DESC
    """, (like_q,)).fetchall():
        if session_id not in seen:
            entry = _make_entry(session_id, _msg_text(raw_msg), stored_title, int(msg_idx or 0), created_at)
            if entry:
                seen[session_id] = entry

    # 2. Conversation titles
    for session_id, title, created_at in con.execute(
        "SELECT conversation_id, title, created_at FROM conversation_titles WHERE title LIKE ?", (like_q,)
    ).fetchall():
        if session_id not in seen:
            entry = _make_entry(session_id, title, title, 0, created_at)
            if entry:
                seen[session_id] = entry

    # 3. Source document names
    for session_id, sources_json, msg_idx, stored_title, created_at in con.execute("""
        SELECT ms.conversation_id, ms.sources, ms.msg_index, t.title, t.created_at
        FROM message_sources ms
        LEFT JOIN conversation_titles t ON t.conversation_id = ms.conversation_id
        WHERE ms.sources LIKE ?
        ORDER BY ms.msg_index DESC
    """, (like_q,)).fetchall():
        if session_id not in seen:
            try:
                readable = ", ".join(json.loads(sources_json))
            except Exception:
                readable = sources_json
            if not stored_title:
                row = con.execute(
                    "SELECT message FROM message_store WHERE session_id=? ORDER BY id LIMIT 1",
                    (session_id,),
                ).fetchone()
                stored_title = (_msg_text(row[0])[:80] if row else None)
            entry = _make_entry(session_id, readable, stored_title, int(msg_idx or 0), created_at)
            if entry:
                seen[session_id] = entry

    con.close()
    return list(seen.values())


@app.get("/conversations/{conversation_id}")
def get_conversation(conversation_id: str):
    history = get_session_history(conversation_id)

    sources_map: dict[int, dict] = {}
    db_path = Path("conversations.db")
    if db_path.exists():
        con = sqlite3.connect(db_path)
        try:
            rows = con.execute(
                "SELECT msg_index, sources, chunks FROM message_sources WHERE conversation_id=?",
                (conversation_id,),
            ).fetchall()
            for idx, src_json, chk_json in rows:
                sources_map[int(idx)] = {
                    "sources": json.loads(src_json) if src_json else [],
                    "chunks":  json.loads(chk_json) if chk_json else [],
                }
        except sqlite3.OperationalError:
            pass  # table doesn't exist yet (old DB)
        finally:
            con.close()

    messages = []
    for i, m in enumerate(history.messages):
        msg: dict = {
            "role":    "user" if isinstance(m, HumanMessage) else "assistant",
            "content": m.content if isinstance(m.content, str) else "",
        }
        if i in sources_map:
            msg["sources"] = sources_map[i]["sources"]
            msg["chunks"]  = sources_map[i]["chunks"]
        messages.append(msg)

    return {"id": conversation_id, "messages": messages}


@app.delete("/conversations/{conversation_id}")
def delete_conversation(conversation_id: str):
    get_session_history(conversation_id).clear()
    return {"deleted": conversation_id}


# ── Feedback ──────────────────────────────────────────────────────────────────

@app.post("/feedback")
def feedback(req: FeedbackRequest):
    con = sqlite3.connect(META_DB)
    con.execute(
        "INSERT INTO feedback (conversation_id, rating, question, answer) VALUES (?,?,?,?)",
        (req.conversation_id, req.rating, req.question, req.answer),
    )
    con.commit()
    con.close()
    return {"ok": True}


# ── Document upload ───────────────────────────────────────────────────────────

SUPPORTED_EXTENSIONS = {".pdf", ".docx", ".pptx", ".xlsx", ".txt", ".md", ".png", ".jpg", ".jpeg", ".webp"}


def _ingest_file(tmp_path: str, original_name: str) -> None:
    # Keep a copy so the document viewer can serve the original file
    upload_copy = _uploads_dir / original_name
    upload_copy.write_bytes(Path(tmp_path).read_bytes())

    con = sqlite3.connect(META_DB)
    try:
        result  = _converter.convert(tmp_path)
        dl_doc  = result.document
        ref_map = _extract_images(dl_doc, Path(original_name).stem)
        chunks  = _build_chunks(dl_doc, original_name, ref_map)
        if Path(original_name).suffix.lower() == ".docx":
            chunks.extend(_extract_docx_links(str(upload_copy), original_name))
        vectorstore.add_documents(chunks)
        con.execute(
            "INSERT INTO ingestion_log (filename, chunks, status) VALUES (?,?,?)",
            (original_name, len(chunks), "ok"),
        )
    except Exception as exc:
        con.execute(
            "INSERT INTO ingestion_log (filename, chunks, status, error) VALUES (?,?,?,?)",
            (original_name, 0, "error", str(exc)),
        )
    finally:
        con.commit()
        con.close()
        os.unlink(tmp_path)


@app.post("/documents")
async def upload_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
):
    suffix = Path(file.filename or "").suffix.lower()
    if suffix not in SUPPORTED_EXTENSIONS:
        return {"error": f"Unsupported file type: {suffix}"}

    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
    tmp.write(await file.read())
    tmp.close()

    background_tasks.add_task(_ingest_file, tmp.name, file.filename)
    return {"status": "processing", "filename": file.filename}


@app.get("/documents/status")
def ingestion_status():
    con = sqlite3.connect(META_DB)
    rows = con.execute(
        "SELECT filename, chunks, status, error, created_at FROM ingestion_log ORDER BY id DESC LIMIT 20"
    ).fetchall()
    con.close()
    return [
        {"filename": r[0], "chunks": r[1], "status": r[2], "error": r[3], "created_at": r[4]}
        for r in rows
    ]


# ── Admin ────────────────────────────────────────────────────────────────────

import hashlib as _hashlib
import imagehash as _imagehash

_rebuild_status: dict = {"running": False, "processed": 0, "updated": 0, "total": 0, "skipped_duplicate": 0, "skipped_already_done": 0}


def _rebuild_all_figures() -> None:
    from qdrant_client.models import PointIdsList

    _rebuild_status.update(running=True, processed=0, updated=0, total=0, skipped_duplicate=0, skipped_already_done=0)

    # First pass: collect all figure points
    figure_points = []
    offset = None
    while True:
        points, next_offset = _qdrant_client.scroll(
            collection_name=config.COLLECTION,
            scroll_filter=None,
            limit=100,
            offset=offset,
            with_payload=True,
            with_vectors=False,
        )
        for point in points:
            payload = point.payload or {}
            meta = payload.get("metadata", {})
            if meta.get("chunk_type") != "figure":
                continue
            img_path = meta.get("image_path", "")
            if not img_path or not Path(img_path).exists():
                continue
            existing = meta.get("image_description", "")
            if existing and len(existing) >= 80:
                _rebuild_status["skipped_already_done"] += 1
                continue
            figure_points.append((point.id, payload, img_path))
        if next_offset is None:
            break
        offset = next_offset

    _rebuild_status["total"] = len(figure_points)

    # Second pass: describe each image, deduplicating by file hash
    hash_to_description: dict[str, str] = {}
    for point_id, payload, img_path in figure_points:
        _rebuild_status["processed"] += 1

        # Hash the image file to detect duplicates
        try:
            img_hash = str(_imagehash.phash(PILImage.open(img_path)))
        except OSError:
            continue

        if img_hash in hash_to_description:
            description = hash_to_description[img_hash]
            _rebuild_status["skipped_duplicate"] += 1
        else:
            description = _describe_image(img_path)
            if not description:
                continue
            hash_to_description[img_hash] = description

        # Delete old point, re-add via LangChain so both dense+sparse vectors are generated
        _qdrant_client.delete(
            collection_name=config.COLLECTION,
            points_selector=PointIdsList(points=[point_id]),
        )
        new_meta = {**payload.get("metadata", {}), "image_description": description}
        vectorstore.add_documents([Document(page_content=description, metadata=new_meta)])
        _rebuild_status["updated"] += 1

    _rebuild_status["running"] = False


@app.post("/admin/rebuild-image-descriptions")
def rebuild_image_descriptions(background_tasks: BackgroundTasks):
    """Rebuild vision descriptions for ALL figure chunks. Deduplicates by image hash."""
    if _rebuild_status["running"]:
        return {"error": "Already running", "status": _rebuild_status}
    background_tasks.add_task(_rebuild_all_figures)
    return {"status": "started"}


@app.get("/admin/rebuild-status")
def rebuild_status():
    return _rebuild_status


# ── Health ────────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    # Qdrant
    try:
        count = _qdrant_client.count(config.COLLECTION).count
        qdrant_ok = True
    except Exception:
        count = 0
        qdrant_ok = False

    # Ollama
    try:
        r = httpx.get(f"{config.OLLAMA_BASE_URL}/api/tags", timeout=3.0)
        ollama_ok = r.status_code == 200
    except Exception:
        ollama_ok = False

    # Last ingestion
    con = sqlite3.connect(META_DB)
    last = con.execute(
        "SELECT filename, created_at FROM ingestion_log WHERE status='ok' ORDER BY id DESC LIMIT 1"
    ).fetchone()
    con.close()

    return {
        "status": "ok" if (qdrant_ok and ollama_ok) else "degraded",
        "qdrant":  {"ok": qdrant_ok, "chunks": count, "collection": config.COLLECTION},
        "ollama":  {"ok": ollama_ok, "model": config.LLM_MODEL},
        "last_ingestion": {"filename": last[0], "at": last[1]} if last else None,
    }


@app.get("/{full_path:path}", include_in_schema=False)
async def spa_fallback(full_path: str):
    """Serve React SPA for all non-API routes."""
    return FileResponse("frontend/dist/index.html")

"""
DRÄXIE API  —  FastAPI + LangChain RAG pipeline.
Run with:  uvicorn backend:app --reload
"""
import base64
import io
import json
import math
import os
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


# ── Ingestion helpers (shared by create_database path and POST /documents) ────

_VISUAL_LABELS = {DocItemLabel.PICTURE, DocItemLabel.CHART}

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
    """Save PictureItems as PNG and return {self_ref -> image_path}."""
    image_store = Path(config.IMAGE_STORE_PATH)
    image_store.mkdir(parents=True, exist_ok=True)
    ref_to_path: dict[str, str] = {}
    fig_idx = 0
    for item, _level in dl_doc.iterate_items():
        if isinstance(item, PictureItem):
            img = item.get_image(dl_doc)
            if img is not None:
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

    split_text = _splitter.split_documents(text_docs)
    for c in split_text:
        c.metadata.setdefault("chunk_type", "text")

    return split_text + figure_docs


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
    except Exception:
        return None


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
)

base_retriever = vectorstore.as_retriever(search_kwargs={"k": config.TOP_K})

_expand_chain = (
    ChatPromptTemplate.from_template(
        "Generate 2 alternative phrasings of this search query. "
        "Return only the queries, one per line, no numbering.\n\nQuery: {question}"
    )
    | llm
    | StrOutputParser()
)

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

def multi_retrieve(question: str):
    extras = _expand_chain.invoke({"question": question})
    queries = [question] + [q.strip() for q in extras.splitlines() if q.strip()]
    seen, docs = set(), []
    for q in queries:
        for doc in base_retriever.invoke(q):
            if doc.page_content not in seen:
                seen.add(doc.page_content)
                docs.append(doc)
    return docs


def format_docs(docs) -> str:
    return "\n\n".join(f"[{i+1}] {d.page_content}" for i, d in enumerate(docs))


_SYSTEM_PROMPT = """\
You are DRÄXIE, a precise onboarding assistant for DRÄXLMAIER sales staff.

GROUNDING RULES
- Answer using only the information in the provided context sections.
- Cite every factual statement with its source marker [N] (e.g. [1], [2]).
- When asked for specific numbers, deadlines, names, or lists, state them directly and exactly as they appear in the context.

WHEN THE CONTEXT IS INCOMPLETE
- If the context fully answers the question, answer completely.
- If the context only partially answers it, give what the context supports, then clearly state what is missing — e.g. "The context covers X but does not specify Y."
- If the context does not answer the question at all, say so plainly and do not guess. Never fill gaps with outside knowledge or assumptions.

FORMAT
- Default to clear prose. Use a table or bullet list only when the content is genuinely a list, comparison, or set of steps — not for single facts.
- When the answer is best shown as a table, emit a fenced block with this EXACT syntax (nothing else inside the fence):
  ```ui-table
    {{"title": "optional title", "columns": ["Col A", "Col B"], "rows": [["Val 1", "Val 2"], ["Val 3", "Val 4"]]}}
  ```
  Put normal prose before and after the block. Only use it for genuine tabular data.
- [N] markers correspond to the numbered context sections provided.

LANGUAGE
- Always reply in the same language as the user's question. German question → German answer. English question → English answer.

CONVERSATION
- Use earlier messages in the conversation for context when relevant.
"""

_answer_prompt = ChatPromptTemplate.from_messages([
    ("system", _SYSTEM_PROMPT),
    MessagesPlaceholder(variable_name="history"),
    ("human", "Kontext:\n{context}\n\nFrage: {question}"),
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


@app.get("/{full_path:path}", include_in_schema=False)
async def spa_fallback(full_path: str):
    """Serve React SPA for all non-API routes."""
    return FileResponse("frontend/dist/index.html")


@app.post("/chat")
def chat(req: ChatRequest):
    docs = multi_retrieve(req.question)

    # Sources: unique filenames
    sources = list(dict.fromkeys(
        Path(d.metadata.get("source", "unknown")).name for d in docs
    ))

    # Chunks: numbered text previews + optional image URL for figure chunks
    chunks = [
        {
            "num": i + 1,
            "source": Path(d.metadata.get("source", "unknown")).name,
            "text": d.page_content[:500],
            "image_url": (
                f"/images/{Path(d.metadata['image_path']).name}"
                if d.metadata.get("chunk_type") == "figure"
                   and d.metadata.get("image_path")
                   and Path(d.metadata["image_path"]).exists()
                else None
            ),
        }
        for i, d in enumerate(docs)
    ]

    context = format_docs(docs)

    # Collect unique, existing image paths from figure chunks
    image_paths: list[str] = []
    seen_paths: set[str] = set()
    for d in docs:
        if d.metadata.get("chunk_type") == "figure":
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
            history_msgs = history_obj.messages

            # Gemma 4: images before text for optimal multimodal attention
            human_content: list[dict] = [
                {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{b}"}}
                for b in b64_images
            ] + [
                {"type": "text", "text": f"Kontext:\n{context}\n\nFrage: {req.question}"},
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
                    yield f"data: {json.dumps({'token': tok})}\n\n"

            # Persist turn to conversation history manually
            history_obj.add_user_message(req.question)
            history_obj.add_ai_message(full_answer)

        else:
            # ── Text-only path ────────────────────────────────────────────────
            full_answer = ""
            for token in _chain_with_history.stream(
                {"context": context, "question": req.question},
                config={"configurable": {"session_id": req.conversation_id}},
            ):
                full_answer += token
                yield f"data: {json.dumps({'token': token})}\n\n"

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
    rows = con.execute("""
        SELECT session_id, MIN(id) as first_id
        FROM message_store
        GROUP BY session_id
        ORDER BY first_id DESC
    """).fetchall()
    con.close()

    result = []
    for session_id, _ in rows:
        history = get_session_history(session_id)
        messages = history.messages
        title = next(
            (m.content[:80] for m in messages if isinstance(m, HumanMessage)),
            "Unbenanntes Gespräch",
        )
        result.append({
            "id": session_id,
            "title": title,
            "created_at": "",
            "message_count": len(messages),
        })
    return result


@app.get("/conversations/{conversation_id}")
def get_conversation(conversation_id: str):
    history = get_session_history(conversation_id)
    return {
        "id": conversation_id,
        "messages": [
            {"role": "user" if isinstance(m, HumanMessage) else "assistant",
             "content": m.content}
            for m in history.messages
        ],
    }


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

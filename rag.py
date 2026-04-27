"""
Dräxlmaier RAG Pipeline
========================
A multi-format Retrieval-Augmented Generation system using:
  - Docling          : document parsing (PDF, DOCX, PPTX, XLSX, …)
  - Unstructured     : cloud source connector (S3, Notion, …)
  - LangChain        : recursive text chunking
  - BGE-M3           : dense + sparse embeddings in one model
  - Qdrant           : hybrid vector store with server-side RRF fusion
  - Gemma 4 27B MoE  : query expansion · answer generation · self-verification
  - Cross-encoder    : reranking (mmarco-mMiniLMv2-L12-H384 — multilingual)

Quick start
-----------
    pipeline = RAGPipeline()
    pipeline.ingest(local_paths=["report.docx", "slides.pptx"])
    result = pipeline.query("What were the Q3 revenue figures?")
    print(result["answer"])
    print(result["sources"])
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

from langchain_core.documents import Document

import config

DATA_DIR = Path(__file__).parent / "data" / "documents"
from chunking import chunk_documents
from generation import Generator, Verifier
from ingestion import ingest as _ingest
from retrieval import Retriever
from vectorstore import QdrantStore


_NOT_FOUND_PHRASES = [
    "nicht gefunden werden",
    "could not find",
    "nicht in den bereitgestellten",
    "no information",
    "nicht vorhanden",
]


def _is_not_found(text: str) -> bool:
    t = text.lower()
    return any(p in t for p in _NOT_FOUND_PHRASES)


class RAGPipeline:
    def __init__(
        self,
        collection: str = config.QDRANT_COLLECTION,
        qdrant_url: str = config.QDRANT_URL,
    ) -> None:
        self._store = QdrantStore(collection=collection, url=qdrant_url)
        self._retriever = Retriever(store=self._store)
        self._generator = Generator()
        self._verifier = Verifier()

    # ── Ingestion ─────────────────────────────────────────────────────

    def ingest_folder(
        self,
        folder: str | Path = DATA_DIR,
        reset: bool = False,
    ) -> int:
        """Ingest all supported files found in `folder` (non-recursive)."""
        folder = Path(folder)
        supported = {".pdf", ".docx", ".pptx", ".xlsx", ".doc", ".ppt", ".xls", ".md", ".txt"}
        paths = [str(p) for p in folder.iterdir() if p.suffix.lower() in supported]
        if not paths:
            print(f"[rag] no supported files found in {folder}")
            return 0
        print(f"[rag] found {len(paths)} file(s) in {folder}")
        return self.ingest(local_paths=paths, reset=reset)

    def ingest(
        self,
        local_paths: list[str] | None = None,
        cloud_sources: list[dict[str, Any]] | None = None,
        reset: bool = False,
    ) -> int:
        """
        Parse, chunk, embed, and index documents.

        Args:
            local_paths   : Paths to local Office / PDF files.
            cloud_sources : Cloud source configs (see ingestion/fetcher.py).
            reset         : If True, wipe the collection before indexing.

        Returns:
            Number of chunks indexed.
        """
        if reset:
            print("[rag] resetting collection ...")
            self._store.delete_collection()

        documents: list[Document] = _ingest(
            local_paths=local_paths,
            cloud_sources=cloud_sources,
        )
        if not documents:
            print("[rag] no documents loaded — nothing to index")
            return 0

        chunks = chunk_documents(documents)
        self._store.index_documents(chunks)
        return len(chunks)

    # ── Query ─────────────────────────────────────────────────────────

    def query(
        self,
        question: str,
        stream: bool = False,
        skip_verify: bool = False,
    ) -> dict:
        """
        Full RAG query pipeline.

        Stages:
          1. Multi-query expansion via Gemma
          2. Hybrid retrieval (dense + sparse → RRF) for each expanded query
          3. Deduplication + cross-encoder reranking
          4. Draft answer generation via Gemma
          5. Self-verification / hallucination correction via Gemma

        Args:
            question    : The user's natural-language question.
            stream      : If True, stream the draft answer to stdout.
            skip_verify : Skip the self-verification step (faster, less safe).

        Returns:
            {
              "answer":   str,           # final verified answer
              "draft":    str,           # raw draft before verification
              "sources":  list[str],     # unique source filenames
              "chunks":   list[dict],    # raw retrieved chunks
            }
        """
        print(f"\n[rag] query: {question!r}")

        # Stage 1–3: retrieve
        chunks = self._retriever.retrieve(question)
        sources = list(
            dict.fromkeys(
                c.get("metadata", {}).get("filename", "unknown") for c in chunks
            )
        )

        # Stage 4: generate
        print("[rag] generating draft answer ...")
        draft = self._generator.generate(question, chunks, stream=stream)

        # Stage 4b: fallback widening — if LLM found nothing, retry with 3× more context
        if _is_not_found(draft):
            print("[rag] 'not found' detected — widening retrieval to top-30 and retrying ...")
            chunks = self._retriever.retrieve(question, top_k=30, prefetch_k=60)
            sources = list(
                dict.fromkeys(
                    c.get("metadata", {}).get("filename", "unknown") for c in chunks
                )
            )
            draft = self._generator.generate(question, chunks, stream=stream)

        # Stage 5: verify
        if skip_verify:
            final = draft
        else:
            print("[rag] self-verifying ...")
            final = self._verifier.verify(question, draft, chunks)

        return {
            "answer": final,
            "draft": draft,
            "sources": sources,
            "chunks": chunks,
        }


# ── CLI entry point ───────────────────────────────────────────────────

if __name__ == "__main__":
    import sys

    if len(sys.argv) < 2:
        print("Usage: python rag.py <question>")
        sys.exit(1)

    import atexit, warnings
    warnings.filterwarnings("ignore")

    question = " ".join(sys.argv[1:])
    pipeline = RAGPipeline()
    result = pipeline.query(question, stream=True)

    print("\n── Final Answer ──")
    print(result["answer"])
    print("\n── Sources ──")
    for s in result["sources"]:
        print(f"  • {s}")

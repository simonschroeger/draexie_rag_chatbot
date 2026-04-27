from __future__ import annotations

import ollama
from sentence_transformers import CrossEncoder

from config import LLM_MODEL, N_QUERIES, OLLAMA_BASE_URL, PREFETCH_K, RRF_K, TOP_K
from embedding.embedder import Embedder
from vectorstore.store import QdrantStore

_reranker: CrossEncoder | None = None


def _get_reranker() -> CrossEncoder:
    global _reranker
    if _reranker is None:
        print("[retriever] loading multilingual cross-encoder reranker ...")
        # German-aware model — significant improvement over English-only ms-marco
        _reranker = CrossEncoder("cross-encoder/mmarco-mMiniLMv2-L12-H384")
    return _reranker


_EXPAND_PROMPT = """\
Generate {n} alternative phrasings of the following search query.
Each phrasing should approach the topic from a different angle or use different terminology.
Return ONLY the queries, one per line, no numbering, no explanation.

Original query: {query}

Paraphrases:"""


class Retriever:
    """
    Full retrieval pipeline:
      1. Multi-query expansion  (Gemma via Ollama)
      2. Hybrid search per query (dense + sparse → server-side RRF via Qdrant)
      3. Deduplication across all query results
      4. Cross-encoder reranking (top-PREFETCH_K → top-TOP_K)
    """

    def __init__(self, store: QdrantStore) -> None:
        self._store = store
        self._embedder = Embedder()
        self._ollama = ollama.Client(host=OLLAMA_BASE_URL)

    # ── Query expansion ───────────────────────────────────────────────

    def expand_query(self, query: str, n: int = N_QUERIES) -> list[str]:
        prompt = _EXPAND_PROMPT.format(n=n, query=query)
        try:
            response = self._ollama.chat(
                model=LLM_MODEL,
                messages=[{"role": "user", "content": prompt}],
                options={"temperature": 0.7},
            )
            lines = response.message.content.strip().split("\n")
            paraphrases = [l.strip() for l in lines if l.strip()][:n]
        except Exception as exc:
            print(f"[retriever] query expansion failed ({exc}), using original query only")
            paraphrases = []

        queries = [query] + paraphrases
        print(f"[retriever] expanded to {len(queries)} queries")
        return queries

    # ── Per-query hybrid search ───────────────────────────────────────

    def _search_one(self, query: str, prefetch_k: int) -> list[dict]:
        emb = self._embedder.embed_query(query)
        return self._store.hybrid_search(
            query_dense=emb["dense"],
            query_sparse=emb["sparse"],
            top_k=prefetch_k,
            prefetch_k=prefetch_k,
        )

    # ── Deduplication ─────────────────────────────────────────────────

    @staticmethod
    def _deduplicate(results: list[dict]) -> list[dict]:
        seen: set[str] = set()
        unique: list[dict] = []
        for r in results:
            fp = r["text"][:120].strip()
            if fp not in seen:
                seen.add(fp)
                unique.append(r)
        return unique

    # ── Cross-encoder reranking ───────────────────────────────────────

    def _rerank(self, query: str, candidates: list[dict], top_k: int) -> list[dict]:
        reranker = _get_reranker()
        pairs = [(query, c["text"]) for c in candidates]
        scores = reranker.predict(pairs)
        ranked = sorted(zip(candidates, scores), key=lambda x: x[1], reverse=True)
        return [c for c, _ in ranked[:top_k]]

    # ── Main entry point ──────────────────────────────────────────────

    def retrieve(
        self,
        query: str,
        n_queries: int = N_QUERIES,
        top_k: int = TOP_K,
        prefetch_k: int = PREFETCH_K,
    ) -> list[dict]:
        """
        Full pipeline: expand → hybrid search → deduplicate → rerank.
        Returns top_k chunks as dicts with 'text' and 'metadata' keys.
        """
        queries = self.expand_query(query, n=n_queries)

        # Sequential — embedding is GPU-bound so threading only causes CUDA OOM
        all_results: list[dict] = []
        for q in queries:
            all_results.extend(self._search_one(q, prefetch_k))

        unique = self._deduplicate(all_results)
        print(f"[retriever] {len(all_results)} hits → {len(unique)} unique → reranking to {top_k}")

        if len(unique) <= top_k:
            return unique

        return self._rerank(query, unique, top_k)

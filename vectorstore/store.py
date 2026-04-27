from __future__ import annotations

import uuid

from langchain_core.documents import Document
from qdrant_client import QdrantClient
from qdrant_client.models import (
    Distance,
    Fusion,
    FusionQuery,
    PointStruct,
    Prefetch,
    SparseIndexParams,
    SparseVector,
    SparseVectorParams,
    VectorParams,
)

from config import DENSE_DIM, PREFETCH_K, QDRANT_COLLECTION, QDRANT_URL, TOP_K
from embedding.embedder import Embedder

# Local on-disk storage path (no Docker / server needed)
QDRANT_LOCAL_PATH = "./data/qdrant_storage"


class QdrantStore:
    """
    Qdrant-backed vector store with named dense + sparse vectors.
    Hybrid search with RRF fusion is handled server-side.

    Uses local on-disk storage by default (no Docker required).
    Set QDRANT_URL env var to point at a remote server instead.
    """

    def __init__(
        self,
        collection: str = QDRANT_COLLECTION,
        url: str = QDRANT_URL,
    ) -> None:
        self.collection = collection
        # Use local file storage unless a real server URL is configured
        if url == "http://localhost:6333":
            self.client = QdrantClient(path=QDRANT_LOCAL_PATH)
        else:
            self.client = QdrantClient(url=url)
        self._embedder = Embedder()
        self._ensure_collection()

    # ── Setup ─────────────────────────────────────────────────────────

    def _ensure_collection(self) -> None:
        existing = [c.name for c in self.client.get_collections().collections]
        if self.collection not in existing:
            self.client.create_collection(
                collection_name=self.collection,
                vectors_config={
                    "dense": VectorParams(size=DENSE_DIM, distance=Distance.COSINE)
                },
                sparse_vectors_config={
                    "sparse": SparseVectorParams(index=SparseIndexParams())
                },
            )
            print(f"[store] created collection '{self.collection}'")

    def delete_collection(self) -> None:
        self.client.delete_collection(self.collection)
        self._ensure_collection()

    # ── Indexing ──────────────────────────────────────────────────────

    def index_documents(self, documents: list[Document], batch_size: int = 64) -> None:
        """Embed and index a list of (chunked) Documents into Qdrant."""
        texts = [doc.page_content for doc in documents]
        total = len(texts)
        points: list[PointStruct] = []

        for start in range(0, total, batch_size):
            batch_texts = texts[start : start + batch_size]
            batch_docs = documents[start : start + batch_size]
            embeddings = self._embedder.embed_texts(batch_texts)

            for doc, emb in zip(batch_docs, embeddings):
                sparse = emb["sparse"]
                points.append(
                    PointStruct(
                        id=str(uuid.uuid4()),
                        vector={
                            "dense": emb["dense"],
                            "sparse": SparseVector(
                                indices=list(sparse.keys()),
                                values=list(sparse.values()),
                            ),
                        },
                        payload={
                            "text": doc.page_content,
                            **doc.metadata,
                        },
                    )
                )
            print(f"[store] embedded {min(start + batch_size, total)}/{total} chunks")

        self.client.upsert(collection_name=self.collection, points=points)
        print(f"[store] indexed {len(points)} point(s) into '{self.collection}'")

    # ── Retrieval ─────────────────────────────────────────────────────

    def hybrid_search(
        self,
        query_dense: list[float],
        query_sparse: dict[int, float],
        top_k: int = TOP_K,
        prefetch_k: int = PREFETCH_K,
    ) -> list[dict]:
        """
        Server-side hybrid search with RRF fusion.
        Qdrant fetches `prefetch_k` candidates from each index in parallel,
        then fuses them with RRF and returns the top `top_k`.
        """
        sparse_indices = list(query_sparse.keys())
        sparse_values = list(query_sparse.values())

        results = self.client.query_points(
            collection_name=self.collection,
            prefetch=[
                Prefetch(query=query_dense, using="dense", limit=prefetch_k),
                Prefetch(
                    query=SparseVector(
                        indices=sparse_indices, values=sparse_values
                    ),
                    using="sparse",
                    limit=prefetch_k,
                ),
            ],
            query=FusionQuery(fusion=Fusion.RRF),
            limit=top_k,
            with_payload=True,
        )

        return [
            {"text": p.payload["text"], "metadata": p.payload, "score": p.score}
            for p in results.points
        ]

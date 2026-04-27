from __future__ import annotations

from FlagEmbedding import BGEM3FlagModel

from config import BGE_DEVICE

# BGE-M3 in a single load — dense (1024-dim) + sparse (lexical) in one forward pass
_model: BGEM3FlagModel | None = None


def _get_model() -> BGEM3FlagModel:
    global _model
    if _model is None:
        on_cpu = BGE_DEVICE == "cpu"
        # fp16 is only useful on CUDA; use fp32 on CPU
        use_fp16 = not on_cpu
        print(f"[embedder] loading BAAI/bge-m3 on {BGE_DEVICE} ...")
        _model = BGEM3FlagModel(
            "BAAI/bge-m3",
            use_fp16=use_fp16,
            devices=[BGE_DEVICE],
        )
    return _model


class Embedder:
    """Wrapper around BGE-M3 that produces both dense and sparse vectors."""

    def __init__(self) -> None:
        self._model = _get_model()

    def embed_texts(
        self, texts: list[str], batch_size: int = 32
    ) -> list[dict]:
        """
        Returns a list of dicts, one per input text:
          {
            "dense":  list[float],          # 1024-dim cosine vector
            "sparse": dict[int, float],     # token_id → weight
          }
        """
        encoded = self._model.encode(
            texts,
            batch_size=batch_size,
            return_dense=True,
            return_sparse=True,
            return_colbert_vecs=False,
        )

        results = []
        for i in range(len(texts)):
            sparse_raw = encoded["lexical_weights"][i]
            # lexical_weights keys may be int or str — normalise to int
            sparse = {int(k): float(v) for k, v in sparse_raw.items()}
            results.append(
                {
                    "dense": encoded["dense_vecs"][i].tolist(),
                    "sparse": sparse,
                }
            )
        return results

    def embed_query(self, query: str) -> dict:
        """Single-query helper used at retrieval time."""
        return self.embed_texts([query])[0]

import os
from dotenv import load_dotenv

load_dotenv()

# ── Ollama ────────────────────────────────────────────────────────────
OLLAMA_BASE_URL: str = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
# Gemma 4 26B A4B MoE — pull with: ollama pull gemma4:26b
LLM_MODEL: str = os.getenv("LLM_MODEL", "gemma4:31b")

# ── Qdrant ────────────────────────────────────────────────────────────
QDRANT_URL: str = os.getenv("QDRANT_URL", "http://localhost:6333")
QDRANT_COLLECTION: str = os.getenv("QDRANT_COLLECTION", "draxil_rag")   
DENSE_DIM: int = 1024  # BGE-M3 dense output dimension

# ── Chunking ──────────────────────────────────────────────────────────
CHUNK_SIZE: int = int(os.getenv("CHUNK_SIZE", "512"))
CHUNK_OVERLAP: int = int(os.getenv("CHUNK_OVERLAP", "64"))

# ── Retrieval ─────────────────────────────────────────────────────────
N_QUERIES: int = int(os.getenv("N_QUERIES", "4"))    # multi-query expansion count
PREFETCH_K: int = int(os.getenv("PREFETCH_K", "30")) # candidates per query before reranking
TOP_K: int = int(os.getenv("TOP_K", "10"))            # final chunks sent to LLM
RRF_K: int = 60                                        # RRF constant

# ── Embedding device ─────────────────────────────────────────────────
# Run BGE-M3 on CPU so Ollama keeps full VRAM for the LLM.
# Change to "cuda" only if you have spare VRAM after loading gemma4:31b.
BGE_DEVICE: str = os.getenv("BGE_DEVICE", "cpu")
if BGE_DEVICE == "cpu":
    # Hide all GPUs from PyTorch before torch is imported anywhere.
    # Ollama is a separate process and is unaffected.
    os.environ.setdefault("CUDA_VISIBLE_DEVICES", "")

# ── Cloud downloads ───────────────────────────────────────────────────
DOWNLOAD_CACHE: str = os.getenv("DOWNLOAD_CACHE", "./data/cloud_cache")

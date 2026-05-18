import os
from dotenv import load_dotenv

load_dotenv()

OLLAMA_BASE_URL: str = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
LLM_MODEL: str      = os.getenv("LLM_MODEL", "gemma4:26b-a4b-it-q4_K_M")
QDRANT_PATH: str    = os.getenv("QDRANT_PATH", "./data/qdrant")
COLLECTION: str     = os.getenv("QDRANT_COLLECTION", "draxil_rag")
EMBED_DEVICE: str   = os.getenv("EMBED_DEVICE", "cuda")
TOP_K: int          = int(os.getenv("TOP_K", "6"))
CHUNK_SIZE: int          = int(os.getenv("CHUNK_SIZE", "512"))
CHUNK_OVERLAP: int       = int(os.getenv("CHUNK_OVERLAP", "64"))
IMAGE_STORE_PATH: str    = os.getenv("IMAGE_STORE_PATH", "./data/images")
VISION_TOKEN_BUDGET: int = int(os.getenv("VISION_TOKEN_BUDGET", "560"))

import os
from dotenv import load_dotenv

load_dotenv()

OLLAMA_BASE_URL: str = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")  # Sets the API address for Ollama, defaulting to the local server
LLM_MODEL: str = os.getenv("LLM_MODEL", "llama3.2:3b")  # Specifies which Large Language Model to load and use
QDRANT_PATH: str = os.getenv("QDRANT_PATH", "./data/qdrant")  # Sets the local folder path where the Qdrant vector database is saved
COLLECTION: str = os.getenv("QDRANT_COLLECTION", "draxil_rag")  # Names the specific collection (table) inside Qdrant to store vectors
EMBED_DEVICE: str = os.getenv("EMBED_DEVICE", "cuda")  # Defines the hardware used for calculating embeddings ("cuda" means Nvidia GPU)
TOP_K: int = int(os.getenv("TOP_K", "6"))  # Sets the number of top relevant document results to fetch during a search
CHUNK_SIZE: int = int(os.getenv("CHUNK_SIZE", "512"))  # Determines how big each piece of text should be when splitting documents
CHUNK_OVERLAP: int = int(os.getenv("CHUNK_OVERLAP", "64"))  # Sets how much text overlaps between chunks to prevent cutting off context
IMAGE_STORE_PATH: str = os.getenv("IMAGE_STORE_PATH", "./data/images")  # Sets the directory path where image files will be stored
VISION_TOKEN_BUDGET: int = int(os.getenv("VISION_TOKEN_BUDGET", "560"))  # Limits the number of tokens the model can spend on analyzing images
DOCS_DIR: str = os.getenv("DOCS_DIR", "./data")  # Sets the folder path containing the raw source documents to be processed
LLM_NUM_CTX: int = int(os.getenv("LLM_NUM_CTX", "4096"))  # Sets the context window (maximum token limit) the LLM can remember at one time

"""
RAG pipeline wrapper for testing.

Calls the live DRÄXIE FastAPI backend.  Set DRAXIE_BASE_URL to override the
default of http://localhost:8000.

Usage in tests:
    from rag import RAGPipeline, query_rag

    result = query_rag("What is the onboarding process?")
    print(result["answer"])

    # or with the class directly (pytest fixture pattern):
    pipeline = RAGPipeline()
    result = pipeline.query("Which customers are at risk?", skip_verify=True)
"""

import json
import os
import uuid

import httpx

BASE_URL = os.getenv("DRAXIE_BASE_URL", "http://localhost:8000")
DEFAULT_TIMEOUT = float(os.getenv("DRAXIE_TIMEOUT", "120"))


class RAGPipeline:
    def __init__(self, base_url: str = BASE_URL, timeout: float = DEFAULT_TIMEOUT):
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout

    def query(self, question: str, conversation_id: str | None = None,
              skip_verify: bool = False) -> dict:
        """
        Query the RAG pipeline.

        Args:
            question:        The user question to send.
            conversation_id: Optional session ID.  A fresh UUID is used if omitted.
            skip_verify:     Ignored — present for interface compatibility.

        Returns:
            {
                "answer":  str,          # full generated answer
                "sources": list[str],    # source filenames retrieved
                "chunks":  list[dict],   # numbered chunk excerpts
                "suggestions": list[str] # follow-up questions (may be empty)
            }

        Raises:
            httpx.ConnectError if the backend is not running.
            httpx.HTTPStatusError on non-2xx response.
        """
        conv_id = conversation_id or str(uuid.uuid4())
        answer_parts: list[str] = []
        sources: list[str] = []
        chunks: list[dict] = []
        suggestions: list[str] = []

        with httpx.Client(timeout=self.timeout) as client:
            with client.stream(
                "POST",
                f"{self.base_url}/chat",
                json={"question": question, "conversation_id": conv_id},
                headers={"Content-Type": "application/json"},
            ) as resp:
                resp.raise_for_status()
                buf = ""
                for text in resp.iter_text():
                    buf += text
                    while "\n\n" in buf:
                        event, buf = buf.split("\n\n", 1)
                        if not event.startswith("data: "):
                            continue
                        try:
                            data = json.loads(event[6:])
                        except json.JSONDecodeError:
                            continue
                        if "sources" in data:
                            sources = data["sources"]
                            chunks = data.get("chunks", [])
                        elif "token" in data:
                            answer_parts.append(data["token"])
                        elif data.get("done"):
                            suggestions = data.get("suggestions", [])

        return {
            "answer": "".join(answer_parts),
            "sources": sources,
            "chunks": chunks,
            "suggestions": suggestions,
        }


def query_rag(question: str, conversation_id: str | None = None) -> dict:
    """
    Convenience function for unittest-style tests.
    Drop-in replacement for the stub in existing test files.
    """
    return RAGPipeline().query(question, conversation_id=conversation_id)

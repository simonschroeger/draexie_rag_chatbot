from __future__ import annotations

import ollama

from config import LLM_MODEL, OLLAMA_BASE_URL

_VERIFY_PROMPT = """\
You are a fact-checker for AI-generated answers.

You will be given:
1. A user question
2. A draft answer
3. The source document chunks the answer was based on

Your task (Chain-of-Verification):
1. Identify every factual claim in the draft answer.
2. For each claim, check whether it is directly supported by the source chunks.
3. Remove or correct any claim that is NOT supported.
4. Rewrite the final answer using only verified, supported claims.
5. Keep the tone helpful and concise.

If all claims are verified, output the answer unchanged.
If no claims are verifiable, output: "I could not verify this from the provided documents."

---

## User Question
{question}

## Draft Answer
{draft}

## Source Chunks
{context}

## Verified Answer"""


class Verifier:
    """
    Uses Gemma (via Ollama) to check the draft answer against retrieved chunks
    and correct any unsupported claims (Chain-of-Verification).
    """

    def __init__(self) -> None:
        self._client = ollama.Client(host=OLLAMA_BASE_URL)

    def verify(
        self,
        query: str,
        draft: str,
        chunks: list[dict],
    ) -> str:
        context = _format_context(chunks)
        prompt = _VERIFY_PROMPT.format(
            question=query, draft=draft, context=context
        )

        response = self._client.chat(
            model=LLM_MODEL,
            messages=[{"role": "user", "content": prompt}],
            options={"temperature": 0.0},
        )
        return response.message.content.strip()


def _format_context(chunks: list[dict]) -> str:
    parts = []
    for i, chunk in enumerate(chunks, 1):
        source = chunk.get("metadata", {}).get("filename", "unknown")
        parts.append(f"[{i}] (source: {source})\n{chunk['text']}")
    return "\n\n---\n\n".join(parts)

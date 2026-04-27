from __future__ import annotations

import ollama

from config import LLM_MODEL, OLLAMA_BASE_URL

_SYSTEM_PROMPT = """\
Du bist ein präziser, dokumentenbasierter Assistent an der Hochschule Landshut.
Beantworte die Frage ausschließlich auf Basis der bereitgestellten Kontext-Abschnitte.
Zitiere bei jeder Aussage die Quelle mit [N] (z. B. [1], [2]).
Wenn die Antwort nicht im Kontext enthalten ist, schreibe genau:
"Diese Information konnte in den bereitgestellten Dokumenten nicht gefunden werden."
Antworte auf Deutsch, sofern die Frage auf Deutsch gestellt wurde.
"""

_USER_TEMPLATE = """\
## Kontext-Abschnitte

{context}

## Frage

{question}

## Antwort (mit Quellenangaben [N])"""


class Generator:
    """Generates a draft answer from retrieved context chunks using Gemma via Ollama."""

    def __init__(self) -> None:
        self._client = ollama.Client(host=OLLAMA_BASE_URL)

    def generate(
        self,
        query: str,
        chunks: list[dict],
        stream: bool = False,
    ) -> str:
        context = _format_context(chunks)
        user_msg = _USER_TEMPLATE.format(context=context, question=query)

        if stream:
            return self._stream(user_msg)

        response = self._client.chat(
            model=LLM_MODEL,
            messages=[
                {"role": "system", "content": _SYSTEM_PROMPT},
                {"role": "user", "content": user_msg},
            ],
            options={"temperature": 0.3},
        )
        return response.message.content.strip()

    def _stream(self, user_msg: str) -> str:
        full = []
        for chunk in self._client.chat(
            model=LLM_MODEL,
            messages=[
                {"role": "system", "content": _SYSTEM_PROMPT},
                {"role": "user", "content": user_msg},
            ],
            options={"temperature": 0.3},
            stream=True,
        ):
            token = chunk.message.content
            print(token, end="", flush=True)
            full.append(token)
        print()
        return "".join(full)


def _format_context(chunks: list[dict]) -> str:
    parts = []
    for i, chunk in enumerate(chunks, 1):
        meta = chunk.get("metadata", {})
        filename = meta.get("filename", "unbekannt")
        chunk_idx = meta.get("chunk_index", "")
        label = f"{filename}" + (f" · Abschnitt {chunk_idx}" if chunk_idx != "" else "")
        parts.append(f"[{i}] Quelle: {label}\n{chunk['text']}")
    return "\n\n---\n\n".join(parts)

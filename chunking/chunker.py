from langchain_core.documents import Document
from langchain_text_splitters import RecursiveCharacterTextSplitter, Language

from config import CHUNK_SIZE, CHUNK_OVERLAP

# Markdown-aware separators: headings → paragraphs → sentences → words
_MARKDOWN_SEPARATORS = [
    "\n## ", "\n### ", "\n#### ",  # heading levels
    "\n\n",                         # paragraph breaks
    "\n",                           # line breaks
    ". ",                           # sentence ends
    " ",                            # word breaks
    "",                             # character fallback
]

_splitter = RecursiveCharacterTextSplitter(
    chunk_size=CHUNK_SIZE,
    chunk_overlap=CHUNK_OVERLAP,
    separators=_MARKDOWN_SEPARATORS,
    length_function=len,
    is_separator_regex=False,
)


def chunk_documents(documents: list[Document]) -> list[Document]:
    """
    Split each Document into smaller chunks using LangChain's
    RecursiveCharacterTextSplitter with Markdown-aware separators.

    All parent metadata is preserved and a chunk_index field is added.
    """
    chunks: list[Document] = []

    for doc in documents:
        splits = _splitter.split_text(doc.page_content)
        for i, text in enumerate(splits):
            if not text.strip():
                continue
            chunks.append(
                Document(
                    page_content=text,
                    metadata={
                        **doc.metadata,
                        "chunk_index": i,
                        "total_chunks": len(splits),
                    },
                )
            )

    print(f"[chunker] {len(documents)} doc(s) → {len(chunks)} chunk(s)")
    return chunks

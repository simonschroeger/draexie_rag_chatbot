"""
Ingest documents from ./data/documents into a Qdrant hybrid vector store.
Extracts embedded images/figures from documents and stores them as PNG files
so the backend can pass them to Gemma 4's vision encoder at query time.

Usage:
    python create_database.py
"""
import math
from pathlib import Path

from docling.datamodel.base_models import DocItemLabel
from docling.datamodel.document import DoclingDocument, PictureItem
from docling.document_converter import DocumentConverter
from docling_core.transforms.chunker import HybridChunker
from langchain_core.documents import Document
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_qdrant import FastEmbedSparse, QdrantVectorStore, RetrievalMode
from langchain_text_splitters import RecursiveCharacterTextSplitter

import config

DOCS_DIR  = Path("./data/documents")
SUPPORTED = {".pdf", ".docx", ".pptx", ".xlsx", ".txt", ".md"}

# Labels that indicate a visual element whose image should be attached
_VISUAL_LABELS = {DocItemLabel.PICTURE, DocItemLabel.CHART}


def _extract_images(
    dl_doc: DoclingDocument,
    source_stem: str,
    image_store: Path,
) -> dict[str, str]:
    """
    Iterate the document, save every PictureItem as PNG, and return a mapping
    of {item.self_ref -> absolute image path string}.

    Filenames are deterministic: <source_stem>__fig<NNNN>.png so re-ingestion
    of the same document overwrites the same files.
    """
    image_store.mkdir(parents=True, exist_ok=True)
    ref_to_path: dict[str, str] = {}
    fig_idx = 0

    for item, _level in dl_doc.iterate_items():
        if isinstance(item, PictureItem):
            img = item.get_image(dl_doc)
            if img is not None:
                out_path = image_store / f"{source_stem}__fig{fig_idx:04d}.png"
                img.save(out_path, "PNG")
                ref_to_path[item.self_ref] = str(out_path)
            fig_idx += 1  # increment regardless so indices stay deterministic

    return ref_to_path


def _build_chunks(
    dl_doc: DoclingDocument,
    source_name: str,
    ref_to_path: dict[str, str],
    text_splitter: RecursiveCharacterTextSplitter,
) -> list[Document]:
    """
    Produce LangChain Document objects from a DoclingDocument.

    Strategy:
    - HybridChunker (same as DoclingLoader internally) creates semantically
      coherent chunks that preserve heading context.
    - For chunks that reference a visual doc item (PICTURE or CHART), we mark
      chunk_type='figure' and attach image_path.  The splitter is NOT applied
      to these so the caption/description text stays intact.
    - All other chunks are tagged chunk_type='text' and run through
      RecursiveCharacterTextSplitter.
    """
    chunker = HybridChunker()
    text_chunks: list[Document] = []
    figure_chunks: list[Document] = []

    for raw_chunk in chunker.chunk(dl_doc):
        text = chunker.contextualize(raw_chunk)
        if not text.strip():
            continue

        # Check whether any doc_item in this chunk is a visual element
        image_path: str | None = None
        for doc_item in raw_chunk.meta.doc_items:
            if doc_item.label in _VISUAL_LABELS:
                image_path = ref_to_path.get(doc_item.self_ref)
                if image_path:
                    break

        if image_path:
            figure_chunks.append(Document(
                page_content=text,
                metadata={
                    "source":     source_name,
                    "chunk_type": "figure",
                    "image_path": image_path,
                },
            ))
        else:
            text_chunks.append(Document(
                page_content=text,
                metadata={
                    "source":     source_name,
                    "chunk_type": "text",
                },
            ))

    # For any PictureItem that HybridChunker did not produce a chunk for
    # (e.g. images with no caption), create a minimal stub so the image is
    # still retrievable if the user mentions the figure topic.
    chunked_refs = {
        doc_item.self_ref
        for raw_chunk in chunker.chunk(dl_doc)
        for doc_item in raw_chunk.meta.doc_items
        if doc_item.label in _VISUAL_LABELS
    }
    for ref, img_path in ref_to_path.items():
        if ref not in chunked_refs:
            figure_chunks.append(Document(
                page_content=f"[Abbildung aus {source_name}]",
                metadata={
                    "source":     source_name,
                    "chunk_type": "figure",
                    "image_path": img_path,
                },
            ))

    # Apply splitter only to text chunks
    split_text = text_splitter.split_documents(text_chunks)
    for c in split_text:
        c.metadata.setdefault("chunk_type", "text")

    return split_text + figure_chunks


def main() -> None:
    paths = [p for p in DOCS_DIR.iterdir() if p.suffix.lower() in SUPPORTED]
    if not paths:
        print(f"No supported files found in {DOCS_DIR}")
        return

    image_store = Path(config.IMAGE_STORE_PATH)
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=config.CHUNK_SIZE,
        chunk_overlap=config.CHUNK_OVERLAP,
        separators=["\n## ", "\n### ", "\n\n", "\n", " ", ""],
    )
    converter = DocumentConverter()
    all_chunks: list[Document] = []

    print(f"[1/3] Parsing {len(paths)} file(s) with Docling...")
    for path in paths:
        print(f"      {path.name}")
        result  = converter.convert(str(path))
        dl_doc  = result.document
        ref_map = _extract_images(dl_doc, path.stem, image_store)
        chunks  = _build_chunks(dl_doc, path.name, ref_map, text_splitter)
        all_chunks.extend(chunks)

    text_count   = sum(1 for c in all_chunks if c.metadata["chunk_type"] == "text")
    figure_count = sum(1 for c in all_chunks if c.metadata["chunk_type"] == "figure")
    print(f"      {text_count} text chunks, {figure_count} figure chunks")
    print(f"      Images saved to {image_store}/")

    print("[2/3] Loading embedding model...")
    embeddings = HuggingFaceEmbeddings(
        model_name="BAAI/bge-m3",
        model_kwargs={"device": config.EMBED_DEVICE},
    )

    print("[3/3] Embedding and indexing into Qdrant...")
    QdrantVectorStore.from_documents(
        all_chunks,
        embedding=embeddings,
        sparse_embedding=FastEmbedSparse(model_name="Qdrant/bm25"),
        retrieval_mode=RetrievalMode.HYBRID,
        path=config.QDRANT_PATH,
        collection_name=config.COLLECTION,
        force_recreate=True,
    )
    print(f"      Done — {len(all_chunks)} total chunks in '{config.COLLECTION}'")


if __name__ == "__main__":
    main()

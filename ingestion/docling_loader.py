from pathlib import Path
from typing import Generator

from docling.document_converter import DocumentConverter
from langchain_core.documents import Document

_converter = None


def _get_converter() -> DocumentConverter:
    global _converter
    if _converter is None:
        _converter = DocumentConverter()
    return _converter


SUPPORTED_SUFFIXES = {".pdf", ".docx", ".pptx", ".xlsx", ".doc", ".ppt", ".xls", ".md", ".txt"}


def load_files(file_paths: list[str]) -> list[Document]:
    converter = _get_converter()
    documents: list[Document] = []

    for path_str in file_paths:
        path = Path(path_str)
        if not path.exists():
            print(f"[docling] skipping missing file: {path_str}")
            continue
        if path.suffix.lower() not in SUPPORTED_SUFFIXES:
            print(f"[docling] skipping unsupported format: {path.suffix}")
            continue

        print(f"[docling] parsing {path.name} ...")
        try:
            result = converter.convert(str(path))
            markdown = result.document.export_to_markdown()
            if not markdown.strip():
                continue
            documents.append(
                Document(
                    page_content=markdown,
                    metadata={
                        "source": str(path),
                        "filename": path.name,
                        "format": path.suffix.lower().lstrip("."),
                        "parser": "docling",
                    },
                )
            )
        except Exception as exc:
            print(f"[docling] failed on {path.name}: {exc}")

    return documents

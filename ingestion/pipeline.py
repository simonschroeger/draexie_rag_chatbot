from __future__ import annotations

import tempfile
from pathlib import Path
from typing import Any

from langchain_core.documents import Document

from config import DOWNLOAD_CACHE
from ingestion.docling_loader import load_files
from ingestion.fetcher import fetch_from_sources


def ingest(
    local_paths: list[str] | None = None,
    cloud_sources: list[dict[str, Any]] | None = None,
    use_cache: bool = True,
) -> list[Document]:
    """
    Master ingestion entry point.

    - local_paths  : Office / PDF files already on disk — parsed by Docling directly.
    - cloud_sources: List of source configs (see fetcher.py). Files are downloaded
                     to a cache dir then parsed by Docling for consistent output.
    - use_cache    : If True, use DOWNLOAD_CACHE (persistent). If False, use a
                     temp dir that is deleted after parsing.
    """
    local_paths = local_paths or []
    cloud_sources = cloud_sources or []

    all_file_paths: list[str] = list(local_paths)

    if cloud_sources:
        if use_cache:
            download_dir = DOWNLOAD_CACHE
            downloaded = fetch_from_sources(cloud_sources, download_dir)
            all_file_paths.extend(downloaded)
            return load_files(all_file_paths)
        else:
            with tempfile.TemporaryDirectory() as tmp_dir:
                downloaded = fetch_from_sources(cloud_sources, tmp_dir)
                all_file_paths.extend(downloaded)
                return load_files(all_file_paths)

    return load_files(all_file_paths)

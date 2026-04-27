"""
Cloud source fetcher — uses Unstructured as a download layer only.
Downloaded raw files are returned as local paths for Docling to parse.

Supported source types:
  - "s3"         : requires bucket, prefix, aws_access_key_id, aws_secret_access_key
  - "notion"     : requires api_key, page_ids (list)
  - "local"      : plain local paths (passthrough, no download needed)

Add more source types by adding an entry to _FETCHERS below.
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import Any


def fetch_from_sources(
    cloud_sources: list[dict[str, Any]],
    download_dir: str,
) -> list[str]:
    """Download raw files from cloud sources and return local paths."""
    Path(download_dir).mkdir(parents=True, exist_ok=True)
    all_paths: list[str] = []

    for source in cloud_sources:
        source_type = source.get("type", "")
        handler = _FETCHERS.get(source_type)
        if handler is None:
            print(f"[fetcher] unknown source type '{source_type}' — skipping")
            continue
        paths = handler(source, download_dir)
        print(f"[fetcher] {source_type}: downloaded {len(paths)} file(s)")
        all_paths.extend(paths)

    return all_paths


def _fetch_s3(source: dict, download_dir: str) -> list[str]:
    try:
        import boto3
    except ImportError:
        raise ImportError("Install boto3 for S3 support: uv add boto3")

    bucket = source["bucket"]
    prefix = source.get("prefix", "")
    session_kwargs: dict = {}
    if source.get("aws_access_key_id"):
        session_kwargs["aws_access_key_id"] = source["aws_access_key_id"]
        session_kwargs["aws_secret_access_key"] = source["aws_secret_access_key"]
    if source.get("region_name"):
        session_kwargs["region_name"] = source["region_name"]

    s3 = boto3.client("s3", **session_kwargs)
    paginator = s3.get_paginator("list_objects_v2")
    pages = paginator.paginate(Bucket=bucket, Prefix=prefix)

    paths: list[str] = []
    for page in pages:
        for obj in page.get("Contents", []):
            key = obj["Key"]
            local_path = Path(download_dir) / key.replace("/", "_")
            s3.download_file(bucket, key, str(local_path))
            paths.append(str(local_path))

    return paths


def _fetch_notion(source: dict, download_dir: str) -> list[str]:
    """
    Exports Notion pages to Markdown using the Notion API directly.
    Unstructured's partition_notion can also be used for richer extraction.
    """
    try:
        from unstructured.partition.notion import partition_notion
    except ImportError:
        raise ImportError("unstructured[notion] required for Notion sources")

    api_key = source["api_key"]
    page_ids: list[str] = source.get("page_ids", [])
    paths: list[str] = []

    for page_id in page_ids:
        elements = partition_notion(
            url=f"https://www.notion.so/{page_id}",
            api_key=api_key,
        )
        text = "\n\n".join(str(el) for el in elements if str(el).strip())
        local_path = Path(download_dir) / f"notion_{page_id}.md"
        local_path.write_text(text, encoding="utf-8")
        paths.append(str(local_path))

    return paths


_FETCHERS = {
    "s3": _fetch_s3,
    "notion": _fetch_notion,
}

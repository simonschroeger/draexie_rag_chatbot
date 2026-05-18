"""
Ingest documents from config.DOCS_DIR into a Qdrant hybrid vector store.

Pipeline:
  [0/3] Convert legacy office files (.xls/.doc/.ppt) into modern formats
  [1/3] Parse files with Docling in parallel (OCR disabled for speed;
        vision LLM sees the raw images at query time)
  [2/3] Load BGE-M3 embeddings (on GPU if EMBED_DEVICE=cuda)
  [3/3] Embed and index chunks into Qdrant

Usage:
    python create_database.py
"""
import io
import shutil
import subprocess
import zipfile
from concurrent.futures import ProcessPoolExecutor, as_completed
from pathlib import Path

import transformers
transformers.logging.set_verbosity_error()

import tiktoken
from docling.datamodel.base_models import DocItemLabel, InputFormat
from docling.datamodel.document import DoclingDocument, PictureItem
from docling.datamodel.pipeline_options import PdfPipelineOptions
from docling.document_converter import DocumentConverter, PdfFormatOption
from docling_core.transforms.chunker import HybridChunker
from docling_core.transforms.chunker.tokenizer.openai import OpenAITokenizer
from langchain_core.documents import Document
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_qdrant import FastEmbedSparse, QdrantVectorStore, RetrievalMode
from langchain_text_splitters import RecursiveCharacterTextSplitter

import config

try:
    import xlrd
    import openpyxl
    _HAVE_XLS = True
except ImportError:
    _HAVE_XLS = False

DOCS_DIR          = Path(config.DOCS_DIR)
CONVERTED_CACHE   = Path("./data/converted_cache")
SUPPORTED_MODERN  = {".pdf", ".docx", ".pptx", ".xlsx", ".txt", ".md"}
_VISUAL_LABELS    = {DocItemLabel.PICTURE, DocItemLabel.CHART}
_WMF_SUFFIXES     = frozenset({".wmf", ".emf"})
_OFFICE_ZIPS      = frozenset({".docx", ".pptx", ".pptm", ".ppsx", ".docm", ".xlsm"})

NUM_WORKERS = 6  # Docling parser workers; each ~2GB RAM


# ── WMF/EMF pre-conversion inside Office zips ─────────────────────────────────

# Temp dir for LibreOffice EMF conversion — must be inside home dir (snap sandbox).
_VECTOR_TMP = Path("./data/.vector_tmp").resolve()


def _rewrite_zip_with_pngs(zip_path: Path, rename_map: dict[str, str], png_data: dict[str, bytes]) -> None:
    """Replace vector entries in an Office zip with pre-rendered PNGs."""
    buf = io.BytesIO()
    with zipfile.ZipFile(zip_path, "r") as zin:
        with zipfile.ZipFile(buf, "w", compression=zipfile.ZIP_DEFLATED) as zout:
            for info in zin.infolist():
                if info.filename in rename_map:
                    continue  # replaced by PNG below
                raw = zin.read(info.filename)
                if info.filename.endswith((".xml", ".rels")):
                    text = raw.decode("utf-8", errors="replace")
                    for old, new in rename_map.items():
                        text = text.replace(Path(old).name, Path(new).name)
                    text = (text
                            .replace('ContentType="image/x-wmf"', 'ContentType="image/png"')
                            .replace('ContentType="image/x-emf"', 'ContentType="image/png"'))
                    raw = text.encode("utf-8")
                zout.writestr(info, raw)
            for new_name, data in png_data.items():
                zout.writestr(new_name, data)
    zip_path.write_bytes(buf.getvalue())


def _batch_convert_vectors_in_cache() -> int:
    """
    Convert all WMF/EMF images embedded in cached Office files to PNG.

    Strategy:
      • WMF → ImageMagick `convert` (per file, fast)
      • EMF → single LibreOffice batch call for all EMF files at once
    Returns the total number of images converted.
    """
    _VECTOR_TMP.mkdir(parents=True, exist_ok=True)

    # ── Inventory ──────────────────────────────────────────────────────────────
    # zip_path → {zip_entry_name → (suffix, raw_bytes)}
    inventory: dict[Path, dict[str, tuple[str, bytes]]] = {}

    for zip_path in CONVERTED_CACHE.iterdir():
        if zip_path.suffix.lower() not in _OFFICE_ZIPS:
            continue
        try:
            with zipfile.ZipFile(zip_path, "r") as zin:
                names = zin.namelist()
                vectors = [n for n in names if Path(n).suffix.lower() in _WMF_SUFFIXES]
                if vectors:
                    inventory[zip_path] = {
                        n: (Path(n).suffix.lower().lstrip("."), zin.read(n))
                        for n in vectors
                    }
        except Exception:
            pass

    if not inventory:
        return 0

    # ── WMF: try ImageMagick first, fall through to LibreOffice if it fails ───
    import tempfile, os
    wmf_pngs:  dict[bytes, bytes] = {}  # raw → PNG (cached by content hash)
    wmf_failed: set[bytes] = set()      # raws that ImageMagick couldn't handle

    all_wmf_raws = {
        raw
        for entries in inventory.values()
        for suffix, raw in entries.values()
        if suffix == "wmf"
    }
    for raw in all_wmf_raws:
        fd, tmp_in = tempfile.mkstemp(suffix=".wmf")
        try:
            os.write(fd, raw); os.close(fd); fd = -1
            tmp_out = tmp_in[:-4] + ".png"
            res = subprocess.run(
                ["convert", "-density", "150", "-background", "white", tmp_in, tmp_out],
                capture_output=True, timeout=30,
            )
            if res.returncode == 0 and os.path.exists(tmp_out):
                wmf_pngs[raw] = Path(tmp_out).read_bytes()
                os.unlink(tmp_out)
            else:
                wmf_failed.add(raw)  # misidentified EMF — retry via LibreOffice
        except Exception:
            wmf_failed.add(raw)
        finally:
            if fd >= 0:
                try: os.close(fd)
                except OSError: pass
            try: os.unlink(tmp_in)
            except OSError: pass

    # ── EMF + failed WMF: batch convert via single LibreOffice call ───────────
    lo_pngs: dict[bytes, bytes] = {}
    lo_batch: list[tuple[Path, bytes, str]] = []  # (tmp_file, raw, orig_suffix)

    seen_lo: set[bytes] = set()
    for entries in inventory.values():
        for suffix, raw in entries.values():
            if raw in seen_lo:
                continue
            if suffix == "emf" or (suffix == "wmf" and raw in wmf_failed):
                seen_lo.add(raw)
                # Use .emf extension for LibreOffice regardless of original suffix
                stem = f"vec_{len(lo_batch):06d}"
                tmp_f = _VECTOR_TMP / f"{stem}.emf"
                tmp_f.write_bytes(raw)
                lo_batch.append((tmp_f, raw, suffix))

    if lo_batch:
        try:
            res = subprocess.run(
                ["libreoffice", "--headless", "--convert-to", "png",
                 "--outdir", str(_VECTOR_TMP)] + [str(p) for p, _, _ in lo_batch],
                capture_output=True, timeout=300,
            )
            for tmp_f, raw, _ in lo_batch:
                out_png = tmp_f.with_suffix(".png")
                if out_png.exists() and out_png.stat().st_size > 100:
                    lo_pngs[raw] = out_png.read_bytes()
        except Exception:
            pass
        finally:
            for tmp_f, _, _ in lo_batch:
                try: tmp_f.unlink()
                except OSError: pass
            for p in _VECTOR_TMP.glob("*.png"):
                try: p.unlink()
                except OSError: pass

    # Merge: WMF (ImageMagick) + all LibreOffice results
    all_pngs = {**wmf_pngs, **lo_pngs}

    # ── Rewrite zips ──────────────────────────────────────────────────────────
    total = 0
    for zip_path, entries in inventory.items():
        rename_map: dict[str, str] = {}
        png_data:   dict[str, bytes] = {}

        for old_name, (suffix, raw) in entries.items():
            png = all_pngs.get(raw)
            if png:
                new_name = str(Path(old_name).with_suffix(".png"))
                rename_map[old_name] = new_name
                png_data[new_name]   = png

        if rename_map:
            try:
                _rewrite_zip_with_pngs(zip_path, rename_map, png_data)
                total += len(rename_map)
            except Exception as e:
                print(f"      Failed to rewrite {zip_path.name}: {e}", flush=True)

    try:
        _VECTOR_TMP.rmdir()
    except OSError:
        pass

    return total


# ── Legacy conversion ──────────────────────────────────────────────────────────

def _cache_path(src: Path, new_ext: str | None = None) -> Path:
    ext = new_ext if new_ext else src.suffix
    return CONVERTED_CACHE / f"{src.stem}{ext}"


def _convert_legacy(docs_dir: Path) -> None:
    CONVERTED_CACHE.mkdir(parents=True, exist_ok=True)

    # .xls → .xlsx
    for xls in docs_dir.rglob("*.xls"):
        out = _cache_path(xls, ".xlsx")
        if out.exists():
            continue
        if not _HAVE_XLS:
            print(f"      Skipping {xls.name}: xlrd/openpyxl not installed")
            continue
        try:
            wb_xls  = xlrd.open_workbook(xls)
            wb_xlsx = openpyxl.Workbook()
            for i in range(wb_xls.nsheets):
                sh = wb_xls.sheet_by_index(i)
                ws = wb_xlsx.active if i == 0 else wb_xlsx.create_sheet(title=sh.name)
                ws.title = sh.name
                for row in range(sh.nrows):
                    ws.append(sh.row_values(row))
            wb_xlsx.save(out)
            print(f"      Converted {xls.name} → {out.name}")
        except Exception as e:
            print(f"      Failed {xls.name}: {e}")

    # .ppt/.doc or weird macro-laden XML formats → modern clean formats via LibreOffice
    legacy_map = {
        ".ppt": ".pptx", 
        ".doc": ".docx",
        ".ppsx": ".pptx",
        ".pptm": ".pptx",
        ".docm": ".docx",
        ".xlsm": ".xlsx"
    }
    legacy_files = [
        p for p in docs_dir.rglob("*")
        if p.is_file() and p.suffix.lower() in legacy_map
    ]
    for src in legacy_files:
        target_ext = legacy_map[src.suffix.lower()]
        out = _cache_path(src, target_ext)
        if out.exists():
            continue
        try:
            result = subprocess.run(
                ["libreoffice", "--headless", "--convert-to", target_ext[1:],
                 "--outdir", str(CONVERTED_CACHE.resolve()), str(src.resolve())],
                capture_output=True, text=True, timeout=120,
            )
            if result.returncode == 0 and out.exists():
                print(f"      Converted {src.name} → {out.name}")
            else:
                print(f"      Failed {src.name}: {result.stderr.strip() or 'unknown error'}")
        except Exception as e:
            print(f"      Failed {src.name}: {e}")

    # Copy modern formats + TXT/MD straight into cache
    for src in docs_dir.rglob("*"):
        if not src.is_file():
            continue
        if src.name.startswith("~$"):  # Office temp/lock files
            continue
        if src.suffix.lower() not in SUPPORTED_MODERN:
            continue
        out = _cache_path(src)
        if out.exists():
            continue
        if src.suffix.lower() == ".txt":
            try:
                raw = src.read_bytes()
                try:
                    raw.decode("utf-8")
                    out.write_bytes(raw)
                except UnicodeDecodeError:
                    out.write_text(src.read_text(encoding="latin1"), encoding="utf-8")
                    print(f"      Re-encoded {src.name} to UTF-8")
            except Exception as e:
                print(f"      Failed {src.name}: {e}")
        else:
            try:
                shutil.copy2(src, out)
            except Exception as e:
                print(f"      Failed to cache {src.name}: {e}")


# ── Docling converter (OCR disabled for speed) ────────────────────────────────

def _make_converter() -> DocumentConverter:
    pdf_opts = PdfPipelineOptions()
    pdf_opts.do_ocr = False
    return DocumentConverter(
        format_options={
            InputFormat.PDF: PdfFormatOption(pipeline_options=pdf_opts),
        }
    )


# ── Image extraction ───────────────────────────────────────────────────────────

def _extract_images(
    dl_doc: DoclingDocument,
    source_stem: str,
    image_store: Path,
) -> dict[str, str]:
    image_store.mkdir(parents=True, exist_ok=True)
    ref_to_path: dict[str, str] = {}
    fig_idx = 0
    for item, _level in dl_doc.iterate_items():
        if isinstance(item, PictureItem):
            img = item.get_image(dl_doc)
            if img is not None:
                out_path = image_store / f"{source_stem}__fig{fig_idx:04d}.png"
                if img.mode not in ("RGB", "RGBA", "L", "LA"):
                    img = img.convert("RGBA" if "A" in img.mode else "RGB")
                img.save(out_path, "PNG")
                ref_to_path[item.self_ref] = str(out_path)
            fig_idx += 1
    return ref_to_path


# ── Chunking ───────────────────────────────────────────────────────────────────

def _build_chunks(
    dl_doc: DoclingDocument,
    source_name: str,
    ref_to_path: dict[str, str],
    text_splitter: RecursiveCharacterTextSplitter,
) -> list[Document]:
    fast_tok = OpenAITokenizer(
        tokenizer=tiktoken.encoding_for_model("gpt-3.5-turbo"),
        max_tokens=8192,
    )
    chunker = HybridChunker(tokenizer=fast_tok)

    try:
        raw_chunks = list(chunker.chunk(dl_doc))
    except Exception as e:
        print(f"        HybridChunker failed ({e}), falling back to RecursiveCharacterTextSplitter")
        raw_text  = dl_doc.export_to_markdown()
        fallback  = text_splitter.create_documents(
            [raw_text],
            metadatas=[{"source": source_name, "chunk_type": "text"}],
        )
        for img_path in ref_to_path.values():
            fallback.append(Document(
                page_content=f"[Abbildung aus {source_name}]",
                metadata={"source": source_name, "chunk_type": "figure", "image_path": img_path},
            ))
        return fallback

    text_chunks:   list[Document] = []
    figure_chunks: list[Document] = []

    for raw_chunk in raw_chunks:
        text = chunker.contextualize(raw_chunk)
        if not text.strip():
            continue

        image_path: str | None = None
        for doc_item in raw_chunk.meta.doc_items:
            if doc_item.label in _VISUAL_LABELS:
                image_path = ref_to_path.get(doc_item.self_ref)
                if image_path:
                    break

        if image_path:
            figure_chunks.append(Document(
                page_content=text,
                metadata={"source": source_name, "chunk_type": "figure", "image_path": image_path},
            ))
        else:
            text_chunks.append(Document(
                page_content=text,
                metadata={"source": source_name, "chunk_type": "text"},
            ))

    chunked_refs = {
        doc_item.self_ref
        for raw_chunk in raw_chunks
        for doc_item in raw_chunk.meta.doc_items
        if doc_item.label in _VISUAL_LABELS
    }
    for ref, img_path in ref_to_path.items():
        if ref not in chunked_refs:
            figure_chunks.append(Document(
                page_content=f"[Abbildung aus {source_name}]",
                metadata={"source": source_name, "chunk_type": "figure", "image_path": img_path},
            ))

    split_text = text_splitter.split_documents(text_chunks)
    for c in split_text:
        c.metadata.setdefault("chunk_type", "text")

    return split_text + figure_chunks


# ── Worker process ─────────────────────────────────────────────────────────────

_WORKER_CONVERTER: DocumentConverter | None = None


def _worker_init() -> None:
    """Each worker creates its own Docling converter once (reused across files)."""
    global _WORKER_CONVERTER
    _WORKER_CONVERTER = _make_converter()


def _worker_init_ocr() -> None:
    """Like _worker_init but with OCR enabled — for scanned PDFs."""
    global _WORKER_CONVERTER
    pdf_opts = PdfPipelineOptions()
    pdf_opts.do_ocr = True
    _WORKER_CONVERTER = DocumentConverter(
        format_options={
            InputFormat.PDF: PdfFormatOption(pipeline_options=pdf_opts),
        }
    )


def _process_one(
    path_str: str,
    image_store_str: str,
    chunk_size: int,
    chunk_overlap: int,
) -> tuple[str, list[dict], str | None]:
    """Parse one file in a worker; return (name, serialized_chunks, error_or_None)."""
    path = Path(path_str)
    try:
        splitter = RecursiveCharacterTextSplitter(
            chunk_size=chunk_size,
            chunk_overlap=chunk_overlap,
            separators=["\n## ", "\n### ", "\n\n", "\n", " ", ""],
        )
        assert _WORKER_CONVERTER is not None, "worker not initialized"
        result = _WORKER_CONVERTER.convert(str(path))
        dl_doc = result.document
        # include suffix in stem so figures from foo.xlsx and foo.pptx don't collide
        safe_stem = f"{path.stem}_{path.suffix.lstrip('.')}"
        ref_map = _extract_images(dl_doc, safe_stem, Path(image_store_str))
        chunks = _build_chunks(dl_doc, path.name, ref_map, splitter)
        return (
            path.name,
            [{"page_content": c.page_content, "metadata": c.metadata} for c in chunks],
            None,
        )
    except Exception as e:
        return (path.name, [], f"{type(e).__name__}: {e}")


# ── Main ───────────────────────────────────────────────────────────────────────

def main() -> None:
    print("[0/3] Converting legacy office files...")
    _convert_legacy(DOCS_DIR)

    print("[0b/3] Converting WMF/EMF images inside cached Office files...")
    wmf_total = _batch_convert_vectors_in_cache()
    if wmf_total:
        print(f"      Converted {wmf_total} WMF/EMF image(s) to PNG.")
    else:
        print("      No WMF/EMF images to convert.")

    paths = [
        p for p in CONVERTED_CACHE.rglob("*")
        if p.is_file()
        and not p.name.startswith(".")
        and not p.name.startswith("~$")
        and not p.name.endswith("~")
    ]
    if not paths:
        print(f"No files found in {CONVERTED_CACHE}")
        return

    print(f"[1/3] Parsing {len(paths)} file(s) with Docling — {NUM_WORKERS} workers, OCR off...")

    all_chunks: list[Document] = []
    zero_chunk_paths: dict[str, bool] = {}  # name → True if 0 chunks produced
    failed_files: list[str] = []

    from pebble import ProcessPool
    from concurrent.futures import TimeoutError

    with ProcessPool(max_workers=NUM_WORKERS, initializer=_worker_init) as pool:
        futures = {
            pool.schedule(
                _process_one,
                args=(
                    str(p),
                    config.IMAGE_STORE_PATH,
                    config.CHUNK_SIZE,
                    config.CHUNK_OVERLAP,
                ),
                timeout=180,
            ): p
            for p in paths
        }
        for i, future in enumerate(as_completed(futures), 1):
            p = futures[future]
            try:
                name, chunk_dicts, error = future.result()
            except TimeoutError:
                name, chunk_dicts, error = p.name, [], "TimeoutError: Document processing hung and was killed after 3 minutes"
            except Exception as e:
                name, chunk_dicts, error = p.name, [], f"Worker crash: {type(e).__name__} - {e}"

            if error:
                print(f"      [{i}/{len(paths)}] FAILED {name}: {error}", flush=True)
                failed_files.append(name)
            else:
                if len(chunk_dicts) == 0:
                    zero_chunk_paths[name] = True
                for d in chunk_dicts:
                    all_chunks.append(
                        Document(page_content=d["page_content"], metadata=d["metadata"])
                    )
                print(f"      [{i}/{len(paths)}] {name} ({len(chunk_dicts)} chunks)", flush=True)

    # Move failed files to a separate directory for manual review
    if failed_files:
        failed_dir = Path("./data/failed_files")
        failed_dir.mkdir(parents=True, exist_ok=True)
        for fname in failed_files:
            for p in paths:
                if p.name == fname:
                    try:
                        dest = failed_dir / p.name
                        p.replace(dest)
                        print(f"      Moved failed file {p.name} to {dest}")
                    except Exception as e:
                        print(f"      Could not move {p.name}: {e}")
        with open(failed_dir / "failed_files.txt", "w") as f:
            for fname in failed_files:
                f.write(fname + "\n")
        print(f"      All failed files moved to {failed_dir}/ and listed in failed_files.txt")

    text_count   = sum(1 for c in all_chunks if c.metadata["chunk_type"] == "text")
    figure_count = sum(1 for c in all_chunks if c.metadata["chunk_type"] == "figure")
    print(f"      Total: {text_count} text chunks, {figure_count} figure chunks")
    print(f"      Images saved to {config.IMAGE_STORE_PATH}/")

    # Re-run scanned PDFs with OCR (produced 0 chunks on the first pass)
    ocr_paths = [
        p for p in paths
        if p.suffix.lower() == ".pdf" and zero_chunk_paths.get(p.name)
    ]
    if ocr_paths:
        print(f"[1b/3] Re-processing {len(ocr_paths)} scanned PDF(s) with OCR enabled...")
        with ProcessPool(max_workers=max(1, NUM_WORKERS // 2), initializer=_worker_init_ocr) as pool:
            futures2 = {
                pool.schedule(
                    _process_one,
                    args=(
                        str(p),
                        config.IMAGE_STORE_PATH,
                        config.CHUNK_SIZE,
                        config.CHUNK_OVERLAP,
                    ),
                    timeout=300,
                ): p
                for p in ocr_paths
            }
            for i, future in enumerate(as_completed(futures2), 1):
                p = futures2[future]
                try:
                    name, chunk_dicts, error = future.result()
                except TimeoutError:
                    name, chunk_dicts, error = p.name, [], "TimeoutError: Document processing hung and was killed after 5 minutes"
                except Exception as e:
                    name, chunk_dicts, error = p.name, [], f"Worker crash: {type(e).__name__} - {e}"

                if error:
                    print(f"      [{i}/{len(ocr_paths)}] FAILED {name}: {error}", flush=True)
                else:
                    for d in chunk_dicts:
                        all_chunks.append(
                            Document(page_content=d["page_content"], metadata=d["metadata"])
                        )
                    print(f"      [{i}/{len(ocr_paths)}] {name} ({len(chunk_dicts)} chunks via OCR)", flush=True)

    print("[2/3] Loading embedding model...")
    embeddings = HuggingFaceEmbeddings(
        model_name="BAAI/bge-m3",
        model_kwargs={"device": config.EMBED_DEVICE},
        encode_kwargs={"batch_size": 64 if config.EMBED_DEVICE == "cuda" else 16},
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

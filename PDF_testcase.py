from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

from pypdf import PdfReader


def extract_text_from_pdf(pdf_path: Path) -> str:
    reader = PdfReader(str(pdf_path))
    text_parts = []

    for page in reader.pages:
        text = page.extract_text() or ""
        text_parts.append(text)

    return "\n".join(text_parts)


def clean_text(text: str) -> str:
    text = re.sub(r"-\s*\n\s*", "", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def split_into_sentences(text: str) -> list[str]:
    text = clean_text(text)
    sentences = re.split(r"(?<=[.!?])\s+", text)
    return [s.strip() for s in sentences if len(s.strip()) > 40]


def extract_keywords(sentence: str) -> list[str]:
    words = re.findall(r"[A-Za-zÄÖÜäöüß0-9%.-]+", sentence)

    keywords = []
    for word in words:
        word = word.strip(".,;:()[]{}").lower()

        if len(word) < 3:
            continue

        if word in {
            "der", "die", "das", "und", "oder", "mit", "von", "für",
            "zur", "zum", "ein", "eine", "einer", "eines", "ist",
            "sind", "den", "dem", "des", "auf", "bei", "als",
        }:
            continue

        if word not in keywords:
            keywords.append(word)

        if len(keywords) >= 5:
            break

    return keywords


def build_test_cases(pdf_path: Path, max_cases: int) -> list[dict]:
    text = extract_text_from_pdf(pdf_path)
    sentences = split_into_sentences(text)

    test_cases = []

    for index, sentence in enumerate(sentences[:max_cases], start=1):
        keywords = extract_keywords(sentence)

        if not keywords:
            continue

        test_cases.append(
            {
                "id": f"{pdf_path.stem}_{index}",
                "source": pdf_path.name,
                "question": f"Was steht im Dokument {pdf_path.name} zu folgendem Thema: {sentence[:120]}?",
                "expected_any": keywords,
                "excerpt": sentence,
            }
        )

    return test_cases


def find_pdfs(input_path: Path) -> list[Path]:
    if input_path.is_file() and input_path.suffix.lower() == ".pdf":
        return [input_path]

    if input_path.is_dir():
        return sorted(input_path.glob("*.pdf"))

    return []


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("input", help="PDF-Datei oder Ordner mit PDFs")
    parser.add_argument(
        "--out",
        default="pdf_test_cases.json",
        help="Ausgabedatei für Test-Cases",
    )
    parser.add_argument(
        "--max-cases-per-pdf",
        type=int,
        default=5,
        help="Maximale Anzahl Test-Cases pro PDF",
    )

    args = parser.parse_args()

    pdfs = find_pdfs(Path(args.input))

    if not pdfs:
        raise SystemExit("Keine PDF-Dateien gefunden.")

    all_cases = []

    for pdf in pdfs:
        cases = build_test_cases(pdf, args.max_cases_per_pdf)
        all_cases.extend(cases)

    output_path = Path(args.out)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    output_path.write_text(
        json.dumps(all_cases, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    print(f"{len(all_cases)} Test-Cases gespeichert in {output_path}")


if __name__ == "__main__":
    main()
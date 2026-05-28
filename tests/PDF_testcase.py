from __future__ import annotations

import argparse
import json
import re
from dataclasses import dataclass
from pathlib import Path

from pypdf import PdfReader


@dataclass(frozen=True)
class PdfTestCase:
    id: str
    source: str
    question: str
    expected_any: list[str]
    excerpt: str


STOPWORDS = {
    "aber", "alle", "als", "auch", "auf", "aus", "bei", "das", "dem", "den",
    "der", "des", "die", "ein", "eine", "einer", "eines", "für", "fuer",
    "ist", "mit", "nach", "oder", "sich", "sind", "und", "von", "zur", "zum",
}


def find_pdfs(input_path: Path) -> list[Path]:
    if input_path.is_file() and input_path.suffix.lower() == ".pdf":
        return [input_path]

    if input_path.is_dir():
        return sorted(input_path.glob("*.pdf"))

    return []


def extract_text_from_pdf(pdf_path: Path) -> str:
    reader = PdfReader(str(pdf_path))
    parts = []

    for page in reader.pages:
        text = page.extract_text() or ""
        parts.append(text)

    return "\n".join(parts)


def clean_text(text: str) -> str:
    text = re.sub(r"-\s*\n\s*", "", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def split_into_sentences(text: str) -> list[str]:
    text = clean_text(text)
    sentences = re.split(r"(?<=[.!?])\s+", text)
    return [s.strip() for s in sentences if 50 <= len(s.strip()) <= 400]


def extract_keywords(sentence: str) -> list[str]:
    keywords = []

    important_patterns = [
        r"\b\d+\s*(?:%|EUR|Euro|Tage|Wochen|Monate|Jahre)\b",
        r"\b\d{1,2}\.\d{1,2}\.\d{4}\b",
        r"\b\d{4}\b",
    ]

    for pattern in important_patterns:
        for match in re.finditer(pattern, sentence, flags=re.IGNORECASE):
            value = match.group(0).lower()
            if value not in keywords:
                keywords.append(value)

    words = re.findall(r"[A-Za-zÄÖÜäöüß0-9]+", sentence)

    for word in words:
        word = word.lower()

        if len(word) < 4:
            continue

        if word in STOPWORDS:
            continue

        if word not in keywords:
            keywords.append(word)

        if len(keywords) >= 6:
            break

    return keywords[:6]


def make_question(sentence: str, source: str) -> str:
    topic = sentence[:140].rstrip(" ,;:.")
    return f"Was steht im Dokument {source} zu folgendem Inhalt: {topic}?"


def build_cases_for_pdf(pdf_path: Path, max_cases: int) -> list[PdfTestCase]:
    text = extract_text_from_pdf(pdf_path)
    sentences = split_into_sentences(text)

    cases = []

    for index, sentence in enumerate(sentences, start=1):
        keywords = extract_keywords(sentence)

        if not keywords:
            continue

        cases.append(
            PdfTestCase(
                id=f"{pdf_path.stem}_{index}",
                source=pdf_path.name,
                question=make_question(sentence, pdf_path.name),
                expected_any=keywords,
                excerpt=sentence,
            )
        )

        if len(cases) >= max_cases:
            break

    return cases


def write_json(cases: list[PdfTestCase], output_path: Path) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)

    data = [
        {
            "id": case.id,
            "source": case.source,
            "question": case.question,
            "expected_any": case.expected_any,
            "excerpt": case.excerpt,
        }
        for case in cases
    ]

    output_path.write_text(
        json.dumps(data, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def write_pytest(cases: list[PdfTestCase], output_path: Path, min_score: int) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)

    cases_as_dicts = [
        {
            "id": case.id,
            "source": case.source,
            "question": case.question,
            "expected_any": case.expected_any,
            "excerpt": case.excerpt,
        }
        for case in cases
    ]

    cases_json = json.dumps(cases_as_dicts, ensure_ascii=False, indent=4)

    content = f'''"""
RAG Test Suite — Generated PDF Test Cases
==========================================

This file was generated from PDF documents.
It checks whether the chatbot can answer questions based on the PDFs.

Run:
    pytest {output_path} -v -s
"""

import pytest
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from rag import RAGPipeline


CASES = {cases_json}


@pytest.fixture(scope="session")
def pipeline():
    return RAGPipeline()


def _answer(pipeline, question: str) -> str:
    result = pipeline.query(question, skip_verify=True)
    return result["answer"].lower()


def _case_passed(answer: str, expected_any: list[str]) -> bool:
    return any(expected.lower() in answer for expected in expected_any)


class TestGeneratedPdfCases:

    @pytest.mark.parametrize("case", CASES, ids=lambda case: case["id"])
    def test_single_case(self, pipeline, case):
        ans = _answer(pipeline, case["question"])

        assert _case_passed(ans, case["expected_any"]), (
            f"Expected one of {{case['expected_any']}} in answer. "
            f"Source: {{case['source']}}"
        )

    def test_chatbot_score_percentage(self, pipeline):
        passed = 0
        total = len(CASES)

        for case in CASES:
            ans = _answer(pipeline, case["question"])

            if _case_passed(ans, case["expected_any"]):
                passed += 1

        score = passed / total * 100 if total else 0

        print()
        print(f"Chatbot Score: {{score:.1f}}%")
        print(f"Passed: {{passed}}/{{total}}")

        assert score >= {min_score}
'''

    output_path.write_text(content, encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("input", help="PDF-Datei oder Ordner mit PDF-Dateien")
    parser.add_argument(
        "--json-out",
        default="generated_tests/pdf_test_cases.json",
        help="JSON-Datei für die generierten Test-Cases",
    )
    parser.add_argument(
        "--pytest-out",
        default="tests/test_generated_pdf_cases.py",
        help="Python pytest-Datei, die den Chatbot testet",
    )
    parser.add_argument(
        "--max-cases-per-pdf",
        type=int,
        default=5,
        help="Maximale Test-Cases pro PDF",
    )
    parser.add_argument(
        "--min-score",
        type=int,
        default=70,
        help="Mindest-Score in Prozent, den der Chatbot erreichen muss",
    )

    args = parser.parse_args()

    pdfs = find_pdfs(Path(args.input))

    if not pdfs:
        raise SystemExit("Keine PDF-Dateien gefunden.")

    all_cases = []

    for pdf in pdfs:
        cases = build_cases_for_pdf(pdf, args.max_cases_per_pdf)
        all_cases.extend(cases)
        print(f"{pdf.name}: {len(cases)} Test-Cases erstellt")

    write_json(all_cases, Path(args.json_out))
    write_pytest(all_cases, Path(args.pytest_out), args.min_score)

    print(f"\\nJSON gespeichert: {args.json_out}")
    print(f"Pytest-Datei gespeichert: {args.pytest_out}")
    print(f"Mindest-Score: {args.min_score}%")


if __name__ == "__main__":
    main()
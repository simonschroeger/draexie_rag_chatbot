from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

from pypdf import PdfReader


NOT_FOUND_PHRASES = [
    "nicht gefunden",
    "konnte nicht",
    "keine information",
    "no information",
    "not found",
]


def read_input(path: Path) -> str:
    if path.suffix.lower() == ".pdf":
        return read_pdf(path)

    return path.read_text(encoding="utf-8")


def read_pdf(path: Path) -> str:
    reader = PdfReader(str(path))
    pages = []

    for page in reader.pages:
        pages.append(page.extract_text() or "")

    return "\n".join(pages)


def extract_questions(text: str) -> list[str]:
    text = re.sub(r"\s+", " ", text).strip()
    raw_questions = re.findall(r"[^?]+[?]", text)

    questions = []
    seen = set()

    for question in raw_questions:
        question = clean_question(question)

        if not question:
            continue

        key = question.lower()

        if key in seen:
            continue

        seen.add(key)
        questions.append(question)

    return questions


def clean_question(question: str) -> str:
    question = question.strip()
    question = re.sub(r"^\d+[\).\s-]+", "", question)
    question = re.sub(r"^[A-Za-z]\)", "", question)
    question = re.sub(r"\s+", " ", question)
    return question.strip()


def write_json(questions: list[str], output: Path) -> None:
    output.parent.mkdir(parents=True, exist_ok=True)

    cases = [
        {
            "id": f"question_{index}",
            "question": question,
        }
        for index, question in enumerate(questions, start=1)
    ]

    output.write_text(
        json.dumps(cases, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def write_pytest(questions: list[str], output: Path, min_score: int) -> None:
    output.parent.mkdir(parents=True, exist_ok=True)

    lines = [
        '"""',
        "RAG Test Suite — Generated Question Test Cases",
        "================================================",
        "Questions are extracted from an input file by splitting at each question mark.",
        "Each test queries the live RAG pipeline and checks that the chatbot returns a",
        "usable answer.",
        "",
        "Run:",
        f"    pytest {output} -v -s",
        '"""',
        "",
        "import pytest",
        "import sys",
        "import os",
        "",
        "sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))",
        "",
        "from rag import RAGPipeline",
        "",
        "",
        "# ── Shared pipeline fixture (loaded once per session) ─────────────────────────",
        "",
        '@pytest.fixture(scope="session")',
        "def pipeline():",
        "    return RAGPipeline()",
        "",
        "",
        "def _answer(pipeline, question: str) -> str:",
        "    result = pipeline.query(question, skip_verify=True)",
        '    return result["answer"].lower()',
        "",
        "",
        "def _case_passed(answer: str) -> bool:",
        "    if not answer.strip():",
        "        return False",
        f"    not_found_phrases = {json.dumps(NOT_FOUND_PHRASES, ensure_ascii=False)}",
        "    return not any(phrase in answer for phrase in not_found_phrases)",
        "",
        "",
        "# ══════════════════════════════════════════════════════════════════════════════",
        "# GROUP 1 — Generated questions",
        "# ══════════════════════════════════════════════════════════════════════════════",
        "",
        "class TestGeneratedQuestions:",
        "",
    ]

    for index, question in enumerate(questions, start=1):
        test_name = make_test_name(question, index)
        question_literal = json.dumps(question, ensure_ascii=False)
        docstring = question.replace('"""', "'")

        lines.extend(
            [
                f"    def {test_name}(self, pipeline):",
                f'        """{docstring}"""',
                f"        ans = _answer(pipeline,",
                f"            {question_literal})",
                "        assert _case_passed(ans)",
                "",
            ]
        )

    lines.extend(
        [
            "    def test_chatbot_score_percentage(self, pipeline):",
            f'        """At least {min_score}% of generated questions must return a usable answer."""',
            "        passed = 0",
            f"        total = {len(questions)}",
            "",
        ]
    )

    for question in questions:
        question_literal = json.dumps(question, ensure_ascii=False)

        lines.extend(
            [
                "        ans = _answer(pipeline,",
                f"            {question_literal})",
                "        if _case_passed(ans):",
                "            passed += 1",
                "",
            ]
        )

    lines.extend(
        [
            "        score = passed / total * 100 if total else 0",
            '        print(f"Chatbot Score: {score:.1f}%")',
            '        print(f"Passed: {passed}/{total}")',
            f"        assert score >= {min_score}",
            "",
        ]
    )

    output.write_text("\n".join(lines), encoding="utf-8")


def make_test_name(question: str, index: int) -> str:
    words = re.findall(r"[a-zA-Z0-9äöüÄÖÜß]+", question.lower())

    ignored_words = {
        "welche",
        "welcher",
        "welches",
        "warum",
        "wieso",
        "wann",
        "wird",
        "werden",
        "kann",
        "können",
        "sind",
        "eine",
        "einer",
        "eines",
    }

    useful_words = [
        word
        for word in words
        if len(word) >= 4 and word not in ignored_words
    ]

    name = "_".join(useful_words[:6]) or f"frage_{index}"
    name = re.sub(r"[^a-z0-9_]+", "_", name).strip("_")

    if not name or name[0].isdigit():
        name = f"frage_{index}_{name}"

    return f"test_{name[:70]}"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Build RAG chatbot test cases from questions ending with '?'."
    )

    parser.add_argument(
        "input",
        type=Path,
        help="Text, Markdown, or PDF file with questions.",
    )

    parser.add_argument(
        "--json-out",
        type=Path,
        default=Path("generated_tests/question_test_cases.json"),
        help="Output JSON file for extracted questions.",
    )

    parser.add_argument(
        "--pytest-out",
        type=Path,
        default=Path("tests/test_generated_questions.py"),
        help="Output pytest file.",
    )

    parser.add_argument(
        "--max-questions",
        type=int,
        default=20,
        help="Maximum number of questions to use.",
    )

    parser.add_argument(
        "--min-score",
        type=int,
        default=70,
        help="Minimum percentage of usable chatbot answers required.",
    )

    return parser.parse_args()


def main() -> None:
    args = parse_args()

    text = read_input(args.input)
    questions = extract_questions(text)[: args.max_questions]

    if not questions:
        raise SystemExit("No questions ending with '?' found.")

    write_json(questions, args.json_out)
    write_pytest(questions, args.pytest_out, args.min_score)

    print(f"Extracted questions: {len(questions)}")
    print(f"JSON written to: {args.json_out}")
    print(f"Pytest written to: {args.pytest_out}")
    print(f"Minimum score: {args.min_score}%")


if __name__ == "__main__":
    main()
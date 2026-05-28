"""
RAG Test Suite — Dräxlmaier Questions
=====================================
Questions derived from the Dräxlmaier question list.
Each test queries the live RAG pipeline and asserts that the chatbot returns a
usable answer.

Run:
    pytest tests/test_draexlmaier_questions.py -v -s
"""

import pytest
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from rag import RAGPipeline


NOT_FOUND_PHRASES = [
    "nicht gefunden",
    "konnte nicht",
    "keine information",
    "no information",
    "not found",
]


# ── Shared pipeline fixture (loaded once per session) ─────────────────────────

@pytest.fixture(scope="session")
def pipeline():
    return RAGPipeline()


def _answer(pipeline, question: str) -> str:
    result = pipeline.query(question, skip_verify=True)
    return result["answer"].lower()


def _case_passed(answer: str) -> bool:
    if not answer.strip():
        return False

    return not any(phrase in answer for phrase in NOT_FOUND_PHRASES)


# ══════════════════════════════════════════════════════════════════════════════
# GROUP 1 — Dräxlmaier knowledge questions
# ══════════════════════════════════════════════════════════════════════════════

class TestDraexlmaierKnowledgeQuestions:

    def test_ksk_definition(self, pipeline):
        """Was ist ein KSK?"""
        ans = _answer(pipeline, "Was ist ein KSK?")
        assert _case_passed(ans)

    def test_ksk_bestandteile(self, pipeline):
        """Was sind die beispielhafte Bestandteile eines KSK?"""
        ans = _answer(pipeline,
            "Was sind die beispielhafte Bestandteile eines KSK?")
        assert _case_passed(ans)

    def test_sustainability_guiding_principles(self, pipeline):
        """Was sind die Sustainability guiding Principles von Dräxelmaier?"""
        ans = _answer(pipeline,
            "Was sind die Sustainability guiding Principles von Dräxelmaier?")
        assert _case_passed(ans)

    def test_lieferprozess(self, pipeline):
        """Wie sieht der Lieferprozess aus?"""
        ans = _answer(pipeline, "Wie sieht der Lieferprozess aus?")
        assert _case_passed(ans)

    def test_vsr_bedeutung(self, pipeline):
        """Was bedeutet der Begriff VSR und wofür steht er?"""
        ans = _answer(pipeline,
            "Was bedeutet der Begriff VSR und wofür steht er?")
        assert _case_passed(ans)

    def test_cmh_standardablauf(self, pipeline):
        """Wie sieht der CMH Standardablauf?"""
        ans = _answer(pipeline, "Wie sieht der CMH Standardablauf?")
        assert _case_passed(ans)

    def test_cmh_installieren(self, pipeline):
        """Wie kann ich CMH installieren?"""
        ans = _answer(pipeline, "Wie kann ich CMH installieren?")
        assert _case_passed(ans)

    def test_member_hinzufuegen_viewset_configuration_management(self, pipeline):
        """Wie kann ich einen Member hinzufügen im ViewSet Configuration Management?"""
        ans = _answer(pipeline,
            "Wie kann ich einen Member hinzufügen im ViewSet Configuration Management?")
        assert _case_passed(ans)

    def test_fertigungskosten_berechnen(self, pipeline):
        """Wie berechne ich die Fertigungskosten?"""
        ans = _answer(pipeline, "Wie berechne ich die Fertigungskosten?")
        assert _case_passed(ans)

    def test_zuschlagskalkulation_materialeinzelkosten(self, pipeline):
        """Was ist der Kalkulationsansatz für Zuschlagskalkulation (Materialeinzelkosten)?"""
        ans = _answer(pipeline,
            "Was ist der Kalkulationsansatz für Zuschlagskalkulation (Materialeinzelkosten)?")
        assert _case_passed(ans)

    def test_ms_excel_tipps(self, pipeline):
        """Allgemeine Tipps für MS Excel?"""
        ans = _answer(pipeline, "Allgemeine Tipps für MS Excel?")
        assert _case_passed(ans)

    def test_wenn_und_oder_excel(self, pipeline):
        """Wie funktioniert WENN UND ODER in Excel?"""
        ans = _answer(pipeline, "Wie funktioniert WENN UND ODER in Excel?")
        assert _case_passed(ans)

    def test_duns_nummer(self, pipeline):
        """Was ist die DUNS-Nummer?"""
        ans = _answer(pipeline, "Was ist die DUNS-Nummer?")
        assert _case_passed(ans)

    def test_ksk_varianten_rechnerisch_moeglich(self, pipeline):
        """Wie viele Varianten eines KSKs sind rechnerisch möglich?"""
        ans = _answer(pipeline,
            "Wie viele Varianten eines KSKs sind rechnerisch möglich?")
        assert _case_passed(ans)

    def test_mitarbeiter_standort_vilsbiburg(self, pipeline):
        """Wie viele Mitarbeiter hat der Standort Vilsbiburg?"""
        ans = _answer(pipeline,
            "Wie viele Mitarbeiter hat der Standort Vilsbiburg?")
        assert _case_passed(ans)

    def test_2al_bedeutung(self, pipeline):
        """Was bedeutet 2AL?"""
        ans = _answer(pipeline, "Was bedeutet 2AL?")
        assert _case_passed(ans)

    def test_vertrieb_verbauraten(self, pipeline):
        """Aufgaben des Vertriebs in Ermittlung von Verbauraten?"""
        ans = _answer(pipeline,
            "Aufgaben des Vertriebs in Ermittlung von Verbauraten?")
        assert _case_passed(ans)

    def test_dif_definition(self, pipeline):
        """Was ist DIF?"""
        ans = _answer(pipeline, "Was ist DIF?")
        assert _case_passed(ans)

    def test_fahrzeug_nomenklatur(self, pipeline):
        """Wie funktioniert die Fahrzeug-Nomenklatur?"""
        ans = _answer(pipeline, "Wie funktioniert die Fahrzeug-Nomenklatur?")
        assert _case_passed(ans)

    def test_chatbot_score_percentage(self, pipeline):
        """At least 70% of Dräxlmaier questions must return a usable answer."""
        questions = [
            "Was ist ein KSK?",
            "Was sind die beispielhafte Bestandteile eines KSK?",
            "Was sind die Sustainability guiding Principles von Dräxelmaier?",
            "Wie sieht der Lieferprozess aus?",
            "Was bedeutet der Begriff VSR und wofür steht er?",
            "Wie sieht der CMH Standardablauf?",
            "Wie kann ich CMH installieren?",
            "Wie kann ich einen Member hinzufügen im ViewSet Configuration Management?",
            "Wie berechne ich die Fertigungskosten?",
            "Was ist der Kalkulationsansatz für Zuschlagskalkulation (Materialeinzelkosten)?",
            "Allgemeine Tipps für MS Excel?",
            "Wie funktioniert WENN UND ODER in Excel?",
            "Was ist die DUNS-Nummer?",
            "Wie viele Varianten eines KSKs sind rechnerisch möglich?",
            "Wie viele Mitarbeiter hat der Standort Vilsbiburg?",
            "Was bedeutet 2AL?",
            "Aufgaben des Vertriebs in Ermittlung von Verbauraten?",
            "Was ist DIF?",
            "Wie funktioniert die Fahrzeug-Nomenklatur?",
        ]

        passed = 0
        total = len(questions)

        for question in questions:
            ans = _answer(pipeline, question)

            if _case_passed(ans):
                passed += 1

        score = passed / total * 100 if total else 0

        print(f"Chatbot Score: {score:.1f}%")
        print(f"Passed: {passed}/{total}")

        assert score >= 70
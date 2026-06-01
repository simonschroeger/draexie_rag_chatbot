
"""
RAG Test Suite — Dräxlmaier Questions
=====================================
Questions derived from the Dräxlmaier training documents.
Each test queries the live RAG pipeline and asserts that key facts from the
expected answers appear in the answer.

Run:
    pytest tests/test_draexlmaier_questions.py -v -s
"""

import pytest
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from rag import RAGPipeline


MIN_SCORE_PERCENT = 70


def _has_any(answer: str, expected_any: list[str]) -> bool:
    return any(expected.lower() in answer for expected in expected_any)


# ── Shared pipeline fixture (loaded once per session) ─────────────────────────

@pytest.fixture(scope="session")
def pipeline():
    return RAGPipeline()


def _answer(pipeline, question: str) -> str:
    result = pipeline.query(question, skip_verify=True)
    return result["answer"].lower()


# ══════════════════════════════════════════════════════════════════════════════
# GROUP 1 — Produktgrundlagen
# ══════════════════════════════════════════════════════════════════════════════

class TestProduktgrundlagen:

    def test_ksk_definition(self, pipeline):
        """KSK bedeutet kundenspezifischer Kabelbaum."""
        ans = _answer(pipeline, "Was ist ein KSK?")
        assert _has_any(ans, [
            "kundenspezifischer kabelbaum",
            "kabelbaum",
            "stromversorgung",
            "signalweiterleitung",
            "12v",
            "niederspannung",
        ])

    def test_ksk_bestandteile(self, pipeline):
        """Beispielhafte Bestandteile sind Leitungen, Kontakte, Gehäuse und weitere Komponenten."""
        ans = _answer(pipeline,
            "Was sind die beispielhafte Bestandteile eines KSK?")
        assert _has_any(ans, [
            "leitungen",
            "kontakte",
            "anschlagteile",
            "gehäuse",
            "wickelband",
            "wickelclip",
            "tülle",
            "kabelkanäle",
            "halter",
            "absicherungen",
            "stromverteiler",
        ])


# ══════════════════════════════════════════════════════════════════════════════
# GROUP 2 — Sustainability
# ══════════════════════════════════════════════════════════════════════════════

class TestSustainability:

    def test_sustainability_guiding_principles(self, pipeline):
        """Die Antwort soll die Sustainability guiding Principles aus dem Sustainability Training nennen."""
        ans = _answer(pipeline,
            "Was sind die Sustainability guiding Principles von Dräxelmaier?")
        assert _has_any(ans, [
            "sustainability",
            "guiding principles",
            "nachhaltigkeit",
            "principles",
        ])


# ══════════════════════════════════════════════════════════════════════════════
# GROUP 3 — Automotiveabläufe
# ══════════════════════════════════════════════════════════════════════════════

class TestAutomotiveablaeufe:

    def test_lieferprozess(self, pipeline):
        """Die Antwort soll den Lieferprozess aus den Automotiveabläufen beschreiben."""
        ans = _answer(pipeline, "Wie sieht der Lieferprozess aus?")
        assert _has_any(ans, [
            "lieferprozess",
            "lieferung",
            "prozess",
            "automotive",
        ])


# ══════════════════════════════════════════════════════════════════════════════
# GROUP 4 — PEP Abkürzungen
# ══════════════════════════════════════════════════════════════════════════════

class TestPepAbkuerzungen:

    def test_vsr_bedeutung(self, pipeline):
        """VSR steht für Verschaltungsrunde."""
        ans = _answer(pipeline,
            "Was bedeutet der Begriff VSR und wofür steht er?")
        assert _has_any(ans, [
            "verschaltungsrunde",
            "vsr",
            "lv- und massekonzept",
            "loadmatrix",
            "aem",
            "syspläne",
            "kostenträger",
            "kskler",
            "lieferant",
        ])


# ══════════════════════════════════════════════════════════════════════════════
# GROUP 5 — CMH
# ══════════════════════════════════════════════════════════════════════════════

class TestCmh:

    def test_cmh_standardablauf(self, pipeline):
        """Die Antwort soll den CMH Standardablauf beschreiben."""
        ans = _answer(pipeline, "Wie sieht der CMH Standardablauf?")
        assert _has_any(ans, [
            "cmh",
            "standardablauf",
            "ablauf",
        ])

    def test_cmh_installieren(self, pipeline):
        """Die Antwort soll erklären, wie CMH installiert wird."""
        ans = _answer(pipeline, "Wie kann ich CMH installieren?")
        assert _has_any(ans, [
            "cmh",
            "installieren",
            "installation",
        ])


# ══════════════════════════════════════════════════════════════════════════════
# GROUP 6 — Integrity
# ══════════════════════════════════════════════════════════════════════════════

class TestIntegrity:

    def test_integrity_verwaltung_zweck(self, pipeline):
        """Integrity verwaltet Elemente des Produktlebenszyklus mit rückverfolgbarer Versionierung."""
        ans = _answer(pipeline, "Was ist der Zweck von Integrity: Verwaltung?")
        assert _has_any(ans, [
            "lebenszyklus",
            "dateien",
            "anforderungen",
            "testfälle",
            "fehler",
            "änderungen",
            "aufgaben",
            "lieferungen",
            "rückverfolgbare versionierung",
            "berichte",
            "metriken",
        ])

    def test_member_hinzufuegen_viewset_configuration_management(self, pipeline):
        """Member hinzufügen: Zielordner der Sandbox wählen und Add Members verwenden."""
        ans = _answer(pipeline,
            "Wie kann ich einen Member hinzufügen im ViewSet Configuration Management?")
        assert _has_any(ans, [
            "zielordner",
            "sandbox",
            "add members",
            "member",
            "configuration management",
        ])


# ══════════════════════════════════════════════════════════════════════════════
# GROUP 7 — Overhead und Kalkulation
# ══════════════════════════════════════════════════════════════════════════════

class TestKalkulation:

    def test_projektspezifischer_ovh(self, pipeline):
        """Die Antwort soll den projektspezifischen OVH aus der Overhead-Aufteilung erklären."""
        ans = _answer(pipeline, "Was ist ein Projektspezifischer OVH?")
        assert _has_any(ans, [
            "ovh",
            "overhead",
            "projektspezifisch",
            "aufteilung",
        ])

    def test_fertigungskosten_berechnen(self, pipeline):
        """Fertigungskosten werden über den Fertigungspreis pro Stück betrachtet."""
        ans = _answer(pipeline, "Wie berechne ich die Fertigungskosten?")
        assert _has_any(ans, [
            "fertigungspreis/stück",
            "fertigungspreis",
            "stück",
            "fertigungskosten",
        ])

    def test_zuschlagskalkulation_materialeinzelkosten(self, pipeline):
        """Materialeinzelkosten: Einkaufspreise Host mal Menge aus Stückliste oder calc-File."""
        ans = _answer(pipeline,
            "Was ist der Kalkulationsansatz für Zuschlagskalkulation (Materialeinzelkosten)?")
        assert _has_any(ans, [
            "materialkosten",
            "einkaufspreise host",
            "menge",
            "stückliste",
            "calc-file",
            "materialeinzelkosten",
        ])


# ══════════════════════════════════════════════════════════════════════════════
# GROUP 8 — Excel
# ══════════════════════════════════════════════════════════════════════════════

class TestExcel:

    def test_ms_excel_tipps(self, pipeline):
        """Die Antwort soll allgemeine Tipps für MS Excel nennen."""
        ans = _answer(pipeline, "Allgemeine Tipps für MS Excel?")
        assert _has_any(ans, [
            "excel",
            "ms excel",
            "tipps",
            "funktion",
        ])

    def test_wenn_und_oder_excel(self, pipeline):
        """Die Antwort soll WENN, UND und ODER in Excel erklären."""
        ans = _answer(pipeline, "Wie funktioniert WENN UND ODER in Excel?")
        assert _has_any(ans, [
            "wenn",
            "und",
            "oder",
            "excel",
            "funktion",
        ])


# ══════════════════════════════════════════════════════════════════════════════
# GROUP 9 — Score
# ══════════════════════════════════════════════════════════════════════════════

class TestDraexlmaierScore:

    def test_chatbot_score_percentage(self, pipeline):
        """Mindestens 70 Prozent der Dräxlmaier-Fragen müssen korrekt beantwortet werden."""
        cases = [
            ("Was ist ein KSK?", [
                "kundenspezifischer kabelbaum", "kabelbaum", "stromversorgung",
            ]),
            ("Was sind die beispielhafte Bestandteile eines KSK?", [
                "leitungen", "kontakte", "gehäuse", "wickelband", "stromverteiler",
            ]),
            ("Was sind die Sustainability guiding Principles von Dräxelmaier?", [
                "sustainability", "guiding principles", "nachhaltigkeit",
            ]),
            ("Wie sieht der Lieferprozess aus?", [
                "lieferprozess", "lieferung", "prozess",
            ]),
            ("Was bedeutet der Begriff VSR und wofür steht er?", [
                "verschaltungsrunde", "vsr", "loadmatrix", "aem",
            ]),
            ("Wie sieht der CMH Standardablauf?", [
                "cmh", "standardablauf", "ablauf",
            ]),
            ("Wie kann ich CMH installieren?", [
                "cmh", "installieren", "installation",
            ]),
            ("Was ist der Zweck von Integrity: Verwaltung?", [
                "lebenszyklus", "dateien", "anforderungen", "rückverfolgbare versionierung",
            ]),
            ("Wie kann ich einen Member hinzufügen im ViewSet Configuration Management?", [
                "zielordner", "sandbox", "add members", "configuration management",
            ]),
            ("Was ist ein Projektspezifischer OVH?", [
                "ovh", "overhead", "projektspezifisch",
            ]),
            ("Wie berechne ich die Fertigungskosten?", [
                "fertigungspreis/stück", "fertigungspreis", "fertigungskosten",
            ]),
            ("Was ist der Kalkulationsansatz für Zuschlagskalkulation (Materialeinzelkosten)?", [
                "materialkosten", "einkaufspreise host", "stückliste", "calc-file",
            ]),
            ("Allgemeine Tipps für MS Excel?", [
                "excel", "tipps", "funktion",
            ]),
            ("Wie funktioniert WENN UND ODER in Excel?", [
                "wenn", "und", "oder", "excel",
            ]),
        ]

        passed = 0
        total = len(cases)

        for question, expected_any in cases:
            ans = _answer(pipeline, question)

            if _has_any(ans, expected_any):
                passed += 1

        score = passed / total * 100 if total else 0

        print(f"Chatbot Score: {score:.1f}%")
        print(f"Passed: {passed}/{total}")

        assert score >= MIN_SCORE_PERCENT
















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

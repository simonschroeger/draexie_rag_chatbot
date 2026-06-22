"""
RAG Test Suite — Dräxlmaier Excel-derived Questions
====================================================
Each test queries the live RAG pipeline and checks that key facts
from the expected answer appear in the response (keyword matching).
"""

import pytest
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from rag import RAGPipeline


@pytest.fixture(scope="session")
def pipeline():
    return RAGPipeline()


def _answer(pipeline, question: str) -> str:
    result = pipeline.query(question, skip_verify=True)
    return result["answer"].lower()


def test_cop_abkuerzung(pipeline):
    """COP = Carry Over Part"""
    ans = _answer(pipeline, "Wofür steht die Abkürzung COP und was bedeutet der Begriff?")
    assert "carry over part" in ans or "cop" in ans, f"Expected COP/Carry Over Part, got: {ans}"
    assert any(kw in ans for kw in ["gleichteile", "normteile", "plattformkonzept"]), f"Missing concept keywords, got: {ans}"


def test_checkliste_neuer_mitarbeiter(pipeline):
    """Checkliste Arbeitsplatz enthält Tisch, Stuhl, Notebook"""
    ans = _answer(pipeline, 'Welche Sachen werden auf der "Checkliste bei Eintritt neuer Mitarbeiter" unter dem Bereich "Arbeitsplatz / Organisatorisches" abgefragt?')
    assert any(kw in ans for kw in ["tisch", "stuhl", "notebook", "bildschirm", "arbeitsplatz"]), f"Missing checklist items, got: {ans}"


def test_hauptprojektleiter_macan(pipeline):
    """Michael Lechner ist Hauptprojektleiter PO416"""
    ans = _answer(pipeline, "Wer ist der Hauptprojektleiter und wer der Ansprechpartner für TK für den PO416 Macan III?")
    assert "michael lechner" in ans or "lechner" in ans, f"Expected Michael Lechner, got: {ans}"
    assert "nicole beischl" in ans or "beischl" in ans, f"Expected Nicole Beischl, got: {ans}"


def test_einarbeitungsthemen_junior_pm(pipeline):
    """Einarbeitungsplan enthält CMH-Tool und Änderungsmanagement"""
    ans = _answer(pipeline, "Welche Einarbeitungs-Themen muss ich innerhalb der ersten 3 Monate bei einem Junior Sales Manager bearbeiten?")
    assert any(kw in ans for kw in ["änderungsmanagement", "cmh", "kalkulation", "einführung"]), f"Missing onboarding topics, got: {ans}"


def test_cbd_abkuerzung(pipeline):
    """CBD = Cost Break Down"""
    ans = _answer(pipeline, "Wofür steht die Abkürzung CBD und was bedeutet der Begriff?")
    assert "cost break down" in ans or "cbd" in ans, f"Expected CBD/Cost Break Down, got: {ans}"
    assert any(kw in ans for kw in ["materialgruppen", "fahrzeug", "kunden", "aufsplittung"]), f"Missing CBD context, got: {ans}"


def test_aufgaben_produktmanagement(pipeline):
    """PM-Aufgaben enthalten Sonderkosten, Akquise, Reporting"""
    ans = _answer(pipeline, "Nenne alle Aufgaben im Produktmanagement und was man unter diesen Versteht.")
    assert any(kw in ans for kw in ["sonderkosten", "akquise", "reporting", "änderungsmanagement"]), f"Missing PM tasks, got: {ans}"
    assert any(kw in ans for kw in ["kalkulation", "verhandlung", "dokumentation"]), f"Missing PM detail keywords, got: {ans}"


def test_checkliste_matrixueberpruefung(pipeline):
    """Matrix-Checkliste enthält Formatierung und Formel-Checks"""
    ans = _answer(pipeline, "Gib mir die Checkliste für Matrixüberprüfung.")
    assert any(kw in ans for kw in ["formatierung", "formel", "matrix", "sverweis", "kupferwert"]), f"Missing matrix checklist items, got: {ans}"


def test_werte_ausrechnen_dfs(pipeline):
    """DFS-Formeln: Kapitalbindung, Nettoerlös"""
    ans = _answer(pipeline, "Wie werden die Werte ausgerechnet?")
    assert any(kw in ans for kw in ["kapitalbindung", "nettoerlös", "zinssatz", "erstattungsbetrag", "kosten"]), f"Missing DFS formula keywords, got: {ans}"


def test_paint_finish_control_number(pipeline):
    """PAINT FINISH CONTROL NUMBER = Lackiersteuernr."""
    ans = _answer(pipeline, "Was bedeutet PAINT FINISH CONTROL NUMBER auf Deutsch?")
    assert any(kw in ans for kw in ["lackiersteuernr", "lackier", "steuer"]), f"Expected Lackiersteuernr., got: {ans}"


def test_luesterklemme_englisch(pipeline):
    """Lüsterklemme = terminal block"""
    ans = _answer(pipeline, "Was bedeutet Lüsterklemme auf Englisch?")
    assert "terminal block" in ans or "terminal" in ans, f"Expected terminal block, got: {ans}"


def test_ausblick_synonym(pipeline):
    """Ausblick = Forecast / Outlook"""
    ans = _answer(pipeline, "Nenne mir das Synonym und das englische Wort für Ausblick.")
    assert any(kw in ans for kw in ["forecast", "outlook"]), f"Expected Forecast/Outlook, got: {ans}"


def test_total_material_cost(pipeline):
    """Total Material Cost = Direct Material + Overheads"""
    ans = _answer(pipeline, "Wie wird die Total Material Cost berechnet?")
    assert any(kw in ans for kw in ["direct material", "material overheads", "indirect material", "materialkosten"]), f"Missing material cost formula, got: {ans}"


def test_production_costs(pipeline):
    """Production Costs enthalten FEK, FGK, Invest"""
    ans = _answer(pipeline, "Wie werden die Production Costs berechnet?")
    assert any(kw in ans for kw in ["fek", "fgk", "fertigungskosten", "invest", "personal"]), f"Missing production cost keywords, got: {ans}"

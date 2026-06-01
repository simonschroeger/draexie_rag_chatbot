"""
Auto-generated RAG pipeline tests derived from PPT_Antworten.docx.

7 questions were skipped because their answers are "Verweis auf Präsentation"
(no ground-truth text to assert against) or marked as veraltet (outdated).

Usage:
    pytest test_rag_ppt_antworten.py -v
"""

import pytest
from rag import RAGPipeline


@pytest.fixture(scope="session")
def pipeline():
    return RAGPipeline()


def _answer(pipeline, question: str) -> str:
    result = pipeline.query(question, skip_verify=True)
    return result["answer"].lower()



def test_aufgaben_technischer_kalkulator(pipeline):
    """Was sind die Aufgaben eines Technischen Kalkulators?"""
    answer = _answer(pipeline, "Was sind die Aufgaben eines Technischen Kalkulators?")
    assert "kalkulation" in answer, f"Expected 'kalkulation' in answer, got: {answer}"
    assert any(kw in answer for kw in ["preisgestaltung", "stückliste", "arbeitsvorbereitung"]), (
        f"Expected pricing/BOM/production keywords, got: {answer}"
    )


def test_aufgaben_technischer_vorklaerer(pipeline):
    """Was sind die Aufgaben eines technischen Vorklärers?"""
    answer = _answer(pipeline, "Was sind die Aufgaben eines technischen Vorklärers?")
    assert any(kw in answer for kw in ["terminplan", "terminplanung", "anlaufblöcke", "prämissen"]), (
        f"Expected planning/milestone keywords, got: {answer}"
    )

def test_was_sind_fek(pipeline):
    """Was sind FEK?"""
    answer = _answer(pipeline, "Was sind FEK?")
    assert "fertigungseinzelkosten" in answer, (
        f"Expected 'fertigungseinzelkosten' in answer, got: {answer}"
    )
    assert any(kw in answer for kw in ["kostenträger", "zugeordnet", "direkt"]), (
        f"Expected direct cost attribution keywords, got: {answer}"
    )


def test_materialeinzelkosten_vs_materialgemeinkosten(pipeline):
    """Was unterscheidet Materialeinzelkosten und Materialgemeinkosten?"""
    answer = _answer(pipeline, "Was unterscheidet Materialeinzelkosten und Materialgemeinkosten?")
    assert "materialeinzelkosten" in answer, f"Expected 'materialeinzelkosten', got: {answer}"
    assert "materialgemeinkosten" in answer, f"Expected 'materialgemeinkosten', got: {answer}"
    assert any(kw in answer for kw in ["zuschlag", "materialpreis", "einzelmaterial"]), (
        f"Expected cost calculation keywords, got: {answer}"
    )


def test_materialgemeinkosten_definition(pipeline):
    """Was sind Materialgemeinkosten?"""
    answer = _answer(pipeline, "Was sind Materialgemeinkosten?")
    assert "materialgemeinkosten" in answer, f"Expected 'materialgemeinkosten', got: {answer}"
    assert any(kw in answer for kw in ["gemeinkosten", "lagerung", "annahme", "versicherung"]), (
        f"Expected storage/handling keywords, got: {answer}"
    )


def test_materialkosten_formel(pipeline):
    """Wie berechne ich Materialkosten?"""
    answer = _answer(pipeline, "Wie berechne ich Materialkosten?")
    assert any(kw in answer for kw in ["mek", "metallgewicht", "metallnotierung", "mgk", "ausschuss"]), (
        f"Expected formula keywords (MEK, Metallgewicht, MGK), got: {answer}"
    )


def test_einstandspreis_verhandlung(pipeline):
    """Von wem wird der Einstandspreis verhandelt?"""
    answer = _answer(pipeline, "Von wem wird der Einstandspreis verhandelt?")
    assert any(kw in answer for kw in ["zentraleinkauf", "einkauf", "mm"]), (
        f"Expected purchasing department keywords, got: {answer}"
    )
    assert any(kw in answer for kw in ["lieferant", "tier ii", "tier"]), (
        f"Expected supplier keywords, got: {answer}"
    )


def test_glaeubigervsschuldner(pipeline):
    """Was ist der Unterschied zwischen einem Gläubiger und einem Schuldner?"""
    answer = _answer(pipeline, "Was ist der Unterschied zwischen einem Gläubiger und einem Schuldner?")
    assert "gläubiger" in answer, f"Expected 'gläubiger', got: {answer}"
    assert "schuldner" in answer, f"Expected 'schuldner', got: {answer}"
    assert any(kw in answer for kw in ["anspruch", "verpflichtet", "inhaber"]), (
        f"Expected legal obligation keywords, got: {answer}"
    )


def test_lifetime_definition(pipeline):
    """Was bedeutet Lifetime?"""
    answer = _answer(pipeline, "Was bedeutet Lifetime?")
    assert any(kw in answer for kw in ["reduzierung", "a-preis", "preis", "kundenteilenummer"]), (
        f"Expected price reduction / part number keywords, got: {answer}"
    )

def test_bestandteile_angebot(pipeline):
    """Was sind die Bestandteile eines Angebots?"""
    answer = _answer(pipeline, "Was sind sie Bestandteile eines Angebots?")
    assert any(kw in answer for kw in ["angebotsschreiben", "pflichtenheft", "anschreiben"]), (
        f"Expected cover letter keywords, got: {answer}"
    )
    assert any(kw in answer for kw in ["teilenummer", "preis", "einpreisung", "kalkmodell"]), (
        f"Expected pricing/part keywords, got: {answer}"
    )
    assert any(kw in answer for kw in ["cbd", "cost break down", "logistikkosten"]), (
        f"Expected cost breakdown keywords, got: {answer}"
    )


def test_incoterms(pipeline):
    """Was sind Incoterms?"""
    answer = _answer(pipeline, "Was sind Incoterms?")
    assert any(kw in answer for kw in ["lieferbedingung", "lieferbedingungen"]), (
        f"Expected 'Lieferbedingungen', got: {answer}"
    )


def test_verbauraten_bestimmung(pipeline):
    """Wie bestimme ich Verbauraten?"""
    answer = _answer(pipeline, "Wie bestimme ich Verbauraten?")
    assert any(kw in answer for kw in ["gelieferte module", "lieferabrufe", "lab", "verbaurate"]), (
        f"Expected delivery/module keywords, got: {answer}"
    )

def test_systempartner(pipeline):
    """Welche Systempartner hat die Dräxlmaier Group?"""
    answer = _answer(pipeline, "Welche Systempartner hat die Dräxlmaier Group?")
    assert any(kw in answer for kw in ["elektronik", "bordnetz", "interieur", "high level assembly"]), (
        f"Expected Dräxlmaier business unit keywords, got: {answer}"
    )


def test_hauptwettbewerber(pipeline):
    """Was sind die Dräxlmaier Hauptwettbewerber?"""
    answer = _answer(pipeline, "Was sind die Dräxlmaier Hauptwettbewerber?")
    assert any(kw in answer for kw in ["yazaki", "lear", "delphi", "nexans", "kromberg", "fujikura"]), (
        f"Expected competitor names, got: {answer}"
    )


def test_integrity_konzept(pipeline):
    """Stelle mir das Konzept von Integrity dar."""
    answer = _answer(pipeline, "Stelle mir das Konzept von Integrity dar")
    assert any(kw in answer for kw in ["server", "datenbank", "client", "browser"]), (
        f"Expected server/client architecture keywords, got: {answer}"
    )


def test_stückliste_aufbau(pipeline):
    """Was muss ich zum Aufbau einer Stückliste wissen?"""
    answer = _answer(pipeline, "Was muss ich zum Aufbau einer Stückliste wissen?")
    assert any(kw in answer for kw in ["fertigungsstückliste", "stückliste", "konstruktions"]), (
        f"Expected BOM type keywords, got: {answer}"
    )
    assert any(kw in answer for kw in ["fertigungsbereich", "arbeitsschritt", "fertigungsfortschritt"]), (
        f"Expected manufacturing step keywords, got: {answer}"
    )


def test_cajun_po416_rahmendaten(pipeline):
    """Was sind die Rahmendaten vom Cajun PO416?"""
    answer = _answer(pipeline, "Was sind die Rahmendaten vom Cajun PO416?")
    assert any(kw in answer for kw in ["ksk", "leitungssatz", "handschuhkasten"]), (
        f"Expected harness/product keywords, got: {answer}"
    )
    assert any(kw in answer for kw in ["55.000", "55000", "202 mio", "sop"]), (
        f"Expected volume/revenue/SOP data, got: {answer}"
    )


def test_verschrottung_physisch(pipeline):
    """Wie funktioniert die Verschrottung physisch intern?"""
    answer = _answer(pipeline, "Wie funktioniert die Verschrottung physisch intern?")
    assert any(kw in answer for kw in ["kupfer", "verschrottung", "modul", "abgeholt"]), (
        f"Expected scrap process keywords, got: {answer}"
    )

def test_dpm_definition(pipeline):
    """Was ist DPM?"""
    answer = _answer(pipeline, "Was ist DPM?")
    assert any(kw in answer for kw in ["dräxlmaier process management", "prozess management", "dpm"]), (
        f"Expected DPM long form or process management, got: {answer}"
    )
    assert any(kw in answer for kw in ["prozess", "standardisierung", "qualität"]), (
        f"Expected process/standardization keywords, got: {answer}"
    )


def test_vorteile_prozessorientierung(pipeline):
    """Was sind die Vorteile einer Prozessorientierung?"""
    answer = _answer(pipeline, "Was sind die Vorteile einer Prozessorientierung?")
    assert any(kw in answer for kw in ["kunde", "kunden", "ausrichtung"]), (
        f"Expected customer orientation keywords, got: {answer}"
    )
    assert any(kw in answer for kw in ["durchlaufzeit", "abstimmung", "rückfragen"]), (
        f"Expected throughput/coordination keywords, got: {answer}"
    )


def test_durchschnittsfahrzeug(pipeline):
    """Was ist ein Durchschnittsfahrzeug?"""
    answer = _answer(pipeline, "Was ist ein Durchschnittsfahrzeug?")
    assert any(kw in answer for kw in ["durchschnitt", "mittelwert", "gewichtet"]), (
        f"Expected average/weighted mean keywords, got: {answer}"
    )
    assert any(kw in answer for kw in ["material", "umsatz", "minuten"]), (
        f"Expected value dimension keywords, got: {answer}"
    )


def test_fmea_definition(pipeline):
    """Was ist eine FMEA?"""
    answer = _answer(pipeline, "Was ist eine FMEA?")
    assert any(kw in answer for kw in [
        "fehler-möglichkeits", "fehler möglichkeits", "fehleranalyse",
        "failure mode", "fmea"
    ]), f"Expected FMEA long form, got: {answer}"
    assert any(kw in answer for kw in ["entwicklung", "vermeiden", "fehler"]), (
        f"Expected defect prevention keywords, got: {answer}"
    )


def test_olap_definition(pipeline):
    """Was ist OLAP?"""
    answer = _answer(pipeline, "Was ist OLAP?")
    assert any(kw in answer for kw in [
        "online analytical processing", "olap", "analytisch", "multidimensional"
    ]), f"Expected OLAP expansion or analytical keywords, got: {answer}"


def test_logistik_bestandteile(pipeline):
    """Was gehört alles zur Logistik?"""
    answer = _answer(pipeline, "Was gehört alles zur Logistik?")
    assert any(kw in answer for kw in ["materialfluss", "planung", "steuerung", "informationsfluss"]), (
        f"Expected logistics process keywords, got: {answer}"
    )


def test_cdtl_definition(pipeline):
    """Was ist eine CDTL?"""
    answer = _answer(pipeline, "Was ist eine CDTL?")
    assert any(kw in answer for kw in ["werkzeug", "operativ", "strategisch"]), (
        f"Expected 'operatives und strategisches Werkzeug', got: {answer}"
    )


def test_übermodul_bestandteile(pipeline):
    """Was beinhaltet ein Übermodul?"""
    answer = _answer(pipeline, "Was beinhaltet ein Übermodul?")
    assert any(kw in answer for kw in ["basismodul", "funktionsmodul", "lowcost"]), (
        f"Expected module composition keywords, got: {answer}"
    )


def test_fast_close(pipeline):
    """Was ist ein Fast Close?"""
    answer = _answer(pipeline, "Was ist ein Fast Close?")
    assert any(kw in answer for kw in ["monatsabschluss", "abschluss", "vorgezogen"]), (
        f"Expected 'vorgezogener Monatsabschluss', got: {answer}"
    )


def test_int_bedeutung(pipeline):
    """Was bedeutet 'Int'?"""
    answer = _answer(pipeline, "Was bedeutet 'Int'?")
    assert "interieur" in answer, f"Expected 'interieur', got: {answer}"
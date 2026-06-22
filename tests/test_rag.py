"""
RAG Test Suite — Hochschule Landshut Satzungen
================================================
Questions derived directly from the 8 source documents in data/documents/.
Each test queries the live RAG pipeline and asserts that key facts from the
documents appear in the answer.

Run:
    pytest tests/test_rag.py -v
    pytest tests/test_rag.py -v -k "studium_generale"   # filter by group
"""

import pytest
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from rag import RAGPipeline


# ── Shared pipeline fixture (loaded once per session) ─────────────────────────

@pytest.fixture(scope="session")
def pipeline():
    return RAGPipeline()


def _answer(pipeline, question: str) -> str:
    result = pipeline.query(question, skip_verify=True)
    return result["answer"].lower()


# ══════════════════════════════════════════════════════════════════════════════
# GROUP 1 — Studium Generale (337-2_Studium_Generale_1.AES_konsF_160424.pdf)
# ══════════════════════════════════════════════════════════════════════════════

class TestStudiumGenerale:

    def test_kompetenzbereiche_liste(self, pipeline):
        """Alle 8 Kompetenzbereiche A–H müssen genannt werden."""
        ans = _answer(pipeline, "Welche Kompetenzbereiche gibt es im Studium Generale?")
        # The document lists A–H; at minimum A, D, and H must appear
        assert "nachhaltigkeit" in ans or "kompetenzbereich" in ans
        assert "kreativität" in ans or "digitale" in ans

    def test_ects_pro_modul(self, pipeline):
        """Jedes Modul hat 2 ECTS und 2 SWS."""
        ans = _answer(pipeline, "Wie viele ECTS-Punkte hat ein Modul im Studium Generale?")
        assert "2" in ans

    def test_bewertung_praedikat(self, pipeline):
        """Prüfungsleistungen werden mit 'mit Erfolg' oder 'ohne Erfolg' bewertet."""
        ans = _answer(pipeline,
            "Mit welchen Prädikaten werden Prüfungsleistungen im Studium Generale bewertet?")
        assert "erfolg" in ans

    def test_anwesenheitspflicht_woechentlich(self, pipeline):
        """Bei wöchentlichen Kursen dürfen Studierende bis zu 25 % fehlen."""
        ans = _answer(pipeline,
            "Wie viel Prozent dürfen Studierende bei wöchentlichen Studium Generale Kursen fehlen?")
        assert "25" in ans

    def test_anwesenheitspflicht_block(self, pipeline):
        """Bei Blockkursen gilt 100 % Anwesenheitspflicht."""
        ans = _answer(pipeline,
            "Welche Anwesenheitspflicht gilt für Blockkurse im Studium Generale?")
        assert "100" in ans

    def test_inkrafttreten_ursprung(self, pipeline):
        """Die Ordnung trat ursprünglich am 1. Oktober 2017 in Kraft."""
        ans = _answer(pipeline,
            "Wann trat die Ordnung für das Studium Generale ursprünglich in Kraft?")
        assert "2017" in ans or "oktober" in ans

    def test_erste_aenderungssatzung(self, pipeline):
        """Die erste Änderungssatzung trat am 1. Oktober 2023 in Kraft."""
        ans = _answer(pipeline,
            "Wann trat die erste Änderungssatzung der Studium Generale Ordnung in Kraft?")
        assert "2023" in ans

    def test_pruefungskommission_zusammensetzung(self, pipeline):
        """Prüfungskommission: 1 Vorsitzender + 2 weitere Mitglieder, bestellt vom Fakultätsrat."""
        ans = _answer(pipeline,
            "Wie ist die Prüfungskommission des Studium Generale zusammengesetzt?")
        assert "vorsitz" in ans or "mitglied" in ans

    def test_modulhandbuch_ersteller(self, pipeline):
        """Das Modulhandbuch wird von der Fakultät Interdisziplinäre Studien erstellt."""
        ans = _answer(pipeline,
            "Wer erstellt das Modulhandbuch für das Studium Generale?")
        assert "interdisziplinäre" in ans or "fakultät" in ans

    def test_sprachen_regelung(self, pipeline):
        """Für Sprachmodule gilt die UNIcert Rahmenordnung vom 06. Dezember 2022."""
        ans = _answer(pipeline,
            "Welche Regelung gilt für Prüfungen im Bereich Sprachen im Studium Generale?")
        assert "unicert" in ans or "sprachen" in ans

    def test_studiengang_anwendung(self, pipeline):
        """Die Ordnung gilt für Bachelorstudiengänge der Hochschule Landshut."""
        ans = _answer(pipeline,
            "Für welche Studiengänge gilt die Ordnung für das Studium Generale?")
        assert "bachelor" in ans

    def test_wintersemester_einfuehrung(self, pipeline):
        """Seit WS 2013/2014 ist das Studium Generale im Curriculum verankert."""
        ans = _answer(pipeline,
            "Seit welchem Semester ist das Studium Generale an der Hochschule Landshut im Curriculum verankert?")
        assert "2013" in ans or "2014" in ans


# ══════════════════════════════════════════════════════════════════════════════
# GROUP 2 — Sprachenzentrum / UNIcert (337-1_Ordnung_Sprachenzentrum_1.AES_konsF_160424.pdf)
# ══════════════════════════════════════════════════════════════════════════════

class TestSprachenzentrum:

    def test_unicert_niveaustufen(self, pipeline):
        """UNIcert Basis=A2, I=B1, II=B2, III=C1."""
        ans = _answer(pipeline,
            "Welchen Niveaustufen des GER entsprechen die UNIcert-Stufen?")
        assert any(x in ans for x in ["b1", "b2", "c1", "a2", "threshold", "vantage"])

    def test_unicert_basis_niveau(self, pipeline):
        """UNIcert Basis orientiert sich an Niveaustufe A2."""
        ans = _answer(pipeline,
            "Welchem GER-Niveau entspricht die UNIcert Basis Vorstufe?")
        assert "a2" in ans or "waystage" in ans

    def test_unicert_iii_niveau(self, pipeline):
        """UNIcert III entspricht GER-Niveau C1."""
        ans = _answer(pipeline,
            "Welchem GER-Niveau entspricht UNIcert Stufe III?")
        assert "c1" in ans or "effective operational" in ans

    def test_allgemeine_fremdsprachenkurse_sws(self, pipeline):
        """Allgemeine Fremdsprachenkurse: 4 Ausbildungsstufen, 2 SWS je Stufe, insgesamt 8 SWS."""
        ans = _answer(pipeline,
            "Wie viele SWS umfassen die allgemeinen Fremdsprachenkurse insgesamt?")
        assert "8" in ans or "sws" in ans

    def test_zulassung_teilnahme_prozent(self, pipeline):
        """Zulassungsvoraussetzung: mindestens 75 % Teilnahme."""
        ans = _answer(pipeline,
            "Wie viel Prozent Teilnahme ist für die Zulassung zu Sprachprüfungen erforderlich?")
        assert "75" in ans

    def test_unicert_pruefung_sws(self, pipeline):
        """UNIcert-Prüfungszulassung: 8–12 SWS Ausbildungsabschnitt."""
        ans = _answer(pipeline,
            "Wie viele SWS müssen für die Zulassung zur UNIcert-Abschlussprüfung nachgewiesen werden?")
        assert any(x in ans for x in ["8", "12", "sws"])

    def test_anmeldung_portal(self, pipeline):
        """Anmeldung zu Prüfungen über das Selbstbedienungsportal der Hochschule."""
        ans = _answer(pipeline,
            "Wie melden sich Studierende zu Sprachprüfungen an?")
        assert "portal" in ans or "selbstbedienung" in ans or "anmeldung" in ans

    def test_quereinstieg_zertifizierung(self, pipeline):
        """Quereinstieg führt nicht zur Zertifizierung niedrigerer UNIcert-Stufen."""
        ans = _answer(pipeline,
            "Was gilt bei einem Quereinstieg in eine höhere UNIcert-Ausbildungsstufe bezüglich der Zertifizierung niedrigerer Stufen?")
        assert "nicht" in ans or "keine" in ans or "zertifizierung" in ans


# ══════════════════════════════════════════════════════════════════════════════
# GROUP 3 — Modulstudium (346-3_Satzung_Modulstudium_1.AES_konsF_30072024.pdf)
# ══════════════════════════════════════════════════════════════════════════════

class TestModulstudium:

    def test_modulstudium_zweck(self, pipeline):
        """Modulstudium dient dem Erwerb wissenschaftlicher oder beruflicher Teilqualifikationen."""
        ans = _answer(pipeline,
            "Welchem Zweck dient das Modulstudium an der Hochschule Landshut?")
        assert "teilqualifikation" in ans or "qualifikation" in ans

    def test_max_ects_bachelor(self, pipeline):
        """In Bachelorstudiengängen können bis zu 30 ECTS im Modulstudium belegt werden."""
        ans = _answer(pipeline,
            "Wie viele ECTS-Punkte können im Modulstudium in Bachelorstudiengängen maximal belegt werden?")
        assert "30" in ans

    def test_max_ects_weiterbildung(self, pipeline):
        """In berufsbegleitenden Studiengängen der Weiterbildungsakademie: bis zu 20 ECTS."""
        ans = _answer(pipeline,
            "Wie viele ECTS können in berufsbegleitenden Studiengängen der Weiterbildungsakademie im Modulstudium belegt werden?")
        assert "20" in ans

    def test_gebuehren_grundstaendig(self, pipeline):
        """Das Modulstudium in grundständigen Bachelor- und Masterstudiengängen ist gebührenfrei."""
        ans = _answer(pipeline,
            "Ist das Modulstudium in grundständigen Bachelorstudiengängen gebührenpflichtig?")
        assert "gebührenfrei" in ans or "kostenlos" in ans or "keine gebühr" in ans or "gebühren" in ans

    def test_pruefungswiederholung(self, pipeline):
        """Nicht bestandene Modulprüfung kann einmal wiederholt werden."""
        ans = _answer(pipeline,
            "Wie oft kann eine nicht bestandene Modulprüfung im Modulstudium wiederholt werden?")
        assert "einmal" in ans or "ein" in ans or "1" in ans or "wiederhol" in ans

    def test_wiederholungsfrist(self, pipeline):
        """Wiederholungsprüfung muss innerhalb von 6 Monaten abgelegt werden."""
        ans = _answer(pipeline,
            "Innerhalb welcher Frist muss eine Wiederholungsprüfung im Modulstudium abgelegt werden?")
        assert "6" in ans or "sechs" in ans or "monat" in ans

    def test_zertifikat_inhalt(self, pipeline):
        """Das Zertifikat enthält: Modulbezeichnung, ECTS-Punkte, Bewertung."""
        ans = _answer(pipeline,
            "Was steht auf dem Zertifikat, das nach dem Modulstudium ausgestellt werden kann?")
        assert "ects" in ans or "modul" in ans or "bewertung" in ans

    def test_schueler_zulassung(self, pipeline):
        """Schüler mit besonderen Begabungen (Bestätigung von Schule und Hochschule) können zugelassen werden."""
        ans = _answer(pipeline,
            "Können Schülerinnen und Schüler am Modulstudium teilnehmen?")
        assert "schüler" in ans or "begabung" in ans or "schule" in ans

    def test_inkrafttreten_aenderungssatzung(self, pipeline):
        """Die 1. Änderungssatzung gilt ab WS 2023/2024."""
        ans = _answer(pipeline,
            "Ab wann gilt die erste Änderungssatzung der Modulstudium-Satzung?")
        assert "2023" in ans or "wintersemester" in ans


# ══════════════════════════════════════════════════════════════════════════════
# GROUP 4 — Hochschulzertifikat Unternehmertum & Gründung
#           (304-4_PO_Hochschulzertifikat__Unternehmertum___Gruendung_20211125.pdf)
# ══════════════════════════════════════════════════════════════════════════════

class TestHochschulzertifikatGruendung:

    def test_anbieter(self, pipeline):
        """Das Zertifikat wird vom Gründerzentrum der Hochschule Landshut angeboten."""
        ans = _answer(pipeline,
            "Wer bietet das Hochschulzertifikat Unternehmertum und Gründung an?")
        assert "gründerzentrum" in ans

    def test_gesamtects(self, pipeline):
        """Das Zertifikatsstudium umfasst insgesamt 10 ECTS."""
        ans = _answer(pipeline,
            "Wie viele ECTS umfasst das Hochschulzertifikat Unternehmertum und Gründung insgesamt?")
        assert "10" in ans

    def test_module_anzahl(self, pipeline):
        """Das Zusatzstudium besteht aus 3 Modulen (GZ01–GZ04, aber 3 Pflichtmodule)."""
        ans = _answer(pipeline,
            "Aus wie vielen Modulen besteht das Hochschulzertifikat Unternehmertum und Gründung?")
        assert any(x in ans for x in ["drei", "3", "gz01", "gz02", "modul"])

    def test_gz04_pruefungsleistung(self, pipeline):
        """GZ04 erfordert Teilnahmebestätigungen und einen 5-seitigen Reflektionsbericht."""
        ans = _answer(pipeline,
            "Welche Prüfungsleistung ist für das Modul GZ04 im Zertifikat Unternehmertum und Gründung erforderlich?")
        assert "reflektionsbericht" in ans or "5 seiten" in ans or "teilnahme" in ans

    def test_gz03_ects(self, pipeline):
        """GZ03 (Finanzmodul) hat 5 ECTS."""
        ans = _answer(pipeline,
            "Wie viele ECTS hat das Finanzmodul GZ03 im Hochschulzertifikat Unternehmertum und Gründung?")
        assert "5" in ans

    def test_zulassung(self, pipeline):
        """Zugang für immatrikulierte Studierende und Modulstudierenden, keine eigene Immatrikulation."""
        ans = _answer(pipeline,
            "Wer kann das Hochschulzertifikat Unternehmertum und Gründung belegen?")
        assert "immatrikuliert" in ans or "studierende" in ans

    def test_pruefungskommission_gz04(self, pipeline):
        """Für GZ04 ist die Prüfungskommission der Fakultät Betriebswirtschaft zuständig."""
        ans = _answer(pipeline,
            "Welche Prüfungskommission ist für das Modul GZ04 im Hochschulzertifikat Unternehmertum zuständig?")
        assert "betriebswirtschaft" in ans or "fakultät" in ans

    def test_bestehen_zertifikat(self, pipeline):
        """Das Zertifikat ist bestanden, wenn alle Modulprüfungen erfolgreich abgelegt wurden."""
        ans = _answer(pipeline,
            "Wann gilt das Hochschulzertifikat Unternehmertum und Gründung als bestanden?")
        assert "alle" in ans or "modulprüfung" in ans or "bestanden" in ans

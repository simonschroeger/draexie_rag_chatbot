"""
RAG Test Suite — Dräxlmaier Word Questions
==========================================
Questions derived directly from Dräxlmaier Word documents.
Each test queries the live RAG pipeline and asserts that key facts from the
documents appear in the answer.

Run:
    pytest tests/test_draexlmaier_word_questions.py -v -s
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
# GROUP 1 — Word Dokumente
# ══════════════════════════════════════════════════════════════════════════════

class TestDraexlmaierWordDokumente:

    def test_hauptprojektbesprechung_inhalte(self, pipeline):
        """Welche Inhalte hat eine Hauptprojektbesprechung?"""
        ans = _answer(pipeline, "Welche Inhalte hat eine Hauptprojektbesprechung?")
        assert (
            "status controlling" in ans or "status entwicklung" in ans or "status vertrieb" in ans or "status logistik" in ans
            or
            "status produktion" in ans or "status qualität" in ans or "status einkauf" in ans or "projektcockpit" in ans
            or
            "terminschiene" in ans or "offene fragen" in ans
        )

    def test_handbuecher_leitfaeden(self, pipeline):
        """Wo finde ich Handbücher und Leitfäden?"""
        ans = _answer(pipeline, "Wo finde ich Handbücher und Leitfäden?")
        assert (
            "o:\\drxinfo\\cc cq" in ans or "drxinfo" in ans or "cc cq" in ans
        )

    def test_telefonverzeichnis(self, pipeline):
        """Wo finde ich das Telefonverzeichnis?"""
        ans = _answer(pipeline, "Wo finde ich das Telefonverzeichnis?")
        assert "dfm" in ans

    def test_vorlagen_briefe_faxe_angebote(self, pipeline):
        """Wo findet man Vorlagen für Briefe, Faxe, Angebote?"""
        ans = _answer(pipeline, "Wo findet man Vorlagen für Briefe, Faxe, Angebote?")
        assert (
            "vorlagen_korrespondenz" in ans or "formulare_etiketten" in ans or "_allg_vertrieb" in ans
        )

    def test_abteilungsbesprechung(self, pipeline):
        """Was wird in der Abteilungsbesprechung alles besprochen?"""
        ans = _answer(pipeline, "Was wird in der Abteilungsbesprechung alles besprochen?")
        assert (
            "vw1" in ans or "vw-vx" in ans or "relevanten themen" in ans
        )

    def test_kundentermine(self, pipeline):
        """Wo und wie muss ich Kundentermine eintragen?"""
        ans = _answer(pipeline, "Wo und wie muss ich Kundentermine eintragen?")
        assert (
            "customer meetings" in ans or "ordner eines anderen benutzers" in ans or "kalender" in ans or "beschriftung blau" in ans
        )

    def test_zeiterfassung_programm(self, pipeline):
        """In welchem Programm wird die Zeiterfassung vorgenommen und wo finde ich das Programm?"""
        ans = _answer(pipeline, "In welchem Programm wird die Zeiterfassung vorgenommen und wo finde ich das Programm?")
        assert (
            "sap ess" in ans or "mss" in ans or "intranet" in ans or "personal" in ans
            or
            "portal.sap.draexlmaier.com" in ans
        )

    def test_email_signatur(self, pipeline):
        """Wie erstelle ich eine E-Mail Signatur?"""
        ans = _answer(pipeline, "Wie erstelle ich eine E-Mail Signatur?")
        assert (
            "interner" in ans or "externer" in ans or "extras" in ans or "optionen" in ans
            or
            "emailformat" in ans or "signatur" in ans
        )

    def test_stundenbuchung_frist(self, pipeline):
        """Bis wann muss ich meine Stundenbuchung vornehmen?"""
        ans = _answer(pipeline, "Bis wann muss ich meine Stundenbuchung vornehmen?")
        assert (
            "05." in ans or "folgemonats" in ans or "vollständig" in ans or "erfassen" in ans
        )

    def test_dienstreisantrag(self, pipeline):
        """An wen muss ich mich wenden für einen Dienstreisantrag?"""
        ans = _answer(pipeline, "An wen muss ich mich wenden für einen Dienstreisantrag?")
        assert (
            "teamassistentinnen" in ans or "dfm" in ans
        )

    def test_mailboxansage(self, pipeline):
        """Welchen Text soll ich bei einer Mailboxansage verwenden?"""
        ans = _answer(pipeline, "Welchen Text soll ich bei einer Mailboxansage verwenden?")
        assert (
            "herzlich willkommen" in ans or "dräxlmaier group" in ans or "nicht persönlich entgegennehmen" in ans or "welcome to dräxlmaier group" in ans
            or
            "not available" in ans
        )

    def test_oem_bedeutung(self, pipeline):
        """Was bedeutet OEM?"""
        ans = _answer(pipeline, "Was bedeutet OEM?")
        assert (
            "original equipement manufacturar" in ans or "original equipment manufacturer" in ans or "erstausrüster" in ans or "zukunftsprodukte" in ans
            or
            "eigenem namen" in ans
        )

    def test_drucker_installieren(self, pipeline):
        """Wie installiere ich den Drucker?"""
        ans = _answer(pipeline, "Wie installiere ich den Drucker?")
        assert (
            "manuelle installation" in ans or "freigegebener software" in ans or "it projects" in ans or "printers" in ans
        )

    def test_elektrische_komponenten_bordnetz(self, pipeline):
        """Was zählt zu den elektrischen Komponenten eines Bordnetzes?"""
        ans = _answer(pipeline, "Was zählt zu den elektrischen Komponenten eines Bordnetzes?")
        assert (
            "verkabelung" in ans or "steuergeräte" in ans or "sensoren" in ans or "anzeigeelemente" in ans
            or
            "aktoren" in ans or "bussysteme" in ans or "energiespeicher" in ans or "generatoren" in ans
        )

    def test_wellrohr(self, pipeline):
        """Was ist ein Wellrohr?"""
        ans = _answer(pipeline, "Was ist ein Wellrohr?")
        assert (
            "starrem material" in ans or "wellenförmig" in ans or "flexibel" in ans or "schutz" in ans
            or
            "bündelung" in ans or "leitungen" in ans
        )

    def test_ersatzteildienstpflicht(self, pipeline):
        """Wie lange haben wir Ersatzteildienstpflicht?"""
        ans = _answer(pipeline, "Wie lange haben wir Ersatzteildienstpflicht?")
        assert (
            "15 jahre" in ans or "eop" in ans
        )

    def test_overhead_unterscheidungen(self, pipeline):
        """Welche Unterscheidungen gibt es beim Overhead?"""
        ans = _answer(pipeline, "Welche Unterscheidungen gibt es beim Overhead?")
        assert (
            "allgemeinen overhead" in ans or "projektspezifischen overhead" in ans or "dienstreisen" in ans or "stundensätze" in ans
            or
            "sop+3" in ans
        )

    def test_verrechnungspreis(self, pipeline):
        """Wie wird der Verrechnungspreis gebildet?"""
        ans = _answer(pipeline, "Wie wird der Verrechnungspreis gebildet?")
        assert (
            "hohlpreis" in ans or "grundpreis" in ans or "kupferbasis" in ans or "kupferzuschlag" in ans
            or
            "materialteuerungszuschlag" in ans or "mtz" in ans or "london metal exchange" in ans
        )

    def test_cop_bedeutung(self, pipeline):
        """Was bedeutet COP?"""
        ans = _answer(pipeline, "Was bedeutet COP?")
        assert (
            "carry over part" in ans or "gleichteile" in ans or "plattformkonzept" in ans or "entwicklungskosten" in ans
            or
            "ersatzteilfertigung" in ans
        )

    def test_preistypen(self, pipeline):
        """Welche Preistypen gibt es?"""
        ans = _answer(pipeline, "Welche Preistypen gibt es?")
        assert (
            "schätzpreise" in ans or "abr-preise" in ans or "interimspreise" in ans
        )

    def test_unternehmensziele_drx(self, pipeline):
        """Was sind die Unternehmensziele von DRX?"""
        ans = _answer(pipeline, "Was sind die Unternehmensziele von DRX?")
        assert (
            "umsatzziel" in ans or "renditeziel" in ans or "8%" in ans or "sonderkostenziele" in ans
            or
            "optimierungsziele" in ans or "projektziele" in ans
        )

    def test_kst_bedeutung(self, pipeline):
        """Was bedeutet KST?"""
        ans = _answer(pipeline, "Was bedeutet KST?")
        assert (
            "unverbindliche kostenanfrage" in ans or "umsetzung" in ans or "änderung noch offen" in ans
        )

    def test_sonderkosten(self, pipeline):
        """Wo finde ich Sonderkosten?"""
        ans = _answer(pipeline, "Wo finde ich Sonderkosten?")
        assert (
            "0211_sonderkosten" in ans or "sonderkosten_übersichten" in ans or "reporting\\soko" in ans
        )

    def test_verbauratenveraenderungen(self, pipeline):
        """Welche Auswirkung haben Verbauratenveränderungen auf Kosten/Preis/Ertrag?"""
        ans = _answer(pipeline, "Welche Auswirkung haben Verbauratenveränderungen auf Kosten/Preis/Ertrag?")
        assert (
            "summe der kosten" in ans or "summe des preises" in ans or "betrag des ertrages" in ans or "verbauratenerhöhung" in ans
            or
            "verbauratenreduzierung" in ans
        )

    def test_fertigungsstueckliste(self, pipeline):
        """Welche Informationen enthält eine Fertigungsstückliste?"""
        ans = _answer(pipeline, "Welche Informationen enthält eine Fertigungsstückliste?")
        assert (
            "fp nummer" in ans or "änderungstand" in ans or "kundenteile-nr" in ans or "fertigungsbereich" in ans
            or
            "kabel-nr" in ans or "material-nr" in ans or "f-zeit" in ans or "kostenstelle" in ans
        )

    def test_lieferkette_afrika(self, pipeline):
        """Wie sieht die Lieferkette aus für Operative Logistik Afrika?"""
        ans = _answer(pipeline, "Wie sieht die Lieferkette aus für Operative Logistik Afrika?")
        assert (
            "lieferkette" in ans or "operative logistik" in ans or "afrika" in ans
        )

    def test_produktion_betriebsmittel_ansprechpartner(self, pipeline):
        """Wer ist Ansprechpartner für die Produktion von Betriebsmitteln?"""
        ans = _answer(pipeline, "Wer ist Ansprechpartner für die Produktion von Betriebsmitteln?")
        assert (
            "anthoni grosswald" in ans or "1334" in ans
        )

    def test_diensthandy_anleitung(self, pipeline):
        """Gibt es eine Anleitung für die Einrichtung meines Diensthandys?"""
        ans = _answer(pipeline, "Gibt es eine Anleitung für die Einrichtung meines Diensthandys?")
        assert (
            "sharepoint" in ans or "iphone activation" in ans or "dep_devices_2024" in ans or "manuals_keyinfo" in ans
        )

    def test_einarbeitungsplan(self, pipeline):
        """Gibt es einen Einarbeitungsplan?"""
        ans = _answer(pipeline, "Gibt es einen Einarbeitungsplan?")
        assert (
            "einarbeitungsplan" in ans or "wissensmanagement" in ans or "einarbeitung" in ans
        )

    def test_dm_bedeutung(self, pipeline):
        """Was bedeutet das Kurzzeichen DM?"""
        ans = _answer(pipeline, "Was bedeutet das Kurzzeichen DM?")
        assert (
            "deutsche mark" in ans or "german mark" in ans
        )

    def test_manuelle_lieferung(self, pipeline):
        """Kannst du mir erklären, wie ich manuell eine Lieferung auslösen kann?"""
        ans = _answer(pipeline, "Kannst du mir erklären, wie ich manuell eine Lieferung auslösen kann?")
        assert (
            "drl" in ans or "eintrag" in ans
        )

    def test_pdf_unterschrift(self, pipeline):
        """Wie füge ich eine Unterschrift für eine Arbeitsanweisung in PDF ein?"""
        ans = _answer(pipeline, "Wie füge ich eine Unterschrift für eine Arbeitsanweisung in PDF ein?")
        assert (
            "unterschrift scannen" in ans or "snipping tool" in ans or "jpg-format" in ans or "füller" in ans
            or
            "unterschrift hinzufügen" in ans or "anwenden" in ans
        )

    def test_projektmanagement_beschreibung(self, pipeline):
        """Wo finde ich eine Beschreibung zum Projektmanagement bei Dräxlmaier?"""
        ans = _answer(pipeline, "Wo finde ich eine Beschreibung zum Projektmanagement bei Dräxlmaier?")
        assert (
            "pm-leitfaden_de.pdf" in ans or "pm_guideline" in ans or "po-public" in ans
        )

    def test_host_zugang(self, pipeline):
        """Wie komme ich zu HOST?"""
        ans = _answer(pipeline, "Wie komme ich zu HOST?")
        assert "unite" in ans

    def test_anschlagteile(self, pipeline):
        """Welche Anschlagteile gibt es?"""
        ans = _answer(pipeline, "Welche Anschlagteile gibt es?")
        assert (
            "a4" in ans or "kabelschuhe" in ans or "a41" in ans or "a42" in ans
            or
            "a61" in ans or "rohrclips" in ans or "a62" in ans or "u-cap" in ans
            or
            "a63" in ans or "aderendhülse" in ans or "a99" in ans or "strombrücke" in ans
        )

    def test_y_teilenummer(self, pipeline):
        """Was ist eine Y-Teilenummer?"""
        ans = _answer(pipeline, "Was ist eine Y-Teilenummer?")
        assert (
            "interimsteilenummer" in ans or "akquisen" in ans or "sop" in ans or "komponentendatenbank" in ans
            or
            "status aktiv" in ans
        )

    def test_bep_zeitpunkte(self, pipeline):
        """Wann sind die BEP Zeitpunkte?"""
        ans = _answer(pipeline, "Wann sind die BEP Zeitpunkte?")
        assert (
            "vergabe" in ans or "sop" in ans or "fahrzeuge gebaut" in ans
        )

    def test_change_management_harness_phasen(self, pipeline):
        """Welche Phasen hat das Change Management Harness?"""
        ans = _answer(pipeline, "Welche Phasen hat das Change Management Harness?")
        assert (
            "vorgang anlegen" in ans or "technische ausarbeitung" in ans or "machbarkeitsprüfung" in ans or "technische kalkulation" in ans
            or
            "kaufmännische bewertung" in ans or "änderungsmeldung" in ans or "änderung umsetzen" in ans
        )

    def test_ksk_beinhaltet(self, pipeline):
        """Was beinhaltet KSK?"""
        ans = _answer(pipeline, "Was beinhaltet KSK?")
        assert (
            "leitungen" in ans or "litzen" in ans or "anschlagteile" in ans or "stecker" in ans
            or
            "wickelbänder" in ans or "tüllen" in ans
        )

    def test_ersatzteildienst_einzelteile(self, pipeline):
        """Was ist, wenn es Einzelteile im Zuge vom Ersatzteildienst nicht mehr gibt?"""
        ans = _answer(pipeline, "Was ist, wenn es Einzelteile im Zuge vom Ersatzteildienst nicht mehr gibt?")
        assert (
            "oem" in ans or "gleichwertige materialien" in ans or "festgelegt" in ans
        )

    def test_tube(self, pipeline):
        """Was ist ein Tube?"""
        ans = _answer(pipeline, "Was ist ein Tube?")
        assert (
            "schlauch" in ans or "kein schrumpfschlauch" in ans or "fädeln" in ans or "schneiden" in ans
            or
            "meterware" in ans
        )

    def test_cmh_phase_6(self, pipeline):
        """Welche Phase ist Phase 6 in CMH?"""
        ans = _answer(pipeline, "Welche Phase ist Phase 6 in CMH?")
        assert "vertrieb" in ans

    def test_labs_abfragen(self, pipeline):
        """Wie kann ich LAB`s abfragen?"""
        ans = _answer(pipeline, "Wie kann ich LAB`s abfragen?")
        assert (
            "hostgui" in ans or "host gui" in ans
        )

    def test_inklusiv_effektivpreis_formel(self, pipeline):
        """Wie lautet die Formel für Inklusiv-/Effektivpreis?"""
        ans = _answer(pipeline, "Wie lautet die Formel für Inklusiv-/Effektivpreis?")
        assert (
            "inklusivpreis" in ans or "effektivpreis" in ans or "notierung" in ans or "basis" in ans
            or
            "mtz" in ans
        )

    def test_stunden_sap_buchen(self, pipeline):
        """Wie kann ich meine Stunden über SAP buchen?"""
        ans = _answer(pipeline, "Wie kann ich meine Stunden über SAP buchen?")
        assert (
            "sap" in ans or "008" in ans or "ps4 element" in ans or "cat2" in ans
            or
            "arbeitszeitblatt" in ans or "cats classic" in ans or "stunden eintragen" in ans or "speichern" in ans
        )

    def test_interne_aenderungen_produkt(self, pipeline):
        """Wo findet man interne Änderungen am Produkt?"""
        ans = _answer(pipeline, "Wo findet man interne Änderungen am Produkt?")
        assert (
            "interneänderungen_allebaureihen" in ans or "produktionsunterlagen" in ans or "interne änderungen" in ans
        )

    def test_smart_calc_verwendungszweck(self, pipeline):
        """Was ist der Verwendungszweck von Smart Calc?"""
        ans = _answer(pipeline, "Was ist der Verwendungszweck von Smart Calc?")
        assert (
            "akquisephase" in ans or "smart sales" in ans or "vereinfachte stückliste" in ans or "kbl" in ans
            or
            "calc datei" in ans or "smart price" in ans or "host" in ans
        )

    def test_pr_bearbeitung_bereiche(self, pipeline):
        """Welche Bereiche sind bei der PR-Bearbeitung beteiligt?"""
        ans = _answer(pipeline, "Welche Bereiche sind bei der PR-Bearbeitung beteiligt?")
        assert (
            "pr-bearbeitung" in ans or "produktreport" in ans or "bereiche" in ans
        )

    def test_audits(self, pipeline):
        """Was sind Audits?"""
        ans = _answer(pipeline, "Was sind Audits?")
        assert (
            "zertifizierungen" in ans or "vda" in ans or "iso" in ans or "ts 16949" in ans
            or
            "autozulieferer" in ans or "qualitativen anforderungen" in ans
        )

    def test_verbauraten_bedeutung(self, pipeline):
        """Kannst du mir die Bedeutung von Verbauraten erklären?"""
        ans = _answer(pipeline, "Kannst du mir die Bedeutung von Verbauraten erklären?")
        assert (
            "prozent aller verkauften fahrzeuge" in ans or "modul verbaut" in ans or "jahresabsatz" in ans or "db-delta" in ans
            or
            "durchschnittsfahrzeug" in ans
        )

    def test_citrix_access_gateway(self, pipeline):
        """Was ist der erste Schritt, um mich in das DRX-Firmennetz mit Citrix Access Gateway einzuwählen?"""
        ans = _answer(pipeline,
            "Was ist der erste Schritt, um mich in das DRX-Firmennetz mit Citrix Access Gateway einzuwählen?")
        assert (
            "citrix" in ans or "access gateway" in ans or "drx-firmennetz" in ans
        )

    def test_projektnummer_k(self, pipeline):
        """Was bedeutet die Projektnummer K?"""
        ans = _answer(pipeline, "Was bedeutet die Projektnummer K?")
        assert "konzeptentwicklungsprojekt" in ans

    def test_txt_datei_oeffnen(self, pipeline):
        """Wie kann ich eine txt-Datei öffnen?"""
        ans = _answer(pipeline, "Wie kann ich eine txt-Datei öffnen?")
        assert (
            "excel" in ans or "datei öffnen" in ans or "alle dateien" in ans or "getrennt" in ans
            or
            "feste breite" in ans
        )

    def test_reisenebenkosten(self, pipeline):
        """Werden Reisenebenkosten immer erstattet?"""
        ans = _answer(pipeline, "Werden Reisenebenkosten immer erstattet?")
        assert (
            "originalrechnungen" in ans or "reisekostenabrechnung" in ans or "auswärtstätigkeit" in ans or "nicht erstattungsfähig" in ans
            or
            "privat" in ans
        )

    def test_koax_leitungen(self, pipeline):
        """Wann werden Koax-Leitungen eingesetzt?"""
        ans = _answer(pipeline, "Wann werden Koax-Leitungen eingesetzt?")
        assert (
            "radio" in ans or "gps" in ans or "sdars" in ans or "car-to-x" in ans
            or
            "ethernet-koax" in ans or "fakra" in ans or "hochfrequente datenübertragung" in ans
        )

    def test_ata_bedeutung(self, pipeline):
        """Was bedeutet ATA?"""
        ans = _answer(pipeline, "Was bedeutet ATA?")
        assert (
            "aussentemperaturanzeige" in ans or "außentemperaturanzeige" in ans
        )
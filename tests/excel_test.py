"""
Auto-generated RAG test cases.
Source file: qa_data.txt
"""

import unittest

# ---------------------------------------------------------------------------
# Replace this stub with your actual RAG query function.
# It should return a dict with at least 'answer' and 'source' keys.
# ---------------------------------------------------------------------------
def query_rag(question: str) -> dict:
    """Call your RAG system here. Return {"answer": ..., "source": ...}"""
    raise NotImplementedError("Wire up your RAG system in query_rag()")


class TestRAG(unittest.TestCase):

    def test_001_wofr_steht_die_abkrzung_cop_und_was_bedeutet_der_begriff(self):
        question = 'Wofür steht die Abkürzung COP und was bedeutet der Begriff?'
        expected_answer = 'COP\nCarry Over Part\nAls Gleichteile werden Bauteile bezeichnet, die unverändert in verschiedenen Produkten\n verwendet werden können, jedoch keine Normteile sind. Ein hoher Anteil an Gleichteilen ist Kern des Plattformkonzepts. Gleichteile können sowohl von Vorgängerprodukten, oder von anderen Produkten aus eigener oder fremder Fertigung übernommen werden. Durch die Verwendung von Gleichteilen in Kraftfahrzeugen werden Entwicklungskosten gesenkt und die Entwicklungsdauer eines neuen Modells verkürzt. Zudem sinken die Produktionskosten infolge größerer möglicher Serien und die Lagerhaltungskosten für Ersatzteile. Jede Änderung an Gleichteilen erfordert die Überprüfung, ob diese Änderung für alle Anwendungen zum Einsatz kommen kann. Dabei müssen auch Produkte berücksichtigt werden, die nicht mehr im aktuellen Produktprogramm enthalten sind, aber noch in der Ersatzteilfertigung erfasst werden müssen. Die Anforderungen an die Entwicklung von Gleichteilen sind dadurch ungleich höher als für produktspezifische Lösungen.'

        result = query_rag(question)

        self.assertEqual(result["answer"], expected_answer)

    def test_002_welche_sachen_werden_auf_der_checkliste_bei_eintritt_neuer_m(self):
        question = 'Welche Sachen werden auf der “Checkliste bei Eintritt neuer Mitarbeiter” unter dem Bereich “Arbeitsplatz / Organisatorisches” abgefragt?'
        expected_answer = 'Arbeitsplatz\n(Vorlaufzeiten beachten / Intranet Self Service Portal)\nTisch\nStuhl\nContainer\nBildschirm\nNotebook + Docking Station\nMaus, Tastatur,\nKopfhörer\nBüromaterial \nKalender, Schreibtischunterlage,.. (ggf. Bestellung über Kiosk)\nErsteinrichtung Drucker\nErstanmeldung und Funktion\nDauerpassierschein\nErstellung des Dauerpassierscheins für Laptop\nMitarbeiterordner anlegen\n- Mitarbeiterordner liegt zentral ab\n- Inhalt: Zertifikaten….'
    
        result = query_rag(question)

        self.assertEqual(result["answer"], expected_answer)

    def test_003_wer_ist_der_hauptprojektleiter_und_wer_der_ansprechpartner_f(self):
        question = 'Wer ist der Hauptprojektleiter und wer der Ansprechpartner für TK für den PO416 Macan III?'
        expected_answer = 'Michael Lechner (Hauptprojektleiter) und Nicole Beischl (TK)'
        
        result = query_rag(question)

        self.assertEqual(result["answer"], expected_answer)

    def test_004_welche_einarbeitungsthemen_muss_ich_innerhalb_der_ersten_3_m(self):
        question = 'Welche Einarbeitungs-Themen muss ich innerhalb der ersten 3 Monate bei einem Junior Sales Manager bearbeiten?'
        expected_answer = 'Einführungsveranstaltung\nDräxlmaier Group\nElectric Sales\nLieferumfänge Elektrik\nAufgaben & Ziele\nOrganisatorisches\nES KSK-Technologie\nAblage auf dem Netzlaufwerk/Ordnerstruktur\nÄnderungsmanagement: Prozess allgemein\nÄnderungsmanagement: Investbewertung\nPreise: Grundlagen\nKostenkalkulation Elektrik: (FT-Kalkulation / Stücklistendownload)\nKostenkalkuatlion Sales Elektrik: SmartSales2\nCMH-Tool (Basis)'
        
        result = query_rag(question)

        self.assertEqual(result["answer"], expected_answer)

    def test_005_wofr_steht_die_abkrzung_cbd_und_was_bedeutet_der_begriff(self):
        question = 'Wofür steht die Abkürzung CBD und was bedeutet der Begriff?'
        expected_answer = 'CBD\nCost Break Down\nWird i.d.R. vom Kunden gefordert. Aufsplittung eines definierten Fahrzeugs in die einzelnen Materialgruppen (Menge, Preis)..., etc.'
        
        result = query_rag(question)

        self.assertEqual(result["answer"], expected_answer)

    def test_006_nenne_alle_aufgaben_im_produktmanagement_und_was_man_unter_d(self):
        question = 'Nenne alle Aufgaben im Produktmanagement und was man unter diesen Versteht.'
        expected_answer = '(1) Änderungsmanagement und Preisüberleitung\n(Kostenbewertung, Invest-Bewertung, Preisoptimierung, Verhandlung mit Kunde, Preisüberleitung / Preistapete, Verfolgung der Preiseinstellungen des Kunden, Dokumentation)\n(2) Sonderkosten\n(interne Abstimmung und Bewertung, Optimierung und Angebot erstellen, Verhandlung, Dokumentation, Zahlung eintreiben)\n(3) Projektadministration intern\n(interne Hauptprojekt-Sitzung, Projektanträge, Budgetplanung)\n(4) Betreuung und Verhandlung von Sonderthemen (externe Sonderthemen mit Kundenbeteiligung)\n(SOP-Verschiebung, Stückzahlenerhöhung, Materialengpass, Kostenanalysen für den OEM, OEM Kostenklausur, OEM Statusrunden)\n(5) Pflege der Kundenbeziehung\n(persönliche Termine, Events, Messe, Geschenke) \n(6) Reporting\n(Produktreport, Zielerreichung bei Änderungsmanagement und Sonderkosten, Rückstellungen, GSV-Runde, Akquise-Reporting, Stückzahlen)\n(7) DRX-interne Dienstleistungen\n(Fertigungs-Analyse Minuten, Überhang/Verschrottung, Target Costing, Produktklausur, interne Kostenanalyse, Make or Buy) \n(8) Akquise  (Nachverhandlung bestehender Aufträge oder Neuvergaben)\n(Kalkulation, Angebotserstellung, Verhandlung, Dokumentation)\n(9) Wissenstransfer / Schulungen\n(Einarbeitung neuer PM‘s, Kostenbewertung der Woche, Schulungen DRX-intern und extern, Werksbesichtigung)\n(10) Marktforschung / Branchenwissen\n(Markt- und Wettbewerbsanalyse, Newsletter, Presseartikel aus dem Bereich Automotive)'
        
        result = query_rag(question)

        self.assertEqual(result["answer"], expected_answer)

    def test_007_gib_mir_die_checkliste_fr_matrixberprfung(self):
        question = 'Gib mir die Checkliste für Matrixüberprüfung.'
        expected_answer = 'Kategorie\nVorgehensweise zur Matrixüberprüfung\nMatrixerstellung\n(Vor Befüllung)\nRichige Formatierung:\n- Formatierung Preis & CU in Spalte 1 / Zeile 1\n- Übertragung dieser Formatierung auf die komplette Spalte 1\n- Übertragung der Formatierung von Spalte 1 auf alle Spalten\n=> dadurch wird verhindert, dass eine "falsche" Formatierung aus der Vorgänermatrix nicht in der neuen Matrix enthalten ist\nMatrixerstellung\n(Vor Befüllung)\nSortierung der Teilenummern\nAllgemeine Formel\nCheck:\nGegenüberstellung der Summe über alle Änderungen in Zeile Summe / Inhalt über alle Änderungen\nAllgemeine Formel\nEntspricht die Summe der Änderungen (Preis- und Kupferdeltas - letzte Zeile) der Summe der gesamten Änderungen\n(Markierung über alle Zellen von AEM 1 bis AEM XY)\nAllgemeine Formel\nZeile:\nIst die Formel zur Addition der Kosten-/Kupferdeltas aus jeder Änderungsmitteilung auf die Module korrekt?\nAllgemeine Formel\nSpalte:\nIst die Summenformel am Ende jeder Spalte korrekt?\nFormat\nSind am Anfang jeder Spalte folgende Zellen enthalten?  \nFormat\nEinheitliches Layout:\n- Schriftfarbe\n- Schriftgröße\n- Zeilenhöhe/Spaltenbreite\n- Vollständigkeit- Inhalt der Zellen\n- Aktuelles Datum, Zeichnungsstand,….\nFormat\nSind alle Werte als "Zahl" formatiert?\nInvest\nIst der Invest vollständig eingetragen?\nAllgemeines\nAbgleich Preise aus der Vorgängermatrix\n* Master ist die neue Matrix\n* Spalten Module, Preis, Kupferwert, Aluwert in leeres Excelblatt kopieren\n* Daten freezen (als Wert abspeichern)\n* mit Hilfe der Formel "sverweis" die aktuellen Preise aus der alten Matrix übertragen\n* Preis alt - Preis neu \t-> Delta = 0 -> i.O.\nAllgemeines\nAbgleich Kupferwerte aus der Vorgängermatrix:\n* Master ist die neue Matrix\n* Spalten Module, Preis, Kupferwert, Aluwert in leeres Excelblatt kopieren\n* Daten freezen (als Wert abspeichern)\n* mit Hilfe der Formel "sverweis" die aktuellen Kupferwerte aus der alten Matrix übertragen\n* Preis alt - Preis neu \t-> Delta = 0 -> i.O.\nAllgemeines\nSind die Absprungspunkte bei neu entstandenen Modulen korrekt?\nAllgemeines\nSind alle Werte eingetragen (keine Rechtslenker vergessen?)\nAllgemeines\nVor Preisabgabe überprüfen, ob negative Preise bzw. CU-Werte enthalten sind'
        
        result = query_rag(question)

        self.assertEqual(result["answer"], expected_answer)

    def test_008_wie_werden_die_werte_ausgerechnet(self):
        question = 'Wie werden die Werte ausgerechnet?'
        expected_answer = '* Kosten (Vorgabe PM) Spalte "P"\n* Kapitalbindung  =  [Kosten *  (Rechnungsstellungsdatum - Leistungsdatum)  *  Zinssatz Fahrzeug]  /  (36000)\n* Fälligkeitstage Kunde  =  [Meldebetrag  *  (Datum Bestellung bzw. Datum Posteingang bzw. Rechnungsstellungsdatum - Meldedatum)]  /  (365)\n* Nettoerlös DFS  =  Erstattungsbetrag  -  (Kosten  +  Kapitalbindung)'
        
        result = query_rag(question)

        self.assertEqual(result["answer"], expected_answer)

    def test_009_was_bedeutet_paint_finish_control_number_auf_deutsch(self):
        question = 'Was bedeutet PAINT FINISH CONTROL NUMBER auf Deutsch?'
        expected_answer = 'LACKIERSTEUERNR.'
        
        result = query_rag(question)

        self.assertEqual(result["answer"], expected_answer)

    def test_010_was_bedeutet_lsterklemme_auf_englisch(self):
        question = 'Was bedeutet Lüsterklemme auf Englisch?'
        expected_answer = 'terminal block for light fixtures'
        
        result = query_rag(question)

        self.assertEqual(result["answer"], expected_answer)

    def test_011_nenne_mir_das_synonym_und_das_englische_wort_fr_ausblick(self):
        question = 'Nenne mir das Synonym und das englische Wort für Ausblick.'
        expected_answer = 'Ausblick\tForecast\tOutlook'
        
        result = query_rag(question)

        self.assertEqual(result["answer"], expected_answer)

    def test_012_wie_wird_die_total_material_cost_berechnet(self):
        question = 'Wie wird die Total Material Cost berechnet?'
        expected_answer = 'Direct Material Costs\n+\nMaterial Overheads / Indirect Material'
        
        result = query_rag(question)

        self.assertEqual(result["answer"], expected_answer)

    def test_013_wie_werden_die_production_costs_berechnet(self):
        question = 'Wie werden die Production Costs berechnet?'
        expected_answer = 'production costs (Fertigungskosten aus Multiplikation Minuten x Faktor €/min.)\ngrundsätzlich alle im Produktionswerk anfallenden Kosten; Abgrenzung zu den Logistikkosten / SEKV: siehe dort\ninsbesondere sind enthalten:\n+ direktes Personal (Werker) → FEK und indirektes Personal (Schichtleiter, Gruppenleiter, Springer, etc) → FGK\n+ Werksleitung, Verwaltung, QS, Wartung, IT, Arbeitsvorbereitung\n+ Invest (Betriebsmittel) → Kalkulatorische Abschreibung\n+ Invest (Fläche) → Kalkulatorische Raummiete\nKostenreduzierungen durch Produktionsoptimierungen werden in der Kalkulation i.d.R. nicht dargstellt'
        
        result = query_rag(question)

        self.assertEqual(result["answer"], expected_answer)


if __name__ == "__main__":
    unittest.main()

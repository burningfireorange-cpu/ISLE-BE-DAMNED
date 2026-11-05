# gauge – Test-Website (Arbeitsgrundlage für Claude)

## Ziel

Test-Website für die Edelstahl-Möbelmarke **gauge** (immer klein geschrieben). Sie zeigt die in Unity gerenderten Produkte
(Standbilder, Kamerafahrten, Abendmodus bei Lampen), eine Galerie gebauter Projekte, Bespoke und About Us.
Reines HTML/CSS/JS ohne Framework und ohne Build-Schritt, nur relative Pfade: funktioniert per Doppelklick (`file://`)
und auf GitHub Pages. Seitentexte auf **Englisch**, Berichte und Kommentare an den Nutzer auf **Deutsch**.

## Ordner

```
index.html                  die Seite (lädt alle Skripte als klassische <script>, kein Modul-System)
css/style.css               Gestaltung; Farben/Radien als CSS-Variablen
js/config.js                ALLE Einstellungen (Zeiten, Abstände, Schalter) – Werte hier ändern, nicht im Code
js/kern.js                  Bewegungsmodus, Lade-Warteschlange, Platzhalter, Produktdaten (G.produkte, G.pfade)
js/leiste.js, werkzeuge.js  Glasleiste und ihre Werkzeuge (Code-Filter, Views, Lampe, Pfeile)
js/viewer.js                Produkt-Viewer (Standbilder, Fahrten, Abendfahrten)
js/seiten.js                Products, Produktseite (+ Customize/Order/Payment), About Us, Bespoke
js/app.js                   Routing → Seiten, Flug Kachel ↔ Produktbild, Vorladen
js/galerie.js, start.js, zeiger.js, router.js, icons.js, baum.js (alter Navigationsbaum, umschaltbar)
data/produkte.js            ERZEUGT vom Bau-Skript – nie von Hand ändern
data/galerie.js             ERZEUGT vom Bau-Skript
data/dummies.js             Dummy-Produkte (von Hand)
media/produkte/<Object_NN>/ Bilder, Kachelbilder (bilder/kachel/), Videos (video/, video/klein/) – vom Bau-Skript
media/galerie/              optimierte Galeriefotos – vom Bau-Skript
_Import/Galerie/            Original-Galeriefotos (NICHT in git – nur lokal, siehe .gitignore)
_Import/produkte-zusatz.json  Maße; Kategorie nur als Rückfall
_Papierkorb/                was das Bau-Skript beiseitegelegt hat (nicht in git)
bau/aktualisieren.ps1       Bau-Skript (+ aktualisieren.cmd zum Doppelklicken)
Reports/                    Berichte an den Nutzer (siehe Arbeitsregeln)
README.md                   ausführliche Beschreibung für den Nutzer (deutsch)
```

## Datenquelle

- **Unity-Projekt `C:\Unity\website steel furniture` nur LESEN, nie ändern** – dort arbeitet parallel eine andere Sitzung
  (lange Render-Läufe). Nichts dorthin schreiben, kopieren, verschieben oder löschen.
- Quelle ist ausschließlich `C:\Unity\website steel furniture\Website_Test\` (nicht `Renders\`): `produkte.json` plus
  `Object_NN\bilder\`, `video\`, `video\klein\`.
- Genutzte Felder von `produkte.json`: `produkt`, `klasse`, `perspektiven`, `abendbilder`, `bilder`,
  `format` (volle Größe 12:5 = 4320 × 1800, Videos 2592 × 1080; Lage von 16:9 `bildschirm` und 4:3 `kachel`), `typ`,
  `anzeigename`, `abendfahrten`, `bildinfo` (Möbel-Box je Bild; bei `_hoch`-Bildern auch `brennweite` und `kachel_breit` =
  Lage der Kachel des breiten Cam1-Bilds im Hochformat, ragt seitlich hinaus), Hochformat `bilder_hoch`, `format_hoch`
  (2400 × 4800), `fahrten_hoch`, `abendfahrten_hoch`, `handykameras` (nur durchgereicht). `kacheln` wird nicht mehr gebraucht:
  Kachelbilder rechnet das Bau-Skript aus dem ganzen Cam1-Standbild (600 px hoch); die Handy-Kachel aus der kleinen Kopie des
  Cam1-Hochformats (volle Breite, 4:5, für alle Produkte gleicher Ausschnitt → `hoch.handyAusschnitt`). Nie mit festen Formaten rechnen.
  **`raum_leer` und der Ordner `Raum_leer` nicht verwenden.**
- Fehlen Felder oder heißen sie anders: Rückfall (z. B. `_Import/produkte-zusatz.json`) und im Bericht melden.

## Bau-Skript

`powershell -ExecutionPolicy Bypass -File bau\aktualisieren.ps1` (Optionen: `-OhneGalerie`, `-OhneProdukte`, `-NurDaten`, `-Neu`).
- Wiederholbar: kopiert nur Geändertes, legt nichts doppelt an, ein zweiter Lauf meldet „0 neu, 0 ersetzt“.
- Schreibt `data/produkte.js` und `data/galerie.js`; Kachelbilder werden auf 800 px verkleinert.
- Am Ende: Liste fehlender Dateien und Hinweise zu Rückfällen – gehört in den Bericht.
- Die Datei muss ihr UTF-8-BOM behalten (PowerShell 5.1).

## Sicherheitsregel (verbindlich – nach dem Datenverlust vom 1.11.2026)

- **Kein Skript löscht außerhalb seiner eigenen Zielordner.** Nie im Projekt-Hauptordner, nie in der Quelle, nie im Scratchpad
  über Verknüpfungen hinweg.
- **Pfad vor jedem Löschen prüfen**: erlaubter Ordner, Ziel liegt direkt darin, keine Junction/Symlink auf dem Weg.
- **Lieber in einen Papierkorb-Ordner verschieben als endgültig löschen** (`_Papierkorb\<Datum_Uhrzeit>\`). Im Bau-Skript
  läuft das über die Funktion `Beiseitelegen`; neue Aufräumschritte nur darüber.
- Keine Junctions/Symlinks vom Scratchpad in das Projekt anlegen (Testkopien: Medien kopieren oder per HTTP ausliefern,
  Baum-Modus per eingeschleuster Konfiguration testen).
- Vor jedem Löschen oder Überschreiben das Ziel ansehen; Unklares erst fragen.

## Navigationskonzept

- **Eine Glasleiste** (Milchglas-Pille, `js/leiste.js`): unten mittig; auf Produktseiten rechts senkrecht; Handy immer unten,
  Werkzeuge in einem kleinen Glasfeld darüber. Abstand zum Rand unten und rechts gleich (`leiste.abstandRand`, 60 px).
- Bereiche: Products · Bespoke · Gallery · About Us; Home erst nach dem Start. Startbildschirm: Logo, die Leiste als Ladebalken.
- **Products: Code-Filter `OBJ_TYPE_SIZE_NUMBER`** – TYPE (TB/ST/SH/LT), SIZE (S/M/L); NUMBER vervollständigt den Code und
  öffnet das Produkt. Keine Sortierung; echte Produkte zuerst, dann Platzhalter, je neueste zuerst.
- **Produktseite**: Leiste rechts mit Views (nur vorhandene), Lampe (nur Leuchten), Pfeilen. Das Bild füllt den ganzen
  Bildschirm (auch hinter der Leiste), seine Mitte liegt in der Mitte des freien Bereichs. Kachel → Produkt: der 4:3-Ausschnitt
  öffnet sich seitlich zum vollen Bild; zurück: die Fahrt zu Cam1 läuft in der schrumpfenden Kachel weiter.
- **Handy senkrecht: Hochformat** – IMMER bildfüllend (volle Breite, oben bündig, kein Rand, kein weicher Auslauf, nie
  verkleinert). Die Kameras des Nutzers sind maßgeblich; liegt ein Möbel unter den Leisten, nur melden, nicht ausgleichen.
  **Handy-Kacheln:** Am Handy senkrecht zeigt Products Kacheln aus dem Hochformat Cam1 (`Still_Cam1_hoch_kachel.jpg`, volle
  Breite, 4:5, gleicher Ausschnitt für alle Produkte). Zoom (`handyFlug` in app.js): ein Rahmen in Vollbildgröße trägt die kleine
  Hochformat-Kopie + das Kachelbild auf seinem Ausschnitt (zurück: den echten Viewer); `transform` + `clip-path: inset` öffnen
  den Ausschnitt in EINER Animation – kein Bildwechsel. Seitliche Insets immer 0, oben/unten schneidet der Clip nur das eigene
  Bild: laufen Clip und Transform am iPhone auseinander, wird nie Seite frei. Volles Standbild erst nach `img.decode()` (Rahmen
  blendet darüber aus, `seite.hochBlende`). Zurück von einer anderen View: erst die Fahrt zu Cam1 im vollen Hochformat, dann
  dasselbe Zusammenziehen.
  Handy quer: breites Format. Desktop darf sich durch Hochformat-Änderungen nicht verändern (A/B gegen alten Stand prüfen).
- Anzeigenamen sind Codes (`OBJ_LT_M_03`), Ordner/Adressen bleiben `Object_NN`.
- Baum-Modus (`navigation: 'baum'` in config.js) muss umschaltbar und funktionsfähig bleiben.

## Gestaltungsregeln

- Ruhig und reduziert: helle, warme Grautöne, keine Farbakzente; feine Linien-Symbole (Lucide, gleiche Größe).
- **Ein einziger Eckradius** für alle Flächen (`eckradius`, 3 px – Biegeradius des Blechs).
- Bewegung weich und kurz, Kurven und Zeiten nur aus `config.js`; „Bewegung reduzieren“ des Systems wird beachtet
  (nur Blenden) – jede neue Bewegung auch so testen.
- Nichts springt: Bilder erscheinen erst geladen (graue Fläche bis dahin), Kacheln steigen nacheinander auf.
- Eigener Mauszeiger: kleiner Kreis mit Farbumkehr – so lassen.
- Textseiten (Bespoke, About Us): Zeilen zentriert, senkrecht mittig zwischen oberem Rand und Leistenoberkante.

## Veröffentlichung (GitHub Pages)

- Repo `burningfireorange-cpu/gauge` (öffentlich), Pages aus `main` / root → https://burningfireorange-cpu.github.io/gauge/
- Der Nutzer veröffentlicht selbst über **GitHub Desktop** (Git in der Konsole hat keine GitHub-Anmeldung).
- Seit Runde 9 hat `main` eine **frische Historie** (Repo-Größe). Die alte Historie liegt nur lokal im Zweig
  `historie-bis-runde-9` und am Tag `vor-hochformat` – **nie pushen** (alte Renderings, ~0,75 GB).
- Grenzen: Seite/Repo höchstens ca. 1 GB, keine Datei über 100 MB. Vor jedem Hochladen prüfen
  (`git bundle create x.bundle main` ≈ Upload-Größe). Wird es wieder knapp: erneut frische Historie für `main`.

## Arbeitsregeln

- **Commit nach jedem Punkt** einer Feedback-Runde (bei Punkten ohne Code-Änderung ein leerer „geprüft“-Commit).
  git liegt nicht im PATH: `C:\pinokio\bin\miniforge\Library\cmd\git.exe`; ffmpeg: `C:\pinokio\bin\miniforge\Library\bin\ffmpeg.exe`.
- **Nach jeder Runde einen Bericht schreiben: `Reports/BERICHT_aktuell.md`.** Den vorherigen vorher mit Datum nach
  `Reports/Archiv/` verschieben (z. B. `Reports/Archiv/BERICHT_2026-11-02.md`; zweiter am selben Tag: `_2`).
  Aufbau:
  1. Ergebnis in Kürze
  2. Was gemacht wurde (mit Commits)
  3. Was du zuerst ausprobieren sollst
  4. Was auffällig ist
  5. Offene Fragen
- Testen im echten Browser (Edge headless über CDP), bei jeder Fenstergröße relevante Maße messen; langsame Netze nur
  über einen lokalen HTTP-Server drosseln (`file://` wird nicht gedrosselt).
- PowerShell 5.1: Dateien mit `[IO.File]` und UTF-8 ohne BOM schreiben (Ausnahme: Bau-Skript mit BOM); die Arbeitskopie
  hat CRLF (git autocrlf), das Repo LF – Textersetzungen müssen Zeilenenden normalisieren.

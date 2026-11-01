# gauge – Test-Website

Test-Website für die Edelstahl-Möbelmarke **gauge**. Reines HTML/CSS/JavaScript, keine Frameworks, keine externen Bibliotheken, nur relative Pfade.
Alles ist ein Test: Animationen und Details sind zentral einstellbar oder abschaltbar.

---

## 1. Seite öffnen

**Lokal:** Doppelklick auf `index.html`. Ein Server ist nicht nötig, denn alle Daten liegen als JS-Dateien vor (`data/*.js`), weil Browser bei `file://` kein `fetch()` von JSON erlauben.

**GitHub Pages:** Repository auf GitHub hochladen → *Settings → Pages → Branch `main`, Ordner `/ (root)`*. Die Datei `.nojekyll` ist schon da.

**Direkte Links** (funktionieren lokal und online):

| Link | zeigt |
|---|---|
| `index.html` | Startbildschirm |
| `index.html#/products` | alle Produkte (Raster) |
| `index.html#/products/tables` | Produkte, Typ-Filter auf „Tables“ gesetzt |
| `index.html#/products/object_01` | Produktseite OBJ_TB_M_01 (in der Adresse steht der interne Name) |
| `index.html#/products/object_03/customize` | Customize |
| `index.html#/products/object_03/customize/order` | To Order |
| `index.html#/products/object_03/customize/order/payment` | Payment (Platzhalter) |
| `index.html#/gallery` · `#/about` · `#/bespoke` | Galerie · About Us · Bespoke |

Alte Links mit Kategorie (`#/products/lighting/object_03`) funktionieren weiter. Im Baum-Modus (siehe Einstellungen) gelten die Pfade mit Kategorie.

Browser-Zurück und der Zurück-Pfeil gehen immer genau einen Schritt zurück (Payment → To Order → Customize → Produkt → Products → Start). Gallery, About Us und Bespoke liegen direkt unter dem Start. Bei einem Direktlink wird die Kette der übergeordneten Schritte bei der ersten Interaktion (Klick, Tippen, Taste) angelegt. Chrome überspringt Verlaufseinträge, die eine Seite ohne Interaktion anlegt. Drückt man direkt nach dem Öffnen eines Direktlinks Browser-Zurück, verlässt man deshalb die Seite. Der Zurück-Pfeil funktioniert immer.

**Tastatur:** Auf der Produktseite `1`–`9` = View, `L` = Lampe. In der Lightbox `←` `→` und `Esc`.

---

## 2. Bedienung

**Gläserne Leiste:** eine lange, schmale Pille aus Milchglas (halb durchsichtig, `backdrop-filter`-Unschärfe, feine Kontur). Der Inhalt scrollt sichtbar dahinter durch. Alle Symbole sind gleich groß und aus feinen Linien. Der aktive Punkt ist ein schwarzer Kreis mit weißem Symbol. Beim Hover erscheint ein Namensschild, immer zur Bildschirmmitte hin: über dem Symbol, wenn die Leiste unten liegt, links daneben, wenn sie rechts steht. Der Abstand zum unteren und zum rechten Rand ist gleich (`leiste.abstandRand`, 36 px). Wie durchsichtig das Glas ist, steht in `leiste.glasDeckkraft`.

- **Laden:** Beim ersten Öffnen steht das Logo in der Mitte, an der Stelle der Leiste zuerst nur ihr leerer Glas-Umriss. Er füllt sich von links nach rechts wie ein Ladebalken, während alle Kachelbilder (zuerst) und die Galeriefotos des ersten Bildschirms laden. Ist er voll, verschwindet die Füllung weich und die Symbole steigen nacheinander auf. Die Füllung braucht mindestens 1,2 s und wartet höchstens bis 5 s nach dem Aufruf, dann geht es trotzdem weiter und der Rest lädt nach. Große Standbilder und Videos laden erst danach im Hintergrund (`start.laden.*`).
- **Startbildschirm:** großes Logo in der Mitte, die Leiste unten mittig mit Products · Bespoke · Gallery · About Us, ohne Home. Ein Klick auf einen Bereich blendet das Logo aus. Ab dann steht ganz links das Home-Symbol (zurück zum Start). Die Namen stehen in `js/config.js` unter `bereiche`; „Bespoke“ ist ein Platzhaltername.
- **Gallery, About Us, Bespoke:** Die Leiste bleibt unten mittig, der Inhalt scrollt dahinter. Unten ist genug Luft, damit das Letzte über die Leiste gescrollt werden kann. About Us (Concept · Studio · Contact) und Bespoke stehen als ruhiger Block genau in der Bildschirmmitte. „Contact us“ auf Bespoke führt zum Abschnitt Contact auf About Us.
- **Produktseiten** (Produkt, Customize, To Order, Payment): Die Leiste steht rechts, senkrecht in der Bildschirmmitte. Beim Wechsel unten ↔ rechts schwingt nichts: Die alte Leiste zieht sich an ihrem Platz zu einem Punkt zusammen und blendet aus, gleichzeitig wächst die neue am neuen Platz aus einem Punkt (`leiste.wechsel`, 340 ms, unterbrechbar). Dabei laufen nur `transform` und `opacity`, die Unschärfe ist währenddessen aus und blendet danach ein.
- **Gleicher Ort, anderer Inhalt:** Das Glas wächst bzw. schrumpft weich (`leiste.umformen`).
- **Handy:** Die Leiste steht immer unten mittig, auch auf der Produktseite. Die Werkzeuge der Seite (Code-Filter, Views, Lampe, Pfeile) sitzen in einem eigenen kleinen Glasfeld direkt über der Leiste.

Hinter einem feinen Trenner stehen die Werkzeuge der jeweiligen Seite:

| Seite | Werkzeuge | Inhalt der Seite |
|---|---|---|
| Products | Code-Filter `OBJ_TYPE_SIZE_NUMBER` (siehe unten) | Kachelraster über die volle Breite, die Leiste liegt darüber |
| Produkt | View 1 · 2 · 3 … · Glühbirne (nur Leuchten) · → Customize · ← | das Bild über den ganzen Bildschirm (siehe unten) |
| Customize | → To Order · ← | Axonometrie links, schmales Feld für Regler/Optionen (noch leer) |
| To Order | → Payment · ← | Kachelbild, Name, Platzhalter für Maße/Optionen und Preis |
| Payment | ← | Platzhalter mit deaktiviertem „Pay“ |

**Code-Filter (Products):** Der Text `OBJ_TYPE_SIZE_NUMBER` ist der Filter. Platzhalter sind hellgrau, gewählte Werte schwarz und kräftiger, z. B. `OBJ_LT_SIZE_NUMBER`. Jedes Segment ist klickbar und öffnet darüber eine kleine Glasleiste mit den Möglichkeiten. Nach der Wahl (oder Klick daneben, `Esc`) fährt sie wieder ein.
- **TYPE:** All · TB · ST · SH · LT (Namensschilder Tables, Seating, Storage, Lighting)
- **SIZE:** All · S · M · L
- **NUMBER:** zeigt nur die Nummern, die es zu TYPE und SIZE wirklich gibt. Ein Klick vervollständigt den Code (z. B. `OBJ_LT_M_03`) und öffnet die Produktseite.
- „All“ setzt ein Segment auf den Platzhalter zurück. Die Kacheln gleiten wie bisher an ihre neuen Plätze.

**Reihenfolge der Kacheln:** fest, keine Sortierung zum Umschalten. In der Testversion stehen Produkte mit echten Bildern immer vorne (oberste Reihe, beim ersten Öffnen alle ohne Scrollen sichtbar), danach die grauen Platzhalter; innerhalb jeder Gruppe die neueste (höchste Nummer) zuerst.

**Aufsteigen:** Kacheln und Galeriefotos erscheinen nicht auf einmal, sondern steigen nacheinander leicht von unten auf und blenden dabei ein, „aus dem Wasser“ (je ca. 0,5 s, die ganze Welle ca. 1 s, `welle.*`). Products in Lesereihenfolge, die Galerie in zufälliger Reihenfolge, beim Öffnen und für Fotos, die neu ins Bild scrollen. Ein Element steigt erst auf, wenn sein Bild wirklich geladen ist; bis dahin eine ruhige graue Fläche.

**Anzeigenamen:** Unter den Kacheln, im Titel und in allen Beschriftungen steht der Produktcode `OBJ_<Typ>_<Größe>_<Nummer>`, z. B. Object_01 = `OBJ_TB_M_01`, Object_02 = `OBJ_SH_M_02`, Object_03 = `OBJ_LT_M_03`. Typ-Kürzel und Code je Produkt stehen zentral in `data/produkte.js`; das Bau-Skript schreibt sie dorthin, die Kürzel lassen sich in `_Import/produkte-zusatz.json` unter `_typen` ändern. Ordner, Dateinamen und Adressen bleiben `Object_0N`.

**Produktbild (Viewer):**
- **Vollbild:** Das Bild füllt den ganzen Bildschirm (cover), auch hinter der Leiste. Seine Mitte sitzt aber in der Mitte der freien Fläche: vom linken Rand bis zum Leistenbereich samt Randabstand, auf dem Handy über den Leisten. Das wird bei jeder Fenstergröße neu gerechnet (reines CSS) und funktioniert in jedem Seitenverhältnis. Das Seitenverhältnis kommt aus den Standbildern (`format` in `data/produkte.js`, jetzt 2400 × 1800). Breitere Renderings später, etwa 16:9 + 10 %, haben dann links und rechts gleich viel Reserve.
- **Aus der Kachel:** Ein Klick auf die Kachel zoomt das Kachelbild nahtlos ins Vollbild. Es ist dasselbe Bild (View 1); die Kachel zeigt eine kleine Kopie (`bilder/kachel/`), das große Standbild fliegt mit, sobald es geladen ist. Zeigte die Kachel beim Klick gerade das Abendbild (Hover bei Leuchten), öffnet das Produkt mit eingeschalteter Lampe.
- **Zurück zu Products:** Der echte Viewer schrumpft in seine Kachel. War eine andere View als 1 aktiv, startet die Fahrt zurück zu Cam1 sofort in normaler Geschwindigkeit, läuft in der Kachel weiter und endet auf dem Cam1-Standbild. Danach blendet der Viewer in das gleiche Kachelbild aus (`viewer.heimAusblenden`). Bei View 1 schrumpft das Bild nur.
- **View-Wechsel:** Das Standbild blendet in 0,1 s ins erste Videobild, die Fahrt läuft in der richtigen Richtung, und am Ende blendet das letzte Videobild in 0,1 s ins Standbild der Zielkamera.
- **Fahrt noch nicht geladen:** Das Standbild bleibt stehen, im View-Symbol der Leiste füllt sich ein feiner Ring, danach startet die Fahrt. Wählt man währenddessen eine andere View, wird die wartende Fahrt aufgegeben. Lädt sie gar nicht, wird überblendet.
- **Lampe:** Ist sie an, blendet das Bild vor der Fahrt erst zurück auf Tag.
- **Handy / schmale Fenster:** Videos aus `video/klein/`.
- **Vorladen:** zuerst die Fahrten ab der aktuellen View, dann die übrigen.

**Mauszeiger:** ein kleiner gefüllter Kreis (10 px), die Mitte ist der Klickpunkt. Er kehrt sich von selbst um: schwarz auf hellem, weiß auf dunklem Grund.
- **Über Feldern der Glasleiste** bleibt der Kreis immer sichtbar obenauf; nur das runde Hover-Feld reagiert: Das helle Feld wächst aus dem Zeiger und fließt in die Form des Feldes. Es liegt im Glas unter den Symbolen und fließt zwischen Nachbarfeldern weiter. Beim Verlassen zieht es sich wieder in den Zeiger zusammen.
- **Über Kacheln und Galeriefotos** wird der Kreis etwas größer.
- **In Textfeldern** erscheint der normale Textcursor, **auf Touch-Geräten** gibt es keinen eigenen Zeiger.
- Einstellungen: `zeiger.*`.

---

## 3. Ordner

```
index.html            die Seite
css/style.css         Gestaltung (Farben, Radius, Layout)
js/config.js          ← ALLE Einstellungen: Animationen, Schalter, Spalten …
js/kern.js            Bewegungsmodus, Lade-Warteschlange, Platzhalter
js/router.js          Hash-Routing (#/…) und Browser-Zurück
js/leiste.js          gläserne Leiste: Bereiche, Ort (unten / rechts), Wechsel, Umformen, Ladebalken
js/werkzeuge.js       Werkzeuge der Seite hinter dem Trenner (Code-Filter, Views, Lampe, Pfeile)
js/icons.js           feine Linien-Symbole (Lucide)
js/zeiger.js          eigener Mauszeiger (Kreis, Hover-Feld in der Leiste)
js/baum.js            früherer Navigationsbaum (nur mit navigation: 'baum')
js/viewer.js          Produkt-Viewer (Logik aus Website_Test/Object_01)
js/seiten.js          Products-Raster, Produktseite (+ Customize/To Order/Payment), About Us, Bespoke
js/galerie.js         Galerie (Masonry, endlos) und Lightbox
js/start.js           Startbildschirm
js/app.js             verbindet alles
data/produkte.js      Produkte – ERZEUGT vom Bau-Skript
data/dummies.js       Dummy-Testprodukte (von Hand, an/aus in config.js)
data/galerie.js       Galerie-Liste – ERZEUGT vom Bau-Skript
media/produkte/…      Produktbilder und Videos – vom Bau-Skript kopiert
media/galerie/…       optimierte Galerie-Fotos – vom Bau-Skript erzeugt
_Import/Galerie/      HIER Fotos ablegen (Originale, werden nicht veröffentlicht)
_Import/produkte-zusatz.json   Kategorie und Maße je Produkt, Typ-Kürzel (_typen)
bau/aktualisieren.ps1 Bau-Skript (bau/aktualisieren.cmd = Doppelklick-Version)
fonts/logo/           Logo-Schrift
lizenzen/             Lizenzen und Hinweise
```

---

## 4. Fotos für die Galerie

1. Fotos (JPG oder PNG, beliebige Größe) in **`_Import/Galerie/`** legen.
2. **`bau/aktualisieren.cmd`** doppelklicken (oder `powershell -ExecutionPolicy Bypass -File bau\aktualisieren.ps1`).
3. Seite neu laden.

Das Skript erzeugt je Foto eine Vorschau (längste Seite ca. 800 px) und eine große Version (ca. 2000 px, nie vergrößert). Es entfernt die Metadaten, berücksichtigt die Kamera-Drehung (EXIF) und legt transparente PNGs auf die Seitenfarbe. Die Liste landet in `data/galerie.js`.
Ein Foto entfernen: in `_Import/Galerie/` löschen und das Skript erneut ausführen. Die Reihenfolge in der Lightbox folgt dem Dateinamen.
Solange die Liste leer ist, zeigt die Galerie 24 graue Platzhalter.
Jede Spalte ist eine eigene Endlosfolge mit eigenem Startversatz. So gibt es nirgends eine durchgehende waagerechte Fuge, auch nicht dort, wo neue Runden angehängt werden. Die Fugen aller Spalten liegen nie näher als das Doppelte von `fugenAbstand` (56 px) beieinander. Dasselbe Foto steht nie direkt neben oder über sich selbst.

> Die Originale in `_Import/Galerie/` stehen in `.gitignore`. Veröffentlicht werden nur die optimierten Kopien.

---

## 5. Neue Produkte

Die Produkte kommen ausschließlich aus `C:\Unity\website steel furniture\Website_Test\` (nicht aus `Renders\`). Das Skript liest dort nur und ändert nie etwas.

1. In Unity wie bisher exportieren: Eintrag in `produkte.json`, Ordner `Object_XX/bilder/` und `Object_XX/video/` (+ `video/klein/`).
2. In **`_Import/produkte-zusatz.json`** Kategorie und Maße ergänzen (`produkte.json` kennt sie noch nicht):
   ```json
   "Object_04": { "kategorie": "seating", "masse": "W 500 × D 520 × H 780 mm" }
   ```
   Kategorien: `tables`, `seating`, `storage`, `lighting`. Steht ein Feld später direkt in `produkte.json`, hat es Vorrang.
3. **`bau/aktualisieren.cmd`** ausführen und die Seite neu laden.

**Was das Skript übernimmt:**
- **Bilder:** genau die Bilder aus dem Feld `bilder` von `produkte.json`, nicht abgeleitet aus `perspektiven`. Die Views sind die Kameras dieser Standbilder, nach Nummer sortiert.
- **Abendbilder:** `Still_CamN_abend.jpg` nur bei `"abendbilder": true`.
- **Fahrten:** alle Fahrten zwischen den vorhandenen Kameras, in beiden Richtungen, als `.mp4` und `.webm`, aus `video/` und `video/klein/`.
- **`produkte.json`** selbst als Kopie nach `media/produkte/produkte.json`.

**Beliebig oft wiederholbar:** Eine einzelne Perspektive neu gerendert? Einfach noch einmal ausführen.
- **Kopieren:** Nur Dateien, deren Größe oder Änderungszeit sich unterscheidet, werden ersetzt (im Fenster als „ersetzt“).
- **Aufräumen:** Was es in der Quelle nicht mehr gibt, wird entfernt. Nichts wird doppelt angelegt.
- **Datenliste:** `data/produkte.js` wird nur neu geschrieben, wenn sich wirklich etwas geändert hat.
- **Neu laden:** Jede Produktdatei trägt eine Versionsmarke (`?v=…`), die sich mit den Dateien ändert. So lädt auch ein Browser mit Cache die neue Fassung.
- **Fehlende Dateien:** Am Ende listet das Skript alle Dateien, die gefehlt haben, z. B. ein Bild aus `bilder`, das es nicht gibt, oder eine fehlende Fahrt/Richtung/Größe.

Optionen des Skripts: `-OhneGalerie`, `-OhneProdukte`, `-NurDaten` (nur `data/produkte.js`, keine Medien kopieren), `-Neu` (Galerie-Bilder neu rechnen), `-Quelle <Ordner>`.

**Dateinamen** (pro Produkt unter `media/produkte/<Name>/`, gleich wie in Unity):

| Datei | Bedeutung |
|---|---|
| `bilder/Still_Cam1.jpg` … | Standbild je View (View 1 = Kachel) |
| `bilder/kachel/Still_Cam1.jpg` (+ `_abend`) | kleine Kopie von View 1 für die Kacheln (800 px breit, vom Skript erzeugt, `-KachelBreite`) |
| `bilder/Still_Cam1_abend.jpg` … | Abendbild je View (nur Produkte mit Leuchtmittel) |
| `bilder/Axonometrie.jpg` | Axonometrie für Customize (noch nicht im Unity-Export: bis dahin Platzhalter, von Hand ablegen möglich) |
| `video/Move_Cam1_Cam2.mp4` / `.webm` | Fahrt von View 1 nach View 2 |
| `video/klein/…` | dieselben Fahrten für Handys (unter 760 px Fensterbreite) |

**Platzhalter → echte Dateien:** Die Seite verwendet genau die Dateien, die das Skript in `data/produkte.js` eingetragen hat. Produkte ohne Bilder (z. B. ein neuer Eintrag in `produkte.json` ohne Renderings und die Dummies) zeigen graue Platzhalter. Fehlende Fahrten werden zu einem schlichten Überblenden. Fehlt eine Fahrt nur in einer Größe, wird die andere Größe genommen. Abschalten lässt sich das mit `echteDateienVerwenden: false` in `js/config.js`.

Die Größenklasse aus `produkte.json` (`"klasse": "L" | "M" | "S"`; fehlt sie dort, `klasse` in `produkte-zusatz.json`) benutzen der Größen-Filter und der Code. Die Nummer im Namen (Object_**03**) bestimmt die Reihenfolge (neueste = höchste Nummer zuerst) und das Ende des Codes. Das Bau-Skript schreibt je Produkt `code` (z. B. `OBJ_LT_M_03`), `format` (Breite, Höhe der Standbilder) und `kachel` / `kachelAbend` (die kleinen Kachelbilder) in `data/produkte.js`.

**Dummy-Produkte:** `data/dummies.js` enthält 8 klar markierte Testprodukte über alle Kategorien und Größen. Abschalten: `dummiesZeigen: false` in `js/config.js`.

---

## 6. Animationen und Einstellungen

Alles steht in **`js/config.js`** (kommentiert). Speichern, Seite neu laden, fertig. Die wichtigsten Einträge:

| Einstellung | Wirkung |
|---|---|
| `animationen: false` | schaltet alle Bewegungen und Überblendungen ab |
| `reduzierteBewegungBeachten` | bei „Bewegung reduzieren“ im System: nur schlichtes Überblenden (`reduziertDauer`) |
| `eckradius` | der eine Eckradius für alle Flächen (Standard 3 px) |
| `fugeHoehe` | Höhe der Fuge Wand/Boden im Platzhalter des Produktbilds (0.163 = in den Unity-Renderings gemessen; die Kacheln sind schlicht grau) |
| `navigation` | `'leiste'` (Standard, gläserne Leiste) oder `'baum'` = der frühere Navigationsbaum, abgeschaltet, zum Vergleich |
| `bereiche` | Namen und Reihenfolge der Bereiche in der Leiste (Namensschilder) |
| `zeiger.groesse`, `zeiger.hoverGroesse` | Mauszeiger: Durchmesser, Durchmesser über Kacheln/Fotos (`zeiger.an` = an/aus) |
| `zeiger.verschmelzen` | Hover-Feld der Leiste wächst aus dem Zeiger in die Feldform und zurück (ms); der Kreis bleibt immer sichtbar obenauf |
| `start.*` | Startbildschirm: Logo und Leiste einblenden, Logo ausblenden (`zusammenpacken`, `zurWurzel` nur im Baum-Modus) |
| `start.laden.*` | Ladebalken im Umriss der Leiste: an/aus, `minimum` (1200 ms), `maximum` (5000 ms nach dem Aufruf), `ausblenden` der Füllung |
| `welle.*` | Aufsteigen der Kacheln und Fotos: Dauer je Element, Hub, ganze Welle, Versatz, wie lange auf ein Bild gewartet wird |
| `leiste.radius` | Rundung der Leisten-Enden (999 = ganz rund; z. B. 14 = nur weich gerundet), gilt auch für Namensschilder und Optionsleisten |
| `leiste.feld`, `feldHandy`, `icon`, `strich` | Größe der runden Felder, Symbolgröße, Linienstärke der Symbole |
| `leiste.blur`, `leiste.glasDeckkraft` | wie stark der Hintergrund hinter dem Glas verschwimmt, wie deckend das Glas ist |
| `leiste.abstandRand`, `abstandRandHandy` | Abstand zum unteren und rechten Rand (auch der Rand des Inhalts) |
| `leiste.wechsel` | Wechsel unten ↔ rechts: alte Leiste zieht sich zum Punkt zusammen, neue wächst aus einem Punkt (Test-Bereich 300–400 ms, unterbrechbar) |
| `leiste.umformen` | gleicher Ort, anderer Inhalt: Glas wächst / schrumpft |
| `leiste.klappfeld` | die kleine Optionsleiste eines Code-Segments fährt aus / ein |
| `leiste.codeVollstaendig` | NUMBER gewählt: so lange steht der vollständige Code, dann öffnet die Produktseite |
| `leiste.hoverZoom`, `leiste.namensschild` | Symbol beim Hover etwas größer, Namensschilder an/aus |
| `baum.*` | nur im Baum-Modus |
| `layout.*` | nur im Baum-Modus (Breite des Inhalts, Rand, Baumbreite) |
| `seite.kachelZumViewer` | Dauer, mit der die Kachel ins Vollbild zoomt (zurück: 85 % davon) |
| `produkte.raster` | Kacheln pro Reihe je Fensterbreite (5 / 4 / 3 / 2) |
| `produkte.abstand`, `produkte.abstandHandy` | Abstand zwischen den Kacheln |
| `produkte.umsortieren`, `produkte.einAusblenden` | Kacheln gleiten an neue Plätze / blenden ein und aus |
| `produkte.kachelMinBreite` | Mindestbreite einer Kachel, damit alle echten Produkte in die erste Reihe passen |
| `produkte.hoverZoom` | Zoom beim Hover (1.03 = 3 %) |
| `viewer.standbildRaus`, `viewer.standbildRein` | View-Wechsel: Standbild → erstes Videobild und letztes Videobild → Standbild der Zielkamera (je 100 ms; verdeckt, dass die Fahrten weniger Samples haben als die Standbilder) |
| `viewer.ueberblenden` | View-Wechsel ohne Video (Datei fehlt, „Bewegung reduzieren“): schlichtes Überblenden |
| `viewer.handyBreite` | bis zu dieser Fensterbreite Videos aus `video/klein/` (wird bei jeder Fahrt neu entschieden) |
| `viewer.lampe` | Überblenden ins Abendbild (ms) |
| `viewer.lampeVorFahrt` | View-Wechsel bei eingeschalteter Lampe: erst so lange zurück auf Tag, dann die Fahrt |
| `viewer.lampeNachFahrtWiederAn` | nach einem View-Wechsel bei eingeschalteter Lampe wieder ins Abendbild |
| `viewer.heimAusblenden` | zurück in der Kachel und auf View 1: der Viewer blendet in das gleiche Kachelbild aus |
| `viewer.ringVoll` | Fahrt war noch nicht geladen: so lange steht der volle Ring, dann startet die Fahrt |
| `galerie.spalten` | Spalten je Fensterbreite (5 / 4 / 3 / 2) |
| `galerie.fugenAbstand` | Spaltenkanten näher als dieser Abstand gelten als „gleiche Höhe“ und werden vermieden |
| `vorladen.*` | Vorladen: Kachel- und Galeriebilder im Ladebalken, danach Standbilder und Fahrten im Hintergrund, beim Hover |

Farben und Schriftgrößen stehen oben in `css/style.css` (`:root`).

---

## 7. Hinweise

- **Logo-Schrift:** In `fonts/logo/` lag keine Lizenzdatei, und die Schrift erlaubt laut ihren Metadaten nur eingeschränkte Einbettung. Vor einer Veröffentlichung klären, siehe `lizenzen/SCHRIFT-WESTERNIC-HINWEIS.txt`.
- **Icons:** Lucide (ISC-Lizenz), siehe `lizenzen/LUCIDE-LICENSE.txt`.
- Videos: WebM (AV1), wenn der Browser es sicher kann, sonst MP4 (H.264), genau wie im bisherigen Test.

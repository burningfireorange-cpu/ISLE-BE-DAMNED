# Bericht – Runde 9: Hochformat fürs Handy, nahtloser Zoom mit `kachel_breit`, Veröffentlichung (2026-11-05)

> **Neu: Nachtrag Runde 13 (View-Wechsel hängt online – Ursache, Lösung, Hochladen) ganz am Ende.** Davor die Nachträge Runde 10 und 11.
>
> **Nachträge Runde 10 und Runde 11 (Zoom am iPhone) stehen am Ende dieses Berichts.** Teile von Kapitel 1–4 zum Zoom
> („Zwei-Stufen-Fenster“) und zur Möbel-Regel gelten nicht mehr, ebenso der Zoom-Teil von Runde 10.

**Online-Adresse:** https://burningfireorange-cpu.github.io/ISLE-BE-DAMNED/ (korrigiert in Runde 13; ein Repo `gauge` gibt es nicht)
Noch **nicht online geprüft**: Du lädst selbst über GitHub Desktop hoch (Schritte siehe Kapitel 3). Sag mir Bescheid, dann prüfe ich die Seite online.

## 1. Ergebnis in Kürze

- **Hochformat-Renderings übernommen**, für alle fünf Produkte: Standbilder 2400 × 4800, Fahrten, Fahrten klein, die Abendbilder und Abendfahrten der Lampe, `handykameras` und `bildinfo`.
  - Es fehlt keine Datei. Ein zweiter Lauf des Bau-Skripts meldet „0 neu, 0 ersetzt“.
  - `raum_leer` wird nicht verwendet.
- **Handy senkrecht zeigt jetzt das Hochformat:**
  - Volle Breite, oben bündig, die Leisten liegen unten über dem Boden.
  - Das Möbel liegt in allen 20 Kombinationen (4 Größen × 5 Produkte) über den Leisten und ist seitlich nie angeschnitten.
- **Der Zoom Kachel → Vollbild ist nahtlos, obwohl Cam1 im Hochformat 78 mm Brennweite hat.**
  - Die Lage der Kachel im Hochformat kommt aus `kachel_breit`. Ich habe nachgerechnet: Kachel und Hochformat zeigen pixelgenau dasselbe (PSNR 42 dB).
  - Beim Öffnen füllt das breite Kachelbild die Seiten, die über das Hochformat hinausragen. Das Fenster schließt sich zuerst seitlich und öffnet sich dann nach oben und unten. So ist nie eine Ecke leer, gemessen in je 21 Zwischenbildern.
- **Zurück ist ebenso nahtlos**, auch mit einer Fahrt von einer anderen View zu Cam1.
- **Abendmodus im Hochformat:** Die Abendfahrten im Hochformat laufen, und beim Zurück geht das Licht weich aus (ca. 0,8 s, kein Sprung).
- **Handy quer** zeigt das breite Format.
- **Desktop ist unverändert:** Alter und neuer Code liefern mit denselben Bildern pixelgleiche Screenshots und identische Animationen.
- **Repo:** Für GitHub Pages hat `main` jetzt eine **frische Historie** mit 505 MB statt 739 MB. Die volle Historie bleibt lokal erhalten.

## 2. Was gemacht wurde (mit Commits)

| Commit | Punkt | Inhalt |
|---|---|---|
| `75c3aef` + Tag `vor-hochformat` | 0 | Stand vor dem Hochformat markiert (es gab keine offenen Änderungen, deshalb ein leerer Commit). |
| `ae0a21a` | 1 Übernehmen | Bau-Skript gelaufen: 199 neue Dateien (Hochformat) und 188 ersetzte (Unity hat auch die breiten Fassungen neu gerechnet). Das Skript gibt jetzt zusätzlich `hoch.kachelBreit` (aus `bildinfo.kachel_breit` von Cam1 hoch) und `hoch.brennweite` (je View) weiter. Fehlt `kachel_breit`, greift ein Rückfall mit Hinweis. |
| `fd2f715` | 2 Handy senkrecht | `G.buehne()`: volle Breite, oben bündig; schlanke Handys werden Richtung volle Höhe vergrößert. Liegt ein Möbel unter den Leisten oder würde es seitlich angeschnitten, wird das Bild kleiner, je Produkt einheitlich und mit weichem Auslauf. Der Flug Kachel → Vollbild bekommt einen Rahmen, der größer ist als das Hochformat. Darin liegt das breite Kachelbild an den Seiten, und das Fenster öffnet sich in zwei Stufen. Zurück: von View 1 derselbe Weg rückwärts. Nach einer anderen View schrumpft das Bild zuerst auf den 4:3-Ausschnitt im Hochformat, dort läuft die Fahrt zu Cam1 weiter. Danach zieht es sich in der Kachel auf den Kachelausschnitt zurück (neu in config: `seite.kachelZurueckziehen`, 480 ms). Das Abendbild der Kachel fliegt im Abendmodus mit. |
| `a655427` | 3 Testen | Screenshots in `Reports/hochformat/` (siehe unten) |
| `eb4e482` | 4 Hochladen | `main` neu angelegt, mit frischer Historie (gleicher Inhalt wie `a655427`) |
| `577ea8b` | 4 Hochladen | Größe geprüft und Entscheidung festgehalten. CLAUDE.md: Abschnitt „Veröffentlichung“. |
| (dieser) | 5 Bericht | Bericht, README (Hochformat, Zoom, Einstellungen), voriger Bericht nach `Archiv/BERICHT_2026-11-03.md` |

Die Commits `75c3aef` bis `a655427` liegen nach dem Neuanlegen im lokalen Zweig `historie-bis-runde-9`, nicht in `main`.

**Getestet** in Edge headless (Touch-Emulation, kein Hover) über einen lokalen HTTP-Server:

- **Größen 390 × 780, 390 × 664, 430 × 932, 360 × 640, alle fünf Produkte:**
  - Zoom Kachel → Vollbild: eingefroren und in 21 Zwischenbildern geprüft. Dabei war jede Stelle ohne Bild magenta eingefärbt, es blieb keine stehen. Das erste Bild entspricht genau der Kachel.
  - Die Möbel-Regel, View 1, die Nahansicht (letzte View) und beide Wege zurück.
  - Ergebnis: **291 von 292 Prüfungen grün** (die eine Meldung siehe Kapitel 4).
- **Gegenprobe:** Mit absichtlich abgeschaltetem Zwei-Stufen-Fenster meldet derselbe Test 6895 freie Pixel. Er erkennt Lücken also wirklich.
- **Lampe (Object_03):** Die Abendfahrt im Hochformat läuft. Zurück mit Abendfahrt und zurück direkt von View 1 bleiben ohne freie Stelle, und das Licht geht weich aus (größter Sprung je 50 ms: 0,14).
- **Drehen** hoch → quer → hoch: Format wechselt, View 3 und Lampe bleiben erhalten.
- **„Bewegung reduzieren“:** kein Flug, nur Blenden, keine Reste.
- **Baum-Modus:** Desktop und Handy ohne Fehler.
- **Desktop:** 1536 × 730, 1920 × 1080, 2560 × 1080 und 1366 × 625, je alle fünf Produkte. Verglichen wurde der alte Code (Tag `vor-hochformat`) mit dem neuen, beide mit denselben neuen Bildern:
  - Produktwand, Zoom-Zwischenbild, View 1 und View 2 sind pixelgleich.
  - Die Keyframes von Zoom und Rückweg sind identisch.
- 0 JS-Fehler.

**Screenshots** (`Reports/hochformat/<Größe>/`):

- Je Produkt: `…_view1.jpg`, `…_nah.jpg` (Nahansicht) und `…_zoom.jpg` (Zwischenbild des Kachel-Zooms bei 35 %).
- Dazu `…_zurueck_view1.jpg` und `…_zurueck_nah.jpg` (Rückweg).
- Bei 390 × 780 zusätzlich die Lampe: `OBJ_LT_M_03_abend_*.jpg`.
- Auf einen Blick: `Reports/hochformat/uebersicht_<Größe>.jpg` (Zeilen = Produkte; Spalten = View 1, Nahansicht, Zoom) und `quer_780x390_OBJ_LT_M_03.jpg`.

**Lage im Hochformat** (gemessen, Bildbreite × -höhe in px):

| Größe | Bild | Hinweis |
|---|---|---|
| 390 × 780 | 390 × 780 | genau 1:2, alles bildfüllend |
| 390 × 664 | 390 × 780, unten unter den Leisten beschnitten | **Object_02: 348 × 697**, seitlich weicher Auslauf |
| 430 × 932 | 466 × 932, seitlich je 18 px beschnitten | **Object_01: 446 × 893**, unten 39 px weicher Auslauf unter den Leisten |
| 360 × 640 | 360 × 720 | **Object_02: 337 × 675**, seitlich weicher Auslauf |

## 3. Was du zuerst ausprobieren sollst

**Zuerst hochladen** (du hattest „selbst hochladen“ gewählt):

1. **GitHub Desktop:** *File → Add local repository…* → `C:\websites\gauge`.
2. **Publish repository:** Name `gauge`, **„Keep this code private“ abwählen** (GitHub Pages ist bei kostenlosen Konten nur für öffentliche Repos möglich).
   - Veröffentlicht wird nur der aktuelle Zweig `main` (~0,5 GB, das dauert etwas).
   - Den Zweig `historie-bis-runde-9` bitte **nicht** veröffentlichen, er enthält die alten Renderings.
3. **Auf github.com:** *Settings → Pages → Source: Deploy from a branch → `main` / `(root)` → Save*.
   - Nach 1–2 Minuten ist die Seite unter https://burningfireorange-cpu.github.io/gauge/ erreichbar.
4. **Sag mir Bescheid:** Ich prüfe dann, ob die Seite online lädt (Bilder, Videos, Hochformat).

**Dann am Handy (senkrecht halten):**

1. **Products → Kachel OBJ_ST_M_05 (Sessel) antippen:** Achte auf den Zoom. Die Kachel öffnet sich ohne Sprung ins Hochformat: erst schließen sich die Seiten, dann wächst das Bild nach oben und unten.
2. **View 3 (Nahansicht) wählen, dann Products:**
   - Die Fahrt zu Cam1 läuft im schrumpfenden Bild weiter.
   - In der Kachel zieht sich das Bild dann ein Stück zurück, und die Seiten der Kachel kommen dazu.
   - Danach Products direkt von View 1 aus: derselbe Weg wie beim Öffnen, rückwärts.
3. **OBJ_LT_M_03 (Lampe):** Glühbirne an, View 2 (Abendfahrt im Hochformat), dann Products. Das Licht geht in der Kachel weich aus.
4. **Handy drehen:** Quer kommt das breite Bild, wieder senkrecht das Hochformat. Die View bleibt.
5. **OBJ_SH_M_02 (Regal)** auf einem kleineren Handy ansehen (siehe Kapitel 4).

## 4. Was auffällig ist

- **Object_02 (Regal) ist auf kurzen Handys schmaler.**
  - Bei 390 × 664 und 360 × 640 sind es 348 bzw. 337 px Breite, mit weich auslaufenden Seiten.
  - Grund: In View 2 steht das Regal so hoch im Bild, dass es sonst unter den Leisten läge. Die Größe ist je Produkt einheitlich (wie am Desktop), deshalb gilt das auch für View 1 und 3.
- **430 × 932, Object_01:**
  - Das Bild wird nicht ganz auf volle Höhe vergrößert, sonst wäre der Tisch in View 2 seitlich näher als 20 px am Rand.
  - Die unteren 39 px laufen deshalb weich aus. Sie liegen ganz unter den Leisten.
- **Eine Meldung im Test:**
  - Wo: 360 × 640, Object_02, Rückweg von View 1.
  - Was: Am oberen und unteren Bildrand erscheint kurz eine Haarlinie unter 1 px (30 Pixel insgesamt). Sie entsteht durch Kantenglättung beim Verkleinern.
  - In Wirklichkeit ist sie hellgrau statt magenta und kaum zu sehen.
- **Bei verkleinertem Hochformat** (Object_02 auf kurzen Handys) sieht man im Flug durch die weichen Kanten die Products-Seite. Das entspricht dem Endzustand (Kanten laufen in die Seite aus). Vorher lag dort ein grauer Hintergrund, der am Ende gesprungen wäre.
- **`bildinfo`:**
  - Bei Object_03 Cam2 hoch und Object_04 Cam3 hoch ist `kachel_breit` gefüllt, obwohl nur Cam1 eine Kachel hat. Das wird nicht verwendet.
  - `brennweite` wird nur durchgereicht. Der Zoom braucht nur `kachel_breit`.
- **`handykameras`** wird weiter nur durchgereicht. Am Handy sind alle Views wählbar.
- **Größe:**
  - `media` ist von 209 auf 502 MB gewachsen, vor allem durch die Hochformat-Videos.
  - Die größte Datei hat 5,1 MB (Grenze 100 MB).
  - Volle Historie: 739 MB. Frische Historie: 505 MB.
- **Warum frische Historie:** Die volle Historie wäre mit 0,74 GB knapp unter 1 GB gewesen, und der nächste Renderlauf hätte die Grenze überschritten. Die frische Historie kostet am wenigsten:
  - Keine Datei geht verloren, die Webseite ist identisch.
  - Lokal bleibt alles im Zweig `historie-bis-runde-9` und am Tag `vor-hochformat`.
  - Videos außerhalb von git oder Git LFS wären teurer: LFS-Kontingent, und Pages liefert LFS-Dateien nicht aus.
- **Nicht getestet:**
  - Auf einem echten iPhone, nur in der Emulation. Gerade die Kanten beim Zoom und das Drehen bitte am Gerät ansehen.
  - Online, weil die Seite noch nicht hochgeladen ist.

## 5. Offene Fragen

1. **Möbel-Regel je View statt je Produkt?** Dann wäre das Regal (Object_02) in View 1 auch auf kurzen Handys bildfüllend, aber beim Wechsel zu View 2 würde das Bild weich kleiner. Im Moment ist die Größe je Produkt einheitlich.
2. **`handykameras`:** Sollen am Handy nur diese Views wählbar sein (z. B. Object_03 nur View 3)? Im Moment werden alle gezeigt.
3. **Alte Historie lokal:** Darf ich den Zweig `historie-bis-runde-9` irgendwann aufräumen (spart lokal ~0,7 GB)? Eilt nicht, er stört nicht.
4. Weiter offen aus Runde 7/8: echte Produktfotos und Galerie-Originale (`_Import/Galerie/`).

---

## Nachtrag – Runde 10: zwei Fehler am iPhone (2026-11-05)

### Ergebnis in Kürze

- **Weiße Streifen beim Zoom: behoben.** Statt des Zwei-Stufen-Fensters gibt es jetzt **eine** Bewegung. Das breite Kachelbild zoomt hinein und blendet dabei ins Hochformat über, zurück genauso.
  - Im Fenster liegt während der ganzen Animation immer das vergrößerte Kachelbild als Unterlage, nie Weiß und nie Seitenhintergrund.
- **Weißer Rand mit weichem Auslauf: entfernt.** Die Regel, die das Bild je Produkt verkleinert hat, ist komplett gelöscht. Am Handy senkrecht ist das Bild immer bildfüllend: volle Breite, oben bündig, ohne Rand und ohne Auslauf.

| Commit | Punkt | Inhalt |
|---|---|---|
| `4498201` | 2 | `G.buehne` im Hochformat: nur noch volle Breite (bzw. volle Höhe bei schlanken Handys), oben bündig, keine Maske. Möbel-Regel, Verkleinern und weicher Rand sind entfernt. |
| `7e6d47b` | 1 | Neuer Zoom `hochFlug` (app.js), Zwei-Stufen-Fenster entfernt. Neue Einstellung `seite.hochUeberblenden` (0,3). README und CLAUDE.md angepasst. |
| (dieser) | – | dieser Nachtrag |

### 1. Weiße Streifen – Ursache und Lösung

- **Ursache:** Das Fenster wurde über ein animiertes `clip-path` geöffnet, der Zoom über `transform`.
  - Safari rechnet `transform` auf der Grafikkarte, `clip-path` aber im Hauptprozess.
  - Bei jedem Ruckler liefen die beiden auseinander: Die Seiten schlossen sich früher, als der Zoom nachkam. So entstanden die weißen Streifen.
- **Jetzt:** Es werden nur noch `transform` und `opacity` animiert. Alle Ebenen laufen mit demselben Takt, das hält der Browser synchron.
  - Das Fenster wächst von der Kachel zum ganzen Bildschirm.
  - Das Hochformat zoomt von seinem Kachelausschnitt mit und blendet über das erste knappe Drittel ein (`seite.hochUeberblenden`). Größer = weicher, aber dann scheint die gestreckte Unterlage länger durch.
  - Darunter liegt das breite Kachelbild zweimal:
    - **vergrößert**, sodass es das ganze Fenster mit 10 px Reserve deckt. Seitlich bleibt es passgenau (dort ist nur Wand und Boden), nach oben und unten wird es gestreckt (oben Wand, unten Boden).
    - **passgenau** auf seinem Ausschnitt, oben und unten weich auslaufend. So erscheint das Möbel beim Überblenden nie doppelt.
  - **Zurück von View 1:** dieselbe Bewegung rückwärts.
    - Im Abendmodus liegt dabei das Abendbild der Kachel darunter, danach geht das Licht weich aus.
    - Nach einer anderen View bleibt der bisherige Weg: Die Fahrt zu Cam1 läuft in der Kachel weiter.
- **Getestet** in Edge headless, Handy-Emulation, Zoom an 11 Zeitpunkten eingefroren:
  - Aufbau: Seite und Leisten ausgeblendet, Seitenhintergrund magenta. Gezählt wurde jede magenta Stelle innerhalb des Fensters.
  - Zusätzlich lief jede Probe mit absichtlich verschobenem Takt (Bilder 8 % vor bzw. hinter dem Fenster), um einen Ruckler nachzustellen.
  - **792 Zwischenbilder, 0 freie Pixel:**
    - 393 × 659 und 390 × 664: alle 5 Produkte, hin und zurück
    - 375 × 548: Tisch und Regal
  - **Gegenprobe** ohne Unterlage: bis zu 110 000 freie Pixel. Der Test erkennt Lücken also.
  - **Ebenfalls geprüft, alles ohne JS-Fehler:**
    - Lampe zurück im Abendmodus: Licht geht weich aus, größter Sprung 0,15 je 50 ms
    - Lampe mit View 2
    - Sessel zurück aus View 3 mit laufender Fahrt
    - Zoom mittendrin abgebrochen und neu geöffnet
    - Drehen hoch → quer → hoch, View bleibt
    - „Bewegung reduzieren“: kein Flug
    - Baum-Modus Desktop und Handy
- **Nicht fertig getestet:** Der große Testlauf wurde vom System abgebrochen, weil der Arbeitsspeicher knapp wurde. Ich habe ihn nicht von selbst neu gestartet.
  - Offen beim Lückentest: 430 × 932, 360 × 640, 430 × 739 und drei Produkte bei 375 × 548.
  - Offen beim Desktop-Vergleich alt gegen neu: 2560 × 1080, 1366 × 625 und Handy quer.
  - Was verglichen ist (1536 × 730, 1920 × 1080): Das Zoom-Bild liegt in alt und neu gleich. Die Unterschiede in den Testbildern kommen von der Seitenüberblendung im Hintergrund, die mein Test nicht anhält.
  - Der Code für Desktop und Handy quer ist rechnerisch unverändert: Ohne Hochformat liefert die vereinfachte Fensterrechnung dieselben Keyframes wie vorher.
  - Wenn du willst, lasse ich den Rest laufen, sobald mehr Speicher frei ist.

### 2. Weißer Rand – warum die alte Rechnung das Bild verkleinert hat

Die Möbel-Boxen aus `bildinfo` stimmen. Ich habe die Box von Regal View 2 auf das Renderbild gezeichnet: Sie liegt genau um das Regal, der tiefste Punkt ist der linke vordere Fuß. Falsch war die Rechnung der Seite:

1. **Leisten 36 px zu hoch angenommen.** Die Regel verlangte, dass das Möbel 36 px über der Oberkante des Werkzeugfelds endet: 16 px Randabstand + 20 px `moebelRand`.
   - Gemessen liegt die Oberkante des Werkzeugfelds (View-Nummern) auf jedem Handy **120 px über dem unteren Rand**. Darunter folgen 8 px Luft, die Leiste (48 px) und 16 px bis zum Rand.
2. **Je Produkt einheitlich:** Lag eine einzige View zu tief (Regal View 2), wurden alle Views kleiner.
3. **Seitliche Regel:** Bei schlanken Handys galten zusätzlich 20 px Abstand zum Seitenrand (Tisch, 430 × 932).

Auf dem häufigsten iPhone-Fenster (393 × 659: iPhone 12–16 in Safari mit Leiste) wurden deshalb Regal und Sessel verkleinert. Der Sessel endet dort in View 2 **29 px über** dem Werkzeugfeld. Das reicht in Wirklichkeit, die Regel verlangte aber 36 px.

### 3. Möbel, die mit der echten Leistenhöhe wirklich darunter liegen (nur gemeldet, nichts geändert)

Gemessen wurde der Abstand von der Möbel-Unterkante (`bildinfo`) zur Oberkante des Werkzeugfelds; negativ = darunter. Nahansichten, die in `bildinfo` als angeschnitten markiert sind, zählen nicht.

| Handy (Fenster) | Produkt | View | Abstand |
|---|---|---|---|
| 393 × 659 (iPhone 12–16, Safari) | OBJ_SH_M_02 (Regal) | 2 | **−34 px** |
| 390 × 664 | OBJ_SH_M_02 (Regal) | 2 | **−25 px** |
| 430 × 739 (Pro Max, Safari) | OBJ_SH_M_02 (Regal) | 2 | **−8 px** |
| 375 × 548 (iPhone SE, Safari) | OBJ_SH_M_02 (Regal) | 2 | **−119 px** |
| 375 × 548 | OBJ_ST_M_05 (Sessel) | 1 / 2 | **−20 / −58 px** |
| 375 × 548 | OBJ_TB_M_01 (Tisch) | 2 | **−37 px** |

- Beim Regal ist es nur die linke vordere Ecke: Die Unterkante steigt nach rechts an, und die Ecke liegt hinter dem linken, runden Ende des Werkzeugfelds.
- Bei 360 × 640, 390 × 780 und 430 × 932 liegt alles darüber.
- Der Unterschied zur Handy-Vorschau kommt wahrscheinlich von Safari.
  - Das Hochformat ist 1:2, das sichtbare Fenster in Safari aber kürzer (z. B. 393 × 659 statt 393 × 786). Das Bild ist oben bündig, also fehlt unten ein Streifen, und die Leisten liegen höher im Bild.
  - Bei 393 × 659 liegt die Oberkante des Werkzeugfelds bei **68,6 % der Bildhöhe**, bei einem vollen 1:2-Fenster bei 84,6 %.
  - Für die Handy-Vorschau in Unity heißt das: Unter 68 % der Bildhöhe muss Platz bleiben, dann passt es auf allen gängigen iPhones außer dem SE.

### 4. Hochladen (GitHub Desktop)

Das Repository ist online noch nicht vorhanden (github.com/burningfireorange-cpu/gauge meldet 404), und in git ist kein Remote eingetragen. Deshalb gelten die Schritte aus Kapitel 3:

1. *File → Add local repository…* → `C:\websites\gauge`.
2. **Publish repository:** Name `gauge`, „Keep this code private“ **abwählen**. Den Zweig `historie-bis-runde-9` nicht veröffentlichen.
3. Auf github.com: *Settings → Pages → Deploy from a branch → `main` / `(root)` → Save*.

Falls du schon veröffentlicht hast (z. B. privat oder aus einer anderen Kopie): in GitHub Desktop `C:\websites\gauge` öffnen und oben **Push origin** drücken.

Upload-Größe: 505 MB, unverändert, Grenze ca. 1 GB.

---

## Nachtrag – Runde 11: Zoom am iPhone ohne weißen Rand rechts (2026-11-05)

### Ergebnis in Kürze

- **Der Zoom läuft jetzt in zwei Schritten, die nacheinander kommen:**
  1. Das breite Kachelbild zoomt, bis sein Kachelausschnitt genau dort liegt, wo er im Hochformat liegt (`kachel_breit`). Das Fenster wächst dabei von der Kachel zum ganzen Bildschirm.
  2. Erst dann blendet es in 200 ms ins Hochformat über. Voraussetzung: Das Hochformat-Standbild ist geladen, im Viewer eingeblendet und dekodiert (`img.decode()`). Bis dahin bleibt das Kachelbild stehen, höchstens 2,5 s.
- **Zurück genauso, nur umgekehrt:** erst 200 ms ins Kachelbild überblenden, dann herauszoomen.
- **Rund um das Kachelbild liegt immer Bild, mit großer Reserve.** Läuft das Fenster am iPhone kurz aus dem Takt, verschiebt sich das Bild nur ein wenig, es wird nichts frei.
- **Test: 0 Lücken** in 3210 eingefrorenen Zwischenbildern und in 1581 Bildern in Echtzeit (CPU gedrosselt bzw. Standbild verspätet).
- **Desktop ist unverändert.**

| Commit | Punkt | Inhalt |
|---|---|---|
| `8459bab` | 1–4 | Neuer Ablauf in `hochFlug` (app.js): Zoom bis zur Endlage, dann überblenden. Neue Einstellungen `seite.hochBlende` (200 ms) und `seite.hochWarten` (2500 ms), `hochUeberblenden` entfällt. README und CLAUDE.md angepasst. |
| `2e5cc73` | Test | Übersichten in `Reports/hochformat/runde11/` |
| (dieser) | – | dieser Nachtrag |

### Ursache: warum der Schnitt gerade rechts entstand

1. **Fenster und Bilder liefen getrennt.**
   - Das Fenster war ein eigenes Element, das per `transform` von der Kachel auf den Bildschirm wuchs.
   - Die Bilder darin wurden mit eigenen Animationen gegenskaliert. Das stimmt nur, solange beide exakt im selben Takt laufen.
   - In derselben Fenster-Animation steckte auch der Eckradius (`border-radius`). Den kann Safari nicht auf der Grafikkarte animieren. Damit war nicht gesichert, dass Fenster und Bilder am iPhone im selben Takt bleiben. Im Desktop-Browser laufen sie synchron, deshalb zeigte mein Test damals 0 Fehler.
2. **Ursprung oben links (`transform-origin: 0 0`).**
   - Läuft das Fenster dem Bild um einen Bruchteil voraus, ist der Fehler am linken Rand null und wächst nach rechts.
   - Am rechten Rand ist er also am größten. Unten wächst er genauso, dort liegt aber der gleichfarbige Boden unter den Leisten.
3. **Kaum Reserve.** Das Unterlagebild lag seitlich passgenau bis an den Fensterrand, mit nur 10 px Reserve.
4. **Zu früher Bildwechsel.**
   - Das Hochformat blendete schon im ersten Drittel ein.
   - Es ist aber bis zum Ende schmaler als das Fenster, denn die Kachel ragt links und rechts je 28 % über das Hochformat hinaus.
   - Seine Seitenkanten standen also mitten im Bild. Das war das „zu frühe Umschalten“.
- **Die Breite des Containers war nicht falsch.** Rechnerisch stimmte der Ausschnitt, deshalb fiel der Fehler nur am Gerät auf.
- **Einschränkung:** Am iPhone selbst kann ich das nicht messen. Punkt 1 und 2 sind die schlüssigste Erklärung für „nur rechts“.

### Lösung

- **Nur noch `transform` und `opacity`.** Das Fenster bewegt sich nur noch. Der Ausschnitt mit dem Eckradius ist ein eigenes Element darin (`.flug-fenster`).
- **Ebenen im Fenster, von unten nach oben:**
  1. Die gespiegelten Ränder des breiten Kachelbilds: oben die Wand, unten der Boden. Sie schließen an der Kante nahtlos an und reichen 30 % der Fensterhöhe + 24 px über das Fenster hinaus.
     - Nötig sind sie, weil das breite Bild (12:5) im Hochformat nur ein Band von 5–64 % der Höhe deckt.
  2. Die kleine Kopie des Hochformats an ihrer Endlage. Im Band passt sie pixelgenau zum Kachelbild, darüber und darunter zeigt sie die echte Wand und den echten Boden.
  3. Das breite Kachelbild genau auf seinem Ausschnitt. Seitlich reicht es immer mindestens 40 % der Fensterbreite über das Fenster hinaus.
- **Zurück aus der Wartezeit:** Wer zurücktippt, während das Kachelbild noch auf das Standbild wartet, bekommt sofort den Rückweg. Vorher lag das Bild bis zu 2,5 s über der Produktwand. Das fiel erst in diesem Test auf.

### Test

Aufbau:
- Edge headless mit Touch-Emulation, über einen lokalen Server.
- Seitenhintergrund magenta, das Innere des Fensters grün.
- Jede grüne oder magenta Stelle im Fenster zählt als Fehler.

| Test | Bilder | Fehler |
|---|---|---|
| Eingefroren: 390 × 780, 390 × 664, 430 × 932, 360 × 640 × alle 5 Produkte + Lampe abends. Je 31 Zeitpunkte hin und zurück, dazu Fenster und Bilder absichtlich ±12 % aus dem Takt, Überblenden und Endseite | 2568 | **0** |
| Dasselbe noch einmal mit dem Endstand, 390 × 664 | 642 | **0** |
| Echtzeit, CPU 6-fach gedrosselt: 390 × 780 und 360 × 640, alle Produkte hin und zurück | 873 | **0** |
| Echtzeit, Server liefert das Standbild verspätet (2,5–4,5 s), auch mit CPU 6-fach, 390 × 664 und 430 × 932 | 638 | **0** |
| Echtzeit ohne Drosselung, 390 × 664, Tisch | 70 | **0** Lücken (1 Bild mit zu runder Ecke, siehe unten) |
| Gegenprobe ohne Spiegelränder und Hochformat-Kopie | 107 | bis 338 000 Lückenpixel je Bild: Der Test findet Lücken |

- **Zeiten mit spätem Standbild** (Regal OBJ_SH_M_04):
  - Zoom fertig nach 751 ms, das Standbild ist bei 1965 ms da, Überblenden ab 2035 ms.
  - Kommt das Standbild gar nicht, wird nach 2,5 s übergeblendet (bei 3268 ms).
  - Das Kachelbild hat dabei immer gestanden.
- **Ohne Drosselung:** Überblenden 40–100 ms nach dem Zoom.
- **Desktop alt gegen neu** (1536 × 730, 1920 × 1080, 2560 × 1080, 1366 × 625, Handy quer 780 × 390 und 844 × 390):
  - Alle 60 Keyframe-Sätze sind identisch.
  - Produktwand und Produktseiten sind pixelgleich.
  - Die Zoom-Zwischenbilder unterscheiden sich nur in der Seitenüberblendung im Hintergrund, die der Test nicht anhält.
- **Außerdem geprüft, alles ohne JS-Fehler und ohne Reste:**
  - Lampe zurück im Abendmodus: Licht geht weich aus, größter Sprung 0,17 je 50 ms.
  - Lampe mit View 2 und Sessel aus View 3: die Fahrt läuft in der Kachel weiter.
  - Mittendrin abgebrochen.
  - Drehen.
  - „Bewegung reduzieren“.
- **Übersichten:** `Reports/hochformat/runde11/390x780_<Produkt>_auf.jpg` und `…_zu.jpg`, je 6 Zwischenbilder.
- **Am Rand des Tests:**
  - Nicht gezählt wurde jeweils der äußerste Pixel der Fensterkante und die 3-px-Rundung der Kachel. Die Kante selbst ist geglättet und zeigt dort Seite und Bild gemischt.
  - In einem Echtzeitbild war die Ecke kurz rund 6 statt 3 px rund. Der Eckradius läuft mit Absicht getrennt vom Zoom und kann einen Takt nachhinken. Das ist eine Ecke, keine Lücke im Bild.

### Was auffällig ist

- **Während des Zooms:** Seitlich neben dem Hochformat (nur wenige px breit, oben und unten neben dem Kachelbild-Band) ist die gespiegelte Wand bzw. der gespiegelte Boden zu sehen statt der echten. Die Struktur ist etwas anders, in der Bewegung kaum sichtbar. Am Ende ist dieser Streifen weg.
- **Nicht getestet:** auf dem echten iPhone. Bitte dort ansehen, vor allem den rechten Rand.

### Hochladen (GitHub Desktop)

- github.com/burningfireorange-cpu/gauge meldet weiterhin **404**. Entweder ist das Repo noch nicht veröffentlicht, oder es ist privat. In git ist kein Remote eingetragen.
- Upload-Größe: 506 MB (Grenze ca. 1 GB).
- **Noch nicht veröffentlicht:**
  1. GitHub Desktop: *File → Add local repository…* → `C:\websites\gauge`.
  2. **Publish repository:** Name `gauge`, „Keep this code private“ **abwählen**.
     - Nur `main` veröffentlichen, **nicht** den Zweig `historie-bis-runde-9`.
  3. Auf github.com: *Settings → Pages → Deploy from a branch → `main` / `(root)` → Save*.
- **Schon veröffentlicht** (privat oder aus einer anderen Kopie): in GitHub Desktop `C:\websites\gauge` öffnen und **Push origin** drücken.
  - Ist das Repo privat: unter *Settings → General → Danger Zone → Change visibility* auf *Public* stellen. Pages ist bei kostenlosen Konten nur für öffentliche Repos möglich.

### Offene Frage

- Passt die Überblendzeit von 200 ms (`seite.hochBlende`)? Kürzer wirkt härter, länger lässt das Kachelbild länger stehen.


---

## Nachtrag – Runde 13: View-Wechsel hängt online (2026-11-06)

### 1. Ergebnis in Kürze

- **Beim Hochladen ist nichts kaputt.**
  - Online liegt genau der Stand aus `C:\websites\gauge`: gleiche Dateinamen (auch Groß-/Kleinschreibung), gleicher Inhalt.
  - Alle 270 Pfade, die die Seite braucht, liefern online `200`.
  - `.gitignore` schließt keine Datei aus, die die Seite braucht.
- **Die Verzögerung kam von der Wartelogik beim View-Wechsel.**
  - Lokal fällt sie nicht auf, weil `file://` alles sofort liefert.
  - Unter echtem Netz (online gemessen ca. 3–7,5 Mbit/s) hat sie gewartet, die Markierung springen lassen und Taps in eine Warteschlange gestellt.
- **Behoben:**
  - Die angetippte Nummer ist **sofort** markiert, gemessen 0–2 ms (gefordert: unter 50 ms), und bleibt markiert.
  - Lädt die Fahrt noch, bleibt das Standbild stehen, und der Ladering füllt sich in der markierten Nummer. Die Fahrt startet, sobald sie durchspielen kann.
  - Am Ende der Fahrt gibt es kein Warten und kein Grau mehr: Das letzte Videobild bleibt stehen, das Standbild blendet darüber ein.
  - Mehrfach-Tippen bricht sauber ab, es gibt keine Warteschlange mehr.
- **Gedrosselter Test** (kalter Cache, Handy und PC, alle 5 Produkte, alle Views, Lampe), alter gegen neuen Stand:

  | | alter Stand (= online) | neuer Stand |
  |---|---|---|
  | Fahrtstart, Slow 4G, Handy | 14,6 s | 2,5–3,5 s |
  | Fahrtstart, Slow 4G, PC | 15,2 s | ca. 7 s |
  | Mehrfach-Tippen | 1,75 s bis zur Markierung | 0,27 s bis zum Ziel |
  | Fehler | 40 Probleme | 0 Probleme, 0 × 404 |

- **Du kannst hochladen.** Der Kopierweg bleibt wie bisher, neu ist nur ein Prüf-Doppelklick vor dem Push (siehe 3).

### 2. Was gemacht wurde (mit Commits)

**Zuerst: der GitHub-Desktop-Ordner (Zusatzauftrag 1–2).**

- Der Ordner heißt `C:\Users\Martin\Documents\GitHub\ISLE-BE-DAMNED`.
- **Ich habe dort nie etwas geändert**, weder in dieser noch in früheren Sitzungen. Eine Sitzung vom 4.11. hat ihn nur gelesen. `git status` dort: sauber, HEAD `b0ae003`.
- Vergleich mit `C:\websites\gauge`:
  - 587 = 587 Dateien, exakt gleiche Namen und gleicher Inhalt.
  - Nur `_Papierkorb` (10 alte Kacheln) wird von `.gitignore` ausgeschlossen; das ist richtig so.
  - `git ls-files` und `origin/main` (577 Dateien) stimmen exakt mit den Namen auf der Platte überein. Es gibt keine Endung in Großbuchstaben und keine Datei, deren Name sich nur in der Schreibweise geändert hat.
  - Online (Pages) entspricht `b0ae003`.
- **Die Verzögerung kommt also nicht vom Kopierweg.** (Commit `c0b9c14`)

**Ursache** (`863839e`; geprüft gegen den Stand vor Runde 12, `3664876`):

1. **Markierung:** Beim Antippen zeigte das Symbol kurz die neue Nummer und sprang dann zurück auf die alte, solange die Fahrt lud (`werkzeuge.js`: `info.laden ? aktuell …`). Das war das „komische Markieren“.
2. **Leitung geteilt:** Die angetippte Fahrt musste sich die Leitung teilen:
   - mit dem 1,5-MB-Standbild von View 1, das der Zoom mit höchster Priorität anfordert;
   - mit Hintergrund-Ladevorgängen anderer Produkte. Die Warteschlange kannte keinen Vorrang und keinen Abbruch.

   Ergebnis: Die Fahrt startete erst nach 4–15 s statt nach ca. 0,5 s.
3. **Ende der Fahrt:** Bis zu 4 s wurde auf das Zielstandbild gewartet, danach blieb die Fläche grau. Alter Stand bei Slow 4G: 26 von 40 Wechseln endeten grau.
4. **Tippen während einer Fahrt:** Die Taps kamen in eine Warteschlange (erst die laufende Fahrt zu Ende, dann die nächste). Die Markierung kam erst nach ca. 1,7 s.

**Ehrlich dazu:** Runde 12 hat diese Logik nicht verändert. Runde 11 ist unter derselben Drosselung genauso langsam (Messung `runde11_*`).
- Wahrscheinlich fiel es jetzt auf, weil nach dem Hochladen viele neue Dateien nicht im Cache lagen (kalter Cache).
- Dazu kam ein Rest aus Runde 12: Am Handy wurden die breiten Kacheln für die Order-Seite zusätzlich zu den Hochformat-Kacheln geladen.

**Lösung:**

- **`7edee0e` (Hauptteil):**
  - `werkzeuge.js`: Die Markierung folgt sofort dem Ziel (`ziel || aktuell`). Der Ladering liegt hell in der markierten Nummer (`style.css`).
  - `kern.js` (Lade-Warteschlange):
    - Eine angetippte Datei (Vorrang „sofort“) lädt allein. Laufende niedrigere Dateien gehen zurück in die Warteschlange, statt mitzulaufen.
    - Dateien des offenen Produkts verdrängen den Hintergrund.
    - Eine langsame Datei gibt nur ihre Leitung frei und scheitert nicht.
  - `viewer.js`:
    - Die angetippte Fahrt startet bei `canplaythrough`. Ihr Rest lädt danach noch allein, höchstens `viewer.nachlaufen` = 8 s (neu in `config.js`).
    - Beim Antippen treten die Standbilder zurück. Das Zielstandbild lädt erst nach der Fahrt; bis dahin steht das letzte Videobild ein.
    - Umlenken ist in jeder Phase möglich:
      - während der Lampen-Blende: nur das Ziel ändern;
      - während des Ladens: aufgeben und die neue Fahrt nehmen;
      - während einer laufenden Fahrt: das Bild hält an, das Standbild der neuen View blendet darüber ein.
  - `seiten.js`: Das Kachelbild der Order-Seite lädt erst beim Öffnen von „To Order“. Am Handy kommen so keine breiten Kacheln mehr mit.
  - README: Bedienung des View-Wechsels, Einstellung `viewer.nachlaufen`, Hochladen mit Prüfskript.
- **`5e83936`** (Nachbesserung aus den Tests):
  - Vorgeladene Videos behalten ihre Leitung, bis ihr Rest da ist. Sonst stapelten sich unsichtbare Downloads.
  - Ein Video gibt erst auf, wenn `wartenJeDateiMs` lang gar nichts ankommt.
- **`29cfdaa`:** Auf der Produktseite laden zuerst die Fahrten ab der aktuellen View, danach erst ihr großes Standbild. Die kleine Kopie bzw. das letzte Videobild steht bis dahin ein.
- **Formate:** Es wird nur das nötige Format geladen. Im Test lud das Handy senkrecht nie ein breites Bild oder großes Video und der PC nie ein Hochformat oder kleines Video.
- **Handy-Zoom** (Runde 11/12): unverändert. Rauchtest hin und zurück bestanden: kein weißer Rand, kein Sprung, die Kachelbilder kommen zurück.

**Weitere Commits:**

- **Zusatzauftrag (`38adc03`):**
  - Feste Regel in `CLAUDE.md`: nur in `C:\websites\gauge` arbeiten, den GitHub-Ordner nur lesen, nie `git push`, Hochladen über GitHub Desktop.
  - Im Abschnitt „Veröffentlichung“ korrigiert: Repo ISLE-BE-DAMNED, Kopierweg, die `core.ignorecase`-Falle, Repo-Größe.
  - Neu: `bau\hochladen-pruefen.cmd` (liest nur, siehe 3).
- **Nachgeholt aus Runde 12:** Code und Übersichten des Handy-Zooms lagen schon online, waren hier aber nicht committet (`5fd0219`, `9f1860e`). Einen Nachtrag zu Runde 12 gab es in diesem Bericht nicht.
- **Tests:** Messungen und Testskripte liegen in `Reports/netz/runde13/` (`109893b`).

**Test** (eigener Drosselserver: eine gemeinsame Bandbreite + Latenz wie ein echter Anschluss; Edge headless; kalter Cache; Handy 390 × 664, PC 1536 × 730; Slow 4G = 1,6 Mbit/s / 560 ms, Fast 4G = 9 Mbit/s / 165 ms):

| Lauf | alter Stand (= online) | neuer Stand |
|---|---|---|
| Slow 4G Handy | Fahrtstart Median 14,6 s, 40 Probleme: Markierung sprang 13×, grau 18×, Mehrfach-Tippen 1,75 s | Fahrtstart Median 3,5 s / max 6,0 s; nach `29cfdaa` 2,5 s / max 4,1 s (2 Produkte) |
| Slow 4G PC (große Videos) | Fahrtstart 15,2 s, 40 Probleme | Fahrtstart Median 6,7 s / max 12,6 s; nach `29cfdaa` ca. 7,0 s / max 7,6 s |
| Fast 4G Handy | 13 Probleme, Mehrfach-Tippen 1,75 s | Fahrtstart Median 0,67 s, fertig ca. 3,0 s |
| Fast 4G PC | 13 Probleme | Fahrtstart Median 0,84 s |
| Lampe (Object_03) | – | 0 Probleme, die Lampe bleibt an |
| alle Läufe neu | – | Markierung 0–2 ms, Mehrfach-Tippen ca. 270 ms, Tippen während Fahrt ca. 330 ms, 0 JS-Fehler, 0 × 404, kein falsches Format |

Außerdem bestanden:
- Rauchtest „Bewegung reduzieren“: nur Blenden, keine Fahrten.
- Desktop unverändert.
- Baum-Modus funktioniert.

### 3. Was du zuerst ausprobieren sollst

1. **Hochladen wie gewohnt:**
   1. In `C:\websites\gauge` Strg+A und kopieren.
   2. Im GitHub-Ordner alles löschen und einfügen.
   3. **Neu:** In `C:\websites\gauge\bau` (nicht im GitHub-Ordner – es vergleicht beide) `hochladen-pruefen.cmd` doppelklicken. Es liest nur und braucht ca. 10 s. Es meldet:
      - fehlende oder anders geschriebene Datenpfade;
      - Dateien, die sich nur in der Groß-/Kleinschreibung unterscheiden;
      - Dateien, die `.gitignore` ausschließt;
      - Dateien über 100 MB;
      - die Gesamtgröße.

      Steht dort „ERGEBNIS: alles in Ordnung“: in GitHub Desktop committen und **„Push origin“** drücken.
2. **Was du sonst beachten musst:**
   - Im Explorer **versteckte Elemente ausgeblendet lassen**. Dann werden die beiden `.git`-Ordner weder gelöscht noch kopiert. Das ist wichtig: Sonst würde das lokale git das GitHub-git ersetzen.
   - Nie nur die Groß-/Kleinschreibung eines Dateinamens ändern (das macht auch das Bau-Skript nicht).
3. **Am Handy online**, am besten im Mobilnetz statt im WLAN:
   - Ein Produkt öffnen, sofort View 2 antippen: Die 2 ist sofort markiert, der Ring füllt sich, dann fährt die Kamera.
   - Schnell 3 → 1 → 2 tippen: Es landet ohne Nachlaufen auf 2.
   - Während einer Fahrt eine andere Nummer tippen: Das Bild hält an und blendet zur neuen View.
4. Bei der Lampe dasselbe mit eingeschaltetem Licht.

### 4. Was auffällig ist

- **Slow 4G am PC:** Die großen Fahrten (2592 × 1080) brauchen ca. 7 s, bis sie spielen. Das liegt an der Dateigröße, nicht am Code. Markierung und Ring reagieren sofort. Kleinere Dateien wären nur über eine stärkere Kompression möglich; das habe ich nicht angefasst.
- **Fehler in meinem eigenen Testserver:** Er hat zuerst auch pausierte Verbindungen beschrieben. Das ergab Phantom-Bandbreite und wachsende Ausreißer bis 22 s. Ich habe den Fehler behoben (Gegendruck) und neu gemessen.
  - Die Slow-4G-Zahlen oben stammen vom korrigierten Server.
  - Die Fast-4G-Zahlen stammen noch vom ersten Server. Die Zeiten sind dort eher zu lang als zu kurz.
- **Abgebrochener Vergleichslauf:** Der letzte große Vergleichslauf mit Fast 4G und korrigiertem Server wurde vom System wegen Speichermangels abgebrochen. Auf dem Rechner liefen gleichzeitig fremde Simulationen. Ich habe ihn nicht von selbst neu gestartet. Mit korrigiertem Server ist Fast 4G nur für 2 Produkte gemessen (Handy: Fahrtstart 0,55–0,68 s). Auf Wunsch wiederhole ich ihn vollständig.
- **Repo-Größe:** ISLE-BE-DAMNED hat 768 MB, weil es alle alten Stände behält. Die Grenze liegt bei ca. 1 GB. Diese Runde fügt nur Code und kleine Messdateien hinzu (unter 1 MB). Ein neuer Renderlauf mit neuen Videos würde aber knapp.
- **Falsche Adresse im Kopf dieses Berichts:** Dort stand bisher die Adresse `…/gauge/`. Die richtige Adresse ist https://burningfireorange-cpu.github.io/ISLE-BE-DAMNED/ (oben korrigiert).

### 5. Offene Fragen

- **Nicht getestet:**
  - ein echtes iPhone. Safari geht mit `canplaythrough`/`preload` eigenwillig um; die Logik fällt dort auf „spielbar“ bzw. den Video-Wecker zurück.
  - der neue Stand online, denn er ist noch nicht hochgeladen.

  Sobald du gepusht hast, messe ich gern direkt gegen die Online-Adresse nach.
- **Repo zu groß?** Soll ich vor dem nächsten Renderlauf vorschlagen, wie das Repo wieder kleiner wird? Das ginge z. B. mit frischer Historie wie in Runde 9. Das müsstest du in GitHub Desktop selbst auslösen.

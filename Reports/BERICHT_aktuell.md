# Bericht – Runde 9: Hochformat fürs Handy, nahtloser Zoom mit `kachel_breit`, Veröffentlichung (2026-11-05)

> **Nachtrag Runde 10 (zwei Fehler am iPhone) steht am Ende dieses Berichts.** Teile von Kapitel 1–4 zum Zoom
> („Zwei-Stufen-Fenster“) und zur Möbel-Regel gelten nicht mehr.

**Online-Adresse (nach dem Hochladen):** https://burningfireorange-cpu.github.io/gauge/
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

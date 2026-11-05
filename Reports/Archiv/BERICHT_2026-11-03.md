# Bericht – Runde 8: breite Renderings 12:5, breite Fenster, nie grau, Handy-Fehler, Hochformat vorbereitet (2026-11-03)

## 1. Ergebnis in Kürze

- **Die neuen breiten Renderings sind übernommen**, für alle fünf Produkte: Standbilder 4320 × 1800, Fahrten 2592 × 1080 und klein, Abendbilder und Abendfahrten der Lampe (Object_03).
  - Gerechnet wird immer mit `format` aus `produkte.json`.
  - Es fehlt keine Datei, alle Felder heißen wie erwartet.
  - `raum_leer` und `Raum_leer` werden nicht angefasst.
- **Breite Fenster:**
  - Das Bild füllt wie bisher den Bildschirm.
  - Das Möbel wird aber nie mehr angeschnitten: Die Box aus `bildinfo` passt immer in die freie Fläche.
  - Auf einem normalen Laptopfenster (1536 × 730) ist der Sessel Object_05 mit Füßen ganz zu sehen.
  - Ultrawide (21:9, 32:9): volle Höhe, seitlich weicher Auslauf in die Hintergrundfarbe.
- **Nie grau beim Öffnen:** Das Kachelbild ist jetzt das ganze Bild in klein. Beim Klick sind die Seiten sofort gefüllt, das große Bild blendet weich darüber. Cam1 wird schon beim Hover bzw. Antippen geladen.
- **Handy-Fehler behoben:**
  - Trennstrich vor den Pfeilen.
  - Pfeile ← · →.
  - Kein weißer Blitz nach der Fahrt.
  - Aktiver Bereich mit Namen.
  - Langes Drücken zeigt das Namensschild.
- **Hochformat ist im Code fertig** und mit künstlichen Testdaten geprüft. Solange `bilder_hoch` leer ist, verhält sich die Seite wie bisher.

## 2. Was gemacht wurde (mit Commits)

| Commit | Punkt | Inhalt |
|---|---|---|
| `d98e531` | 1 Übernehmen | Bau-Skript gelaufen: 188 Dateien übernommen, zweiter Lauf „0 neu, 0 ersetzt“. Liest jetzt `bildinfo` (Möbel-Box je Bild, `angeschnitten`), `format.video`, die Hochformat-Felder (noch leer) und `handykameras` (nur durchgereicht). |
| `d952390` | 2 Breite Fenster | Die Lage des Bilds rechnet jetzt `G.buehne()` (kern.js) statt reinem CSS. Erst wird gedeckt wie bisher. Würde eine nicht angeschnittene Möbel-Box aus der freien Fläche ragen, wird verkleinert, und zwar je Produkt einheitlich über alle Views, damit beim Wechsel nichts springt. Kanten im Fenster laufen über eine CSS-Maske weich aus. Neu in config: `viewer.moebelRand` (20 px), `viewer.auslaufen` (10 %), `viewer.auslaufenWechsel`. |
| `aa08ebf` | 3 Nie grau | Das Bau-Skript rechnet die Kachelbilder aus dem **ganzen** Cam1-Bild (1440 × 600, ~60 KB). Die Kachel zeigt davon den 4:3-Ausschnitt. Der Viewer zeigt es unter Standbild 1, bis das große Bild geladen ist, und der Flug füllt damit sofort die Seiten. Hover bzw. Touchstart auf der Kachel lädt Cam1 sofort. |
| `dd686cb` | 4a | Feiner Trennstrich zwischen View-Nummern/Lampe und Pfeilen (Handy waagrecht, Desktop senkrecht) |
| `da213a8` | 4b | Pfeile umgedreht: links ← zurück, rechts → weiter |
| `fe0de17` | 4c | Weißer Blitz: Das Zielstandbild liegt schon geladen hinter dem laufenden Video, am Ende wird nur das Video ausgeblendet (auch bei Abendfahrten) |
| `a3ca73d` | 4d | Nur ohne Hover (`@media (hover: none)`): Der aktive Bereich wird weich breiter und zeigt Symbol + Namen. Langes Drücken (450 ms) zeigt das Namensschild, ohne auszulösen. Config: `leiste.aktivName`, `namenWechsel`, `langDruck`, `schildNachLangDruck`. |
| `c13fea3` | 5 Hochformat | Am Handy senkrecht gilt: volle Breite, oben bündig. Ist das Handy schlanker als 1:2, wird auf volle Höhe vergrößert und seitlich gleichmäßig beschnitten. Die Kachel zoomt nahtlos ins Hochformat. Beim Drehen wird der Viewer getauscht, View und Lampe bleiben erhalten. Das Bau-Skript übernimmt `*_hoch`-Dateien und rechnet Hochformat-Kacheln. Ohne Daten gilt der Rückfall von bisher. Config: `viewer.hochformat`. |
| `4120512` | 6 Bericht | README (Format, Lage, Kacheln, Hochformat, neue Einstellungen), CLAUDE.md (Felder), Bericht |

**Getestet** in Edge headless:

- **14 Fenstergrößen von 320 × 568 bis 5120 × 1440:** Jede nicht angeschnittene Möbel-Box liegt in der freien Fläche, nirgends ein Rand ohne Bild oder Auslauf.
- **Öffnen bei gedrosselten 1,5 Mbit:** kein graues Bild.
- **Fahrten Bild für Bild aufgezeichnet:** 0 Bilder ohne deckende Ebene (Tag und Abend, Desktop und Handy).
- **Touch-Emulation:** Beschriftung und langes Drücken geprüft.
- **Hochformat mit künstlichen Daten:** Testkopie im Scratchpad, nie in der Unity-Quelle.
- **Regression:** Desktop, „Bewegung reduzieren“, Handy und Baum-Modus laufen ohne Fehler.

## 3. Was du zuerst ausprobieren sollst

1. **Laptop-Fenster, Object_05 (Sessel):** Der Sessel steht mit Füßen ganz im Bild. Dann Views 2 und 3 durchgehen: Die Bildgröße bleibt gleich.
2. **Fenster sehr breit ziehen (oder Ultrawide-Bildschirm):** Das Bild behält die volle Höhe und läuft seitlich weich aus.
3. **Products mit leerem Cache** (Strg+F5), dann sofort auf eine Kachel klicken: Die Seiten sind sofort gefüllt, nichts ist grau.
4. **iPhone, Produktseite:**
   - Trennstrich und Pfeilrichtung prüfen.
   - Mehrere Views wechseln und auf einen Blitz am Ende achten.
   - Die Leiste unten zeigt beim aktiven Bereich den Namen.
   - Lange auf ein anderes Symbol drücken: Das Schild erscheint, nichts öffnet sich.

## 4. Was auffällig ist

- **Object_05 (Sessel), Cam3 hat eine sehr breite Möbel-Box.** Weil die Größe je Produkt einheitlich ist, wird der Sessel in **hohen** Fenstern (z. B. Tablet senkrecht 768 × 1024) in allen Views kleiner gezeigt, mit weichem Auslauf oben und unten. Am Laptop ist das kaum zu merken.
- **1366 × 625 (kleines Laptopfenster):** Rechts hinter der Leiste bleibt ein schmaler Streifen (20 px), der weich ausläuft, weil das Möbel sonst angeschnitten würde. Er liegt hinter der Leiste und fällt kaum auf.
- **Handy senkrecht ohne Hochformat-Daten (jetzt):** Hier gilt die Rückfallregel „wie bisher“, also bildfüllend. Das Möbel kann dabei seitlich angeschnitten sein, wie in Runde 7. Das ändert sich mit den Hochformat-Bildern.
- **Felder:**
  - Alle Felder heißen wie erwartet; es fehlen keine Dateien.
  - Einziger Rückfall-Hinweis des Skripts: `bilder_hoch` ist bei allen fünf Produkten leer, deshalb gilt am Handy das breite Bild.
  - `kacheln` wird nicht mehr gebraucht; die Kachelbilder rechnet das Skript aus dem ganzen Bild.
  - `format.video` wird nur geprüft.
  - `handykameras` wird nur durchgereicht, die Seite nutzt es noch nicht.
- **Echtes iPhone nicht getestet**, nur Emulation (Touch, Größe, kein Hover). Gerade der Blitz (4c) zeigt sich nur auf Safari wirklich.
- **Repo-Größe:** `.git` 443 MB, `media` 209 MB (vor dieser Runde 235 / 166 MB). Jeder Renderlauf mit neuen Bildern wächst die Historie um die alten Fassungen. Mit Hochformat-Bildern und -Videos kommt noch einmal einiges dazu.

## 5. Offene Fragen

1. **Möbel-Regel je View statt je Produkt?** Dann wäre der Sessel in Cam1/Cam2 auch in hohen Fenstern groß, aber das Bild würde beim View-Wechsel die Größe ändern (weich animiert). Im Moment ist es je Produkt einheitlich.
2. **Handy senkrecht bis zum Renderlauf:** So lassen (bildfüllend, Möbel teils angeschnitten) oder schon jetzt die Möbel-Regel anwenden (Möbel ganz, dann oben und unten Auslauf)?
3. **Repo-Größe vor GitHub Pages:** GitHub empfiehlt unter 1 GB. Sollen alte Render-Fassungen irgendwann aus der Historie (neues Repo / Squash), oder die Videos außerhalb von git liegen?
4. Weiter offen aus Runde 7: echte Produktfotos und Galerie-Originale (`_Import/Galerie/`).

## Nachtrag (2026-11-03): Licht geht nach der Abend-Rückfahrt weich aus

**Fehler:** Im Abendmodus der Lampe (Object_03) lief die Abendfahrt zu Cam1 richtig in die Kachel. Danach sprang die Kachel aber in 0,2 s vom Abendbild aufs Tagbild.

**Lösung (Commit `9461ee2`):**

- Am Ende der Abendfahrt übernimmt die Kachel ihr eigenes Abendbild. Es ist eine kleine Kopie desselben Bilds und liegt voll sichtbar unter dem Viewer.
- Der Viewer blendet hinein, und gleichzeitig geht das Licht in der Kachel weich aus. Dauer und Kurve sind dieselben wie beim Ausschalten mit der Glühbirne (`viewer.lampe`, 1 s).
- Ist das Abendbild der Kachel ausnahmsweise nicht geladen, geht das Licht zuerst im Viewer aus, dann blendet der Viewer aus.
- **Unterbrochene Rückfahrt:** Verlässt der Viewer die Kachel, solange er noch Abend zeigt (z. B. schneller Klick, zurück und gleich wieder hin), hält die Kachel ebenfalls das Abendbild und blendet weich aus.

**Gemessen** (Abendanteil des sichtbaren Kachelbilds, alle 50 ms):

| Stand | Übergang Abend → Tag | größter Sprung je 50 ms |
|---|---|---|
| vorher | 250 ms | 0,34 |
| jetzt | ca. 1 s | 0,17 |
| jetzt, unterbrochene Rückfahrt | ca. 1 s | 0,16 |

**Andere Stellen geprüft:**

- **Browser-Zurück** nimmt denselben Weg wie der Products-Knopf, ist also mitbehoben.
- **Home-Knopf und andere Bereiche im Abendmodus:** Die Produktseite blendet als Ganzes aus, kein harter Lichtwechsel. Die Lampe bleibt im Viewer gemerkt. Beim nächsten Öffnen aus der Kachel startet er wie die Kachel (Tag), umgestellt wird das, solange er noch unsichtbar ist.
- **„Bewegung reduzieren“:** Es gibt keine Rückfahrt in die Kachel, nur das Überblenden der Seiten, also keinen Sprung.
- **View-Wechsel ohne Abendfahrt** und **Lampe aus vor der Rückfahrt:** Diese Wechsel waren schon weich (`viewer.lampeVorFahrt` bzw. 1 s).

**Zum Ausprobieren:** Object_03 öffnen, Glühbirne an, View 2 wählen, dann Products (oder Browser-Zurück). Die Abendfahrt läuft in der Kachel zu Ende, danach geht das Licht über etwa 1 s aus. Steht die Maus dabei auf der Kachel, bleibt sie wie gewohnt im Abendbild (Hover).

## Nach dem nächsten Renderlauf zu tun

1. **`bau\aktualisieren.cmd` ausführen.** Das Skript übernimmt `*_hoch`-Standbilder und -Fahrten (auch klein und webm) und rechnet die Hochformat-Kacheln. Am Ende prüfen, ob „Hochformat: …“ mit Größe und Zahl der Fahrten erscheint.
2. **Struktur von `format_hoch` prüfen.** Erwartet sind `breite`, `hoehe`, `kachel {x, y, breite, hoehe}`, wie in Kapitel 9 beschrieben. Weicht es ab, das Skript anpassen (Meldung kommt im Bericht).
3. **`bildinfo` für die `_hoch`-Bilder prüfen:** Daraus kommt der 4:3-Kachelausschnitt im Hochformat und die Möbel-Box.
4. **Übergang Kachel → Hochformat prüfen:** Die Kachel zeigt den 4:3-Ausschnitt des **breiten** Bilds. Beim Zoom liegt dieser genau auf dem 4:3-Ausschnitt des Hochformats; oben und unten kommt die kleine Hochformat-Kopie, dann das große Standbild. Das ist nur nahtlos, wenn beide Ausschnitte wirklich dasselbe zeigen. Mit der anderen Brennweite des Hochformats an den echten Bildern ansehen.
5. **Auf dem echten iPhone testen:** Hochformat, Drehen quer ↔ hoch, Abendfahrten der Lampe, Blitz.
6. **Bei Bedarf** die Möbel-Regel auch im Hochformat anwenden (zurzeit nur: volle Breite oben bündig bzw. volle Höhe).
7. **`handykameras`:** Klären, ob am Handy nur diese Views gezeigt werden sollen. Im Moment werden sie nur durchgereicht.

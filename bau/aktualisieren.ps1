<#
  gauge – Bau-Skript: aktualisiert alles, was die Website an Daten und Medien braucht.
  Beliebig oft wiederholbar: Es kopiert nur, was neu ist oder sich geändert hat (Größe oder Änderungszeit),
  legt beiseite, was es in der Quelle nicht mehr gibt, und legt nie etwas doppelt an.
  Es löscht nie endgültig: Überzähliges wandert nach _Papierkorb\<Datum_Uhrzeit>\ (nicht in Git; bei Bedarf von Hand leeren),
  und nur aus den eigenen Bildordnern unter media\ (Sicherheitsprüfung siehe "SICHERES AUFRÄUMEN").

  1. Galerie:  _Import\Galerie\*.jpg|*.jpeg|*.png  →  media\galerie\klein\ (ca. 800 px) + media\galerie\gross\ (ca. 2000 px)
               Metadaten entfernt, Drehung (EXIF) berücksichtigt, Transparenz auf Seitenfarbe  →  data\galerie.js
  2. Produkte: <Quelle>\produkte.json  →  media\produkte\produkte.json (Kopie)
               je Produkt  <Quelle>\<Name>\bilder\   nur die Bilder aus dem Feld "bilder" (Abendbilder nur bei "abendbilder": true)
                           Kachelbild = ganzes Standbild von View 1 (+ Abend-/Hochformat), verkleinert nach bilder\kachel\
                           <Quelle>\<Name>\video\    Move_CamX_CamY.mp4 + .webm zwischen den vorhandenen Kameras, beide Richtungen,
                                                     bei Lampen zusätzlich die Abendfahrten aus "abendfahrten" (Move_CamX_CamY_abend)
                           <Quelle>\<Name>\video\klein\  dasselbe in klein (Handy / schmale Fenster)
               →  media\produkte\<Name>\...  →  data\produkte.js
               Typ und Anzeigename aus "typ" / "anzeigename", Bildformat und Ausschnitte aus "format" (Videos: "format.video"),
               Möbelbereich je Standbild aus "bildinfo".
               Hochformat (Handy): "bilder_hoch", "format_hoch", "fahrten_hoch", "abendfahrten_hoch" (Dateien *_hoch) – nur
               übernommen, wenn jede View ein Hochformat-Bild hat; sonst "hoch": null (Website zeigt das breite Bild).
               Fehlt eines davon: Rückfall auf _Import\produkte-zusatz.json (Kategorie, Maße) – steht am Ende im Bericht.
               "raum_leer" und der Ordner Raum_leer werden nicht verwendet.
               Die Quelle (Unity-Projekt) wird NUR gelesen – dort wird nie etwas geändert.
               Am Ende steht eine Liste aller Dateien, die gefehlt haben.
  Dummy-Produkte stehen in data\dummies.js und werden hier nicht angefasst (an/aus in js\config.js: dummiesZeigen).

  SICHERHEITSREGEL (gilt für jede Änderung an diesem Skript, siehe auch CLAUDE.md):
    - Kein Löschen außerhalb der eigenen Zielordner (media\produkte\<Produkt>\bilder|bilder\kachel|video|video\klein,
      media\produkte für verwaiste Produktordner, media\galerie\klein|gross) – nie im Projekt-Hauptordner, nie in der Quelle.
    - Vor jedem Löschen den Pfad prüfen (Funktion Beiseitelegen: erlaubter Ordner, direkt darin, keine Junction/Symlink).
    - Lieber verschieben als löschen: alles Überzählige wandert nach _Papierkorb\<Datum_Uhrzeit>\. Kein Remove-Item auf Dateien
      oder Ordner mit Inhalt – neue Aufräumschritte immer über Beiseitelegen.

  Einzelne Perspektive neu gerendert?  Einfach noch einmal ausführen – nur die geänderten Dateien werden ersetzt,
  und die Website lädt sie neu (jede Produktdatei bekommt eine Versionsmarke ?v=…, die sich mit der Datei ändert).

  Aufruf (im Ordner der Website):
      powershell -ExecutionPolicy Bypass -File bau\aktualisieren.ps1
  oder Doppelklick auf bau\aktualisieren.cmd

  Optionen:
      -OhneGalerie     Galerie überspringen
      -OhneProdukte    Produkte überspringen
      -NurDaten        Produkte: nur data\produkte.js schreiben, keine Bilder/Videos kopieren
      -Neu             Galerie-Bilder neu erzeugen, auch wenn sie schon aktuell sind
      -Quelle <Pfad>   anderer Ordner mit produkte.json (Standard: Unity Website_Test – NICHT der Ordner Renders)
      -Ziel <Pfad>     anderer Ausgabeordner (Standard: der Ordner der Website)
#>
[CmdletBinding()]
param(
  [string]$Quelle = 'C:\Unity\website steel furniture\Website_Test',
  [string]$Ziel = '',             # leer = der Ordner der Website
  [string]$FFmpeg = 'C:\pinokio\bin\miniforge\Library\bin\ffmpeg.exe',
  [int]$Klein = 800,
  [int]$Gross = 2000,
  [int]$Qualitaet = 3,          # ffmpeg JPEG-Qualität: 2 = sehr gut … 5 = kleiner
  [int]$KachelHoehe = 600,      # Höhe der kleinen Kachelbilder (ganzes 12:5-Bild → 1440 × 600; Products lädt beim Start nur diese)
  [int]$KachelHochBreite = 600, # Breite der kleinen Hochformat-Kopie (600 × 1200) und der Handy-Kachel (600 × 750)
  # Handy-Kachel (Handy senkrecht, Products): Ausschnitt aus dem Cam1-Hochformat, volle Bildbreite, für ALLE Produkte gleich
  # (gleicher Maßstab, Wand/Boden-Fuge auf gleicher Höhe). 4:5 und Oberkante bei 5,5 % der Bildhöhe: 2400 × 3000 ab y = 264
  # – die Lampe Object_03 (y 663 … 2741) und der tiefste Fuß (Sessel, y 2868) haben darin je ca. 13 % Luft.
  # Nach einer Änderung einmal mit -Neu bauen (eine andere Kachelhöhe merkt das Skript auch von selbst).
  [double]$HandyKachelSeite = 0.8,    # Breite : Höhe der Handy-Kachel (0.8 = 4:5)
  [double]$HandyKachelOben = 0.055,   # Oberkante als Anteil der Hochformat-Höhe
  [switch]$OhneGalerie,
  [switch]$OhneProdukte,
  [switch]$NurDaten,
  [switch]$Neu
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$utf8 = New-Object System.Text.UTF8Encoding($false)
$skriptOrdner = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }
$Website = Split-Path -Parent $skriptOrdner      # Eingaben (_Import) liegen immer bei der Website
if (-not $Ziel) { $Ziel = $Website }

function Schreiben([string]$pfad, [string]$text) {
  $ordner = Split-Path -Parent $pfad
  if (-not (Test-Path $ordner)) { New-Item -ItemType Directory -Force $ordner | Out-Null }
  [IO.File]::WriteAllText($pfad, $text, $utf8)
}
<# Datei nur schreiben, wenn sich außer dem Zeitstempel "erzeugt" etwas geändert hat (sonst bleibt sie unberührt – kein neuer Git-Stand). #>
function SchreibenWennNeu([string]$pfad, [string]$text) {
  if (Test-Path -LiteralPath $pfad) {
    $alt = [IO.File]::ReadAllText($pfad, $utf8)
    # (Zeilenenden egal – Git kann sie beim Auschecken umstellen)
    if (($alt -replace '"erzeugt": "[^"]*"', '' -replace "`r`n", "`n") -eq ($text -replace '"erzeugt": "[^"]*"', '' -replace "`r`n", "`n")) { return $false }
  }
  Schreiben $pfad $text
  return $true
}
function JsText($s) {
  if ($null -eq $s) { return 'null' }
  $t = [string]$s
  $t = $t.Replace('\', '\\').Replace('"', '\"').Replace("`r", '\r').Replace("`n", '\n').Replace("`t", '\t')
  return '"' + $t + '"'
}
function JsListe($werte) { return '[' + ((@($werte) | ForEach-Object { if ($_ -is [int]) { [string]$_ } else { JsText $_ } }) -join ', ') + ']' }
function Wert($obj, [string]$name) {
  if ($null -eq $obj) { return $null }
  $p = $obj.PSObject.Properties[$name]
  if ($p) { return $p.Value } else { return $null }
}
function Melden([string]$text, [string]$farbe = 'Gray') { Write-Host $text -ForegroundColor $farbe }

<# ---------------------------------------------------------------------
   SICHERES AUFRÄUMEN – das Skript löscht nie endgültig.
   Was nicht mehr gebraucht wird, wandert nach  _Papierkorb\<Datum_Uhrzeit>\<gleicher Pfad>  (nicht in Git).
   Erlaubt sind NUR diese Ordner (relativ zur Ausgabe):
       media\produkte\<Produkt>\bilder | bilder\kachel | video | video\klein   (Dateien darin)
       media\produkte                                                          (ganze Produktordner, die nicht mehr in produkte.json stehen)
       media\galerie\klein | gross                                             (Dateien darin)
   Vor jedem Verschieben wird geprüft: Pfad liegt genau in so einem Ordner, kein Laufwerks-/Hauptordner,
   keine Verknüpfung (Junction/Symlink) auf dem Weg. Sonst bricht das Skript ab, ohne etwas anzufassen.
   --------------------------------------------------------------------- #>
$ZielVoll = [IO.Path]::GetFullPath($Ziel).TrimEnd('\')
if ($ZielVoll.Length -le 3 -or $ZielVoll -eq [IO.Path]::GetFullPath($env:USERPROFILE).TrimEnd('\')) { throw "Sicherheitsstopp: Ausgabeordner '$ZielVoll' ist ein Laufwerks- oder Benutzer-Hauptordner." }
$Papierkorb = Join-Path $ZielVoll ('_Papierkorb\' + (Get-Date -Format 'yyyy-MM-dd_HHmmss'))
$ErlaubteOrdner = @(
  '^media\\produkte\\[^\\]+\\(bilder|bilder\\kachel|video|video\\klein)$',
  '^media\\produkte$',
  '^media\\galerie\\(klein|gross)$'
)
function Sicherheitsstopp([string]$text) { throw "Sicherheitsstopp beim Aufräumen: $text – nichts verschoben." }
<# Datei oder Ordner $pfad, der DIREKT in $ordner liegt, in den Papierkorb-Ordner verschieben. #>
function Beiseitelegen([string]$pfad, [string]$ordner) {
  $voll = [IO.Path]::GetFullPath($pfad).TrimEnd('\')
  $ordnerVoll = [IO.Path]::GetFullPath($ordner).TrimEnd('\')
  if (-not $ordnerVoll.StartsWith($ZielVoll + '\', [StringComparison]::OrdinalIgnoreCase)) { Sicherheitsstopp "$ordnerVoll liegt nicht im Ausgabeordner" }
  $relOrdner = $ordnerVoll.Substring($ZielVoll.Length + 1)
  $ok = $false; foreach ($m in $ErlaubteOrdner) { if ($relOrdner -match $m) { $ok = $true } }
  if (-not $ok) { Sicherheitsstopp "$relOrdner ist kein Bildordner des Bau-Skripts" }
  if ((Split-Path -Parent $voll) -ne $ordnerVoll) { Sicherheitsstopp "$voll liegt nicht direkt in $relOrdner" }
  # keine Verknüpfung auf dem Weg vom Ausgabeordner bis zum Ziel (eine Junction könnte sonst auf fremde Ordner zeigen)
  $p = $voll
  while ($p.Length -ge $ZielVoll.Length) {
    $it = Get-Item -LiteralPath $p -Force -ErrorAction Stop
    if ($it.Attributes -band [IO.FileAttributes]::ReparsePoint) { Sicherheitsstopp "$p ist eine Verknüpfung (Junction/Symlink)" }
    if ($p -eq $ZielVoll) { break }
    $p = Split-Path -Parent $p
  }
  if ((Get-Item -LiteralPath $voll -Force).PSIsContainer) {
    $verkn = @(Get-ChildItem -LiteralPath $voll -Recurse -Force -Attributes ReparsePoint -ErrorAction SilentlyContinue)
    if ($verkn.Count) { Sicherheitsstopp "$voll enthält Verknüpfungen" }
  }
  $nach = Join-Path $Papierkorb $voll.Substring($ZielVoll.Length + 1)
  $nachOrdner = Split-Path -Parent $nach
  if (-not (Test-Path -LiteralPath $nachOrdner)) { New-Item -ItemType Directory -Force $nachOrdner | Out-Null }
  Move-Item -LiteralPath $voll -Destination $nach
}
<# Leeren Ordner entfernen (nur wenn wirklich leer, nur in erlaubten Bildordnern). #>
function LeerenOrdnerEntfernen([string]$ordner) {
  if (-not (Test-Path -LiteralPath $ordner)) { return }
  if (@(Get-ChildItem -LiteralPath $ordner -Force).Count) { return }
  Beiseitelegen $ordner (Split-Path -Parent $ordner)
}

$zeit = Get-Date -Format 'yyyy-MM-dd HH:mm'
Melden "gauge – aktualisieren ($zeit)" 'White'
Melden "  Website: $Website"
Melden "  Ausgabe: $Ziel"

# =====================================================================
# 1. GALERIE
# =====================================================================
if (-not $OhneGalerie) {
  Melden "`n[Galerie]" 'White'
  $eingang = Join-Path $Website '_Import\Galerie'
  $ausKlein = Join-Path $Ziel 'media\galerie\klein'
  $ausGross = Join-Path $Ziel 'media\galerie\gross'
  New-Item -ItemType Directory -Force $eingang, $ausKlein, $ausGross | Out-Null
  if (-not (Test-Path $FFmpeg)) { throw "ffmpeg nicht gefunden: $FFmpeg" }

  $dateien = @(Get-ChildItem -LiteralPath $eingang -File | Where-Object { $_.Extension -match '^\.(jpe?g|png)$' } | Sort-Object Name)
  $vorhandeneAusgaben = @(Get-ChildItem -LiteralPath $ausGross -File -Filter *.jpg -ErrorAction SilentlyContinue)
  if (-not $dateien.Count -and $vorhandeneAusgaben.Count) {
    # Schutz: Originale fehlen (z. B. Ordner geleert), aber es gibt fertige Galeriebilder → nichts entfernen, Liste nicht leeren
    Melden ("  ! _Import\Galerie ist leer, media\galerie enthält aber {0} Foto(s) – Galerie bleibt unverändert." -f $vorhandeneAusgaben.Count) 'Yellow'
    Melden '    Zum Entfernen aller Fotos: media\galerie\klein und \gross von Hand leeren.' 'Yellow'
    $dateien = $null
  }
}
if (-not $OhneGalerie -and $null -ne $dateien) {
  $fotos = @()
  $vergeben = @{}
  foreach ($d in $dateien) {
    # sicherer Dateiname
    $basis = [IO.Path]::GetFileNameWithoutExtension($d.Name).ToLowerInvariant()
    $basis = $basis.Normalize([Text.NormalizationForm]::FormD) -replace '\p{Mn}', ''
    $basis = ($basis -replace '[^a-z0-9]+', '-').Trim('-')
    if (-not $basis) { $basis = 'foto' }
    $name = $basis; $n = 2
    while ($vergeben.ContainsKey($name)) { $name = "$basis-$n"; $n++ }
    $vergeben[$name] = $true

    # Größe und EXIF-Drehung lesen
    $bild = [System.Drawing.Image]::FromFile($d.FullName)
    try {
      $w = $bild.Width; $h = $bild.Height; $orient = 1
      if ($bild.PropertyIdList -contains 0x0112) { $orient = [int]$bild.GetPropertyItem(0x0112).Value[0] }
    } finally { $bild.Dispose() }
    $dreh = switch ($orient) {
      2 { 'hflip' } 3 { 'hflip,vflip' } 4 { 'vflip' } 5 { 'transpose=0' } 6 { 'transpose=1' } 7 { 'transpose=3' } 8 { 'transpose=2' } default { '' }
    }
    if ($orient -ge 5 -and $orient -le 8) { $t = $w; $w = $h; $h = $t }

    $ergebnis = @{}
    foreach ($stufe in @(@{ n = 'klein'; box = $Klein; ordner = $ausKlein }, @{ n = 'gross'; box = $Gross; ordner = $ausGross })) {
      $s = [Math]::Min(1.0, $stufe.box / [double][Math]::Max($w, $h))
      $aB = [int]([Math]::Round($w * $s / 2) * 2); $aH = [int]([Math]::Round($h * $s / 2) * 2)   # (PowerShell: $W wäre dasselbe wie $w)
      $aus = Join-Path $stufe.ordner "$name.jpg"
      $ergebnis[$stufe.n] = @{ w = $aB; h = $aH }
      if (-not $Neu -and (Test-Path $aus) -and (Get-Item $aus).LastWriteTime -ge $d.LastWriteTime) { continue }
      $vor = if ($dreh) { "$dreh," } else { '' }
      # Bild drehen + skalieren, auf Seitenfarbe legen (Transparenz), ohne Metadaten als JPEG speichern
      $graph = "[0:v]${vor}scale=${aB}:${aH}:flags=lanczos,format=rgba[f];color=c=0xEFEEEB:s=${aB}x${aH}:d=1[b];[b][f]overlay=shortest=1:format=auto,format=yuvj420p[o]"
      & $FFmpeg -hide_banner -loglevel error -y -noautorotate -i $d.FullName -filter_complex $graph -map '[o]' -frames:v 1 -update 1 -q:v $Qualitaet -map_metadata -1 $aus
      if ($LASTEXITCODE -ne 0) { throw "ffmpeg-Fehler bei $($d.Name)" }
    }
    $fotos += [pscustomobject]@{ datei = $d.Name; name = $name; b = $ergebnis.gross.w; h = $ergebnis.gross.h }
    Melden ("  {0,-40} {1} x {2}" -f $d.Name, $ergebnis.gross.w, $ergebnis.gross.h)
  }
  # verwaiste Ausgaben beiseitelegen (Original wurde gelöscht) – in den Papierkorb-Ordner, nicht endgültig
  foreach ($o in @($ausKlein, $ausGross)) {
    @(Get-ChildItem -LiteralPath $o -File -Filter *.jpg | Where-Object { -not $vergeben.ContainsKey($_.BaseName) }) | ForEach-Object {
      Beiseitelegen $_.FullName $o; Melden "  → Papierkorb: $($_.Name)" 'DarkGray'
    }
  }
  $zeilen = $fotos | ForEach-Object {
    '    { "datei": ' + (JsText $_.datei) + ', "klein": ' + (JsText ("media/galerie/klein/" + $_.name + ".jpg")) + ', "gross": ' + (JsText ("media/galerie/gross/" + $_.name + ".jpg")) + ', "b": ' + $_.b + ', "h": ' + $_.h + ' }'
  }
  $js = "/* gauge – gallery list. GENERATED by bau/aktualisieren.ps1 from _Import/Galerie/ – do not edit by hand.`n   Empty list = the gallery shows grey test placeholders. */`nwindow.GAUGE_GALERIE = {`n  ""erzeugt"": " + (JsText $zeit) + ",`n  ""fotos"": [`n" + (($zeilen) -join ",`n") + "`n  ]`n};`n"
  $neuGeschrieben = SchreibenWennNeu (Join-Path $Ziel 'data\galerie.js') $js
  Melden ("  {0} Foto(s) → data\galerie.js{1}" -f $fotos.Count, $(if ($neuGeschrieben) { '' } else { ' (unverändert)' })) 'Green'
}

# =====================================================================
# 2. PRODUKTE
# =====================================================================
if (-not $OhneProdukte) {
  Melden "`n[Produkte]" 'White'
  Melden "  Quelle:  $Quelle"
  $jsonPfad = Join-Path $Quelle 'produkte.json'
  if (-not (Test-Path -LiteralPath $jsonPfad)) { throw "produkte.json nicht gefunden: $jsonPfad" }
  $daten = [IO.File]::ReadAllText($jsonPfad, $utf8) | ConvertFrom-Json
  $zusatzPfad = Join-Path $Website '_Import\produkte-zusatz.json'
  $zusatz = $null
  if (Test-Path -LiteralPath $zusatzPfad) { $zusatz = [IO.File]::ReadAllText($zusatzPfad, $utf8) | ConvertFrom-Json }
  $klassen = @{ 'L' = 'L'; 'LARGE' = 'L'; 'M' = 'M'; 'MEDIUM' = 'M'; 'S' = 'S'; 'SMALL' = 'S' }
  $kategorien = @('tables', 'seating', 'storage', 'lighting')
  # Typ-Kürzel für den Anzeigenamen OBJ_<Typ>_<Größe>_<Nummer> – änderbar in _Import\produkte-zusatz.json unter "_typen"
  $typen = [ordered]@{ tables = 'TB'; seating = 'ST'; storage = 'SH'; lighting = 'LT' }
  $zt = Wert $zusatz '_typen'
  if ($zt) { foreach ($k in @($typen.Keys)) { $v = Wert $zt $k; if ($v) { $typen[$k] = ([string]$v).ToUpperInvariant() } } }
  $mediaProdukte = Join-Path $Ziel 'media\produkte'
  New-Item -ItemType Directory -Force $mediaProdukte | Out-Null

  $stat = @{ neu = 0; ersetzt = 0; gleich = 0; entfernt = 0 }
  $fehlend = New-Object System.Collections.ArrayList
  $md5 = [Security.Cryptography.MD5]::Create()

  <# Eine Datei spiegeln: kopieren, wenn sie im Ziel fehlt oder sich Größe/Änderungszeit unterscheiden (Copy-Item übernimmt die Zeit). #>
  function Spiegeln([IO.FileInfo]$q, [string]$nach) {
    if ($NurDaten) { return }
    $ordner = Split-Path -Parent $nach
    if (-not (Test-Path -LiteralPath $ordner)) { New-Item -ItemType Directory -Force $ordner | Out-Null }
    if (Test-Path -LiteralPath $nach) {
      $z = Get-Item -LiteralPath $nach
      if ($z.Length -eq $q.Length -and $z.LastWriteTimeUtc -eq $q.LastWriteTimeUtc) { $stat.gleich++; return }
      Copy-Item -LiteralPath $q.FullName -Destination $nach -Force
      $stat.ersetzt++
      Melden ("    ersetzt: {0}" -f $nach.Substring($Ziel.Length).TrimStart('\')) 'Cyan'
    } else {
      Copy-Item -LiteralPath $q.FullName -Destination $nach -Force
      $stat.neu++
    }
  }
  <# Alles in einem Produkt-Bildordner beiseitelegen, was nicht (mehr) dazugehört (→ _Papierkorb, siehe oben). #>
  function Aufraeumen([string]$ordner, [hashtable]$behalten, [string]$muster) {
    if ($NurDaten -or $quelleFehlt -or -not (Test-Path -LiteralPath $ordner)) { return }
    @(Get-ChildItem -LiteralPath $ordner -File | Where-Object { $_.Name -match $muster -and -not $behalten.ContainsKey($_.Name) }) | ForEach-Object {
      Beiseitelegen $_.FullName $ordner
      $stat.entfernt++
      Melden ("    → Papierkorb: {0}" -f $_.FullName.Substring($ZielVoll.Length).TrimStart('\')) 'DarkGray'
    }
  }

  # produkte.json selbst mitnehmen (zum Nachsehen; die Website liest data\produkte.js)
  Spiegeln (Get-Item -LiteralPath $jsonPfad) (Join-Path $mediaProdukte 'produkte.json')

  $namen = @{}
  $zeilen = @()
  $rueckfall = New-Object System.Collections.ArrayList     # Felder, die in produkte.json fehlten (→ Bericht)
  $handyLuft = New-Object System.Collections.ArrayList     # je Produkt: Luft über / unter dem Möbel in der Handy-Kachel
  $typNamen = @{ 'tables' = 'tables'; 'table' = 'tables'; 'seating' = 'seating'; 'seat' = 'seating'; 'storage' = 'storage'; 'lighting' = 'lighting'; 'light' = 'lighting'; 'lamp' = 'lighting' }
  function Rechteck($r) {     # {x,y,breite,hoehe} → [x, y, b, h] (oder $null)
    if ($null -eq $r) { return $null }
    $x = Wert $r 'x'; $y = Wert $r 'y'; $b = Wert $r 'breite'; $h = Wert $r 'hoehe'
    if ($null -eq $b -or $null -eq $h) { return $null }
    return @([int]$x, [int]$y, [int]$b, [int]$h)
  }
  foreach ($p in $daten.produkte) {
    $name = [string]$p.produkt
    if (-not $name) { continue }
    $namen[$name] = $true
    $z = Wert $zusatz $name

    # ---- Typ und Anzeigename: aus produkte.json ("typ", "anzeigename"); leer → Rückfall auf _Import\produkte-zusatz.json ----
    $typRoh = ([string](Wert $p 'typ')).Trim().ToLowerInvariant()
    $kat = $typNamen[$typRoh]
    if (-not $kat) {
      $kat = ([string](Wert $z 'kategorie')).ToLowerInvariant()
      if ($typRoh) { [void]$rueckfall.Add("$name  typ = '$(Wert $p 'typ')' unbekannt → Kategorie '$kat' aus produkte-zusatz.json") }
      else { [void]$rueckfall.Add("$name  typ leer → Kategorie '$kat' aus produkte-zusatz.json") }
    }
    if ($kategorien -notcontains $kat) { Melden "  ! $name hat keine gültige Kategorie ('$kat') – nehme 'tables'." 'Yellow'; [void]$rueckfall.Add("$name  keine Kategorie gefunden → 'tables'"); $kat = 'tables' }
    $masse = Wert $p 'masse'; if (-not $masse) { $masse = Wert $z 'masse' }
    $kl = $klassen[([string]$p.klasse).ToUpperInvariant()]
    if (-not $kl) { $kl = $klassen[([string](Wert $z 'klasse')).ToUpperInvariant()] }
    if (-not $kl) { $kl = 'M' }
    $anzeige = ([string](Wert $p 'anzeigename')).Trim()
    $nummer = $null
    if ($anzeige -match '^OBJ_([A-Z]+)_([A-Z]+)_(\d+)$') {
      $code = $anzeige; $nummer = [int]$matches[3]
      if ($matches[1] -ne $typen[$kat]) { [void]$rueckfall.Add("$name  anzeigename ${anzeige}: Typkürzel $($matches[1]) passt nicht zu typ '$kat' ($($typen[$kat])) – Anzeigename gilt, Filter nach typ") }
      if ($matches[2] -ne $kl) { [void]$rueckfall.Add("$name  anzeigename ${anzeige}: Größe $($matches[2]) passt nicht zu klasse $kl – Anzeigename gilt, Filter nach klasse") }
    } else {
      $nummer = Wert $z 'nummer'
      if (-not $nummer) { $ziffern = $name -replace '\D', ''; if ($ziffern) { $nummer = [int]$ziffern } else { $nummer = 0 } }
      $code = 'OBJ_' + $typen[$kat] + '_' + $kl + '_' + ([int]$nummer).ToString('00')
      if ($anzeige) { [void]$rueckfall.Add("$name  anzeigename '$anzeige' nicht im Muster OBJ_TT_G_NN → $code") }
      else { [void]$rueckfall.Add("$name  anzeigename leer → $code (aus Typ, Klasse, Nummer)") }
    }
    $perspektiven = [int](Wert $p 'perspektiven')
    $mitAbend = [bool](Wert $p 'abendbilder')
    $quellOrdner = Join-Path $Quelle $name
    $zielOrdner = Join-Path $mediaProdukte $name
    # Schutz: fehlt der Quellordner (z. B. gerade im Neuaufbau), wird für dieses Produkt nichts beiseitegelegt
    $quelleFehlt = -not (Test-Path -LiteralPath $quellOrdner)
    if ($quelleFehlt) { Melden "  ! $name  Quellordner fehlt – vorhandene Dateien bleiben unverändert." 'Yellow' }
    $versionText = New-Object System.Text.StringBuilder

    function QuellDatei([string]$eintrag) {      # Pfad aus produkte.json (relativ zu Website_Test) → FileInfo oder $null
      $rel = $eintrag.Replace('/', '\').TrimStart('\')
      $voll = Join-Path $Quelle $rel
      if (-not (Test-Path -LiteralPath $voll)) { $voll2 = Join-Path $quellOrdner $rel; if (Test-Path -LiteralPath $voll2) { $voll = $voll2 } }
      if (-not (Test-Path -LiteralPath $voll)) { return $null }
      return Get-Item -LiteralPath $voll
    }

    # ---- Bilder: genau die aus dem Feld "bilder" (nicht aus "perspektiven" abgeleitet) ----
    $tag = @{}; $abend = @{}; $bildDateien = @{}
    foreach ($eintrag in @(Wert $p 'bilder')) {
      if (-not $eintrag) { continue }
      $f = QuellDatei ([string]$eintrag)
      if (-not $f) { [void]$fehlend.Add("$name  $eintrag  (steht in produkte.json, Datei fehlt)"); continue }
      if ($f.Name -notmatch '^Still_Cam(\d+)(_abend)?\.(jpe?g|png|webp)$') { Melden "  ! $name  unbekannter Bildname $($f.Name) – übersprungen" 'Yellow'; continue }
      $cam = [int]$matches[1]
      if ($matches[2]) {
        if (-not $mitAbend) { continue }          # Abendbilder nur, wenn "abendbilder": true
        $abend[$cam] = $f
      } else { $tag[$cam] = $f }
    }
    $kameras = @($tag.Keys | Sort-Object)
    if ($mitAbend) {
      foreach ($c in $kameras) { if (-not $abend.ContainsKey($c)) { [void]$fehlend.Add("$name  bilder\Still_Cam${c}_abend.jpg  (abendbilder: true, Abendbild fehlt)") } }
    }
    if ($perspektiven -and $kameras.Count -and $perspektiven -ne $kameras.Count) {
      Melden ("  i $name  perspektiven = {0}, im Feld bilder stehen {1} Kamera(s) – es zählen die Bilder." -f $perspektiven, $kameras.Count) 'DarkYellow'
      [void]$rueckfall.Add("$name  perspektiven = $perspektiven, vorhandene Standbilder = $($kameras.Count) – die Website zeigt $($kameras.Count) View(s)")
    }
    # ---- Format: volle Bildgröße und Lage des 16:9- (bildschirm) und 4:3-Ausschnitts (kachel) aus "format" ----
    $fo = Wert $p 'format'
    $format = @(); $bildschirm = $null; $kachelAus = $null
    if ($fo -and (Wert $fo 'breite') -and (Wert $fo 'hoehe')) {
      $format = @([int](Wert $fo 'breite'), [int](Wert $fo 'hoehe'))
      $bildschirm = Rechteck (Wert $fo 'bildschirm')
      $kachelAus = Rechteck (Wert $fo 'kachel')
      if (-not $bildschirm) { [void]$rueckfall.Add("$name  format.bildschirm fehlt → ganzes Bild") }
      if (-not $kachelAus) { [void]$rueckfall.Add("$name  format.kachel fehlt → mittiger 4:3-Ausschnitt") }
    } else {
      [void]$rueckfall.Add("$name  format fehlt → Größe aus dem ersten Standbild")
    }
    if (-not $format.Count -and $kameras.Count) {
      $bild = [System.Drawing.Image]::FromFile($tag[$kameras[0]].FullName)
      try { $format = @([int]$bild.Width, [int]$bild.Height) } finally { $bild.Dispose() }
    }
    if ($format.Count -and $kameras.Count) {      # passt die Angabe zum echten Bild?
      $bild = [System.Drawing.Image]::FromFile($tag[$kameras[0]].FullName)
      try { if ($bild.Width -ne $format[0] -or $bild.Height -ne $format[1]) { [void]$rueckfall.Add("$name  format $($format[0])×$($format[1]), Standbild ist $($bild.Width)×$($bild.Height) – es gilt das Standbild"); $format = @([int]$bild.Width, [int]$bild.Height) } } finally { $bild.Dispose() }
    }
    if (-not $bildschirm -and $format.Count) { $bildschirm = @(0, 0, $format[0], $format[1]) }
    if (-not $kachelAus -and $format.Count) { $kw = [int][Math]::Round($format[1] * 4 / 3); $kachelAus = @([int](($format[0] - $kw) / 2), 0, $kw, $format[1]) }
    # Videos: eigene Größe (format.video, z. B. 2592 × 1080) – die Website legt sie auf dieselbe Fläche wie die Standbilder,
    # das Seitenverhältnis muss also gleich sein
    $formatVideo = @()
    $fov = Wert $fo 'video'
    if ($fov -and (Wert $fov 'breite') -and (Wert $fov 'hoehe')) {
      $formatVideo = @([int](Wert $fov 'breite'), [int](Wert $fov 'hoehe'))
      if ($format.Count -and [Math]::Abs($formatVideo[0] / $formatVideo[1] - $format[0] / $format[1]) -gt 0.005) {
        [void]$rueckfall.Add("$name  format.video $($formatVideo[0])×$($formatVideo[1]) hat ein anderes Seitenverhältnis als die Standbilder $($format[0])×$($format[1]) – Videos werden gestreckt")
      }
    } else { [void]$rueckfall.Add("$name  format.video fehlt → Videos im Seitenverhältnis der Standbilder angenommen") }

    # ---- bildinfo: je Standbild der Bildbereich des Möbels (Pixel im vollen Bild) und ob es schon angeschnitten ist ----
    #      → "moebel" / "moebelAbend" (parallel zu bilder / abend): [x, y, b, h, angeschnitten 0|1] oder null
    $bildinfo = @{}
    $biListe = @(@(Wert $p 'bildinfo') | Where-Object { $_ })
    if (-not $biListe.Count) { [void]$rueckfall.Add("$name  bildinfo fehlt → kein Möbelbereich, das Bild wird nur nach dem Fenster gelegt") }
    foreach ($e in $biListe) { $nm = Split-Path -Leaf ([string](Wert $e 'bild')); if ($nm) { $bildinfo[$nm] = $e } }
    function MoebelJs([string]$datei) {
      $e = $bildinfo[$datei]
      if (-not $e) { if ($biListe.Count) { [void]$rueckfall.Add("$name  bildinfo: kein Eintrag für $datei") }; return 'null' }
      $r = Rechteck (Wert $e 'moebel')
      if (-not $r) { [void]$rueckfall.Add("$name  bildinfo: $datei ohne Feld moebel"); return 'null' }
      return '[' + ($r -join ', ') + ', ' + $(if ([bool](Wert $e 'angeschnitten')) { '1' } else { '0' }) + ']'
    }

    $bilderJs = @(); $abendJs = @(); $moebelJs = @(); $moebelAbendJs = @()
    foreach ($c in $kameras) {
      $f = $tag[$c]; $bildDateien[$f.Name] = $true; $bilderJs += 'bilder/' + $f.Name
      $moebelJs += MoebelJs $f.Name
      Spiegeln $f (Join-Path $zielOrdner ('bilder\' + $f.Name))
      [void]$versionText.Append("$($f.Name)|$($f.Length)|$($f.LastWriteTimeUtc.Ticks);")
      if ($abend.ContainsKey($c)) {
        $fa = $abend[$c]; $bildDateien[$fa.Name] = $true; $abendJs += 'bilder/' + $fa.Name
        $moebelAbendJs += MoebelJs $fa.Name
        Spiegeln $fa (Join-Path $zielOrdner ('bilder\' + $fa.Name))
        [void]$versionText.Append("$($fa.Name)|$($fa.Length)|$($fa.LastWriteTimeUtc.Ticks);")
      } else { $abendJs += $null; $moebelAbendJs += 'null' }
    }

    # ---- Hochformat (Handy senkrecht): bilder_hoch, format_hoch, fahrten_hoch, abendfahrten_hoch ----
    #      Nur wenn JEDE View ein Hochformat-Standbild hat (sonst gemischte Formate) – sonst bleibt "hoch": null und
    #      die Website zeigt am Handy wie bisher das breite Bild.  Dateien: Still_CamN_hoch.jpg, Still_CamN_abend_hoch.jpg,
    #      video\Move_CamA_CamB_hoch.mp4|webm (+ _abend_hoch), video\klein\ dasselbe.
    $tagH = @{}; $abendH = @{}
    foreach ($eintrag in @(Wert $p 'bilder_hoch')) {
      if (-not $eintrag) { continue }
      $f = QuellDatei ([string]$eintrag)
      if (-not $f) { [void]$fehlend.Add("$name  $eintrag  (steht in bilder_hoch, Datei fehlt)"); continue }
      if ($f.Name -notmatch '^Still_Cam(\d+)(_abend)?_hoch\.(jpe?g|png|webp)$') { Melden "  ! $name  unbekannter Hochformat-Name $($f.Name) – übersprungen" 'Yellow'; continue }
      if ($matches[2]) { if ($mitAbend) { $abendH[[int]$matches[1]] = $f } } else { $tagH[[int]$matches[1]] = $f }
    }
    $hochJs = 'null'; $mitHoch = $false; $formatHoch = @(); $kachelHoch = $null
    if ($tagH.Count) {
      $ohne = @($kameras | Where-Object { -not $tagH.ContainsKey($_) })
      if ($ohne.Count) {
        [void]$rueckfall.Add("$name  bilder_hoch: Hochformat fehlt für Cam $($ohne -join ', ') – Hochformat nicht verwendet (Handy zeigt das breite Bild)")
      } else {
        $mitHoch = $true
        $foh = Wert $p 'format_hoch'
        if ($foh -and (Wert $foh 'breite') -and (Wert $foh 'hoehe')) {
          $formatHoch = @([int](Wert $foh 'breite'), [int](Wert $foh 'hoehe'))
          $kachelHoch = Rechteck (Wert $foh 'kachel')
        }
        $bild = [System.Drawing.Image]::FromFile($tagH[$kameras[0]].FullName)
        try {
          if (-not $formatHoch.Count) { [void]$rueckfall.Add("$name  format_hoch fehlt → Größe aus dem ersten Hochformat-Bild"); $formatHoch = @([int]$bild.Width, [int]$bild.Height) }
          elseif ($bild.Width -ne $formatHoch[0] -or $bild.Height -ne $formatHoch[1]) { [void]$rueckfall.Add("$name  format_hoch $($formatHoch[0])×$($formatHoch[1]), Bild ist $($bild.Width)×$($bild.Height) – es gilt das Bild"); $formatHoch = @([int]$bild.Width, [int]$bild.Height) }
        } finally { $bild.Dispose() }
        # Lage der 4:3-Kachel im Hochformat: aus bildinfo des Cam1-Hochformats (gilt für genau dieses Bild), sonst format_hoch.kachel
        $e1 = $bildinfo[$tagH[$kameras[0]].Name]
        if ($e1 -and (Rechteck (Wert $e1 'kachel'))) { $kachelHoch = Rechteck (Wert $e1 'kachel') }
        if (-not $kachelHoch) { [void]$rueckfall.Add("$name  format_hoch.kachel fehlt → Kachel = volle Breite, 4:3, oben bei 750/4800"); $kh = [int][Math]::Round($formatHoch[0] * 3 / 4); $kachelHoch = @(0, [int][Math]::Round($formatHoch[1] * 750 / 4800), $formatHoch[0], $kh) }
        # Lage der KACHEL (4:3-Ausschnitt des breiten Cam1-Bilds) im Cam1-Hochformat: bildinfo.kachel_breit – Cam1 hat im
        # Hochformat eine andere Brennweite, die Kachel ragt dann seitlich über das Hochformat hinaus (negative Werte).
        # Daraus rechnet die Seite den nahtlosen Zoom Kachel ↔ Hochformat. Fehlt es: Rückfall auf format_hoch.kachel.
        $kachelBreit = $null
        if ($e1) { $kachelBreit = Rechteck (Wert $e1 'kachel_breit') }
        if (-not $kachelBreit) { [void]$rueckfall.Add("$name  bildinfo.kachel_breit für Cam1 hoch fehlt → Kachel = format_hoch.kachel (Zoom nur nahtlos bei gleicher Brennweite)"); $kachelBreit = $kachelHoch }
        $brennweiten = @()
        $hb = @(); $ha = @(); $hm = @(); $hma = @()
        foreach ($c in $kameras) {
          $f = $tagH[$c]; $bildDateien[$f.Name] = $true; $hb += 'bilder/' + $f.Name; $hm += MoebelJs $f.Name
          $bw = Wert $bildinfo[$f.Name] 'brennweite'; $brennweiten += $(if ($null -ne $bw) { ([double]$bw).ToString([Globalization.CultureInfo]::InvariantCulture) } else { 'null' })
          Spiegeln $f (Join-Path $zielOrdner ('bilder\' + $f.Name))
          [void]$versionText.Append("$($f.Name)|$($f.Length)|$($f.LastWriteTimeUtc.Ticks);")
          if ($abendH.ContainsKey($c)) {
            $fa = $abendH[$c]; $bildDateien[$fa.Name] = $true; $ha += 'bilder/' + $fa.Name; $hma += MoebelJs $fa.Name
            Spiegeln $fa (Join-Path $zielOrdner ('bilder\' + $fa.Name))
            [void]$versionText.Append("$($fa.Name)|$($fa.Length)|$($fa.LastWriteTimeUtc.Ticks);")
          } else {
            $ha += $null; $hma += 'null'
            if ($mitAbend) { [void]$fehlend.Add("$name  bilder\Still_Cam${c}_abend_hoch.jpg  (Lampe: Hochformat-Abendbild fehlt)") }
          }
        }
      }
    } elseif ($kameras.Count) {
      [void]$rueckfall.Add("$name  bilder_hoch leer → am Handy senkrecht das breite Bild (wie bisher)")
    }

    # ---- Kachelbilder (seit Runde 8): eine kleine Kopie des GANZEN Standbilds von View 1 (12:5, KachelHoehe px hoch,
    #      ~60 KB) und bei Lampen seiner Abendversion. Die Kachel zeigt davon den 4:3-Ausschnitt (format.kachel); beim
    #      Öffnen ist so sofort das ganze breite Bild da (unscharf), bis das große Standbild geladen ist – nie grau.
    #      Mit Hochformat zusätzlich eine kleine Kopie des Hochformat-Bilds von View 1 (Handy senkrecht).
    #      → bilder\kachel\Still_Cam1.jpg, Still_Cam1_abend.jpg, Still_Cam1_hoch.jpg, Still_Cam1_abend_hoch.jpg
    #      (Das Feld "kacheln" – 4:3-Ausschnitte in voller Größe – wird dafür nicht mehr gebraucht.)
    $paare = @()
    if ($kameras.Count) {
      $paare += @{ q = $tag[$kameras[0]]; js = 'tag'; vf = "scale=-2:${KachelHoehe}" }
      if ($mitAbend -and $abend.ContainsKey($kameras[0])) { $paare += @{ q = $abend[$kameras[0]]; js = 'abend'; vf = "scale=-2:${KachelHoehe}" } }
      if ($mitHoch) {
        $paare += @{ q = $tagH[$kameras[0]]; js = 'hochTag'; vf = "scale=${KachelHochBreite}:-2" }
        if ($mitAbend -and $abendH.ContainsKey($kameras[0])) { $paare += @{ q = $abendH[$kameras[0]]; js = 'hochAbend'; vf = "scale=${KachelHochBreite}:-2" } }
        # Handy-Kachel: derselbe verkleinerte Hochformat-Kopie (600 px breit), daraus der Kachelausschnitt – so ist die
        # Kachel Pixel für Pixel ein Stück der kleinen Kopie, mit der der Zoom aufzieht. Lage in ganzen Pixeln der Kopie,
        # in den Daten zurückgerechnet auf das volle Hochformat (handyAusschnitt).
        $fk = $KachelHochBreite / $formatHoch[0]
        $kH = [int][Math]::Round($KachelHochBreite / $HandyKachelSeite)
        $kY = [int][Math]::Round($HandyKachelOben * $formatHoch[1] * $fk)
        $kopieH = [int][Math]::Round($formatHoch[1] * $fk)
        if ($kY + $kH -gt $kopieH) { $kY = $kopieH - $kH }
        $handyAus = @(0, [int][Math]::Round($kY / $fk), [int]$formatHoch[0], [int][Math]::Round($kH / $fk))
        $vfHandy = "scale=${KachelHochBreite}:-2:flags=lanczos,crop=${KachelHochBreite}:${kH}:0:${kY}"
        $paare += @{ q = $tagH[$kameras[0]]; js = 'handyTag'; vf = $vfHandy; aus = 'Still_Cam1_hoch_kachel.jpg'; hoehe = $kH }
        if ($mitAbend -and $abendH.ContainsKey($kameras[0])) { $paare += @{ q = $abendH[$kameras[0]]; js = 'handyAbend'; vf = $vfHandy; aus = 'Still_Cam1_abend_hoch_kachel.jpg'; hoehe = $kH } }
        # passt das Möbel (bildinfo von Cam1 hoch) mit Luft hinein? – für den Bericht
        $mb = $null; if ($e1) { $mb = Rechteck (Wert $e1 'moebel') }
        if ($mb) {
          $luftO = ($mb[1] - $handyAus[1]) / $handyAus[3]; $luftU = ($handyAus[1] + $handyAus[3] - $mb[1] - $mb[3]) / $handyAus[3]
          [void]$handyLuft.Add(("{0,-12} Luft oben {1,5:P1}, unten {2,5:P1}" -f $name, $luftO, $luftU))
          if ($luftO -lt 0.03 -or $luftU -lt 0.03) { [void]$rueckfall.Add(("$name  Handy-Kachel: Möbel hat zu wenig Luft (oben {0:P1}, unten {1:P1}) – HandyKachelSeite / HandyKachelOben anpassen" -f $luftO, $luftU)) }
        } else { [void]$handyLuft.Add("$name  (keine Möbel-Box in bildinfo für Cam1 hoch)") }
      }
    }
    $kachelJs = $null; $kachelAbendJs = $null; $kachelHochJs = $null; $kachelHochAbendJs = $null; $handyJs = $null; $handyAbendJs = $null; $kachelDateien = @{}
    $kachelOrdner = Join-Path $zielOrdner 'bilder\kachel'
    foreach ($pa in $paare) {
      $q = $pa.q
      $nameAus = if ($pa.aus) { $pa.aus } else { $q.Name }
      $aus = Join-Path $kachelOrdner $nameAus
      $kachelDateien[$nameAus] = $true
      if (-not $NurDaten) {
        if (-not (Test-Path -LiteralPath $kachelOrdner)) { New-Item -ItemType Directory -Force $kachelOrdner | Out-Null }
        $erneuern = $Neu -or -not (Test-Path -LiteralPath $aus) -or (Get-Item -LiteralPath $aus).LastWriteTimeUtc -lt $q.LastWriteTimeUtc
        if (-not $erneuern -and $pa.hoehe) {      # Handy-Kachel mit anderer Höhe (Einstellung geändert): neu schneiden
          $vorh = [System.Drawing.Image]::FromFile($aus)
          try { $erneuern = $vorh.Height -ne $pa.hoehe } finally { $vorh.Dispose() }
        }
        if ($erneuern) {
          $vfVoll = if ($pa.vf -match 'flags=') { $pa.vf } else { "$($pa.vf):flags=lanczos" }
          & $FFmpeg -hide_banner -loglevel error -y -i $q.FullName -vf $vfVoll -frames:v 1 -update 1 -q:v 4 -map_metadata -1 $aus
          if ($LASTEXITCODE -ne 0) { throw "ffmpeg-Fehler beim Kachelbild $name $nameAus" }
          $stat.neu++
        }
      }
      if (Test-Path -LiteralPath $aus) {
        [void]$versionText.Append("kachel\$nameAus|$($q.Length)|$($q.LastWriteTimeUtc.Ticks)|$($pa.vf);")
        switch ($pa.js) {
          'tag' { $kachelJs = 'bilder/kachel/' + $nameAus } 'abend' { $kachelAbendJs = 'bilder/kachel/' + $nameAus }
          'hochTag' { $kachelHochJs = 'bilder/kachel/' + $nameAus } 'hochAbend' { $kachelHochAbendJs = 'bilder/kachel/' + $nameAus }
          'handyTag' { $handyJs = 'bilder/kachel/' + $nameAus } 'handyAbend' { $handyAbendJs = 'bilder/kachel/' + $nameAus }
        }
      }
    }
    Aufraeumen $kachelOrdner $kachelDateien '\.(jpe?g|png|webp)$'

    # Axonometrie für Customize (noch nicht im Export – wird übernommen, sobald sie da ist)
    $axo = $null
    foreach ($kandidat in @('Axonometrie.jpg', 'Axonometrie.png')) {
      $qa = Join-Path $quellOrdner ('bilder\' + $kandidat)
      if (Test-Path -LiteralPath $qa) {
        $fx = Get-Item -LiteralPath $qa; $bildDateien[$fx.Name] = $true; $axo = 'bilder/' + $fx.Name
        Spiegeln $fx (Join-Path $zielOrdner ('bilder\' + $fx.Name))
        [void]$versionText.Append("$($fx.Name)|$($fx.Length)|$($fx.LastWriteTimeUtc.Ticks);")
        break
      }
    }
    Aufraeumen (Join-Path $zielOrdner 'bilder') $bildDateien '\.(jpe?g|png|webp)$'

    # ---- Videos: Fahrten zwischen allen vorhandenen Kameras, beide Richtungen, mp4 + webm, groß und klein ----
    #      Abendfahrten (nur Lampen): genau die aus "abendfahrten" – Move_CamA_CamB_abend.mp4, daneben .webm und video\klein\
    $abendPaare = @{}
    foreach ($eintrag in @(Wert $p 'abendfahrten')) {
      if (-not $eintrag) { continue }
      $nm = Split-Path -Leaf ([string]$eintrag)
      if ($nm -match '^Move_Cam(\d+)_Cam(\d+)_abend\.(mp4|webm)$') { $abendPaare["$([int]$matches[1])-$([int]$matches[2])"] = $true }
      else { Melden "  ! $name  unbekannter Name in abendfahrten: $nm – übersprungen" 'Yellow' }
    }
    if ($abendPaare.Count -and -not $mitAbend) { [void]$rueckfall.Add("$name  abendfahrten vorhanden, aber abendbilder: false – Abendfahrten nicht übernommen"); $abendPaare = @{} }
    # Hochformat-Fahrten: Move_CamA_CamB_hoch (+ _abend_hoch bei Lampen) – zwischen denselben Kameras wie die breiten
    $abendHochPaare = @{}
    foreach ($eintrag in @(Wert $p 'abendfahrten_hoch')) {
      if (-not $eintrag) { continue }
      $nm = Split-Path -Leaf ([string]$eintrag)
      if ($nm -match '^Move_Cam(\d+)_Cam(\d+)_abend_hoch\.(mp4|webm)$') { $abendHochPaare["$([int]$matches[1])-$([int]$matches[2])"] = $true }
      else { Melden "  ! $name  unbekannter Name in abendfahrten_hoch: $nm – übersprungen" 'Yellow' }
    }
    $nFahrtenHochFeld = @(@(Wert $p 'fahrten_hoch') | Where-Object { $_ }).Count
    $fahrtenJs = @{}
    foreach ($stufe in @(@{ ordner = 'video'; js = 'fahrten' }, @{ ordner = 'video\klein'; js = 'fahrtenKlein' })) {
      $vorhanden = @{}; $eintraege = @(); $eintraegeAbend = @(); $eintraegeHoch = @(); $eintraegeAbendHoch = @()
      foreach ($a in $kameras) {
        foreach ($b in $kameras) {
          if ($a -eq $b) { continue }
          foreach ($art in @('', '_abend', '_hoch', '_abend_hoch')) {
            if ($art -eq '_abend' -and -not $abendPaare.ContainsKey("$a-$b")) { continue }
            if ($art -eq '_hoch' -and -not $mitHoch) { continue }
            if ($art -eq '_abend_hoch' -and -not ($mitHoch -and $mitAbend -and $abendHochPaare.ContainsKey("$a-$b"))) { continue }
            $formate = @()
            foreach ($endung in @('webm', 'mp4')) {
              $datei = "Move_Cam${a}_Cam${b}$art.$endung"
              $qv = Join-Path $quellOrdner ($stufe.ordner + '\' + $datei)
              if (Test-Path -LiteralPath $qv) {
                $fv = Get-Item -LiteralPath $qv
                $vorhanden[$datei] = $true
                $formate += $endung
                Spiegeln $fv (Join-Path $zielOrdner ($stufe.ordner + '\' + $datei))
                [void]$versionText.Append("$($stufe.ordner)\$datei|$($fv.Length)|$($fv.LastWriteTimeUtc.Ticks);")
              } else {
                [void]$fehlend.Add("$name  $($stufe.ordner)\$datei")
              }
            }
            if ($formate.Count) {
              $e = '"' + $a + '-' + $b + '": ' + (JsListe $formate)
              switch ($art) { '' { $eintraege += $e } '_abend' { $eintraegeAbend += $e } '_hoch' { $eintraegeHoch += $e } '_abend_hoch' { $eintraegeAbendHoch += $e } }
            }
          }
        }
      }
      Aufraeumen (Join-Path $zielOrdner $stufe.ordner) $vorhanden '\.(mp4|webm)$'
      $fahrtenJs[$stufe.js] = '{' + ($eintraege -join ', ') + '}'
      $fahrtenJs[$stufe.js + 'Abend'] = '{' + ($eintraegeAbend -join ', ') + '}'
      $fahrtenJs[$stufe.js + 'Hoch'] = '{' + ($eintraegeHoch -join ', ') + '}'
      $fahrtenJs[$stufe.js + 'AbendHoch'] = '{' + ($eintraegeAbendHoch -join ', ') + '}'
    }
    LeerenOrdnerEntfernen $kachelOrdner
    if ($mitHoch) {
      $nH = ([regex]::Matches($fahrtenJs.fahrtenHoch, '"\d+-\d+"')).Count
      if ($nFahrtenHochFeld -and $nFahrtenHochFeld -ne $nH) { [void]$rueckfall.Add("$name  fahrten_hoch nennt $nFahrtenHochFeld Datei(en), gefunden wurden $nH Hochformat-Fahrten") }
      $hochJs = "{ ""format"": " + (JsListe $formatHoch) + ', "kachelAusschnitt": ' + (JsListe $kachelHoch) +
        ', "kachelBreit": ' + (JsListe $kachelBreit) + ', "brennweite": [' + ($brennweiten -join ', ') + ']' +
        ', "bilder": ' + (JsListe $hb) + ', "abend": ' + $(if ($mitAbend) { JsListe $ha } else { '[]' }) +
        ",`n        ""moebel"": [" + ($hm -join ', ') + '], "moebelAbend": [' + $(if ($mitAbend) { $hma -join ', ' } else { '' }) + ']' +
        ",`n        ""kachel"": " + (JsText $kachelHochJs) + ', "kachelAbend": ' + (JsText $kachelHochAbendJs) +
        ",`n        ""handyKachel"": " + (JsText $handyJs) + ', "handyKachelAbend": ' + (JsText $handyAbendJs) + ', "handyAusschnitt": ' + (JsListe $handyAus) +
        ",`n        ""fahrten"": " + $fahrtenJs.fahrtenHoch + ', "fahrtenKlein": ' + $fahrtenJs.fahrtenKleinHoch +
        ",`n        ""fahrtenAbend"": " + $fahrtenJs.fahrtenAbendHoch + ', "fahrtenAbendKlein": ' + $fahrtenJs.fahrtenKleinAbendHoch + ' }'
    } elseif ((@(Wert $p 'fahrten_hoch') | Where-Object { $_ }).Count -or $abendHochPaare.Count) {
      [void]$rueckfall.Add("$name  fahrten_hoch / abendfahrten_hoch vorhanden, aber keine vollständigen bilder_hoch – nicht übernommen")
    }
    $handyKameras = @(@(Wert $p 'handykameras') | Where-Object { $null -ne $_ } | ForEach-Object { [int]$_ })

    # Versionsmarke: ändert sich, sobald sich eine Datei des Produkts ändert → der Browser lädt sie neu
    $hash = $md5.ComputeHash([Text.Encoding]::UTF8.GetBytes($versionText.ToString()))
    $version = (($hash[0..3] | ForEach-Object { $_.ToString('x2') }) -join '')

    $views = if ($kameras.Count) { $kameras.Count } elseif ($perspektiven -gt 0) { $perspektiven } else { 1 }
    $licht = $mitAbend
    $nV = ([regex]::Matches($fahrtenJs.fahrten, '"\d+-\d+"')).Count
    $nVk = ([regex]::Matches($fahrtenJs.fahrtenKlein, '"\d+-\d+"')).Count
    $nA = ([regex]::Matches($fahrtenJs.fahrtenAbend, '"\d+-\d+"')).Count
    Melden ("  {0,-12} {1,-12} {2,-9} {3}  {4} View(s){5}   Bilder: {6}{7}   Fahrten: {8} / klein {9}{10}   Format {11}{12}" -f $name, $code, $kat, $kl, $views,
      $(if ($licht) { '  Licht' } else { '' }), $kameras.Count, $(if ($abend.Count) { " + $($abend.Count) Abend" } else { '' }), $nV, $nVk,
      $(if ($nA) { " + $nA Abend" } else { '' }), $(if ($format.Count) { "$($format[0])×$($format[1])" } else { '?' }),
      $(if ($mitHoch) { "   Hochformat $($formatHoch[0])×$($formatHoch[1]), Fahrten $(([regex]::Matches($fahrtenJs.fahrtenHoch, '"\d+-\d+"')).Count)" } else { '   Hochformat: –' }))

    $zeilen += '    { "name": ' + (JsText $name) + ', "code": ' + (JsText $code) + ', "nummer": ' + $nummer + ', "kategorie": ' + (JsText $kat) + ', "klasse": ' + (JsText $kl) +
      ', "views": ' + $views + ', "leuchtmittel": ' + $(if ($licht) { 'true' } else { 'false' }) + ', "masse": ' + (JsText $masse) +
      ",`n      ""ordner"": " + (JsText ("media/produkte/" + $name + "/")) + ', "version": ' + (JsText $version) +
      ', "kameras": ' + (JsListe $kameras) + ', "axo": ' + (JsText $axo) +
      ",`n      ""format"": " + (JsListe $format) + ', "bildschirm": ' + $(if ($bildschirm) { JsListe $bildschirm } else { 'null' }) + ', "kachelAusschnitt": ' + $(if ($kachelAus) { JsListe $kachelAus } else { 'null' }) +
      ",`n      ""kachel"": " + (JsText $kachelJs) + ', "kachelAbend": ' + (JsText $kachelAbendJs) + ', "kachelVoll": true' +
      ",`n      ""bilder"": " + (JsListe $bilderJs) +
      ",`n      ""abend"": " + $(if ($licht) { JsListe $abendJs } else { '[]' }) +
      ",`n      ""moebel"": [" + ($moebelJs -join ', ') + ']' +
      ",`n      ""moebelAbend"": [" + $(if ($licht) { $moebelAbendJs -join ', ' } else { '' }) + ']' +
      ",`n      ""formatVideo"": " + (JsListe $formatVideo) +
      ",`n      ""fahrten"": " + $fahrtenJs.fahrten +
      ",`n      ""fahrtenKlein"": " + $fahrtenJs.fahrtenKlein +
      ",`n      ""fahrtenAbend"": " + $fahrtenJs.fahrtenAbend +
      ",`n      ""fahrtenAbendKlein"": " + $fahrtenJs.fahrtenKleinAbend +
      ",`n      ""handykameras"": " + (JsListe $handyKameras) +
      ",`n      ""hoch"": " + $hochJs + ' }'
  }

  # Ordner von Produkten, die nicht mehr in produkte.json stehen, entfernen
  if (-not $NurDaten) {
    @(Get-ChildItem -LiteralPath $mediaProdukte -Directory | Where-Object { -not $namen.ContainsKey($_.Name) }) | ForEach-Object {
      Beiseitelegen $_.FullName $mediaProdukte
      $stat.entfernt++
      Melden "    → Papierkorb: media\produkte\$($_.Name)\ (steht nicht mehr in produkte.json)" 'DarkGray'
    }
  }

  $js = "/* gauge – products. GENERATED by bau/aktualisieren.ps1 from produkte.json (Unity Website_Test) + _Import/produkte-zusatz.json.`n" +
        "   Do not edit by hand – changes are overwritten on the next build.`n" +
        "   Paths are relative to ""ordner"". bilder[i] / abend[i] = still of view i+1 (camera kameras[i]), abend entry null = no evening image.`n" +
        "   fahrten / fahrtenKlein: ""a-b"" = move from camera a to camera b, with the formats that exist.`n" +
        "   fahrtenAbend / fahrtenAbendKlein: the same for the evening moves of a lamp (Move_CamA_CamB_abend, field abendfahrten).`n" +
        "   kachel / kachelAbend = small copy of the WHOLE still of view 1 (12:5, kachelVoll) and its evening version (bilder/kachel/) –`n   the tile shows its 4:3 crop (kachelAusschnitt); opening a product shows it at once until the big still has loaded.`n" +
        "   format = [width, height] of the stills and videos (full picture, e.g. 12:5); bildschirm / kachelAusschnitt = [x, y, w, h] of the`n" +
        "   16:9 and 4:3 crops in it (both centred – the picture centre is the composition centre; the reserve left/right lets the`n" +
        "   product page move the centre into the middle of the free area).`n" +
        "   formatVideo = [width, height] of the moves (same aspect ratio, e.g. 2592 × 1080 for 4320 × 1800 stills).`n" +
        "   moebel / moebelAbend[i] = [x, y, w, h, cut] – pixel box of the furniture in still i (field bildinfo), which the page`n" +
        "   never crops; cut = 1: the furniture already touches the picture edge (close-up) – the box is not enforced.`n" +
        "   hoch = the portrait version for phones held upright (fields bilder_hoch, format_hoch, fahrten_hoch, abendfahrten_hoch)`n" +
        "   or null while it does not exist for every view – the phone then shows the wide picture.`n" +
        "   hoch.kachelAusschnitt = 4:3 crop of the portrait Cam1 picture (format_hoch.kachel), hoch.kachelBreit = where the tile`n" +
        "   (4:3 crop of the WIDE Cam1 picture) lies in the portrait Cam1 picture (bildinfo.kachel_breit, may reach outside),`n" +
        "   hoch.brennweite = focal length (mm) per portrait view (bildinfo.brennweite).`n" +
        "   hoch.kachel / kachelAbend = small copy of the whole portrait Cam1 picture; hoch.handyKachel / handyKachelAbend = the phone`n" +
        "   tile (Products, phone upright): a full-width crop of that small copy, handyAusschnitt = [x, y, w, h] of the crop in the`n" +
        "   portrait picture – the same for all products (same scale, wall/floor joint at the same height).`n" +
        "   handykameras = passed through (field handykameras).`n" +
        "   code = display name (field anzeigename, e.g. OBJ_ST_M_05), kategorie = field typ; typen = the type abbreviations.`n" +
        "   name = internal name (folders, files, URLs). */`n" +
        "window.GAUGE_PRODUKTE = {`n  ""erzeugt"": " + (JsText $zeit) + ",`n" +
        "  ""typen"": {" + ((@($typen.Keys) | ForEach-Object { (JsText $_) + ': ' + (JsText $typen[$_]) }) -join ', ') + "},`n" +
        "  ""produkte"": [`n" + ($zeilen -join ",`n") + "`n  ]`n};`n"
  $neuGeschrieben = SchreibenWennNeu (Join-Path $Ziel 'data\produkte.js') $js
  Melden ("  {0} Produkt(e) → data\produkte.js{1}" -f $zeilen.Count, $(if ($neuGeschrieben) { '' } else { ' (unverändert)' })) 'Green'
  if ($NurDaten) { Melden '  (-NurDaten: keine Dateien kopiert)' 'DarkGray' }
  else { Melden ("  Dateien: {0} neu, {1} ersetzt, {2} unverändert, {3} entfernt" -f $stat.neu, $stat.ersetzt, $stat.gleich, $stat.entfernt) 'Green' }
  if ($handyLuft.Count) {
    Melden ("`n  Handy-Kachel (Cam1 hoch, {0:0.###} : 1, Oberkante {1:P1} der Höhe) – Möbel darin:" -f $HandyKachelSeite, $HandyKachelOben) 'Gray'
    $handyLuft | ForEach-Object { Melden "    $_" 'Gray' }
  }
  if ($rueckfall.Count) {
    Melden ("`n  Hinweise zu produkte.json ({0}) – Rückfall oder Abweichung:" -f $rueckfall.Count) 'Yellow'
    $rueckfall | ForEach-Object { Melden "    $_" 'Yellow' }
  } else {
    Melden '  produkte.json: typ, anzeigename, format, kacheln vollständig – kein Rückfall nötig.' 'Green'
  }
  if ($fehlend.Count) {
    Melden ("`n  Fehlende Dateien ({0}):" -f $fehlend.Count) 'Yellow'
    $fehlend | ForEach-Object { Melden "    $_" 'Yellow' }
  } else {
    Melden '  Keine Dateien fehlen.' 'Green'
  }
}

Melden "`nFertig. Seite neu laden (F5)." 'White'

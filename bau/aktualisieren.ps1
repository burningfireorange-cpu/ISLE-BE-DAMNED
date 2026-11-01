<#
  gauge – Bau-Skript: aktualisiert alles, was die Website an Daten und Medien braucht.
  Beliebig oft wiederholbar: Es kopiert nur, was neu ist oder sich geändert hat (Größe oder Änderungszeit),
  entfernt, was es in der Quelle nicht mehr gibt, und legt nie etwas doppelt an.

  1. Galerie:  _Import\Galerie\*.jpg|*.jpeg|*.png  →  media\galerie\klein\ (ca. 800 px) + media\galerie\gross\ (ca. 2000 px)
               Metadaten entfernt, Drehung (EXIF) berücksichtigt, Transparenz auf Seitenfarbe  →  data\galerie.js
  2. Produkte: <Quelle>\produkte.json  →  media\produkte\produkte.json (Kopie)
               je Produkt  <Quelle>\<Name>\bilder\   nur die Bilder aus dem Feld "bilder" (Abendbilder nur bei "abendbilder": true)
                           <Quelle>\<Name>\video\    Move_CamX_CamY.mp4 + .webm zwischen den vorhandenen Kameras, beide Richtungen
                           <Quelle>\<Name>\video\klein\  dasselbe in klein (Handy / schmale Fenster)
               →  media\produkte\<Name>\...  →  data\produkte.js
               Zusatzinfos (Kategorie, Maße) aus _Import\produkte-zusatz.json.
               Die Quelle (Unity-Projekt) wird NUR gelesen – dort wird nie etwas geändert.
               Am Ende steht eine Liste aller Dateien, die gefehlt haben.
  Dummy-Produkte stehen in data\dummies.js und werden hier nicht angefasst (an/aus in js\config.js: dummiesZeigen).

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
  [int]$KachelBreite = 800,     # Breite der kleinen Kachelbilder (Products lädt beim Start nur diese)
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
  # verwaiste Ausgaben entfernen (Original wurde gelöscht)
  foreach ($o in @($ausKlein, $ausGross)) {
    Get-ChildItem -LiteralPath $o -File -Filter *.jpg | Where-Object { -not $vergeben.ContainsKey($_.BaseName) } | ForEach-Object {
      Remove-Item -LiteralPath $_.FullName; Melden "  entfernt: $($_.Name)" 'DarkGray'
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
  <# Alles in einem Zielordner entfernen, was nicht (mehr) dazugehört. #>
  function Aufraeumen([string]$ordner, [hashtable]$behalten, [string]$muster) {
    if ($NurDaten -or -not (Test-Path -LiteralPath $ordner)) { return }
    Get-ChildItem -LiteralPath $ordner -File | Where-Object { $_.Name -match $muster -and -not $behalten.ContainsKey($_.Name) } | ForEach-Object {
      Remove-Item -LiteralPath $_.FullName
      $stat.entfernt++
      Melden ("    entfernt: {0}" -f $_.FullName.Substring($Ziel.Length).TrimStart('\')) 'DarkGray'
    }
  }

  # produkte.json selbst mitnehmen (zum Nachsehen; die Website liest data\produkte.js)
  Spiegeln (Get-Item -LiteralPath $jsonPfad) (Join-Path $mediaProdukte 'produkte.json')

  $namen = @{}
  $zeilen = @()
  foreach ($p in $daten.produkte) {
    $name = [string]$p.produkt
    if (-not $name) { continue }
    $namen[$name] = $true
    $z = Wert $zusatz $name
    $kat = Wert $p 'kategorie'; if (-not $kat) { $kat = Wert $z 'kategorie' }
    $kat = ([string]$kat).ToLowerInvariant()
    if ($kategorien -notcontains $kat) { Melden "  ! $name hat keine gültige Kategorie ('$kat') – nehme 'tables'. Bitte in _Import\produkte-zusatz.json eintragen." 'Yellow'; $kat = 'tables' }
    $masse = Wert $p 'masse'; if (-not $masse) { $masse = Wert $z 'masse' }
    $nummer = Wert $p 'nummer'; if (-not $nummer) { $nummer = Wert $z 'nummer' }
    if (-not $nummer) { $ziffern = $name -replace '\D', ''; if ($ziffern) { $nummer = [int]$ziffern } else { $nummer = 0 } }
    $kl = $klassen[([string]$p.klasse).ToUpperInvariant()]
    if (-not $kl) { $kl = $klassen[([string](Wert $z 'klasse')).ToUpperInvariant()] }
    if (-not $kl) { $kl = 'M' }
    $code = 'OBJ_' + $typen[$kat] + '_' + $kl + '_' + ([int]$nummer).ToString('00')
    $perspektiven = [int](Wert $p 'perspektiven')
    $mitAbend = [bool](Wert $p 'abendbilder')
    $quellOrdner = Join-Path $Quelle $name
    $zielOrdner = Join-Path $mediaProdukte $name
    $versionText = New-Object System.Text.StringBuilder

    # ---- Bilder: genau die aus dem Feld "bilder" (nicht aus "perspektiven" abgeleitet) ----
    $tag = @{}; $abend = @{}; $bildDateien = @{}
    foreach ($eintrag in @(Wert $p 'bilder')) {
      if (-not $eintrag) { continue }
      $rel = ([string]$eintrag).Replace('/', '\').TrimStart('\')
      $voll = Join-Path $Quelle $rel
      if (-not (Test-Path -LiteralPath $voll)) { $voll2 = Join-Path $quellOrdner $rel; if (Test-Path -LiteralPath $voll2) { $voll = $voll2 } }
      if (-not (Test-Path -LiteralPath $voll)) { [void]$fehlend.Add("$name  $rel  (steht in produkte.json, Datei fehlt)"); continue }
      $f = Get-Item -LiteralPath $voll
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
    }
    # Bildformat (Breite, Höhe) aus dem ersten Standbild – die Produktseite füllt damit den Bildschirm in jedem Seitenverhältnis
    $format = @()
    if ($kameras.Count) {
      $bild = [System.Drawing.Image]::FromFile($tag[$kameras[0]].FullName)
      try { $format = @([int]$bild.Width, [int]$bild.Height) } finally { $bild.Dispose() }
    }
    $bilderJs = @(); $abendJs = @()
    foreach ($c in $kameras) {
      $f = $tag[$c]; $bildDateien[$f.Name] = $true; $bilderJs += 'bilder/' + $f.Name
      Spiegeln $f (Join-Path $zielOrdner ('bilder\' + $f.Name))
      [void]$versionText.Append("$($f.Name)|$($f.Length)|$($f.LastWriteTimeUtc.Ticks);")
      if ($abend.ContainsKey($c)) {
        $fa = $abend[$c]; $bildDateien[$fa.Name] = $true; $abendJs += 'bilder/' + $fa.Name
        Spiegeln $fa (Join-Path $zielOrdner ('bilder\' + $fa.Name))
        [void]$versionText.Append("$($fa.Name)|$($fa.Length)|$($fa.LastWriteTimeUtc.Ticks);")
      } else { $abendJs += $null }
    }
    # Kachelbilder: View 1 (und ihr Abendbild) klein – die Kacheln laden beim Start nur diese, nicht die großen Standbilder
    $kachelJs = $null; $kachelAbendJs = $null; $kachelDateien = @{}
    $kachelOrdner = Join-Path $zielOrdner 'bilder\kachel'
    if ($kameras.Count) {
      $c1 = $kameras[0]
      $paare = @(@{ q = $tag[$c1]; js = 'tag' })
      if ($abend.ContainsKey($c1)) { $paare += @{ q = $abend[$c1]; js = 'abend' } }
      foreach ($pa in $paare) {
        $q = $pa.q
        $aus = Join-Path $kachelOrdner $q.Name
        $kachelDateien[$q.Name] = $true
        if (-not $NurDaten) {
          if (-not (Test-Path -LiteralPath $kachelOrdner)) { New-Item -ItemType Directory -Force $kachelOrdner | Out-Null }
          if ($Neu -or -not (Test-Path -LiteralPath $aus) -or (Get-Item -LiteralPath $aus).LastWriteTimeUtc -lt $q.LastWriteTimeUtc) {
            & $FFmpeg -hide_banner -loglevel error -y -i $q.FullName -vf "scale=${KachelBreite}:-2:flags=lanczos" -frames:v 1 -update 1 -q:v 4 -map_metadata -1 $aus
            if ($LASTEXITCODE -ne 0) { throw "ffmpeg-Fehler beim Kachelbild $name $($q.Name)" }
            $stat.neu++
          }
        }
        if (Test-Path -LiteralPath $aus) {
          if ($pa.js -eq 'tag') { $kachelJs = 'bilder/kachel/' + $q.Name } else { $kachelAbendJs = 'bilder/kachel/' + $q.Name }
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
    $fahrtenJs = @{}
    foreach ($stufe in @(@{ ordner = 'video'; js = 'fahrten' }, @{ ordner = 'video\klein'; js = 'fahrtenKlein' })) {
      $vorhanden = @{}; $eintraege = @()
      foreach ($a in $kameras) {
        foreach ($b in $kameras) {
          if ($a -eq $b) { continue }
          $formate = @()
          foreach ($endung in @('webm', 'mp4')) {
            $datei = "Move_Cam${a}_Cam${b}.$endung"
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
          if ($formate.Count) { $eintraege += ('"' + $a + '-' + $b + '": ' + (JsListe $formate)) }
        }
      }
      Aufraeumen (Join-Path $zielOrdner $stufe.ordner) $vorhanden '\.(mp4|webm)$'
      $fahrtenJs[$stufe.js] = '{' + ($eintraege -join ', ') + '}'
    }

    # Versionsmarke: ändert sich, sobald sich eine Datei des Produkts ändert → der Browser lädt sie neu
    $hash = $md5.ComputeHash([Text.Encoding]::UTF8.GetBytes($versionText.ToString()))
    $version = (($hash[0..3] | ForEach-Object { $_.ToString('x2') }) -join '')

    $views = if ($kameras.Count) { $kameras.Count } elseif ($perspektiven -gt 0) { $perspektiven } else { 1 }
    $licht = $mitAbend
    $nV = ([regex]::Matches($fahrtenJs.fahrten, '"\d+-\d+"')).Count
    $nVk = ([regex]::Matches($fahrtenJs.fahrtenKlein, '"\d+-\d+"')).Count
    Melden ("  {0,-12} {1,-12} {2,-9} {3}  {4} View(s){5}   Bilder: {6}{7}   Fahrten: {8} / klein {9}" -f $name, $code, $kat, $kl, $views,
      $(if ($licht) { '  Licht' } else { '' }), $kameras.Count, $(if ($abend.Count) { " + $($abend.Count) Abend" } else { '' }), $nV, $nVk)

    $zeilen += '    { "name": ' + (JsText $name) + ', "code": ' + (JsText $code) + ', "nummer": ' + $nummer + ', "kategorie": ' + (JsText $kat) + ', "klasse": ' + (JsText $kl) +
      ', "views": ' + $views + ', "leuchtmittel": ' + $(if ($licht) { 'true' } else { 'false' }) + ', "masse": ' + (JsText $masse) +
      ",`n      ""ordner"": " + (JsText ("media/produkte/" + $name + "/")) + ', "version": ' + (JsText $version) +
      ', "kameras": ' + (JsListe $kameras) + ', "format": ' + (JsListe $format) + ', "axo": ' + (JsText $axo) +
      ', "kachel": ' + (JsText $kachelJs) + ', "kachelAbend": ' + (JsText $kachelAbendJs) +
      ",`n      ""bilder"": " + (JsListe $bilderJs) +
      ",`n      ""abend"": " + $(if ($licht) { JsListe $abendJs } else { '[]' }) +
      ",`n      ""fahrten"": " + $fahrtenJs.fahrten +
      ",`n      ""fahrtenKlein"": " + $fahrtenJs.fahrtenKlein + ' }'
  }

  # Ordner von Produkten, die nicht mehr in produkte.json stehen, entfernen
  if (-not $NurDaten) {
    Get-ChildItem -LiteralPath $mediaProdukte -Directory | Where-Object { -not $namen.ContainsKey($_.Name) } | ForEach-Object {
      Remove-Item -LiteralPath $_.FullName -Recurse -Force
      $stat.entfernt++
      Melden "    entfernt: media\produkte\$($_.Name)\ (steht nicht mehr in produkte.json)" 'DarkGray'
    }
  }

  $js = "/* gauge – products. GENERATED by bau/aktualisieren.ps1 from produkte.json (Unity Website_Test) + _Import/produkte-zusatz.json.`n" +
        "   Do not edit by hand – changes are overwritten on the next build.`n" +
        "   Paths are relative to ""ordner"". bilder[i] / abend[i] = still of view i+1 (camera kameras[i]), abend entry null = no evening image.`n" +
        "   fahrten / fahrtenKlein: ""a-b"" = move from camera a to camera b, with the formats that exist.`n" +
        "   kachel / kachelAbend = small copy of view 1 for the tiles (bilder/kachel/).`n" +
        "   format = [width, height] of the stills (the product page covers the screen with this aspect ratio).`n" +
        "   code = display name OBJ_<type>_<size>_<number>; typen = the type abbreviations (from _Import/produkte-zusatz.json ""_typen"").`n" +
        "   name = internal name (folders, files, URLs). */`n" +
        "window.GAUGE_PRODUKTE = {`n  ""erzeugt"": " + (JsText $zeit) + ",`n" +
        "  ""typen"": {" + ((@($typen.Keys) | ForEach-Object { (JsText $_) + ': ' + (JsText $typen[$_]) }) -join ', ') + "},`n" +
        "  ""produkte"": [`n" + ($zeilen -join ",`n") + "`n  ]`n};`n"
  $neuGeschrieben = SchreibenWennNeu (Join-Path $Ziel 'data\produkte.js') $js
  Melden ("  {0} Produkt(e) → data\produkte.js{1}" -f $zeilen.Count, $(if ($neuGeschrieben) { '' } else { ' (unverändert)' })) 'Green'
  if ($NurDaten) { Melden '  (-NurDaten: keine Dateien kopiert)' 'DarkGray' }
  else { Melden ("  Dateien: {0} neu, {1} ersetzt, {2} unverändert, {3} entfernt" -f $stat.neu, $stat.ersetzt, $stat.gleich, $stat.entfernt) 'Green' }
  if ($fehlend.Count) {
    Melden ("`n  Fehlende Dateien ({0}):" -f $fehlend.Count) 'Yellow'
    $fehlend | ForEach-Object { Melden "    $_" 'Yellow' }
  } else {
    Melden '  Keine Dateien fehlen.' 'Green'
  }
}

Melden "`nFertig. Seite neu laden (F5)." 'White'

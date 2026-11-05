# gauge - vor dem Hochladen pruefen. LIEST NUR, aendert nichts (weder hier noch im GitHub-Ordner).
# Aufruf: Doppelklick auf bau\hochladen-pruefen.cmd  (nach dem Kopieren in den GitHub-Ordner, vor "Push origin")
#   1. Stimmen alle Pfade in data\produkte.js / data\galerie.js exakt mit den Dateinamen ueberein (Gross-/Kleinschreibung)?
#   2. Ist der GitHub-Ordner eine vollstaendige, gleiche Kopie von C:\websites\gauge?
#   3. Hat git im GitHub-Ordner einen Namen nur in anderer Gross-/Kleinschreibung (wuerde online den alten behalten)?
#   4. Werden Dateien, die die Seite braucht, von .gitignore ausgeschlossen? Groesste Datei, Gesamtgroesse.
param(
  [string]$Quelle = (Split-Path $PSScriptRoot -Parent),
  [string]$Ziel = (Join-Path $env:USERPROFILE 'Documents\GitHub\ISLE-BE-DAMNED')
)
$ErrorActionPreference = 'Stop'
$warn = New-Object System.Collections.Generic.List[string]
function Warnung($t) { $warn.Add($t); Write-Host "  WARNUNG: $t" -ForegroundColor Yellow }
function Ok($t) { Write-Host "  ok: $t" -ForegroundColor Green }

$git = @('C:\pinokio\bin\miniforge\Library\cmd\git.exe') + @(Get-ChildItem "$env:LOCALAPPDATA\GitHubDesktop\app-*\resources\app\git\cmd\git.exe" -ErrorAction SilentlyContinue | Sort-Object FullName -Descending | ForEach-Object FullName)
$git = $git | Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1
if (-not $git) { $c = Get-Command git -ErrorAction SilentlyContinue; if ($c) { $git = $c.Source } }

# Dateien, die nicht hochgeladen werden (nur lokal)
function NurLokal($rel) { return $rel -like '_Papierkorb/*' -or ($rel -like '_Import/Galerie/*' -and $rel -ne '_Import/Galerie/LIESMICH.txt') }
function Liste($root) {
  $set = New-Object 'System.Collections.Generic.Dictionary[string,System.IO.FileInfo]' ([StringComparer]::Ordinal)
  Get-ChildItem -LiteralPath $root -Recurse -File -Force | Where-Object { $_.FullName -notmatch '\\\.git(\\|$)' } | ForEach-Object {
    $set[$_.FullName.Substring($root.Length).TrimStart('\').Replace('\', '/')] = $_
  }
  return $set
}
function Existiert($root, $rel) {     # exakt so geschrieben (jede Ordnerebene)
  $p = $root
  foreach ($teil in ($rel -split '/')) {
    if (-not (Test-Path -LiteralPath $p -PathType Container)) { return $false }
    $namen = [IO.Directory]::GetFileSystemEntries($p) | ForEach-Object { [IO.Path]::GetFileName($_) }
    if (-not ($namen -ccontains $teil)) { return $false }
    $p = Join-Path $p $teil
  }
  return $true
}

Write-Host ''
Write-Host "gauge - Pruefung vor dem Hochladen" -ForegroundColor Cyan
Write-Host "  Quelle: $Quelle"
Write-Host "  GitHub-Ordner: $Ziel"

# ---- 1. Pfade in den Daten ----
Write-Host ''; Write-Host '1. Pfade in data\produkte.js und data\galerie.js (Gross-/Kleinschreibung)'
$pfade = New-Object System.Collections.Generic.List[string]
$roh = [IO.File]::ReadAllText((Join-Path $Quelle 'data\produkte.js'))
$json = $roh.Substring($roh.IndexOf('{', $roh.IndexOf('GAUGE_PRODUKTE'))); $json = $json.Substring(0, $json.LastIndexOf('}') + 1)
$daten = $json | ConvertFrom-Json
foreach ($p in $daten.produkte) {
  $o = $p.ordner
  $saetze = @(@{ d = $p; hoch = '' }); if ($p.hoch) { $saetze += @{ d = $p.hoch; hoch = '_hoch' } }
  foreach ($s in $saetze) {
    $d = $s.d
    foreach ($f in @($d.kachel, $d.kachelAbend, $d.handyKachel, $d.handyKachelAbend) + @($d.bilder) + @($d.abend)) { if ($f) { $pfade.Add($o + $f) } }
    foreach ($art in @(@('fahrten', 'video/', ''), @('fahrtenKlein', 'video/klein/', ''), @('fahrtenAbend', 'video/', '_abend'), @('fahrtenAbendKlein', 'video/klein/', '_abend'))) {
      $tab = $d.($art[0]); if (-not $tab) { continue }
      foreach ($k in $tab.PSObject.Properties) {
        $ab = $k.Name -split '-'
        foreach ($endung in $k.Value) { $pfade.Add($o + $art[1] + 'Move_Cam' + $ab[0] + '_Cam' + $ab[1] + $art[2] + $s.hoch + '.' + $endung) }
      }
    }
  }
}
$groh = [IO.File]::ReadAllText((Join-Path $Quelle 'data\galerie.js'))
[regex]::Matches($groh, '"(klein|gross)":\s*"([^"]+)"') | ForEach-Object { $pfade.Add($_.Groups[2].Value) }
$fehlt = @($pfade | Sort-Object -Unique | Where-Object { -not (Existiert $Quelle $_) })
if ($fehlt.Count) { $fehlt | ForEach-Object { Warnung "Datei fehlt oder ist anders geschrieben: $_" } }
else { Ok "$(@($pfade | Sort-Object -Unique).Count) Pfade, alle exakt vorhanden" }

# ---- 2. Kopie vollstaendig? ----
Write-Host ''; Write-Host '2. GitHub-Ordner = Kopie von C:\websites\gauge?'
if (-not (Test-Path -LiteralPath (Join-Path $Ziel '.git'))) { Warnung "Im GitHub-Ordner fehlt der versteckte Ordner .git - ist das der richtige Ordner?" }
$la = Liste $Quelle; $lb = Liste $Ziel
$nurQ = @($la.Keys | Where-Object { -not $lb.ContainsKey($_) -and -not (NurLokal $_) })
$nurZ = @($lb.Keys | Where-Object { -not $la.ContainsKey($_) -and -not (NurLokal $_) })
$anders = @($la.Keys | Where-Object { $lb.ContainsKey($_) -and -not (NurLokal $_) } | Where-Object {
  $a = $la[$_]; $b = $lb[$_]
  if ($a.Length -ne $b.Length) { $true } elseif ($a.Length -lt 4MB) { (Get-FileHash -LiteralPath $a.FullName -Algorithm MD5).Hash -ne (Get-FileHash -LiteralPath $b.FullName -Algorithm MD5).Hash } else { $false }
})
# (Textdateien: Zeilenenden koennen sich unterscheiden - dann nur melden, wenn auch der Text anders ist)
$anders = @($anders | Where-Object {
  if ($_ -match '\.(html|js|css|md|json|ps1|cmd|txt|svg)$') { ([IO.File]::ReadAllText($la[$_].FullName) -replace "`r`n", "`n") -ne ([IO.File]::ReadAllText($lb[$_].FullName) -replace "`r`n", "`n") } else { $true }
})
foreach ($x in $nurQ) { Warnung "fehlt im GitHub-Ordner: $x" }
foreach ($x in $nurZ) { Warnung "nur im GitHub-Ordner (alt? wird mit hochgeladen): $x" }
foreach ($x in $anders) { Warnung "anderer Inhalt: $x" }
if (-not ($nurQ.Count + $nurZ.Count + $anders.Count)) { Ok "$($la.Count) Dateien, gleiche Namen (exakt) und gleicher Inhalt" }

# ---- 3. + 4. git im GitHub-Ordner ----
Write-Host ''; Write-Host '3. git im GitHub-Ordner (Gross-/Kleinschreibung, .gitignore)'
if (-not $git) { Warnung 'git nicht gefunden - Punkt 3 uebersprungen' }
else {
  $idx = New-Object 'System.Collections.Generic.HashSet[string]' ([StringComparer]::Ordinal)
  & $git -C $Ziel --no-optional-locks -c core.quotepath=off ls-files | ForEach-Object { [void]$idx.Add($_) }
  $platte = @{}; foreach ($k in $lb.Keys) { $platte[$k.ToLowerInvariant()] = $k }
  $fall = 0
  foreach ($n in $idx) {
    if ($lb.ContainsKey($n)) { continue }
    $l = $n.ToLowerInvariant()
    if ($platte.ContainsKey($l)) { $fall++; Warnung "nur Gross-/Kleinschreibung anders: im Repo '$n', auf der Platte '$($platte[$l])' - git uebernimmt das NICHT von selbst (online bliebe '$n')" }
  }
  if (-not $fall) { Ok 'keine Namen, die sich nur in der Gross-/Kleinschreibung unterscheiden' }
  $ign = @(& $git -C $Ziel --no-optional-locks -c core.quotepath=off ls-files --others --ignored --exclude-standard | Where-Object { -not (NurLokal $_) })
  if ($ign.Count) { $ign | ForEach-Object { Warnung "von .gitignore ausgeschlossen (wird NICHT hochgeladen): $_" } } else { Ok '.gitignore schliesst nur _Papierkorb / Galerie-Originale aus' }
  $neu = @(& $git -C $Ziel --no-optional-locks -c core.quotepath=off status --porcelain)
  Write-Host "  Aenderungen fuer den naechsten Commit: $($neu.Count) (GitHub Desktop zeigt sie unter 'Changes')"
}
$gross = $lb.Values | Where-Object { -not (NurLokal ($_.FullName.Substring($Ziel.Length).TrimStart('\').Replace('\', '/'))) } | Sort-Object Length -Descending
$summe = ($gross | Measure-Object Length -Sum).Sum
if ($gross[0].Length -gt 95MB) { Warnung "Datei zu gross fuer GitHub (100 MB): $($gross[0].Name)" }
Write-Host ("  Seite: {0:N0} MB, groesste Datei {1:N1} MB ({2})" -f ($summe / 1MB), ($gross[0].Length / 1MB), $gross[0].Name)

Write-Host ''
if ($warn.Count) { Write-Host "ERGEBNIS: $($warn.Count) Warnung(en) - bitte vor dem Push ansehen (oder Claude fragen)." -ForegroundColor Yellow; exit 1 }
Write-Host 'ERGEBNIS: alles in Ordnung - du kannst in GitHub Desktop committen und "Push origin" druecken.' -ForegroundColor Green
exit 0

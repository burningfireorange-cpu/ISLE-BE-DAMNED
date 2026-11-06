# Messreihe: je Produkt ein eigener Browser (kalter Cache). Aufruf: serie.ps1 <ERG-Datei> <Skript> <IDs, Komma> ; Umgebung wie gesetzt
param([string]$erg, [string]$skript, [string]$ids)
$s = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $s
foreach ($id in $ids.Split(',')) {
  $env:IDS = $id
  $env:ERG = $erg
  node --experimental-websocket $skript
}

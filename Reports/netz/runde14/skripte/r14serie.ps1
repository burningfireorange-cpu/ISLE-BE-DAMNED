# Runde-14-Messreihe gedrosselt (Server 8771). Je Lauf eigener Browser, kalter Cache.
$ErrorActionPreference = 'Continue'
Set-Location $PSScriptRoot
$env:BASE = 'http://127.0.0.1:8771/'
function lauf($datei, $skript, $vars) {
  foreach ($k in 'GR','DESK','IDS','KBIT','LAT','IOS','LAMPE','WARTE','MAX','ERG','VIEW','LOG','LOG2') { Remove-Item "env:$k" -ErrorAction SilentlyContinue }
  foreach ($k in $vars.Keys) { Set-Item "env:$k" $vars[$k] }
  "### $skript $(($vars.GetEnumerator() | % { $_.Key + '=' + $_.Value }) -join ' ')" | Out-File -Append -Encoding utf8 $datei
  node --experimental-websocket $skript 2>&1 | Out-File -Append -Encoding utf8 $datei
}
$F = @{ KBIT = '9000'; LAT = '165' }; $S = @{ KBIT = '1600'; LAT = '560' }
$alle = 'object_05,object_04,object_03,object_02,object_01'
# 1. Öffnen -> alle Fahrten bereit
lauf 'r14_vorlad.txt' 'vorlad.js' (@{ IDS = $alle; IOS = '1'; MAX = '120000' } + $F)
lauf 'r14_vorlad.txt' 'vorlad.js' (@{ IDS = $alle; DESK = '1'; MAX = '120000' } + $F)
lauf 'r14_vorlad.txt' 'vorlad.js' (@{ IDS = 'object_03'; IOS = '1'; LAMPE = '1'; MAX = '120000' } + $F)
lauf 'r14_vorlad.txt' 'vorlad.js' (@{ IDS = 'object_05,object_01'; IOS = '1'; MAX = '150000' } + $S)
lauf 'r14_vorlad.txt' 'vorlad.js' (@{ IDS = 'object_05'; DESK = '1'; MAX = '150000' } + $S)
# 2. Tippen -> Fahrtstart, Mehrfach, während Fahrt
lauf 'r14_views_fast.txt' 'views.js' (@{ IDS = $alle; IOS = '1' } + $F)
lauf 'r14_views_fast.txt' 'views.js' (@{ IDS = $alle; DESK = '1' } + $F)
lauf 'r14_views_fast.txt' 'views.js' (@{ IDS = 'object_03'; IOS = '1'; LAMPE = '1' } + $F)
lauf 'r14_views_slow.txt' 'views.js' (@{ IDS = $alle; IOS = '1' } + $S)
lauf 'r14_views_slow.txt' 'views.js' (@{ IDS = $alle; DESK = '1' } + $S)
lauf 'r14_views_slow.txt' 'views.js' (@{ IDS = 'object_03'; IOS = '1'; LAMPE = '1' } + $S)
'FERTIG' | Out-File -Append -Encoding utf8 'r14_views_slow.txt'

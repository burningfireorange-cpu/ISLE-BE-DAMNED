@echo off
rem gauge - Doppelklick: aktualisiert Galerie und Produkte (siehe aktualisieren.ps1)
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0aktualisieren.ps1" %*
echo.
pause

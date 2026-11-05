@echo off
rem gauge - vor dem Hochladen pruefen (liest nur). Doppelklicken, nachdem du in den GitHub-Ordner kopiert hast.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0hochladen-pruefen.ps1"
echo.
pause

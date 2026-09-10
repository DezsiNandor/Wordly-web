@echo off
title WL - Word Learning
echo ========================================================
echo   WL (Word Learning) - Inditas...
echo   Megnyitjuk a szervert es a bongeszot.
echo ========================================================
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "server.ps1"
pause

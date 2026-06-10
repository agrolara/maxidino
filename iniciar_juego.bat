@echo off
title Servidor Baby Dino Jump
echo ==========================================================
echo       INICIANDO SERVIDOR LOCAL PARA BABY DINO JUMP
echo ==========================================================
echo.
echo Ejecutando servidor mediante PowerShell...
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0server.ps1"
echo.
echo Servidor detenido.
pause

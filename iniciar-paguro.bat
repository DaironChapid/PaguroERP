@echo off
rem Enciende Paguro ERP (version de produccion) y abre el navegador.
rem Requiere haber corrido una vez: npm install  y  npm run build  (ver docs\INSTALACION.md).
cd /d "%~dp0"
title Paguro ERP - no cierres esta ventana
echo.
echo   Paguro ERP se esta encendiendo...
echo   Deja esta ventana abierta (puedes minimizarla). Si la cierras, el sistema se apaga.
echo.
start "" /min cmd /c "timeout /t 5 /nobreak >nul & start http://localhost:3000"
call npm start

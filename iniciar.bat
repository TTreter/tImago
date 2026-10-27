@echo off
chcp 65001 > nul
title Controle de Overlay OBS - Cantata & Live
echo ====================================================
echo Iniciando Servidor de Overlay para o OBS Studio...
echo ====================================================
start "" http://localhost:3000
node server.js
pause

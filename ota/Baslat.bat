@echo off
chcp 65001 >nul
title VerityLang Desktop Baslatici
if not exist "%~dp0VerityLang-Desktop.exe" (
    echo [HATA] VerityLang-Desktop.exe bulunamadi!
    pause
    exit /b 1
)
start "" /D "%~dp0" "%~dp0VerityLang-Desktop.exe"

@echo off
setlocal
cd /d "%~dp0"

where node.exe >nul 2>nul
if errorlevel 1 (
    echo Node.js is required to run the local web server.
    echo Install the Node.js LTS release from https://nodejs.org/ and run this file again.
    pause
    exit /b 1
)

node "%~dp0tools\run-webport.mjs"
if errorlevel 1 pause

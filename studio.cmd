@echo off
setlocal
if /I "%~1"=="start" goto run
if /I "%~1"=="stop" goto run
if /I "%~1"=="diagnose" goto run
echo Usage: studio.cmd start ^| stop ^| diagnose
exit /b 1
:run
powershell.exe -NoProfile -ExecutionPolicy RemoteSigned -File "%~dp0scripts\%~1.ps1"
exit /b %errorlevel%

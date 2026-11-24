@echo off
title MediLink AI - Stopping System...
echo ===================================================
echo   Stopping MediLink AI Services
echo ===================================================
echo.

echo Terminating running Node and MongoDB processes...
taskkill /F /IM mongod.exe 2>nul
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :5000 ^| findstr LISTENING') do taskkill /F /PID %%a 2>nul
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :5173 ^| findstr LISTENING') do taskkill /F /PID %%a 2>nul

echo All services stopped cleanly.
pause

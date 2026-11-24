@echo off
title MediLink AI - Starting System...
echo ===================================================
echo   Starting MediLink AI System
echo ===================================================
echo.

:: Ensure data\db directory exists
if not exist "%~dp0data\db" (
    echo Creating data\db folder for MongoDB...
    mkdir "%~dp0data\db"
)

:: Check if MongoDB is already listening on 27017
echo Checking MongoDB on port 27017...
netstat -ano | findstr :27017 | findstr LISTENING >nul
if %ERRORLEVEL% EQU 0 (
    echo [OK] MongoDB is already running.
) else (
    echo Starting MongoDB...
    if exist "C:\Program Files\MongoDB\Server\8.0\bin\mongod.exe" (
        start "MediLink - MongoDB" "C:\Program Files\MongoDB\Server\8.0\bin\mongod.exe" --dbpath "%~dp0data\db" --bind_ip 127.0.0.1 --port 27017
    ) else (
        start "MediLink - MongoDB" mongod --dbpath "%~dp0data\db"
    )
    timeout /t 3 /nobreak >nul
)

:: Start Backend Server
echo Starting Backend Server (Port 5000)...
start "MediLink - Backend Server" cmd /k "cd /d "%~dp0server" && npm run dev"

:: Wait for backend to initialize
timeout /t 3 /nobreak >nul

:: Start Frontend Server
echo Starting Frontend Client (Port 5173)...
start "MediLink - Frontend Client" cmd /k "cd /d "%~dp0client" && npm run dev"

:: Wait and open browser
timeout /t 3 /nobreak >nul
echo.
echo ===================================================
echo   MediLink AI is ready!
echo   Opening: http://localhost:5173
echo   Demo Doctor:  doctor@medilink.com / 123456
echo   Demo Patient: patient@medilink.com / 123456 (MLP-26-000001)
echo   Demo Admin:   admin@medilink.com / 123456
echo ===================================================
start http://localhost:5173

@echo off
setlocal
cd /d %~dp0

echo ===================================================
echo           ConfidenceAI Startup Launcher
echo ===================================================

REM 1. Check Python
python --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python is not installed or not in PATH.
    pause
    exit /b 1
)

REM 2. Check Backend Virtual Environment
if not exist "ai-service\venv" (
    echo [INFO] Creating Python virtual environment in ai-service\venv...
    cd ai-service
    python -m venv venv
    echo [INFO] Installing backend dependencies...
    venv\Scripts\python.exe -m pip install -r requirements.txt
    cd ..
) else (
    echo [INFO] Python virtual environment found.
)

REM 3. Launch Backend
echo [INFO] Launching FastAPI Backend on http://127.0.0.1:8000...
start "ConfidenceAI Backend (FastAPI)" cmd /k "cd /d %~dp0ai-service && venv\Scripts\python.exe -m uvicorn main:app --reload --host 127.0.0.1 --port 8000"

REM 4. Launch Frontend
echo [INFO] Launching React Frontend on http://localhost:3000...
start "ConfidenceAI Frontend (React)" cmd /k "cd /d %~dp0frontend && npm start"

echo.
echo ===================================================
echo ConfidenceAI is running!
echo Backend:  http://127.0.0.1:8000
echo Frontend: http://localhost:3000
echo ===================================================
echo Keep the opened command windows running.
pause
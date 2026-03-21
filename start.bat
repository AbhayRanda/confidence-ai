@echo off
cd /d %~dp0
cd ai-service

REM Check if Python is installed
python --version >nul 2>&1
if errorlevel 1 (
    echo Error: Python is not installed or not in PATH
    pause
    exit /b 1
)

REM Check if virtual environment exists
if not exist "venv" (
    echo Creating virtual environment...
    python -m venv venv
)

REM Install dependencies using venv's python as the module runner
echo Installing dependencies...
venv\Scripts\python.exe -m pip install --upgrade pip
venv\Scripts\python.exe -m pip install --force-reinstall -r requirements.txt

REM Run the server using venv's python
echo.
echo Starting FastAPI server on http://127.0.0.1:8000
echo Press Ctrl+C to stop the server
echo.
venv\Scripts\python.exe -m uvicorn main:app --reload --host 127.0.0.1 --port 8000

pause
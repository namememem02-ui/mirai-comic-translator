@echo off
title LaMa Inpainting Sidecar Launcher
cd /d "%~dp0"

echo [🧠] Checking Python installation...
python --version >nul 2>&1
if errorlevel 1 goto NO_PYTHON

if not exist .venv goto CREATE_VENV
goto RUN_VENV

:NO_PYTHON
echo [X] Python was not found on your system.
echo Please install Python (3.9 - 3.11 recommended) from python.org
echo Make sure to check "Add Python to PATH" during installation.
pause
exit /b 1

:CREATE_VENV
echo [📦] Creating Virtual Environment (.venv)...
python -m venv .venv
if errorlevel 1 goto VENV_FAILED
goto RUN_VENV

:VENV_FAILED
echo [X] Failed to create virtual environment.
pause
exit /b 1

:RUN_VENV
echo [🚀] Activating Virtual Environment...
call .venv\Scripts\activate.bat

echo [⚙️] Installing required Python libraries (this may take a few minutes)...
python -m pip install --upgrade pip
pip install -r requirements.txt
if errorlevel 1 goto INSTALL_FAILED
goto START_SERVER

:INSTALL_FAILED
echo [X] Dependency installation failed.
pause
exit /b 1

:START_SERVER
echo [🔥] Starting AI Inpainting Server (LaMa)...
python inpaint_server.py
if errorlevel 1 goto SERVER_FAILED
exit /b 0

:SERVER_FAILED
echo [X] Server stopped unexpectedly.
pause
exit /b 1

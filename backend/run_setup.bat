@echo off
REM Setup script for SCHLR backend
REM Run this batch file to initialize the database and venv

echo.
echo ========================================
echo SCHLR Backend Setup
echo ========================================
echo.

REM Activate venv
if exist "venv\Scripts\activate.bat" (
    call venv\Scripts\activate.bat
    echo Virtual environment activated.
) else (
    echo [WARNING] No virtual environment found. Run: py -m venv venv
)
echo.

REM Install dependencies
echo Installing Python dependencies...
pip install -r requirements.txt
echo.

echo Creating super admin...
python create_super_admin.py
echo.

echo Setup completed! Press Enter to exit.
pause

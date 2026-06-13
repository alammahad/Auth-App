@echo off
REM Startup script for SCHLR development environment
REM Starts both backend and frontend servers

echo.
echo ========================================
echo SCHLR Development Server Startup
echo ========================================
echo.
echo Starting Backend (FastAPI on port 8000) and Frontend (Vite on port 5173)...
echo.

REM Run the dev command from package.json
npm run dev

echo.
echo Servers stopped.
pause

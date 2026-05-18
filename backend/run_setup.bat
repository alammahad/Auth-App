@echo off
REM Setup script for SCHLR database
REM Run this batch file to initialize and seed the database

echo.
echo ========================================
echo SCHLR Database Setup
echo ========================================
echo.

echo Creating super admin...
python create_super_admin.py
echo.

echo Seeding database with sample data...
python seed_database.py
echo.

echo Verifying database...
python tmp_mongo_inspect.py
echo.

echo Setup completed! Press Enter to exit.
pause

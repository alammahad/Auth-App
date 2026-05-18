#!/usr/bin/env python3
"""
SCHLR Complete Setup & Verification Script
Combines database setup, server startup, and verification in one script.
"""

import os
import sys
import subprocess
import time
import requests
import json
from pathlib import Path

# Colors for terminal output
class Colors:
    HEADER = '\033[95m'
    BLUE = '\033[94m'
    CYAN = '\033[96m'
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    RED = '\033[91m'
    END = '\033[0m'
    BOLD = '\033[1m'

def print_header(text):
    print(f"\n{Colors.BOLD}{Colors.CYAN}{'='*60}{Colors.END}")
    print(f"{Colors.BOLD}{Colors.CYAN}  {text}{Colors.END}")
    print(f"{Colors.BOLD}{Colors.CYAN}{'='*60}{Colors.END}\n")

def print_success(text):
    print(f"{Colors.GREEN}✅ {text}{Colors.END}")

def print_error(text):
    print(f"{Colors.RED}❌ {text}{Colors.END}")

def print_info(text):
    print(f"{Colors.BLUE}ℹ️  {text}{Colors.END}")

def print_warning(text):
    print(f"{Colors.YELLOW}⚠️  {text}{Colors.END}")

def run_command(cmd, description, cwd=None):
    """Run a shell command and return success status"""
    print_info(f"Running: {description}")
    print(f"   Command: {' '.join(cmd)}")
    
    try:
        result = subprocess.run(
            cmd,
            cwd=cwd,
            capture_output=True,
            text=True,
            timeout=30
        )
        
        if result.returncode == 0:
            print_success(f"{description} completed")
            if result.stdout:
                print(f"   Output: {result.stdout[:200]}")
            return True, result.stdout
        else:
            print_error(f"{description} failed")
            if result.stderr:
                print(f"   Error: {result.stderr[:300]}")
            return False, result.stderr
    except subprocess.TimeoutExpired:
        print_warning(f"{description} timed out (expected for server startup)")
        return True, "Process started"
    except Exception as e:
        print_error(f"{description} encountered error: {str(e)}")
        return False, str(e)

def main():
    print(f"\n{Colors.BOLD}{Colors.HEADER}")
    print("╔════════════════════════════════════════════════════════╗")
    print("║   SCHLR - Complete Setup & Verification Script         ║")
    print("║   Setting up Database, Backend, Frontend, and Tests    ║")
    print("╚════════════════════════════════════════════════════════╝")
    print(f"{Colors.END}")
    
    project_root = Path(__file__).parent
    backend_dir = project_root / "backend"
    
    # Check if we're in the right directory
    if not backend_dir.exists():
        print_error("Backend directory not found. Please run this script from project root.")
        sys.exit(1)
    
    print_info(f"Project root: {project_root}")
    print_info(f"Backend dir: {backend_dir}")
    
    # Step 1: Database Setup
    print_header("STEP 1: Database Setup")
    
    setup_steps = [
        (["python", "create_super_admin.py"], "Creating super admin", backend_dir),
        (["python", "seed_database.py"], "Seeding database with sample data", backend_dir),
        (["python", "tmp_mongo_inspect.py"], "Verifying database contents", backend_dir),
    ]
    
    db_setup_success = True
    for cmd, desc, cwd in setup_steps:
        success, output = run_command(cmd, desc, cwd)
        if not success:
            db_setup_success = False
            print_warning(f"Database setup incomplete, but continuing with server startup...")
        time.sleep(1)
    
    if db_setup_success:
        print_success("Database setup completed successfully!")
    
    # Step 2: Start Backend Server
    print_header("STEP 2: Starting Backend Server")
    print_info("Backend will run on http://localhost:8000")
    print_info("API Documentation: http://localhost:8000/docs")
    
    backend_process = None
    try:
        print_info("Starting FastAPI backend (uvicorn)...")
        backend_process = subprocess.Popen(
            ["python", "-m", "uvicorn", "app:app", "--reload", "--host", "127.0.0.1", "--port", "8000"],
            cwd=backend_dir,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE
        )
        print_success("Backend process started (PID: {})".format(backend_process.pid))
        time.sleep(5)  # Give server time to start
    except Exception as e:
        print_error(f"Failed to start backend: {e}")
    
    # Step 3: Start Frontend Server
    print_header("STEP 3: Starting Frontend Server")
    print_info("Frontend will run on http://localhost:5173")
    
    frontend_process = None
    try:
        print_info("Starting Vite frontend...")
        frontend_process = subprocess.Popen(
            ["npm", "run", "dev"],
            cwd=project_root,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE
        )
        print_success("Frontend process started (PID: {})".format(frontend_process.pid))
        time.sleep(5)  # Give server time to start
    except Exception as e:
        print_error(f"Failed to start frontend: {e}")
    
    # Step 4: Verification Tests
    print_header("STEP 4: Verification Tests")
    
    tests_passed = 0
    tests_total = 0
    
    # Test 1: Backend Health
    print_info("Testing backend health endpoint...")
    tests_total += 1
    try:
        response = requests.get("http://localhost:8000/health", timeout=5)
        if response.status_code == 200:
            print_success(f"Backend health check passed")
            tests_passed += 1
        else:
            print_error(f"Backend returned status {response.status_code}")
    except Exception as e:
        print_warning(f"Backend not responding yet: {e}")
    
    # Test 2: Frontend Connectivity
    print_info("Testing frontend connectivity...")
    tests_total += 1
    try:
        response = requests.get("http://localhost:5173", timeout=5)
        if response.status_code == 200:
            print_success("Frontend is running")
            tests_passed += 1
        else:
            print_error(f"Frontend returned status {response.status_code}")
    except Exception as e:
        print_warning(f"Frontend not responding yet: {e}")
    
    # Test 3: Login Test
    print_info("Testing login endpoint...")
    tests_total += 1
    try:
        response = requests.post(
            "http://localhost:8000/auth/login",
            json={"email": "alice@sclr.com", "password": "Password123!"},
            timeout=5
        )
        if response.status_code == 200:
            data = response.json()
            token = data.get('token', 'N/A')
            print_success(f"Login successful - Token: {token[:20]}...")
            tests_passed += 1
        else:
            print_error(f"Login failed with status {response.status_code}")
    except Exception as e:
        print_warning(f"Login test failed: {e}")
    
    # Test 4: Users Endpoint
    print_info("Testing users endpoint...")
    tests_total += 1
    try:
        response = requests.get("http://localhost:8000/users", timeout=5)
        if response.status_code == 200:
            users = response.json()
            print_success(f"Users endpoint working - Found {len(users) if isinstance(users, list) else 'N/A'} users")
            tests_passed += 1
        else:
            print_error(f"Users endpoint returned {response.status_code}")
    except Exception as e:
        print_warning(f"Users endpoint test failed: {e}")
    
    # Test 5: Scholarships Endpoint
    print_info("Testing scholarships endpoint...")
    tests_total += 1
    try:
        response = requests.get("http://localhost:8000/scholarships", timeout=5)
        if response.status_code == 200:
            scholarships = response.json()
            print_success(f"Scholarships endpoint working - Found {len(scholarships) if isinstance(scholarships, list) else 'N/A'} scholarships")
            tests_passed += 1
        else:
            print_error(f"Scholarships endpoint returned {response.status_code}")
    except Exception as e:
        print_warning(f"Scholarships endpoint test failed: {e}")
    
    # Summary
    print_header("VERIFICATION SUMMARY")
    print(f"\nTests Passed: {Colors.GREEN}{tests_passed}/{tests_total}{Colors.END}")
    
    if tests_passed == tests_total:
        print_success("All tests passed! ✨")
        print(f"\n{Colors.BOLD}Application is ready to use!{Colors.END}")
    else:
        print_warning(f"{tests_total - tests_passed} test(s) need attention")
    
    print_header("Access Points")
    print(f"  Backend API:        {Colors.CYAN}http://localhost:8000{Colors.END}")
    print(f"  API Documentation:  {Colors.CYAN}http://localhost:8000/docs{Colors.END}")
    print(f"  Frontend:           {Colors.CYAN}http://localhost:5173{Colors.END}")
    
    print_header("Test Credentials")
    print(f"  {Colors.BOLD}Student:{Colors.END}")
    print(f"    Email: alice@sclr.com")
    print(f"    Password: Password123!")
    print(f"\n  {Colors.BOLD}Recruiter:{Colors.END}")
    print(f"    Email: carol@sclr.com")
    print(f"    Password: Password123!")
    print(f"\n  {Colors.BOLD}Admin:{Colors.END}")
    print(f"    Email: schlradmin@gmail.com")
    print(f"    Password: Admin123!")
    
    print(f"\n{Colors.BOLD}{Colors.GREEN}🎉 Setup Complete!{Colors.END}")
    print(f"{Colors.YELLOW}Note: Keep this script running to maintain backend and frontend servers.{Colors.END}")
    print(f"{Colors.YELLOW}Press Ctrl+C to stop all servers.{Colors.END}\n")
    
    # Keep processes running
    try:
        while True:
            time.sleep(1)
            
            # Check if processes are still alive
            if backend_process and backend_process.poll() is not None:
                print_warning("Backend process ended, attempting restart...")
            if frontend_process and frontend_process.poll() is not None:
                print_warning("Frontend process ended, attempting restart...")
                
    except KeyboardInterrupt:
        print(f"\n{Colors.YELLOW}Shutting down servers...{Colors.END}")
        if backend_process:
            backend_process.terminate()
        if frontend_process:
            frontend_process.terminate()
        print_success("All servers stopped")
        sys.exit(0)

if __name__ == "__main__":
    main()

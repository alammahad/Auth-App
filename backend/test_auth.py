import subprocess
import time
import httpx
import sys
import os

def test_auth():
    # Start uvicorn in a background process
    print("Starting uvicorn server...")
    proc = subprocess.Popen(
        [sys.executable, "app.py"],
        env=os.environ.copy()
    )
    
    # Wait for the server to spin up
    time.sleep(10.0)
    
    # Check if the server is running
    try:
        # Create a new user payload
        # Ensure password satisfies strong password check: at least 8 chars, uppercase, lowercase, number, special char.
        signup_data = {
            "name": "Test User",
            "email": "testuser_unique_123@gmail.com",
            "password": "Password@123",
            "user_type": "student",
            "university": "Test University",
            "degree": "BS",
            "major": "Computer Science"
        }
        
        # Test Signup
        print("Testing signup...")
        r_signup = httpx.post("http://127.0.0.1:8000/auth/signup", json=signup_data, timeout=10.0)
        print("Signup status code:", r_signup.status_code)
        
        # Check response. Note: if the email is already registered, let's delete it or ignore error for multiple test runs.
        signup_json = r_signup.json()
        print("Signup response:", signup_json)
        
        if r_signup.status_code == 400 and "Email already registered" in signup_json.get("detail", ""):
            print("Email already exists. Proceeding directly to login check.")
        else:
            assert r_signup.status_code == 201
        
        # Test Login
        print("Testing login...")
        login_data = {
            "email": "testuser_unique_123@gmail.com",
            "password": "Password@123"
        }
        r_login = httpx.post("http://127.0.0.1:8000/auth/login", json=login_data, timeout=10.0)
        print("Login status code:", r_login.status_code)
        print("Login response:", r_login.json())
        
        assert r_login.status_code == 200
        
        print("Authentication tests PASSED successfully!")
        
    except Exception as e:
        print("Tests failed:", e)
        sys.exit(1)
        
    finally:
        print("Shutting down uvicorn server...")
        proc.terminate()
        proc.wait()

if __name__ == "__main__":
    test_auth()

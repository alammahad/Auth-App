#!/usr/bin/env python3
"""
Verification script to test all components of SCHLR application.
Tests database, backend API, and frontend connectivity.
"""

import requests
import json
import time
import sys
from datetime import datetime

BASE_URL = "http://localhost:8000"
FRONTEND_URL = "http://localhost:5173"

def print_header(text):
    print(f"\n{'='*50}")
    print(f"  {text}")
    print(f"{'='*50}\n")

def test_health():
    """Test backend health endpoint"""
    print_header("1. Testing Backend Health")
    try:
        response = requests.get(f"{BASE_URL}/health", timeout=5)
        if response.status_code == 200:
            print("✅ Backend is healthy")
            print(f"   Response: {response.json()}")
            return True
        else:
            print(f"❌ Backend returned status {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Cannot reach backend: {e}")
        return False

def test_auth_endpoints():
    """Test authentication endpoints"""
    print_header("2. Testing Authentication Endpoints")
    
    test_creds = {
        "email": "alice@sclr.com",
        "password": "Password123!"
    }
    
    # Try login
    try:
        print("Testing login endpoint...")
        response = requests.post(
            f"{BASE_URL}/auth/login",
            json=test_creds,
            timeout=5
        )
        if response.status_code == 200:
            data = response.json()
            print("✅ Login successful")
            print(f"   Token: {data.get('token', 'N/A')[:20]}...")
            print(f"   User: {data.get('user', {}).get('email', 'N/A')}")
            return data.get('token')
        else:
            print(f"❌ Login failed with status {response.status_code}")
            print(f"   Response: {response.text}")
            return None
    except Exception as e:
        print(f"❌ Login test failed: {e}")
        return None

def test_users_endpoint(token):
    """Test users endpoint"""
    print_header("3. Testing Users Endpoint")
    
    try:
        headers = {"Authorization": f"Bearer {token}"} if token else {}
        response = requests.get(
            f"{BASE_URL}/users",
            headers=headers,
            timeout=5
        )
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Users endpoint working")
            if isinstance(data, list):
                print(f"   Total users: {len(data)}")
                for user in data[:3]:
                    print(f"   - {user.get('email', 'N/A')} ({user.get('user_type', 'N/A')})")
            return True
        else:
            print(f"❌ Users endpoint returned {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Users endpoint test failed: {e}")
        return False

def test_scholarships_endpoint():
    """Test scholarships endpoint"""
    print_header("4. Testing Scholarships Endpoint")
    
    try:
        response = requests.get(
            f"{BASE_URL}/scholarships",
            timeout=5
        )
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Scholarships endpoint working")
            if isinstance(data, list):
                print(f"   Total scholarships: {len(data)}")
                for scholarship in data[:3]:
                    print(f"   - {scholarship.get('title', 'N/A')}")
            return True
        else:
            print(f"❌ Scholarships endpoint returned {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Scholarships endpoint test failed: {e}")
        return False

def test_internships_endpoint():
    """Test internships endpoint"""
    print_header("5. Testing Internships Endpoint")
    
    try:
        response = requests.get(
            f"{BASE_URL}/internships",
            timeout=5
        )
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Internships endpoint working")
            if isinstance(data, list):
                print(f"   Total internships: {len(data)}")
                for internship in data[:3]:
                    print(f"   - {internship.get('title', 'N/A')}")
            return True
        else:
            print(f"❌ Internships endpoint returned {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Internships endpoint test failed: {e}")
        return False

def test_frontend():
    """Test frontend connectivity"""
    print_header("6. Testing Frontend Connectivity")
    
    try:
        response = requests.get(FRONTEND_URL, timeout=5)
        if response.status_code == 200:
            print("✅ Frontend is running")
            print(f"   URL: {FRONTEND_URL}")
            return True
        else:
            print(f"❌ Frontend returned {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Cannot reach frontend: {e}")
        print(f"   Make sure frontend is running on {FRONTEND_URL}")
        return False

def main():
    print("\n")
    print("╔════════════════════════════════════════════════════╗")
    print("║   SCHLR Application Verification Script            ║")
    print("║   Testing: Database, Backend API, Frontend         ║")
    print(f"║   Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}                         ║")
    print("╚════════════════════════════════════════════════════╝")
    
    results = {
        "health": test_health(),
        "auth": False,
        "users": False,
        "scholarships": test_scholarships_endpoint(),
        "internships": test_internships_endpoint(),
        "frontend": test_frontend()
    }
    
    # Test auth and get token
    token = test_auth_endpoints()
    if token:
        results["auth"] = True
        results["users"] = test_users_endpoint(token)
    else:
        results["users"] = test_users_endpoint(None)
    
    # Summary
    print_header("Verification Summary")
    passed = sum(1 for v in results.values() if v)
    total = len(results)
    
    for test, result in results.items():
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status} - {test.upper()}")
    
    print(f"\n{passed}/{total} tests passed")
    
    if passed == total:
        print("\n🎉 All systems operational! App is ready to use.")
        return 0
    else:
        print(f"\n⚠️  {total - passed} test(s) failed. Check output above.")
        return 1

if __name__ == "__main__":
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        print("\n\nVerification cancelled by user.")
        sys.exit(0)

import httpx
import time
import sys

def verify_auth_endpoints():
    base_url = "http://127.0.0.1:8000"
    unique_email = f"test_user_{int(time.time())}@gmail.com"
    password = "Password@123"
    
    signup_data = {
        "name": "Integration Tester",
        "email": unique_email,
        "password": password,
        "user_type": "student",
        "university": "State University",
        "degree": "Bachelors",
        "major": "Data Science"
    }
    
    print(f"1. Testing signup with email: {unique_email} ...")
    try:
        r_signup = httpx.post(f"{base_url}/auth/signup", json=signup_data, timeout=10.0)
        print("Signup status:", r_signup.status_code)
        print("Signup response:", r_signup.json())
        assert r_signup.status_code == 201, f"Signup failed with status {r_signup.status_code}"
        
        print("\n2. Testing login with registered credentials ...")
        login_data = {
            "email": unique_email,
            "password": password
        }
        r_login = httpx.post(f"{base_url}/auth/login", json=login_data, timeout=10.0)
        print("Login status:", r_login.status_code)
        login_res = r_login.json()
        print("Login response:", login_res)
        assert r_login.status_code == 200, f"Login failed with status {r_login.status_code}"
        token = login_res.get("access_token") or login_res.get("token")
        assert token, "Login response did not return an access token"
        
        print("\n3. Testing GET /auth/me using JWT token ...")
        headers = {"Authorization": f"Bearer {token}"}
        r_me = httpx.get(f"{base_url}/auth/me", headers=headers, timeout=10.0)
        print("Profile status:", r_me.status_code)
        print("Profile response:", r_me.json())
        assert r_me.status_code == 200, f"Fetching profile failed with status {r_me.status_code}"
        
        print("\n[SUCCESS] ALL TESTS PASSED! Backend, database, and auth integrations are 100% functional!")
        
    except Exception as e:
        print("\n[FAILURE] VERIFICATION FAILED:", e)
        sys.exit(1)

if __name__ == "__main__":
    verify_auth_endpoints()

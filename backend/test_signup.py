import os
import certifi
from pymongo import MongoClient
from dotenv import load_dotenv
import pathlib
import bcrypt
from datetime import datetime

backend_dir = pathlib.Path(__file__).parent
load_dotenv(dotenv_path=backend_dir / ".env")

MONGO_URI = os.getenv("MONGO_URI")
MONGO_DB_NAME = os.getenv("MONGO_DB_NAME", "scholar_ai")

if not MONGO_URI:
    print("MONGO_URI not set in backend/.env")
    raise SystemExit(1)

client = MongoClient(MONGO_URI, tlsCAFile=certifi.where())
db = client[MONGO_DB_NAME]
users_col = db["users"]

# Test user data
email = f"teststudent+{int(datetime.utcnow().timestamp())}@example.org"
name = "Test Student"
password_plain = "Testpass1!"

if users_col.find_one({"email": email}):
    print("User already exists")
else:
    hashed = bcrypt.hashpw(password_plain.encode('utf-8'), bcrypt.gensalt(rounds=12)).decode('utf-8')
    user = {
        "name": name,
        "email": email,
        "password": hashed,
        "user_type": "student",
        "status": "approved",
        "handle": email.split("@")[0],
        "avatar": None,
        "bio": "Automated test user",
        "profile": {
            "university": "Test University",
            "degree": "BSc",
            "major": "Computer Science",
            "country": "Testland",
            "target_country": "Nowhere",
            "interests": ["Testing"],
            "cgpa": None,
        },
        "followers": [],
        "following": [],
        "saved_posts": [],
        "created_at": datetime.utcnow(),
        "updated_at": None,
    }
    res = users_col.insert_one(user)
    print("Inserted user id:", str(res.inserted_id))
    found = users_col.find_one({"_id": res.inserted_id}, {"password": 0})
    print("User:", found)

#!/usr/bin/env python3
"""
Script to create a super admin account for the SCHLR application.
Run this script once to create the initial super admin user.
"""

import os
import sys
import certifi
from pymongo import MongoClient
from datetime import datetime
import bcrypt
import dotenv

# Load environment variables
dotenv.load_dotenv()

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def create_super_admin():
    MONGO_URI = os.getenv("MONGO_URI")
    if not MONGO_URI:
        print("Error: MONGO_URI not found in .env file")
        sys.exit(1)

    MONGO_DB_NAME = os.getenv("MONGO_DB_NAME", "scholar_ai")
    try:
        client = MongoClient(MONGO_URI, tlsCAFile=certifi.where())
        db = client[MONGO_DB_NAME]
        users_col = db.users

        # Check if super admin already exists
        existing_admin = users_col.find_one({"user_type": "super_admin"})
        if existing_admin:
            print("Super admin account already exists!")
            print(f"Email: {existing_admin['email']}")
            return

        # Create super admin account
        admin_email = os.getenv('SUPER_ADMIN_EMAIL', 'admin@schlr.com')
        admin_password = os.getenv('SUPER_ADMIN_PASSWORD', 'Admin123!')
        admin_data = {
            "name": "Super Admin",
            "email": admin_email,
            "password": hash_password(admin_password),
            "user_type": "super_admin",
            "status": "approved",
            "handle": admin_email.split('@')[0],
            "avatar": None,
            "bio": "System Administrator",
            "profile": {},
            "followers": [],
            "following": [],
            "saved_posts": [],
            "created_at": datetime.utcnow(),
            "updated_at": None,
        }

        result = users_col.insert_one(admin_data)
        print("Super admin account created successfully!")
        print(f"Email: {admin_data['email']}")
        print(f"Password: {admin_password}")
        print("\nIMPORTANT: Change the default password after first login!")

    except Exception as e:
        print(f"Error creating super admin: {e}")
        sys.exit(1)
    finally:
        try:
            client.close()
        except NameError:
            pass

if __name__ == "__main__":
    create_super_admin()
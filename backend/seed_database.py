#!/usr/bin/env python3
"""
Script to seed the SCHLR database with sample data.
Includes users, posts, scholarships, and other collections.
"""

import os
import sys
import certifi
from pymongo import MongoClient
from datetime import datetime
import bcrypt
import json
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def seed_database():
    MONGO_URI = os.getenv("MONGO_URI")
    if not MONGO_URI:
        print("Error: MONGO_URI not found in .env file")
        sys.exit(1)

    MONGO_DB_NAME = os.getenv("MONGO_DB_NAME", "scholar_ai")
    
    try:
        client = MongoClient(MONGO_URI, tlsCAFile=certifi.where())
        db = client[MONGO_DB_NAME]
        
        print("Connected to MongoDB!")
        print(f"Database: {MONGO_DB_NAME}")
        
        # Clear existing collections (optional - uncomment if you want to reset)
        # db.users.delete_many({})
        # db.posts.delete_many({})
        
        # 1. Create/Insert Users
        print("\n--- Seeding Users ---")
        users_col = db.users
        
        sample_users = [
            {
                "name": "Alice Johnson",
                "email": "alice@sclr.com",
                "password": hash_password("Password123!"),
                "user_type": "student",
                "status": "approved",
                "handle": "alice_j",
                "avatar": None,
                "bio": "Computer Science student exploring scholarships",
                "profile": {
                    "education": "BS Computer Science",
                    "interests": ["AI", "Web Development"]
                },
                "followers": [],
                "following": [],
                "saved_posts": [],
                "created_at": datetime.utcnow(),
                "updated_at": None,
            },
            {
                "name": "Bob Smith",
                "email": "bob@sclr.com",
                "password": hash_password("Password123!"),
                "user_type": "student",
                "status": "approved",
                "handle": "bob_smith",
                "avatar": None,
                "bio": "Business student looking for internships",
                "profile": {
                    "education": "MBA Candidate",
                    "interests": ["Finance", "Entrepreneurship"]
                },
                "followers": [],
                "following": [],
                "saved_posts": [],
                "created_at": datetime.utcnow(),
                "updated_at": None,
            },
            {
                "name": "Carol Davis",
                "email": "carol@sclr.com",
                "password": hash_password("Password123!"),
                "user_type": "recruiter",
                "status": "approved",
                "handle": "carol_recruiter",
                "avatar": None,
                "bio": "Hiring manager at TechCorp",
                "profile": {
                    "company": "TechCorp Inc",
                    "position": "Head of Recruiting"
                },
                "followers": [],
                "following": [],
                "saved_posts": [],
                "created_at": datetime.utcnow(),
                "updated_at": None,
            },
            {
                "name": "David Wilson",
                "email": "david@sclr.com",
                "password": hash_password("Password123!"),
                "user_type": "student",
                "status": "approved",
                "handle": "david_w",
                "avatar": None,
                "bio": "Engineering student seeking scholarships",
                "profile": {
                    "education": "BS Mechanical Engineering",
                    "interests": ["Robotics", "Renewable Energy"]
                },
                "followers": [],
                "following": [],
                "saved_posts": [],
                "created_at": datetime.utcnow(),
                "updated_at": None,
            }
        ]
        
        # Check and insert users
        for user in sample_users:
            existing = users_col.find_one({"email": user["email"]})
            if not existing:
                result = users_col.insert_one(user)
                print(f"✓ Created user: {user['email']}")
            else:
                print(f"✓ User already exists: {user['email']}")
        
        # 2. Create Posts
        print("\n--- Seeding Posts ---")
        posts_col = db.posts
        
        sample_posts = [
            {
                "author_id": None,  # Will be set to first student user
                "content": "Just got accepted to an amazing scholarship program! So excited to start in the fall.",
                "likes": [],
                "comments": [],
                "saved_by": [],
                "created_at": datetime.utcnow(),
                "updated_at": None,
            },
            {
                "author_id": None,  # Will be set to second student user
                "content": "Looking for summer internship opportunities in finance. Any recommendations?",
                "likes": [],
                "comments": [],
                "saved_by": [],
                "created_at": datetime.utcnow(),
                "updated_at": None,
            },
            {
                "author_id": None,  # Will be set to recruiter
                "content": "We're hiring! Check out our career page for the latest opportunities. #Hiring",
                "likes": [],
                "comments": [],
                "saved_by": [],
                "created_at": datetime.utcnow(),
                "updated_at": None,
            }
        ]
        
        # Get user IDs and assign to posts
        users = list(users_col.find({"user_type": "student"}))
        recruiter = users_col.find_one({"user_type": "recruiter"})
        
        if len(users) >= 2 and recruiter:
            sample_posts[0]["author_id"] = str(users[0]["_id"])
            sample_posts[1]["author_id"] = str(users[1]["_id"])
            sample_posts[2]["author_id"] = str(recruiter["_id"])
            
            for post in sample_posts:
                result = posts_col.insert_one(post)
                print(f"✓ Created post by {post['author_id'][:8]}...")
        
        # 3. Create Scholarships
        print("\n--- Seeding Scholarships ---")
        scholarships_col = db.scholarships
        
        sample_scholarships = [
            {
                "title": "Future Tech Leaders Scholarship",
                "description": "Full-ride scholarship for undergraduate CS students",
                "amount": 50000,
                "deadline": datetime(2026, 6, 30),
                "eligibility": ["CS Major", "3.5+ GPA", "US Citizen"],
                "url": "https://example.com/scholarship1",
                "posted_at": datetime.utcnow(),
            },
            {
                "title": "Business Excellence Grant",
                "description": "Merit-based scholarship for MBA students",
                "amount": 25000,
                "deadline": datetime(2026, 7, 15),
                "eligibility": ["MBA Program", "2 years work experience", "3.0+ GPA"],
                "url": "https://example.com/scholarship2",
                "posted_at": datetime.utcnow(),
            },
            {
                "title": "Engineering Innovation Fund",
                "description": "Scholarship for engineering students with project portfolio",
                "amount": 15000,
                "deadline": datetime(2026, 8, 1),
                "eligibility": ["Engineering Major", "Completed 2 years", "Project Portfolio Required"],
                "url": "https://example.com/scholarship3",
                "posted_at": datetime.utcnow(),
            }
        ]
        
        for scholarship in sample_scholarships:
            existing = scholarships_col.find_one({"title": scholarship["title"]})
            if not existing:
                result = scholarships_col.insert_one(scholarship)
                print(f"✓ Created scholarship: {scholarship['title']}")
            else:
                print(f"✓ Scholarship already exists: {scholarship['title']}")
        
        # 4. Create Internships
        print("\n--- Seeding Internships ---")
        internships_col = db.internships
        
        sample_internships = [
            {
                "title": "Summer Software Engineering Internship",
                "company": "TechCorp Inc",
                "description": "Work on real-world software projects with mentorship",
                "location": "San Francisco, CA",
                "duration": "12 weeks",
                "stipend": 5000,
                "deadline": datetime(2026, 3, 31),
                "posted_at": datetime.utcnow(),
            },
            {
                "title": "Finance Internship Program",
                "company": "Goldman Sachs",
                "description": "Competitive 10-week program in investment banking",
                "location": "New York, NY",
                "duration": "10 weeks",
                "stipend": 6000,
                "deadline": datetime(2026, 4, 30),
                "posted_at": datetime.utcnow(),
            }
        ]
        
        for internship in sample_internships:
            existing = internships_col.find_one({"title": internship["title"]})
            if not existing:
                result = internships_col.insert_one(internship)
                print(f"✓ Created internship: {internship['title']}")
            else:
                print(f"✓ Internship already exists: {internship['title']}")
        
        # Summary
        print("\n--- Database Summary ---")
        print(f"Users: {users_col.count_documents({})}")
        print(f"Posts: {posts_col.count_documents({})}")
        print(f"Scholarships: {scholarships_col.count_documents({})}")
        print(f"Internships: {internships_col.count_documents({})}")
        
        # Show sample data
        print("\n--- Sample Users ---")
        for user in users_col.find({}, {"email": 1, "user_type": 1, "status": 1}).limit(5):
            print(f"  {user['email']} ({user['user_type']}) - {user['status']}")
        
        print("\n✅ Database seeding completed successfully!")
        
    except Exception as e:
        print(f"Error seeding database: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    finally:
        try:
            client.close()
        except NameError:
            pass

if __name__ == "__main__":
    seed_database()

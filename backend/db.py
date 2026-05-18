import os
import certifi
from dotenv import load_dotenv
from pymongo import MongoClient

# Load .env from backend directory
import pathlib
backend_dir = pathlib.Path(__file__).parent
load_dotenv(dotenv_path=backend_dir / ".env")

MONGO_URI = os.getenv("MONGO_URI")
MONGO_URI_READ = os.getenv("MONGO_URI_READ") or MONGO_URI
MONGO_DB_NAME = os.getenv("MONGO_DB_NAME", "scholar_ai")

if not MONGO_URI:
    raise ValueError("MONGO_URI is missing in backend/.env")

# Lazy connection initialization
class MongoDBConnection:
    _rw_client = None
    _ro_client = None
    
    @classmethod
    def get_rw_client(cls):
        if cls._rw_client is None:
            try:
                cls._rw_client = MongoClient(MONGO_URI, tlsCAFile=certifi.where(), serverSelectionTimeoutMS=5000, connectTimeoutMS=5000, retryWrites=False)
                # Test connection
                cls._rw_client.admin.command('ping')
            except Exception as e:
                print(f"Warning: Failed to connect to MongoDB: {e}")
                cls._rw_client = None
                raise
        return cls._rw_client
    
    @classmethod
    def get_ro_client(cls):
        if cls._ro_client is None:
            try:
                cls._ro_client = MongoClient(MONGO_URI_READ, tlsCAFile=certifi.where(), serverSelectionTimeoutMS=5000, connectTimeoutMS=5000, retryWrites=False)
                # Test connection
                cls._ro_client.admin.command('ping')
            except Exception as e:
                print(f"Warning: Failed to connect to MongoDB read replica: {e}")
                cls._ro_client = None
                raise
        return cls._ro_client

# Get initial connections without blocking app startup
try:
    mongo_db = MongoDBConnection.get_rw_client()[MONGO_DB_NAME]
    mongo_db_read = MongoDBConnection.get_ro_client()[MONGO_DB_NAME]
except Exception as e:
    print(f"MongoDB connection error during initialization: {e}")
    print("App will continue but MongoDB operations will fail")
    mongo_db = None
    mongo_db_read = None

# Create collections safely
if mongo_db is not None:
    users_col = mongo_db["users"]
    posts_col = mongo_db["posts"]
    messages_col = mongo_db["messages"]
    conversations_col = mongo_db["conversations"]
    dm_messages_col = mongo_db["dm_messages"]
    dm_threads_col = mongo_db["dm_threads"]
    scholarships_col = mongo_db["scholarships"]
    internships_col = mongo_db["internships"]
    applications_col = mongo_db["applications"]
    notifications_col = mongo_db["notifications"]
    job_postings_col = mongo_db["job_postings"]
else:
    users_col = posts_col = messages_col = conversations_col = dm_messages_col = dm_threads_col = None
    scholarships_col = internships_col = applications_col = notifications_col = job_postings_col = None

if mongo_db_read is not None:
    r_users_col = mongo_db_read["users"]
    r_posts_col = mongo_db_read["posts"]
    r_messages_col = mongo_db_read["messages"]
    r_dm_messages_col = mongo_db_read["dm_messages"]
    r_dm_threads_col = mongo_db_read["dm_threads"]
    r_scholarships_col = mongo_db_read["scholarships"]
    r_internships_col = mongo_db_read["internships"]
    r_applications_col = mongo_db_read["applications"]
    r_notifications_col = mongo_db_read["notifications"]
    r_job_postings_col = mongo_db_read["job_postings"]
else:
    r_users_col = r_posts_col = r_messages_col = r_dm_messages_col = r_dm_threads_col = None
    r_scholarships_col = r_internships_col = r_applications_col = r_notifications_col = r_job_postings_col = None


# When a read-only replica is not configured, fall back to the primary write collections.
if r_users_col is None:
    r_users_col = users_col
if r_posts_col is None:
    r_posts_col = posts_col
if r_messages_col is None:
    r_messages_col = messages_col
if r_dm_messages_col is None:
    r_dm_messages_col = dm_messages_col
if r_dm_threads_col is None:
    r_dm_threads_col = dm_threads_col
if r_scholarships_col is None:
    r_scholarships_col = scholarships_col
if r_internships_col is None:
    r_internships_col = internships_col
if r_applications_col is None:
    r_applications_col = applications_col
if r_notifications_col is None:
    r_notifications_col = notifications_col
if r_job_postings_col is None:
    r_job_postings_col = job_postings_col


def serialize_doc(doc: dict | None) -> dict | None:
    if not doc:
        return None
    if "_id" in doc:
        try:
            doc["_id"] = str(doc["_id"])
        except Exception:
            pass
    return doc

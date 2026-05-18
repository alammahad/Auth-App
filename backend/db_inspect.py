import os
import certifi
from pymongo import MongoClient
from dotenv import load_dotenv
import pathlib

backend_dir = pathlib.Path(__file__).parent
load_dotenv(dotenv_path=backend_dir / ".env")

MONGO_URI = os.getenv("MONGO_URI")
MONGO_DB_NAME = os.getenv("MONGO_DB_NAME", "scholar_ai")

if not MONGO_URI:
    print("MONGO_URI not set in backend/.env")
    raise SystemExit(1)

client = MongoClient(MONGO_URI, tlsCAFile=certifi.where())
db = client[MONGO_DB_NAME]

print("Database:", MONGO_DB_NAME)
print("Collections:")
for name in sorted(db.list_collection_names()):
    print(" -", name)
    try:
        coll = db[name]
        indexes = coll.index_information()
        print("   Indexes:")
        for idx_name, spec in indexes.items():
            print("    -", idx_name, ":", spec.get('key'))
    except Exception as e:
        print("   Could not fetch indexes:", e)

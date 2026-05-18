import os
import certifi
from pymongo import MongoClient, ASCENDING
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

collections_to_ensure = [
    ("scholarships", [
        ([("deadline", ASCENDING)], False),
        ([("type", ASCENDING), ("country", ASCENDING)], False),
        ([("title", "text"), ("eligibility", "text"), ("university", "text")], False),
        ([("dedupe_key", ASCENDING)], True),
    ]),
    ("internships", [
        ([("deadline", ASCENDING)], False),
        ([("location", ASCENDING), ("field", ASCENDING)], False),
        ([("title", "text"), ("company", "text"), ("field", "text")], False),
        ([("dedupe_key", ASCENDING)], True),
    ])
]

for name, indexes in collections_to_ensure:
    if name in db.list_collection_names():
        print(f"Collection '{name}' already exists")
        coll = db[name]
    else:
        try:
            coll = db.create_collection(name)
            print(f"Created collection '{name}'")
        except Exception as e:
            print(f"Could not create collection '{name}': {e}")
            coll = db[name]

    # Create indexes
    for spec, unique in indexes:
        try:
            # If text index, pass spec as list of (field, 'text')
            spec_kw = []
            for f, order in spec:
                spec_kw.append((f, order))
            coll.create_index(spec_kw, unique=unique, background=True, sparse=True)
            print(f"Created index on {name}: {spec_kw} (unique={unique})")
        except Exception as e:
            print(f"Failed to create index on {name} {spec}: {e}")

print("Done")

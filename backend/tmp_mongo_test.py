import certifi
from pymongo import MongoClient
import traceback

uri = 'mongodb+srv://scholar_appp:ScholarFYP2026@schlr-ai.bo2mmmz.mongodb.net/scholar_ai?appName=Schlr-Ai'
try:
    client = MongoClient(uri, tlsCAFile=certifi.where(), serverSelectionTimeoutMS=5000, connectTimeoutMS=5000, retryWrites=False)
    print('connected')
    print(client.list_database_names())
    client.close()
except Exception:
    traceback.print_exc()

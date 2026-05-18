import certifi
from pymongo import MongoClient

uri = 'mongodb+srv://scholar_appp:ScholarFYP2026@schlr-ai.bo2mmmz.mongodb.net/scholar_ai?appName=Schlr-Ai'
client = MongoClient(uri, tlsCAFile=certifi.where(), serverSelectionTimeoutMS=5000, connectTimeoutMS=5000, retryWrites=False)
db = client['scholar_ai']
print('collections:', db.list_collection_names())
print('users count', db['users'].count_documents({}))
print('sample users', list(db['users'].find({}, {'email': 1, 'user_type': 1, 'status': 1}).limit(5)))
client.close()

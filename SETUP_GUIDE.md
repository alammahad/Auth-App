# SCHLR - Complete Setup & Verification Guide

## 🚀 Quick Start

### Step 1: Initialize Database
```bash
cd backend
python create_super_admin.py
python seed_database.py
python tmp_mongo_inspect.py
```

**Or use the batch file (Windows):**
```bash
backend\run_setup.bat
```

### Step 2: Start Development Servers
```bash
npm run dev
```

**Or use the batch file (Windows):**
```bash
run_dev.bat
```

This will start:
- **Backend**: FastAPI on `http://localhost:8000`
- **Frontend**: Vite React on `http://localhost:5173`

### Step 3: Verify Everything Works
```bash
python verify_setup.py
```

---

## 📋 What Gets Created

### Database Collections

| Collection | Records | Purpose |
|-----------|---------|---------|
| **users** | 5 | 2 students, 1 recruiter, 1 student, 1 super admin |
| **posts** | 3 | Sample posts from users |
| **scholarships** | 3 | Scholarship opportunities |
| **internships** | 2 | Internship programs |

### Sample Users

| Email | Password | Type | Status |
|-------|----------|------|--------|
| schlradmin@gmail.com | Admin123! | super_admin | approved |
| alice@sclr.com | Password123! | student | approved |
| bob@sclr.com | Password123! | student | approved |
| carol@sclr.com | Password123! | recruiter | approved |
| david@sclr.com | Password123! | student | approved |

---

## 🔍 Verification Steps

### 1. Database Verification
```bash
python backend/tmp_mongo_inspect.py
```
**Expected Output:**
```
collections: ['users', 'posts', 'scholarships', 'internships', ...]
users count: 5
sample users: [{'_id': ..., 'email': 'alice@sclr.com', 'user_type': 'student', 'status': 'approved'}, ...]
```

### 2. Backend Health Check
Navigate to: `http://localhost:8000/health`

**Expected:** JSON response with status "ok"

### 3. API Testing (After Backend Starts)
```bash
python verify_setup.py
```

This will test:
- ✅ Backend health
- ✅ Login endpoint
- ✅ Users list
- ✅ Scholarships list
- ✅ Internships list
- ✅ Frontend connectivity

### 4. Manual Testing

**Login with student:**
- Email: `alice@sclr.com`
- Password: `Password123!`

**Login with recruiter:**
- Email: `carol@sclr.com`
- Password: `Password123!`

**Login with admin:**
- Email: `schlradmin@gmail.com`
- Password: `Admin123!`

---

## 📁 Project Structure

```
simple-auth-app/
├── backend/
│   ├── app.py                 # FastAPI main app
│   ├── db.py                  # MongoDB connection
│   ├── create_super_admin.py  # Admin setup script
│   ├── seed_database.py       # Data seeding (CREATED)
│   ├── run_setup.bat          # Windows setup batch (CREATED)
│   ├── .env                   # Environment variables
│   └── requirements.txt        # Python dependencies
├── frontend/
│   ├── src/
│   │   ├── main.jsx           # React entry point
│   │   ├── App.jsx            # Main component
│   │   └── pages/             # Feature pages
│   ├── package.json
│   └── vite.config.js
├── run_dev.bat                # Windows dev batch (CREATED)
├── verify_setup.py            # Verification script (CREATED)
└── package.json               # Root package.json
```

---

## 🔧 Configuration

### Backend (.env)
```
MONGO_URI=mongodb+srv://scholar_appp:ScholarFYP2026@schlr-ai.bo2mmmz.mongodb.net/scholar_ai
MONGO_DB_NAME=scholar_ai
JWT_SECRET=SchlrAiFYP2026SuperSecretKeyMuhammad123456789
SUPER_ADMIN_EMAIL=schlradmin@gmail.com
SUPER_ADMIN_PASSWORD=Admin123!
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:8081,http://localhost:5173,http://127.0.0.1:5173
```

### Frontend (Auto Configured)
- API Base: `http://localhost:8000` (default)
- Dev Server: `http://localhost:5173`

---

## 🐛 Troubleshooting

### Issue: "Cannot connect to MongoDB"
- Check `.env` file has valid `MONGO_URI`
- Verify MongoDB Atlas credentials
- Check network connectivity

### Issue: "Port already in use"
**Backend (8000):**
```bash
lsof -i :8000  # macOS/Linux
netstat -ano | findstr :8000  # Windows
```

**Frontend (5173):**
```bash
lsof -i :5173  # macOS/Linux
netstat -ano | findstr :5173  # Windows
```

### Issue: "Module not found"
```bash
# Backend
pip install -r backend/requirements.txt

# Frontend
npm install
```

---

## 📊 Expected Endpoints

### Public
- `GET /health` - Health check
- `POST /auth/login` - Login
- `POST /auth/signup` - Register
- `GET /scholarships` - List scholarships
- `GET /internships` - List internships

### Protected (Requires Auth)
- `GET /auth/me` - Current user info
- `GET /users` - List users
- `GET /posts` - User posts
- `POST /posts` - Create post
- `GET /chat` - Chat history
- `WS /ws/{user_id}` - WebSocket messaging

---

## ✅ Success Criteria

After setup, you should have:

1. ✅ Database initialized with 5 users
2. ✅ Sample data seeded (posts, scholarships, internships)
3. ✅ Backend running and responding to `/health`
4. ✅ Frontend accessible at `localhost:5173`
5. ✅ Can login with test credentials
6. ✅ API endpoints returning data
7. ✅ No console errors in browser or backend

---

## 📝 Notes

- All passwords are hashed with bcrypt
- JWT tokens expire after 24 hours (configurable)
- Default admin credentials should be changed in production
- MongoDB Atlas used for cloud database
- CORS configured for local development

---

## 🆘 Need Help?

If you encounter issues:

1. Check logs in backend terminal
2. Check browser console (F12)
3. Run `python verify_setup.py` for automated diagnosis
4. Verify `.env` configuration
5. Ensure all dependencies installed: `pip install -r requirements.txt` & `npm install`

Good luck! 🚀

# SCHLR / ScholarAI — Project overview

## Purpose

**SCHLR** (“ScholarAI”) is a web platform aimed at **students and recruiters** in a scholarship-oriented community. It is meant to help users:

- **Discover scholarships and internships** (including scraped or curated listings stored in the backend).
- **Build profiles** (students and recruiters) and **match** users to opportunities or each other.
- **Social feed & engagement**: posts, comments, likes, follows, saved posts.
- **AI assistant (“chat”)**: question answering using retrieval over ingested content (RAG-style flow) and optional Claude integration; conversation history can be stored.
- **Direct messaging** between users (DM threads via REST and WebSocket).
- **Recruiter workflows**: job postings, recruiter dashboard, admin approval for recruiters.
- **Admin**: pending recruiter review, stats.

The **FastAPI backend** (`backend/app.py`) exposes a large REST API plus WebSockets and connects to **MongoDB** (`scholar_ai` database) for persistence. The **React (Vite) frontend** talks to that API using `VITE_API_BASE` or the default `http://localhost:8000`.

---

## High-level architecture

```
┌─────────────────┐     HTTP / WS      ┌──────────────────┐      MongoDB       ┌────────────┐
│  React (Vite) │ ◄────────────────► │  FastAPI (8000)  │ ◄───────────────► │ scholar_ai │
│  frontend/src │   Bearer JWT        │  backend/app.py  │   PyMongo         │ Atlas / DB │
└─────────────────┘                    └──────────────────┘                   └────────────┘
                                              │
                                              ▼
                                     Optional: Claude, vector store,
                                     scrapers, Cloudinary uploads
```

---

## What the frontend does today (routing)

**Entry:** `frontend/src/main.jsx` renders `<App />` only — there is **no** `BrowserRouter` wrapper.

**`App.jsx` flow:**

1. If no logged-in user and view is “landing” → **`LandingPage`**
2. If no user (after choosing auth) → **`AuthPage`** (login/signup; calls `/auth/login`, `/auth/signup`, stores JWT)
3. If user is logged in → **`Dashboard`** (with `user`, `token`, `onLogout`, `onUserRefresh`)

So the **only** screens currently mounted by the app are: **Landing → Auth → Dashboard**.

### Important: feature pages vs. the shell

The repo contains many **section components** under `frontend/src/pages/` (for example `ChatSection`, `ProfileSection`, `NewsSection`, `MessagingSection`, `MatchesSection`, `GuidesSection`, `AdminSection`, `AdminDashboard`, recruiter panes, etc.). These are built to call the backend APIs.

However, **`Dashboard.jsx` does not import or render those sections.** As checked in the codebase, nothing imports `ChatSection`, `ProfileSection`, `NewsSection`, etc. — only `LandingPage`, `AuthPage`, and `Dashboard` are imported from `App.jsx`.

So:

- **Backend ↔ API contracts**: Many routes exist and match what those section components would call.
- **Frontend ↔ “every page attached”**: **Not yet.** After login, users do not automatically get a tabbed shell that mounts Chat, Profile, News, DMs, etc. Those components are **present but orphaned** until a parent layout imports them and switches views.

### Router leftovers

- **`Signup.jsx`** uses `react-router-dom` (`Link`, `useNavigate`) but **`Signup` is not used** in `App.jsx`, and **`main.jsx` has no router** — so that file is unused / inconsistent with the current flow (auth is handled in **`AuthPage`**).
- **`Dashboard.jsx`** includes `<Link to="/login">` / `/signup`, which expect a router and routes that are **not** defined in `main.jsx`.

---

## Backend capabilities (summary)

The API includes (non-exhaustive):

| Area | Examples |
|------|-----------|
| Auth | `/auth/signup`, `/auth/login`, `/auth/me` |
| Users | profiles, follow, saved posts, search |
| Posts / feed | CRUD posts, like, comment, save |
| Opportunities | scholarships, internships, applications |
| Chat | `/chat`, `/chat/history` |
| News / guides | `/news`, `/guides/degree-attestation` |
| Matches | `/recommendations/matches` |
| Recruiter | jobs CRUD, `/recruiter/dashboard` |
| Admin | pending recruiters, approve/reject, stats |
| Messaging | DM threads/messages, `WebSocket /ws/{user_id}` |
| Ops | `/health`, scrape endpoints, image upload |

Schedulers and scrapers can refresh content depending on environment flags.

---

## Configuration essentials

| Piece | Role |
|-------|------|
| `backend/.env` | `MONGO_URI`, `MONGO_URI_READ`, JWT secrets, optional Claude/Cloudinary/scraper toggles |
| `frontend` | `VITE_API_BASE` if the API is not on `http://localhost:8000` |
| CORS | `ALLOWED_ORIGINS` in backend (defaults include local Vite ports) |

---

## Requirements (runtime)

- Python: 3.11.x (tested with 3.11.4)
- Backend pinned dependencies: see `backend/requirements.txt` (examples used in this environment):
    - fastapi==0.136.1
    - uvicorn[standard]==0.46.0
    - pymongo==4.17.0
    - python-dotenv==1.2.2
    - bcrypt==5.0.0
    - PyJWT==2.12.1
    - certifi==2026.4.22
    - anthropic==0.102.0
    - APScheduler==3.11.2
    - cloudinary==1.44.2
    - httpx==0.28.1
    - python-multipart==0.0.28
    - pydantic==2.13.4
    - starlette==1.0.0
    - websockets==16.0

Installation (backend):

```bash
cd backend
python -m pip install -r requirements.txt
```

Notes:
- `backend/.env` must contain `MONGO_URI` (and other optional keys) before running the server.
- If you encounter `anthropic` version constraints in other environments, pin to a specific installed version instead of `>=1.0.0`.


## Recent updates

- Backend now falls back to the primary write collections when a read-only replica is not configured, so auth and user-related routes work consistently in local/dev environments.
- Recruiters now have a dedicated **Messages** tab in the dashboard, and DM threads support send/receive for both students and recruiters via REST + WebSocket.
- Student CV upload is improved so profile CVs and per-application CV submission work together, and recruiters can review submitted applicant CVs from the job posting applicant list.
- Built-in admin credentials are aligned to the current project test credential set: `admin@sclr.com` / `Admin123!`.

## Summary

- **Project purpose**: Scholarship/community platform with profiles, feed, opportunities, AI chat, DMs, recruiter and admin flows — backed by **FastAPI + MongoDB** and a **React** client.
- **Are all pages “attached” to the right place?** **Not completely.** Auth and landing are wired; the **post-login experience does not yet compose** the section pages into one navigable dashboard, and **React Router is not fully integrated** with `main.jsx`. Completing that wiring (e.g. a real dashboard layout + tabs or `react-router` routes) would attach those pages as intended.

---

*Generated from the repository structure and imports as of the documentation date.*

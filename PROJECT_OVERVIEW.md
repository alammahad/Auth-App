# SCHLR / ScholarAI — Project Overview

## Purpose

**SCHLR** (“ScholarAI”) is a web platform aimed at **students, recruiters, and administrators** in a scholarship-oriented community. It is designed to help users:

- **Discover Scholarships & Internships**: Scraped and curated listings stored and queried dynamically from MongoDB.
- **Build Profiles**: Detailed student and recruiter profiles with target countries, majors, and hiring focuses.
- **Social Feed & Engagement**: Create, like, comment, and save community posts.
- **AI assistant (“Chat”)**: Semantic RAG-style query answering using opportunities and knowledge embeddings.
- **Real-Time Direct Messaging**: REST endpoints and WebSockets for real-time text chat between members.
- **Smart CV Matching**: Automated matching of student CVs (PDF, Word, Images) against recruiter requirements using rule-based scoring (60%) and Sentence-Transformers ML semantic embeddings (40%).
- **Recruiter Workflows**: Centralized postings creation, dashboard overview, and CV category filters.
- **Admin Dashboards**: Recruiter approvals, registration audits, and analytical insights.

The platform is powered by a **FastAPI backend** (`backend/app.py`) connecting to a **MongoDB database** (`scholar_ai`) and a **React (Vite) frontend** client (`frontend/src/App.jsx`).

---

## High-Level Architecture

```
┌─────────────────┐     HTTP / WS      ┌──────────────────┐      MongoDB       ┌────────────┐
│  React (Vite)   │ ◄────────────────► │  FastAPI (8000)  │ ◄───────────────► │ scholar_ai │
│  frontend/src   │   Bearer JWT        │  backend/app.py  │   PyMongo         │ Atlas / DB │
└─────────────────┘                    └──────────────────┘                   └────────────┘
                                              │
                                              ▼
                                     ChromaDB (Vector RAG), Scrapers, 
                                     Sentence-Transformers (ML Matcher)
```

---

## Frontend Layout & Shell Routing

### Component Flow (`App.jsx`)
1. **Bootstrap / Session Init**: The app boots and verifies the JWT token. While loading, the page displays a custom fullscreen large **Gooey Loader**.
2. **Landing Page**: Shown to unauthenticated visitors (option to choose Sign In or Sign Up).
3. **Auth Page**: Renders signup and login forms, verifying credentials against `/auth/signup` and `/auth/login`.
4. **Dashboard**: The shell once logged in, providing customized, tabbed navigation according to user roles.

### Tab Navigation Mapping
The dashboard shell dynamically resolves menus and tab components for each user role:

- **Student Dashboard Tabs**:
  - `Feed`: Community posts, comments, likes, and saved posts.
  - `Jobs & Apply`: Search internships/scholarships and upload CVs for applications.
  - `Matches`: View personalized opportunity recommendations matching student profile fields.
  - `AI Chat`: Retrieve help and scholarship advice via the AI chatbot.
  - `Guides`: Ingest guides for degree attestation and foreign studies.
  - `Messages`: Interactive direct message list.
  - `Profile`: Display details, default CV upload, post history, and account self-deletion options.
  
- **Recruiter Dashboard Tabs**:
  - `Overview`: Key recruiting metrics (active postings, total applicants, shortlisted/new applicants count).
  - `Community`: Engage in the social feed as a recruiter.
  - `Post Roles`: Create and edit job postings with specific match criteria (keywords, fields, scores).
  - `Applicants`: Expand active roles to review and filter applicants by match category and shortlist status.
  - `Messages`: Direct messaging pane to contact students.
  - `Profile`: Manage personal recruiter details and company fields.

- **Admin Dashboard Tabs**:
  - `Approvals`: Audit and approve/reject pending recruiter account registrations.
  - `Insights`: Statistical overviews of users, students, and recruiters.
  - `Profile`: Manage admin settings.

---

## Backend Capabilities

| Category | Description & Endpoints |
|---|---|
| **Auth** | `/auth/signup`, `/auth/login`, `/auth/me` (JWT session management) |
| **Users** | Profile edits, follow/unfollow, member search, saved posts tracking |
| **Posts** | Community posts CRUD, liking, commenting, dynamic feeds |
| **Opportunities** | Scholarship and internship listing, bookmarking |
| **CV Matcher** | Text extraction via `cv_reader.py` (OCR fallback for images). Text comparison via `cv_matcher.py` (Rule-based keywords [60%] + Sentence-Transformers embeddings [40%]) |
| **Recruiter API** | Job creation, applicant reviews, and dashboard metrics `/recruiter/dashboard` |
| **Admin API** | Pending recruiter audits, registration decisions, platform statistics |
| **DMs** | DM threads CRUD, WebSocket `/ws/{user_id}` connection with ref-based manager preventing reconnection loops |
| **Ops** | `/health` checks, RSS/AI scrapers, Cloudinary uploads, fallback DNS configuration (`8.8.8.8`/`1.1.1.1`) to resolve database resolution timeouts |

---

## Premium UI/UX Features

1. **Gooey Morph Loader (Daily UI #076)**:
   A liquid, morphing loader using an SVG Gaussian Blur + Color Matrix filter to merge orbiting dots fluidly. Used in place of all loading text and spinners across all views with scale scaling (`sm`/`md`/`lg`).
2. **Seen Receipts (Eye Icon)**:
   Read receipts for messages you sent using a blue SVG eye icon next to the timestamp for `read === true` messages.
3. **Smooth Messaging Pane Layout & Connection Manager**:
   - **Message Grouping**: Closely bundles messages from the same sender within 2 minutes and hides redundant peer profile avatars.
   - **Adaptive Bubble Rounding**: Bubbles round differently based on their position in a group (top, middle, bottom, single).
   - **Centered Date Dividers**: Centered blur-backed pills separating days (e.g. "Today", "Yesterday").
   - **Bouncing Dots Typing Indicator**: Clean bubble containing three pulsing bouncing dots inside the scroll container.
   - **Hover Delete Controls**: Deletion buttons (`🗑`) fade in only when a message bubble container is hovered.
   - **Resilient Connection Manager**: Relies on a stable React Ref (`wsRef`) and connection-tracking flags (`wsRef.current === newWs`) to completely eliminate the infinite WebSocket reconnect loops on layout updates and user logouts.
4. **Light / Dark Blue Theme**:
   A white, glassmorphic layout accented with soft sky-blue borders, gradients, and light/dark theme toggle support.
5. **Interactive Dropdowns & Match Filters**:
   - **Recruiter Applicant filtering**: Categorizes student applications as **Best** (Score $\ge$ 70), **Medium** (Score 45–69), and **Below** (Score $<$ 45) with custom colored status badges.
   - **Student Matches filtering**: Custom, glassmorphic multi-select checkboxes for Country and Degree Level. Pre-populated by default with the student's profile values, featuring a search-filter input for countries, 16px curved dropdown panels, and smooth text-translation animations (`translateX(4px)`) on option hover.
6. **Smooth Guides Accordion Animations**:
   Collapsible panels in the HEC Attestation/Foreign Guides section utilizing modern CSS grid-template-rows height transitions and smoothly rotating chevron icons (`▼`) when clicked.
7. **Modern SVG Vector Icons**:
   All legacy text emojis in navigation pills, settings drop-downs, and landing page capability panels have been replaced with customized, theme-responsive SVG line-art icons that dynamically adapt to active colors (`currentColor`).
8. **High-Fidelity Hover Micro-Animations**:
   Hovering over any navigation icon or card triggers sleek, Dribbble-inspired animations (e.g., rotating gear, sliding logout exit arrow, pulsing bullseye target, bouncing briefcase handle, typing message dots, and self-drawing verification shield checkmark).
9. **Password Toggle Visibility**:
   Settings credential forms feature absolute-positioned SVG eye icons to toggle between password masking and plain text dynamically, including automatic safety resets.
10. **Landing Page Instagram Link**:
    The landing page footer integrates an animated `<InstagramIcon />` linked directly to `https://www.instagram.com/alam_mahad`. Hovering over the link scales and rotates the icon playfully while shifting its color to the brand pink `#E1306C`.
11. **Blur-Filtered Logout Modal**:
    A glassmorphic overlay with screen-blur filters (`backdrop-filter: blur(8px)`) and cubic-bezier scale zooming overlays confirmation questions before terminating sessions to prevent accidental logouts.

---

## Requirements & Configuration

- **Python**: 3.11.x (or compatible)
- **Node.js**: 18+ (tested with Vite 8.0.x)
- **Database**: MongoDB Atlas or local MongoDB instance
- **Environment Settings**:
  - `backend/.env`: `MONGO_URI`, `MONGO_URI_READ`, JWT secret key, and optional Claude/Cloudinary tokens.
  - `frontend/.env` (optional): `VITE_API_BASE` (defaults to `http://localhost:8000`).

---

*Verified functional and compiled on: 2026-06-12*

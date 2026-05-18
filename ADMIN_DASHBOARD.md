# Super Admin Dashboard Guide

## Overview
The Super Admin Dashboard is a comprehensive management interface for platform administrators to review, approve, and manage recruiter accounts. Only users with `user_type: "super_admin"` can access this dashboard.

## Accessing the Dashboard

**Default Super Admin Credentials:**
- **Email:** `admin@schlr.com`
- **Password:** `Admin123!`

Once logged in with super admin account, navigate to the **Admin** tab in the Dashboard.

## Dashboard Sections

### 1. **Statistics Cards** (Top Section)
Quick overview of platform metrics:

- **Total Users** - All users (students + recruiters + admins)
- **Total Recruiters** - All recruiter accounts (pending + approved + rejected)
- **Pending Review** - Recruiters awaiting approval (highlighted in orange)
- **Total Students** - All student accounts

These stats update automatically when you approve/reject recruiters.

---

## Tabs

### 🔴 **Pending Recruiters** (⏳ Pending Review)

This is the main recruiter approval interface.

**What You See:**
- List of all recruiters waiting for approval
- Shows count of pending recruiters

**Recruiter Information:**
- **Name** - Full name of recruiter
- **Email** - Work email address
- **Title** - Recruiter's job title (e.g., HR Manager, Recruiter)
- **Industry** - Company industry (e.g., Tech, Finance)
- **Company Size** - Number of employees
- **Website** - Company website link
- **Hiring For** - Job categories they're hiring for

**Action Buttons:**
- **✓ Approve** - Grant platform access to this recruiter
  - Updates status to "approved" in database
  - Recruiter can now log in and access full platform
  - Appears in "Approved" tab
  
- **✗ Reject** - Decline this recruiter application
  - Updates status to "rejected" in database
  - Recruiter cannot log in
  - Account appears in "All Recruiters" tab with REJECTED badge

**Search Feature:**
Search by:
- Recruiter name
- Email address
- Industry
- Company details

---

### ✓ **Approved Recruiters**

View all currently active recruiter accounts.

**Features:**
- Shows all "approved" recruiters
- Full recruiter profile information
- Green badge indicates "APPROVED" status
- Search across approved list
- No action buttons (information only)

**Approved Recruiters Can:**
✅ Log in to platform
✅ Post job listings
✅ View student profiles
✅ Send messages to students
✅ Manage applications
✅ Access recruiter dashboard

---

### 📋 **All Recruiters**

Complete view of every recruiter account regardless of status.

**Shows:**
- All recruiter accounts (pending + approved + rejected)
- Status badge for each:
  - ⏳ **PENDING** - Awaiting review
  - ✓ **APPROVED** - Active account
  - ✗ **REJECTED** - Declined application

**Use Cases:**
- Audit recruiter list
- Search for specific recruiter
- See application history
- Track rejections and approvals

---

### 📊 **Analytics**

Platform performance dashboard.

**Metrics Displayed:**
- **Total Students** - Active student accounts
- **Approved Recruiters** - Active recruiter accounts
- **Pending Approval** - Recruiters under review

*Note: Advanced analytics coming soon - charts, trends, and detailed insights*

---

## Recruiter Status Workflow

### Status: **PENDING**
```
New recruiter signs up
         ↓
Status: pending in database
         ↓
Appears in "Pending Recruiters" tab
         ↓
Cannot log in (login blocked)
         ↓
Admin must approve or reject
```

### Status: **APPROVED** ✅
```
Admin clicks "Approve" button
         ↓
Status: approved in database
         ↓
Recruiter can now log in
         ↓
Full platform access granted
         ↓
Appears in "Approved Recruiters" tab
```

### Status: **REJECTED** ❌
```
Admin clicks "Reject" button
         ↓
Status: rejected in database
         ↓
Recruiter cannot log in
         ↓
Login shows: "Account rejected by super admin"
         ↓
Appears in "All Recruiters" tab with REJECTED badge
```

---

## Database Collections

### Users Collection Structure
```json
{
  "_id": ObjectId,
  "name": "John Recruiter",
  "email": "john@company.com",
  "user_type": "recruiter",
  "status": "pending|approved|rejected",
  "profile": {
    "recruiter_title": "HR Manager",
    "industry": "Tech",
    "company_size": "51",
    "company_website": "company.com",
    "hiring_focus": ["Software", "Product"],
    "linkedin_company_url": "linkedin.com/company/xyz"
  },
  "created_at": datetime,
  "updated_at": datetime
}
```

---

## Backend API Endpoints

### GET `/admin/recruiters/pending`
Get all pending recruiters
```bash
curl -H "Authorization: Bearer {token}" \
  http://localhost:8000/admin/recruiters/pending
```

**Response:**
```json
{
  "recruiters": [
    {
      "_id": "recruiter_id",
      "name": "John Recruiter",
      "email": "john@company.com",
      "profile": { ... },
      "status": "pending",
      "created_at": "2026-05-13T10:00:00Z"
    }
  ]
}
```

### GET `/admin/recruiters/approved`
Get all approved recruiters
```bash
curl -H "Authorization: Bearer {token}" \
  http://localhost:8000/admin/recruiters/approved
```

### GET `/admin/recruiters/all`
Get all recruiters (any status)
```bash
curl -H "Authorization: Bearer {token}" \
  http://localhost:8000/admin/recruiters/all
```

### POST `/admin/recruiters/{recruiter_id}/approve`
Approve a recruiter
```bash
curl -X POST \
  -H "Authorization: Bearer {token}" \
  http://localhost:8000/admin/recruiters/recruiter_id/approve
```

**Response:**
```json
{
  "status": "approved"
}
```

### POST `/admin/recruiters/{recruiter_id}/reject`
Reject a recruiter
```bash
curl -X POST \
  -H "Authorization: Bearer {token}" \
  http://localhost:8000/admin/recruiters/recruiter_id/reject
```

### GET `/admin/stats`
Get platform statistics
```bash
curl -H "Authorization: Bearer {token}" \
  http://localhost:8000/admin/stats
```

**Response:**
```json
{
  "total_users": 150,
  "total_recruiters": 25,
  "pending_recruiters": 5,
  "approved_recruiters": 20,
  "total_students": 125
}
```

---

## Security & Access Control

✅ **Protected Endpoints**
- All admin endpoints require JWT token
- Token must belong to user with `user_type: "super_admin"`
- Returns 403 Forbidden if not super admin

✅ **Password Fields**
- Recruiter passwords NEVER returned in API responses
- Excluded with `{"password": 0}` in all queries

✅ **Data Validation**
- Recruiter ID must be valid ObjectId
- Recruiter must exist in database
- Action (approve/reject) only works on recruiter accounts

---

## Use Cases

### Scenario 1: Approving a Quality Recruiter
1. Open Admin Dashboard → "Pending Review" tab
2. Review recruiter details:
   - Legitimate company
   - Valid email domain
   - Real job titles and industries
3. Click **Approve** button
4. Recruiter receives success message in UI
5. Recruiter can now log in and post jobs

### Scenario 2: Rejecting Suspicious Application
1. Open Admin Dashboard → "Pending Review" tab
2. Review recruiter details (notice red flags):
   - Invalid company info
   - Suspicious email
   - Missing required fields
3. Click **Reject** button
4. Recruiter sees "Account rejected" on login
5. Admin can see this in "All Recruiters" tab

### Scenario 3: Auditing Recruiter Base
1. Open Admin Dashboard → "All Recruiters" tab
2. Search by company name or industry
3. View status distribution
4. Monitor approval trends

---

## Testing the Admin Dashboard

### Test with Mock Data

**Create a test recruiter (as student):**
1. Sign up as recruiter with:
   - Email: `test.recruiter@company.com`
   - Password: `TestPass123!`
   - Title: Test Recruiter
   - Industry: Technology

**Then as Super Admin:**
1. Log in with: `admin@schlr.com` / `Admin123!`
2. Go to Admin Dashboard
3. Find the test recruiter in "Pending Review"
4. Click Approve
5. Verify recruiter now appears in "Approved" tab
6. Try logging in as the recruiter - should work

---

## Performance Optimization

**Indexes Created:**
```javascript
db.users.createIndex({ email: 1 }, { unique: true })
db.users.createIndex({ user_type: 1 })
db.users.createIndex({ status: 1 })
```

**Query Optimization:**
- Pending recruiters sorted by `created_at` (newest first)
- Excludes password field from all responses
- Uses read-only connection for GET endpoints

---

## Common Issues & Troubleshooting

**Issue: Can't see pending recruiters**
- ✓ Check you're logged in as super admin (`admin@schlr.com`)
- ✓ Verify token is valid and not expired
- ✓ Check MongoDB connection in backend

**Issue: Approve button not working**
- ✓ Check browser console for errors
- ✓ Verify recruiter ID is valid
- ✓ Check network tab for API response

**Issue: Recruiter still can't log in after approval**
- ✓ Ask recruiter to clear cache and try again
- ✓ Verify status was updated to "approved" in MongoDB
- ✓ Check login validation logic in backend

**Issue: See "403 Super admin access required"**
- ✓ You must be logged in as `admin@schlr.com`
- ✓ Your account must have `user_type: "super_admin"`
- ✓ Check MongoDB to verify account status

---

## Best Practices

1. **Regular Reviews** - Check pending tab daily to reduce recruiter wait time
2. **Verify Information** - Check company website and LinkedIn profile before approving
3. **Document Decisions** - Note reasons for rejections if needed
4. **Monitor Metrics** - Watch the stats to understand platform growth
5. **Quick Approvals** - Approve legitimate applications within 24 hours for better UX

---

## Feature Roadmap

🔜 **Coming Soon:**
- Bulk approve/reject actions
- Email notifications to recruiters on approval/rejection
- Rejection reason template
- Recruiter verification badges
- Advanced analytics dashboard
- Audit logs for all admin actions
- Recruiter profile editing by admin
- Suspension/ban functionality

---

## Super Admin Creation (First Time Setup)

If you need to create a super admin account:

```bash
cd backend
python create_super_admin.py
```

Edit the script to set:
- Email: Change from `admin@schlr.com`
- Password: Change from `Admin123!` (use strong password)

---

**Last Updated:** May 13, 2026  
**Dashboard Status:** ✅ Fully Functional  
**Tested With:** Super Admin Account


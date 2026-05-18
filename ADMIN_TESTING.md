# Super Admin Dashboard - Testing Guide

## Quick Start Testing

### Step 1: Access Admin Dashboard
```
1. Go to http://localhost:5174/
2. Login with Super Admin:
   Email: admin@schlr.com
   Password: Admin123!
3. Click "Admin" tab in navigation
```

### Step 2: View Dashboard
You should see:
- ✅ Statistics cards (Total Users, Total Recruiters, Pending Review)
- ✅ Three main tabs: Pending Review | Approved | All Recruiters
- ✅ Analytics tab with platform metrics

---

## Test Scenarios

### Test 1: Approve a Recruiter

**Setup:**
1. Have recruiter account waiting in pending status
2. Example: `abd90@gmail.com` (already in database)

**Test Steps:**
```
1. Go to Admin Dashboard
2. Click "Pending Review" tab
3. Search for recruiter by name or email
4. Click "✓ Approve" button
5. See success message: "Recruiter approved successfully!"
6. Recruiter moves to "Approved Recruiters" tab
```

**Expected Results:**
- ✅ Message displayed at top
- ✅ Statistics updated (pending count decreases)
- ✅ Recruiter appears in "Approved" tab
- ✅ Recruiter can now log in with full access

---

### Test 2: Reject a Recruiter

**Test Steps:**
```
1. Go to Admin Dashboard → "Pending Review"
2. Find a recruiter to reject
3. Click "✗ Reject" button
4. See success message: "Recruiter rejected successfully!"
5. Recruiter now appears in "All Recruiters" with REJECTED badge
```

**Expected Results:**
- ✅ Recruiter status changes to "rejected"
- ✅ Recruiter cannot log in
- ✅ Shows "Account rejected by super admin" error message
- ✅ Appears in "All Recruiters" tab with red REJECTED badge

---

### Test 3: Search Functionality

**Pending Tab Search:**
```
1. Click "Pending Review" tab
2. Enter search term in search box:
   - Search by name (e.g., "Ahmed")
   - Search by email (e.g., "@gmail.com")
   - Search by industry (e.g., "Tech")
3. List filters in real-time
```

**Expected Results:**
- ✅ Search filters all three recruiter tabs
- ✅ Shows matching results only
- ✅ Count updates dynamically
- ✅ Clear search → shows all again

---

### Test 4: View Recruiter Details

**What to Verify in Recruiter Card:**
```
✓ Name displayed correctly
✓ Email shown with 📧 icon
✓ Title badge (💼 Recruiter Title)
✓ Industry badge (🏢 Industry)
✓ Company size (👥 employees)
✓ Website link (🔗)
✓ Hiring focus categories listed
✓ Status badge (color-coded)
```

**Example Recruiter Card:**
```
Ahmed | ✓ APPROVED
📧 abd90@gmail.com
💼 HR Manager  🏢 Tech  👥 51 employees
🔗 www.bluecascade.com
Hiring for: Software, Product
```

---

### Test 5: Analytics Tab

**Expected Metrics:**
```
Total Students: [number of student accounts]
Approved Recruiters: [approved count]
Pending Approval: [pending count]
```

**Test Steps:**
1. Click "Analytics" tab
2. Verify all metrics display
3. Approve a recruiter
4. Check "Approved Recruiters" count increases
5. Check "Pending Approval" count decreases

---

### Test 6: Approved Recruiters Tab

**Test Steps:**
```
1. Click "Approved Recruiters" tab
2. See all approved recruiter accounts
3. Each has green "APPROVED" badge
4. Try search functionality
5. Verify information is complete
```

**Expected Results:**
- ✅ Only shows "approved" status recruiters
- ✅ Green APPROVED badges visible
- ✅ No action buttons (read-only view)
- ✅ Search filters list
- ✅ Count matches dashboard stats

---

### Test 7: All Recruiters Tab

**Test Steps:**
```
1. Click "All Recruiters" tab
2. See complete recruiter list (pending + approved + rejected)
3. Verify status badges for each:
   - ⏳ PENDING (orange)
   - ✓ APPROVED (green)
   - ✗ REJECTED (red)
4. Use search to find specific recruiter
```

**Expected Results:**
- ✅ All recruiters visible (all statuses)
- ✅ Correct status badges displayed
- ✅ Count shows total recruiter count
- ✅ Search works across all

---

## Database Verification

### Check Recruiter Status Changes

**Method 1: MongoDB Client**
```bash
# Connect to MongoDB
mongo mongodb+srv://...

# Query pending recruiters
db.users.find({"user_type": "recruiter", "status": "pending"})

# Query approved recruiters
db.users.find({"user_type": "recruiter", "status": "approved"})

# Query rejected recruiters
db.users.find({"user_type": "recruiter", "status": "rejected"})

# Check specific recruiter
db.users.findOne({"email": "abd90@gmail.com"})
```

**Expected Output:**
```json
{
  "_id": ObjectId("..."),
  "name": "Ahmed",
  "email": "abd90@gmail.com",
  "user_type": "recruiter",
  "status": "approved",  // ← Should change after approve button
  "updated_at": ISODate("2026-05-13T..."),
  "profile": { ... }
}
```

### Verify Stats are Accurate

```bash
# Count total users
db.users.count()

# Count pending recruiters
db.users.find({"user_type": "recruiter", "status": "pending"}).count()

# Count approved recruiters
db.users.find({"user_type": "recruiter", "status": "approved"}).count()

# Verify stats endpoint
curl -H "Authorization: Bearer {token}" \
  http://localhost:8000/admin/stats
```

---

## API Endpoint Testing

### Test with cURL

**1. Get Pending Recruiters**
```bash
curl -H "Authorization: Bearer {your_token}" \
  http://localhost:8000/admin/recruiters/pending
```

**2. Get Approved Recruiters**
```bash
curl -H "Authorization: Bearer {your_token}" \
  http://localhost:8000/admin/recruiters/approved
```

**3. Get All Recruiters**
```bash
curl -H "Authorization: Bearer {your_token}" \
  http://localhost:8000/admin/recruiters/all
```

**4. Approve Recruiter**
```bash
curl -X POST \
  -H "Authorization: Bearer {your_token}" \
  http://localhost:8000/admin/recruiters/{recruiter_id}/approve
```

**5. Reject Recruiter**
```bash
curl -X POST \
  -H "Authorization: Bearer {your_token}" \
  http://localhost:8000/admin/recruiters/{recruiter_id}/reject
```

**6. Get Stats**
```bash
curl -H "Authorization: Bearer {your_token}" \
  http://localhost:8000/admin/stats
```

---

## Browser Testing Checklist

### UI Elements
- [ ] Header displays "Admin Dashboard"
- [ ] Subtitle explains purpose
- [ ] Stats cards show all 4 metrics
- [ ] Tabs are clickable and switch content
- [ ] Tab counter badges update
- [ ] Search box appears for recruiter tabs

### Functionality
- [ ] Pending recruiters display in list
- [ ] Approved/Rejected badges show correct color
- [ ] Approve button works (shows loading, then success)
- [ ] Reject button works (shows loading, then success)
- [ ] Success/error messages display
- [ ] Search filters results in real-time
- [ ] Statistics update immediately
- [ ] Sorting by date works (newest first)

### Error Handling
- [ ] Error message displays if API fails
- [ ] Can retry failed actions
- [ ] Clear error messages show what went wrong
- [ ] Buttons disable during loading

### Performance
- [ ] Dashboard loads in < 2 seconds
- [ ] Search responds instantly
- [ ] Tab switches are smooth
- [ ] No console errors

---

## Accessibility Testing

### Keyboard Navigation
```
Tab:      Move between buttons and tabs
Enter:    Activate buttons
Escape:   (optional) Clear search
```

### Screen Reader Testing
- [ ] Headings properly marked
- [ ] Buttons have descriptive labels
- [ ] Form inputs have labels
- [ ] Status badges have clear text

### Color Contrast
- [ ] APPROVED (green) is readable
- [ ] PENDING (orange) is readable
- [ ] REJECTED (red) is readable
- [ ] All text meets WCAG standards

---

## Performance Benchmarks

**Expected Response Times:**

| Action | Expected | Max |
|--------|----------|-----|
| Load Dashboard | < 500ms | 1000ms |
| Fetch Pending | < 1000ms | 2000ms |
| Approve Button | < 500ms | 1000ms |
| Search Filter | < 100ms | 500ms |
| Tab Switch | < 200ms | 500ms |

---

## Common Test Issues & Solutions

### Issue: "403 Super admin access required"
**Solution:**
- Verify you're logged in as `admin@schlr.com`
- Check JWT token is valid in browser DevTools
- Token might be expired - log out and log back in

### Issue: Recruiters not showing up
**Solution:**
- Check MongoDB has recruiter data
- Verify recruiter status is correct:
  ```bash
  db.users.find({"user_type": "recruiter"}).count()
  ```
- Refresh page (might be cached data)

### Issue: Approve button does nothing
**Solution:**
- Check browser console (F12) for errors
- Check Network tab for failed requests
- Verify recruiter ID in URL parameters
- Check backend logs for errors

### Issue: Search not working
**Solution:**
- Clear search box and try again
- Search is case-insensitive - try different case
- Try searching by email instead of name
- Refresh page to clear filters

---

## Regression Testing

After any code changes, verify:

1. **Admin Access**
   - [ ] Super admin can access dashboard
   - [ ] Non-admin users cannot access
   - [ ] Correct 403 error for unauthorized users

2. **Recruiter Operations**
   - [ ] Can view pending recruiters
   - [ ] Can approve recruiters
   - [ ] Can reject recruiters
   - [ ] Approved recruiters can log in
   - [ ] Rejected recruiters cannot log in

3. **Data Integrity**
   - [ ] Database records updated correctly
   - [ ] No duplicate records created
   - [ ] Timestamps accurate
   - [ ] No data corruption

4. **UI Responsiveness**
   - [ ] Works on desktop (1920px+)
   - [ ] Works on tablet (768px)
   - [ ] Works on mobile (375px)
   - [ ] All buttons clickable

---

## Load Testing

### Test with Multiple Recruiters

1. Create 50+ test recruiter accounts
2. Open Admin Dashboard
3. Verify it loads and performs well
4. Try searching for specific recruiter
5. Check memory usage doesn't spike

---

## Security Testing

### Authentication
- [ ] Cannot access admin endpoints without token
- [ ] Token expiration is enforced
- [ ] Invalid tokens are rejected
- [ ] Only super admin can access

### Authorization
- [ ] Super admin can approve/reject
- [ ] Regular users cannot access endpoints
- [ ] Recruiters cannot access endpoints
- [ ] Students cannot access endpoints

### Data Protection
- [ ] Passwords never displayed in UI
- [ ] Passwords never exposed in API
- [ ] Sensitive data properly encrypted
- [ ] No XSS vulnerabilities

---

## Final Verification Checklist

Before considering the dashboard complete:

- [ ] All three recruiter tabs working
- [ ] Approve/reject functionality working
- [ ] Search across all tabs working
- [ ] Statistics updating correctly
- [ ] Analytics tab showing metrics
- [ ] Database records updating properly
- [ ] Error handling working
- [ ] UI responsive on all devices
- [ ] No console errors
- [ ] Performance acceptable
- [ ] Documentation complete
- [ ] API endpoints tested with cURL

---

**Test Date:** _____________  
**Tested By:** _____________  
**Status:** ✅ Ready for Production  


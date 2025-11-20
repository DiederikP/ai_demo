# Manual UI Testing Guide

## Prerequisites
- Backend running on http://localhost:8000
- Frontend running on http://localhost:3000

## Test Accounts

### Admin
- Email: `vaatje@zuljehemhebben.nl`
- Password: `123`

### Recruiter
- Email: `recruiter@recruiter-test.nl`
- Password: `123`

### Company Admin
- Email: `admin@techsolutions.nl`
- Password: `123`

## Testing Checklist

### 1. Login & Navigation

#### Company Portal Login
1. Go to http://localhost:3000/company/login
2. Enter `vaatje@zuljehemhebben.nl` / `123`
3. ✅ Should redirect to `/company/dashboard`
4. ✅ Should show navigation menu
5. ✅ Portal selector should show "Company" as active

#### Portal Switching
1. Click on portal selector (top left)
2. ✅ Should show 3 portals: Company, Recruiter, Candidate
3. Click "Recruiter"
4. ✅ Should navigate to `/recruiter/dashboard` (or show login if not authenticated)
5. Click "Candidate"
6. ✅ Should navigate to `/candidate/dashboard` (or show login if not authenticated)

#### Logout
1. Click user menu (top right)
2. Click "Uitloggen"
3. ✅ Should redirect to login page
4. ✅ Should clear session

### 2. Company Portal - Vacatures

#### View Vacatures
1. Go to `/company/dashboard?module=vacatures`
2. ✅ Should show list of vacancies
3. ✅ Should show active/inactive grouping

#### Create New Vacancy
1. Click "Nieuwe Vacature"
2. ✅ Should open vacancy form
3. Fill in all fields
4. Click "Opslaan"
5. ✅ Should save and redirect to vacancy detail
6. ✅ Should show success message

#### View Vacancy Details
1. Click on a vacancy
2. ✅ Should show vacancy details
3. ✅ Should show tabs: Overview, Analysis, Candidates, Results, Compare
4. ✅ Should show pipeline stages

#### Offer Candidate
1. Go to vacancy detail page
2. Click "Candidates" tab
3. Click "+ Kandidaat Aanbieden" button
4. ✅ Should open modal
5. ✅ Should show available candidates
6. Select one or more candidates
7. Click "Kandidaat(en) Aanbieden"
8. ✅ Should assign candidates to vacancy
9. ✅ Should show success message
10. ✅ Candidates should appear in vacancy candidates list

### 3. Company Portal - Kandidaten

#### View Kandidaten
1. Go to `/company/dashboard?module=kandidaten`
2. ✅ Should show list of candidates
3. ✅ Should show filter options (with/without vacancies)
4. ✅ Should show pagination if many candidates

#### Add New Candidate
1. Click "+ Nieuwe Kandidaat" button
2. ✅ Should open upload form
3. Upload resume file
4. Fill in candidate details
5. Click "Upload"
6. ✅ Should save candidate
7. ✅ Should show success message or duplicate warning

#### Duplicate Candidate Handling
1. Try to upload a candidate with existing email
2. ✅ Should show duplicate warning modal
3. ✅ Should show options: Overwrite, Force Create, Cancel
4. Test each option
5. ✅ Should handle appropriately

#### View Candidate Details
1. Click on a candidate
2. ✅ Should show candidate details page
3. ✅ Should show all fields
4. ✅ Should show assigned vacancies
5. ✅ Should show pipeline status

### 4. Recruiter Portal

#### Login
1. Go to `/company/login`
2. Enter `recruiter@recruiter-test.nl` / `123`
3. ✅ Should redirect to recruiter dashboard

#### View Assigned Vacancies
1. Go to `/recruiter/dashboard`
2. Click "Vacatures" in navigation
3. ✅ Should show assigned vacancies
4. ✅ Should show "Nieuwe Vacatures" checkbox
5. Check "Nieuwe Vacatures"
6. ✅ Should show unassigned vacancies
7. ✅ Should not show own company's vacancies

#### View Submitted Candidates
1. Click "Kandidaten" in navigation
2. ✅ Should show candidates submitted by recruiter
3. ✅ Should show status and job assignments

#### Add New Candidate
1. Click "+ Nieuwe Kandidaat"
2. ✅ Should open candidate form
3. Fill in all fields
4. Select a job
5. Click "Upload"
6. ✅ Should save candidate
7. ✅ Should automatically set `submitted_by_company_id`

#### Edit Candidate Company Note
1. Go to candidate detail page
2. ✅ Should show company note textarea
3. Edit company note
4. Click "Opslaan"
5. ✅ Should save note
6. ✅ Should show success message

### 5. Candidate Portal

#### Login
1. Go to `/company/login`
2. Use candidate email (if user exists) or admin to test
3. Navigate to candidate portal

#### View Applications
1. Go to `/candidate/dashboard`
2. ✅ Should show own applications
3. ✅ Should show pipeline status
4. ✅ Should show job details

#### View Targeted Jobs
1. ✅ Should show "Vacatures die bij jou passen" section
2. ✅ Should show job cards
3. Click "Bekijk Details"
4. ✅ Should navigate to job detail page

### 6. Evaluation Flow

#### Start Evaluation
1. Go to vacancy detail page
2. Select a candidate
3. Click "Start Evaluation"
4. ✅ Should open evaluation modal
5. ✅ Should show persona selection
6. ✅ Should show action selection
7. Select personas and actions
8. Click "Start"
9. ✅ Should show workflow visualization
10. ✅ Should show progress
11. ✅ Should show active personas
12. ✅ Should show debate start

#### View Results
1. Wait for evaluation to complete
2. ✅ Should show results
3. ✅ Should show evaluation tab
4. ✅ Should show debate tab
5. ✅ Should show LLM Judge tab (agent performance only)

### 7. Common UI Elements

#### Navigation
- ✅ All menu items work
- ✅ Active state highlights correctly
- ✅ Responsive design works (mobile/tablet)

#### Modals
- ✅ Open/close correctly
- ✅ Backdrop click closes
- ✅ Escape key closes
- ✅ Scroll works if content is long

#### Forms
- ✅ All inputs work
- ✅ Validation shows
- ✅ Submit buttons work
- ✅ Loading states show
- ✅ Error messages display

#### Buttons
- ✅ All action buttons work
- ✅ Disabled states work
- ✅ Loading states work
- ✅ Hover effects work

## Known Issues to Fix

1. ✅ Recruiter vacancies endpoint - Fixed NoneType comparison
2. Need to test all buttons and clicks manually
3. Need to verify all modals work correctly
4. Need to check responsive design


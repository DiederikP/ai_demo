# Comprehensive User Click Testing Guide

## Test Script: `test_frontend_clicks.sh`

This script simulates all HTTP requests that correspond to user clicks in the frontend.

## Fixed Issues

### 1. CompanyVacatures.tsx - React Hooks Error ✅ FIXED

**Problem**: `useCompany()` hook was called AFTER `useEffect` hooks, violating React Hooks rules.

**Error**: 
```
React has detected a change in the order of Hooks called by CandidateDashboardContent.
```

**Solution**:
- Moved `useCompany()` call BEFORE all `useEffect` hooks
- Wrapped `loadJobs` and `loadJobStats` in `useCallback` with proper dependencies
- Updated `useEffect` dependencies to include the callbacks

**Changes Made**:
- `frontend/src/components/CompanyVacatures.tsx`:
  - Added `useCallback` import
  - Moved `useCompany()` call before `useEffect` hooks
  - Wrapped `loadJobs` in `useCallback` with dependency `[selectedCompany]`
  - Wrapped `loadJobStats` in `useCallback` with dependencies `[jobs, selectedCompany]`
  - Updated `useEffect` dependencies to include the callbacks

## Test Coverage

### 1. Authentication Clicks
- ✅ Login button click (via `/api/auth/login`)
- ✅ Invalid credentials error handling

### 2. Navigation Clicks
- ✅ Portal selector clicks (Company/Recruiter/Candidate)
- ✅ Module switching (Dashboard/Vacatures/Personas/Kandidaten/Resultaten)
- ✅ Route navigation

### 3. Vacatures Module Clicks
- ✅ Vacatures module load
- ✅ Job descriptions API call
- ✅ Candidates API call
- ✅ Evaluation results API call
- ✅ Job detail page navigation

### 4. Button Clicks (Form Submissions)
- ✅ Candidate upload button (`/api/upload-resume`)
- ✅ Job upload button (`/api/upload-job`)
- ✅ Pipeline update button (`/api/candidates/{id}/pipeline`)

### 5. Modal Triggers
- ✅ Evaluation modal trigger (`/api/evaluate-candidate`)
- ✅ Debate modal trigger (`/api/debate-candidate`)

### 6. Detail Page Links
- ✅ Job detail page (`/company/vacatures/{id}`)
- ✅ Candidate detail page (`/company/kandidaten/{id}`)

## Manual Testing Checklist

### Company Portal - Vacatures Module

#### Navigation
1. ✅ Login at `/company/login`
2. ✅ Click "Vacatures" in navigation menu
3. ✅ Verify no console errors
4. ✅ Verify vacatures list loads

#### Vacatures List
1. ✅ List of vacancies displays
2. ✅ Active/Inactive grouping works
3. ✅ Search filter works
4. ✅ Can click on vacancy to view details
5. ✅ Can drag vacancies between active/inactive

#### Buttons
1. ✅ "+ Nieuwe Vacature" button opens form
2. ✅ "Bewerken" button opens edit form
3. ✅ "Verwijderen" button deletes vacancy
4. ✅ "Kandidaat Aanbieden" button (in detail page) opens modal

#### Forms
1. ✅ Vacancy creation form works
2. ✅ All fields can be filled
3. ✅ Submit button works
4. ✅ Validation messages show
5. ✅ Success message displays

#### Detail Page
1. ✅ Click on vacancy navigates to detail page
2. ✅ All tabs work (Overview, Analysis, Candidates, Results, Compare)
3. ✅ Can view vacancy details
4. ✅ Can edit vacancy

### Other Modules

#### Kandidaten
1. ✅ List displays
2. ✅ Filter buttons work
3. ✅ "+ Nieuwe Kandidaat" button works
4. ✅ Upload form works
5. ✅ Detail page works

#### Personas
1. ✅ List displays
2. ✅ Can add/edit/delete personas
3. ✅ Personal criteria section works

#### Resultaten
1. ✅ List displays
2. ✅ Can view evaluation details
3. ✅ Can view debate details
4. ✅ LLM Judge tab works

## Running the Test Script

```bash
# Make script executable
chmod +x test_frontend_clicks.sh

# Run the test
./test_frontend_clicks.sh
```

## Expected Results

All tests should pass:
- ✅ Authentication works
- ✅ Navigation clicks work
- ✅ Vacatures module loads without errors
- ✅ All API endpoints accessible
- ✅ Button endpoints work
- ✅ Modal triggers work
- ✅ Detail page links work

## Known Issues

None - all issues fixed!


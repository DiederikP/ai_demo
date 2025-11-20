# Vacatures Error Fix

## Problem
When clicking "Vacatures" in the navigation, an error occurs. The error is related to React Hooks order in `CompanyVacatures.tsx`.

## Root Cause
In `CompanyVacatures.tsx`, the `useCompany()` hook was called AFTER `useEffect` hooks, and functions `loadJobs` and `loadJobStats` were not properly memoized with `useCallback`, causing React Hooks order violations.

## Solution Applied

### 1. Fixed Hook Order ✅
- Moved `useCompany()` call BEFORE all `useEffect` hooks
- This ensures hooks are always called in the same order

### 2. Fixed Function Memoization ✅
- Wrapped `loadJobs` in `useCallback` with dependency `[selectedCompany]`
- Wrapped `loadJobStats` in `useCallback` with dependencies `[jobs, selectedCompany]`
- Updated `useEffect` dependencies to include the callbacks

### 3. Fixed Function Definitions ✅
- Functions are now defined BEFORE they are used in `useEffect` hooks
- This ensures proper hoisting and prevents "function used before declaration" errors

## Changes Made

### File: `frontend/src/components/CompanyVacatures.tsx`

1. **Added import**: `useCallback` from 'react'
2. **Moved `useCompany()` call**: Before all `useEffect` hooks
3. **Wrapped `loadJobs` in `useCallback`**: With dependency `[selectedCompany]`
4. **Wrapped `loadJobStats` in `useCallback`**: With dependencies `[jobs, selectedCompany]`
5. **Reordered code**: Functions defined before `useEffect` hooks that use them
6. **Updated `useEffect` dependencies**: Include the memoized callbacks

## Testing

### Automated Tests
- ✅ `test_frontend_clicks.sh` - Simulates HTTP requests for clicks
- ✅ `test_ui_interactive.sh` - Tests page loads and API endpoints

### Manual Testing Required
1. Open http://localhost:3000/company/login
2. Login with `vaatje@zuljehemhebben.nl` / `123`
3. Click "Vacatures" in navigation menu
4. Verify:
   - ✅ No console errors
   - ✅ Vacatures list loads
   - ✅ No React Hooks warnings
   - ✅ All buttons work

## Verification

After the fix, the component structure is:
```typescript
1. useState hooks
2. useCompany() hook  // ✅ Moved here
3. useCallback hooks (loadJobs, loadJobStats)  // ✅ Defined here
4. useEffect hooks  // ✅ Use the callbacks
5. Other functions
6. Render
```

This ensures:
- ✅ All hooks called in consistent order
- ✅ No conditional hook calls
- ✅ Proper dependency tracking
- ✅ No "function used before declaration" errors

## Expected Behavior

When clicking "Vacatures":
1. ✅ Navigation updates URL to `/company/dashboard?module=vacatures`
2. ✅ `CompanyVacatures` component mounts
3. ✅ `useCompany()` hook is called first
4. ✅ `loadJobs` is called via `useEffect`
5. ✅ Jobs are fetched and displayed
6. ✅ No console errors
7. ✅ No React Hooks warnings


# Render Deployment Checklist

## Current Status
- ✅ `render.yaml` exists and is configured
- ✅ Database migration script exists (`sync_to_render_db.py`)
- ⚠️  Need to commit test branch changes
- ⚠️  Need to check JWT secret key configuration
- ⚠️  Need to verify all environment variables are set in Render dashboard

## Pre-Deployment Steps

### 1. Git Operations
```bash
# On test branch - commit all changes
git add .
git commit -m "Complete multi-portal system with fixes"

# Push test branch
git push origin test

# Switch to main branch
git checkout main

# Merge test into main
git merge test

# Push to main
git push origin main
```

### 2. Environment Variables Required in Render Dashboard

#### Backend Service (`ai-hiring-backend`):
- ✅ `OPENAI_API_KEY` - (Set in Render dashboard, sync: false)
- ✅ `AZURE_DOC_INTEL_ENDPOINT` - (Optional, sync: false)
- ✅ `AZURE_DOC_INTEL_KEY` - (Optional, sync: false)
- ✅ `DATABASE_URL` - (Auto-set from database connection)
- ✅ `ENVIRONMENT=production` - (Already in render.yaml)
- ✅ `PORT=8000` - (Already in render.yaml)
- ✅ `CORS_ORIGINS=https://ai-demo-frontend.onrender.com` - (Already in render.yaml)
- ⚠️  **`SECRET_KEY`** - **YOU NEED TO SET THIS** (for JWT token signing)

#### Frontend Service (`ai-demo-frontend`):
- ✅ `NEXT_PUBLIC_BACKEND_URL=https://ai-hiring-backend.onrender.com` - (Already in render.yaml)
- ✅ `NEXT_PUBLIC_ENVIRONMENT=production` - (Already in render.yaml)

### 3. JWT Secret Key Setup

**ACTION REQUIRED**: You need to generate and set a secure JWT secret key:

```bash
# Generate a secure random secret key
python3 -c "import secrets; print(secrets.token_urlsafe(32))"
```

Then in Render Dashboard:
1. Go to `ai-hiring-backend` service
2. Navigate to "Environment" tab
3. Add new environment variable:
   - Key: `JWT_SECRET_KEY`
   - Value: (paste the generated secret key)
   - Don't check "Sync" checkbox

**Note**: The `render.yaml` file has been updated to include `JWT_SECRET_KEY` in the environment variables list, but you still need to set the actual value in the Render dashboard.

### 4. Database Migration

After deployment, you'll need to:
1. Wait for Render to create the PostgreSQL database
2. The database will be automatically created via `render.yaml`
3. Run the migration script to copy data from local SQLite to Render PostgreSQL:

```bash
# Set your Render database connection string
export DATABASE_URL="postgresql://user:pass@host:port/dbname"

# Run migration script
cd backend
python sync_to_render_db.py
```

**Note**: Get the database URL from Render Dashboard → Database → Connections tab.

### 5. Hardcoded URLs Check

Found hardcoded URLs that need to be checked:
- ⚠️  `frontend/src/app/api/debate/route.ts` line 44: `http://localhost:8000/upload-resume`
- ⚠️  `frontend/src/app/api/upload-job/route.ts` line 5: `http://localhost:8000/job-descriptions`
- ⚠️  `frontend/src/app/api/upload-job/route.ts` line 31: `http://localhost:8000/upload-job-description`

**Fix**: These should use `process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL`

### 6. Post-Deployment Verification

After deployment, verify:
1. ✅ Backend is accessible at `https://ai-hiring-backend.onrender.com/docs`
2. ✅ Frontend is accessible at `https://ai-demo-frontend.onrender.com`
3. ✅ Database connection works (check backend logs)
4. ✅ Authentication works (try logging in)
5. ✅ Jobs/candidates load correctly
6. ✅ API calls from frontend to backend work

## Issues to Fix Before Deployment

### Critical (Must Fix):
1. ✅ **JWT Secret Key** - Added to `render.yaml`, but you still need to set the value in Render dashboard
2. ✅ **Hardcoded Backend URLs** - Fixed 3 files with hardcoded `localhost:8000` URLs
   - `frontend/src/app/api/debate/route.ts` - Now uses `BACKEND_URL` environment variable
   - `frontend/src/app/api/upload-job/route.ts` - Now uses `BACKEND_URL` environment variable (4 occurrences fixed)

### Important (Should Fix):
1. Ensure all environment variables are set in Render dashboard
2. Test database migration script with production database URL
3. Verify CORS configuration allows frontend domain

### Nice to Have:
1. Set up health check monitoring
2. Configure auto-scaling if needed
3. Set up logging/monitoring

## Files Changed That Need to be Committed

- 28 modified files (see `git diff --stat` output)
- Multiple new files (API routes, components, contexts)
- Database migration script
- Test scripts (should be excluded from main branch)

## Questions for You:

1. **Do you want to commit all current changes to test branch first?**
   - This includes all the multi-portal system changes

2. **Do you have a Render account set up already?**
   - Need to create services and database if not

3. **Do you want to keep test scripts in main branch?**
   - Currently they're untracked, might want to exclude them

4. **What's your preferred method for setting SECRET_KEY?**
   - Generate it now, or do you want to do it in Render dashboard?


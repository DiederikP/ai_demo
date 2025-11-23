# Deployment Checklist for Render

## Pre-Deployment Steps

### 1. Code Status
- [x] All changes are on `test` branch
- [ ] Merge `test` branch to `main` branch
- [ ] Commit all uncommitted changes
- [ ] Push to remote repository

### 2. Environment Variables (Set in Render Dashboard)

#### Backend Service (`ai-hiring-backend`):
- [ ] `OPENAI_API_KEY` - Your OpenAI API key
- [ ] `AZURE_DOC_INTEL_ENDPOINT` - Azure Document Intelligence endpoint (optional)
- [ ] `AZURE_DOC_INTEL_KEY` - Azure Document Intelligence key (optional)
- [ ] `JWT_SECRET_KEY` - Generate a secure random string (e.g., `openssl rand -hex 32`)
- [x] `DATABASE_URL` - Automatically set from database connection
- [x] `ENVIRONMENT` - Set to `production` (already in render.yaml)
- [x] `PORT` - Set to `8000` (already in render.yaml)
- [x] `CORS_ORIGINS` - Set to frontend URL (already in render.yaml)

#### Frontend Service (`ai-demo-frontend`):
- [x] `NEXT_PUBLIC_BACKEND_URL` - Set to backend URL (already in render.yaml)
- [x] `NEXT_PUBLIC_ENVIRONMENT` - Set to `production` (already in render.yaml)

### 3. Database Setup
- [x] PostgreSQL database configured in render.yaml (`ai-hiring-db`)
- [ ] Database tables will be created automatically on first run
- [ ] Run user setup script if needed (optional, for initial admin users)

### 4. Required Actions Before Deployment

#### A. Merge to Main Branch
```bash
# Switch to main branch
git checkout main

# Merge test branch
git merge test

# Push to remote
git push origin main
```

#### B. Generate JWT Secret Key
```bash
# Generate a secure JWT secret key
openssl rand -hex 32
```
Copy this value and set it as `JWT_SECRET_KEY` in Render dashboard.

#### C. Set Environment Variables in Render
1. Go to Render Dashboard
2. Navigate to `ai-hiring-backend` service
3. Go to "Environment" tab
4. Add the following environment variables:
   - `OPENAI_API_KEY` (your OpenAI API key)
   - `JWT_SECRET_KEY` (generated secret key)
   - `AZURE_DOC_INTEL_ENDPOINT` (optional, if using Azure)
   - `AZURE_DOC_INTEL_KEY` (optional, if using Azure)

### 5. Deployment Configuration

#### render.yaml Status
- [x] Backend service configured
- [x] Frontend service configured
- [x] Database configured
- [x] Health check paths set
- [x] Build commands configured
- [x] Start commands configured

### 6. Post-Deployment Verification

After deployment, verify:
- [ ] Backend health check: `https://ai-hiring-backend.onrender.com/docs`
- [ ] Frontend loads: `https://ai-demo-frontend.onrender.com`
- [ ] Database connection works
- [ ] Authentication works (login page)
- [ ] Can upload job descriptions
- [ ] Can upload candidates
- [ ] Can run evaluations
- [ ] Can run debates

### 7. Optional: Initial User Setup

If you need to create initial users, you can:
1. SSH into the backend service
2. Run the setup script:
   ```bash
   python setup_users.py
   ```

Or use the API to create users after deployment.

## Current Status

- **Branch**: `test` (needs to be merged to `main`)
- **Uncommitted Changes**: Yes (needs to be committed)
- **render.yaml**: ✅ Configured correctly
- **Dependencies**: ✅ All listed in requirements.txt and package.json
- **Database**: ✅ PostgreSQL configured

## Next Steps

1. **Commit all changes**:
   ```bash
   git add .
   git commit -m "Prepare for production deployment"
   ```

2. **Merge to main**:
   ```bash
   git checkout main
   git merge test
   git push origin main
   ```

3. **Set environment variables in Render dashboard**

4. **Deploy** (Render will auto-deploy when you push to main if auto-deploy is enabled)


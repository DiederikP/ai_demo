# Frontend Submodule Fix for Render

## The Problem
Your `frontend` folder is a **Git submodule**, not part of the main repository. Render doesn't automatically initialize submodules, so it can't find `frontend/package.json`.

## Solution Options

### Option 1: Initialize Submodule in Build Command (EASIEST)

Update your Render Frontend Service build command to initialize the submodule:

**In Render Dashboard → Frontend Service → Settings:**

**Build Command:**
```bash
git submodule update --init --recursive && cd frontend && npm install && npm run build
```

**Start Command:**
```bash
cd frontend && npm run start
```

**Root Directory:** Leave empty (root of repo)

This will:
1. Initialize and update the submodule
2. Change to frontend directory
3. Install dependencies and build

### Option 2: Deploy Frontend as Separate Repository

If the frontend is a separate GitHub repository:

1. **Create New Service in Render**
   - Connect to the **frontend repository** (not the main repo)
   - Root Directory: Leave empty (or `.`)
   - Build Command: `npm install && npm run build`
   - Start Command: `npm run start`

2. **Environment Variables:**
   - `NEXT_PUBLIC_BACKEND_URL = https://ai-demo-k78k.onrender.com`
   - `NEXT_PUBLIC_ENVIRONMENT = production`

### Option 3: Remove Submodule and Commit Directly (PERMANENT FIX)

If you want frontend to be part of the main repo:

1. **Remove submodule:**
   ```bash
   git submodule deinit frontend
   git rm frontend
   ```

2. **Add frontend files directly:**
   ```bash
   git add frontend/
   git commit -m "Move frontend from submodule to direct files"
   git push
   ```

3. **Then in Render:**
   - Root Directory: `frontend`
   - Build Command: `npm install && npm run build`
   - Start Command: `npm run start`

## Recommended: Option 1

**Update your Render Frontend Service:**

1. Go to Render Dashboard → Your Frontend Service
2. Settings → Build & Deploy
3. **Build Command:** 
   ```
   git submodule update --init --recursive && cd frontend && npm install && npm run build
   ```
4. **Start Command:**
   ```
   cd frontend && npm run start
   ```
5. **Root Directory:** Leave empty
6. Save and redeploy

This should work immediately!


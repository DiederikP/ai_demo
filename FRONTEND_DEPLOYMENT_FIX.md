# Frontend Deployment Fix - Render Configuration

## The Problem
Render is detecting Python instead of Node.js, and the Root Directory isn't set correctly.

## Solution: Manual Configuration in Render Dashboard

### Step 1: Delete the Current Service (if exists)
If you already created a service that's failing:
1. Go to your Render dashboard
2. Find the failing frontend service
3. Settings → Delete Service

### Step 2: Create New Web Service

1. **Go to Render Dashboard**
   - https://dashboard.render.com
   - Click "New +" → "Web Service"

2. **Connect Repository**
   - Select: `ai_demo`
   - Click "Connect"

3. **Configure Service Settings**

   **Basic Settings:**
   - **Name:** `ai-demo-frontend`
   - **Region:** Choose closest to you
   - **Branch:** `main`
   - **Root Directory:** `frontend` ⚠️ **CRITICAL: Must be `frontend`**
   - **Runtime:** `Node` (should show Node.js, NOT Python)

   **Build & Deploy:**
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm run start`

4. **Environment Variables**
   Click "Advanced" → Add these:
   
   ```
   NEXT_PUBLIC_BACKEND_URL = https://ai-demo-k78k.onrender.com
   ```
   
   ```
   NEXT_PUBLIC_ENVIRONMENT = production
   ```

5. **Create Service**
   - Click "Create Web Service"
   - Wait for deployment

## Why This Happened

Render auto-detected Python because:
- There's a `requirements.txt` in the root
- There's a `render.yaml` that might be confusing it
- The Root Directory wasn't set to `frontend`

## Verification

After deployment, check:
1. ✅ Build logs show "Using Node.js version"
2. ✅ Build completes successfully
3. ✅ Service is "Live"
4. ✅ Frontend URL loads (not a white screen)

## Alternative: If Root Directory Setting Doesn't Work

If setting Root Directory to `frontend` doesn't work, try:

**Build Command:**
```bash
cd frontend && npm install && npm run build
```

**Start Command:**
```bash
cd frontend && npm run start
```

**Root Directory:** Leave empty (root of repo)

But the preferred method is setting Root Directory to `frontend`.


# Frontend Deployment to Render - Step by Step

## Your Backend URL
**Backend:** https://ai-demo-k78k.onrender.com/

## Step-by-Step Instructions

### Option 1: Using Render Dashboard (Recommended)

1. **Go to Render Dashboard**
   - Visit https://dashboard.render.com
   - Click "New +" → "Web Service"

2. **Connect Your Repository**
   - Connect your GitHub account if not already connected
   - Select your repository: `ai_demo`
   - Click "Connect"

3. **Configure the Service**
   - **Name:** `ai-demo-frontend` (or any name you prefer)
   - **Region:** Choose closest to your users
   - **Branch:** `main`
   - **Root Directory:** `frontend` ⚠️ **IMPORTANT: Set this to `frontend`**
   - **Runtime:** `Node` (should auto-detect)
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm run start`

4. **Set Environment Variables**
   Click "Advanced" → "Add Environment Variable" and add:
   
   ```
   NEXT_PUBLIC_BACKEND_URL = https://ai-demo-k78k.onrender.com
   ```
   
   ```
   NEXT_PUBLIC_ENVIRONMENT = production
   ```

5. **Deploy**
   - Click "Create Web Service"
   - Wait for build to complete (5-10 minutes)
   - Your frontend will be live at: `https://ai-demo-frontend.onrender.com` (or your chosen name)

### Option 2: Using render.yaml (Automatic)

I've updated your `render.yaml` file. If Render supports automatic deployment from this file:

1. The frontend service is already configured
2. Just push to GitHub and Render should detect it
3. Make sure environment variables are set in the dashboard

## Important Settings Summary

| Setting | Value |
|---------|-------|
| **Root Directory** | `frontend` |
| **Build Command** | `npm install && npm run build` |
| **Start Command** | `npm run start` |
| **Environment Variable** | `NEXT_PUBLIC_BACKEND_URL=https://ai-demo-k78k.onrender.com` |
| **Environment Variable** | `NEXT_PUBLIC_ENVIRONMENT=production` |

## After Deployment

1. **Update Backend CORS** (if needed)
   - Go to your backend service settings
   - Add environment variable:
     ```
     CORS_ORIGINS = https://your-frontend-url.onrender.com
     ```
   - Redeploy backend

2. **Test the Connection**
   - Visit your frontend URL
   - Try uploading a resume or creating a job
   - Check browser console for any errors

## Troubleshooting

### Build Fails
- Check that Root Directory is set to `frontend`
- Verify Node version (should be >= 18.0.0)
- Check build logs for specific errors

### Frontend Can't Connect to Backend
- Verify `NEXT_PUBLIC_BACKEND_URL` is set correctly
- Check backend is running: https://ai-demo-k78k.onrender.com/docs
- Check CORS settings in backend

### White Screen
- Check browser console for errors
- Verify environment variables are set
- Check that build completed successfully

## Quick Test

Once deployed, test:
1. Frontend loads: `https://your-frontend.onrender.com`
2. Backend API docs: `https://ai-demo-k78k.onrender.com/docs`
3. Connection works: Try uploading a file from frontend

## Next Steps

After frontend is deployed:
1. Update backend CORS to allow your frontend URL
2. Test the full flow: Upload resume → Evaluate candidate
3. Share your frontend URL with users!


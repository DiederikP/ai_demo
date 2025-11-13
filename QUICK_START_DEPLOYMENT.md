# Quick Start: Deploy to Production

This is a condensed guide. For detailed instructions, see [PRODUCTION_DEPLOYMENT.md](./PRODUCTION_DEPLOYMENT.md).

## 🚀 5-Minute Deployment

### 1. Push to GitHub
```bash
git init
git add .
git commit -m "Ready for deployment"
git remote add origin https://github.com/YOUR_USERNAME/ai-hiring-assistant.git
git push -u origin main
git checkout -b develop
git push -u origin develop
```

### 2. Deploy Backend (Railway - Easiest)

1. Go to [railway.app](https://railway.app) → Sign up with GitHub
2. New Project → Deploy from GitHub repo
3. Select your repo
4. Add PostgreSQL database (New → Database → PostgreSQL)
5. Add environment variables:
   - `OPENAI_API_KEY`: Your key
   - `ENVIRONMENT`: `production`
   - `DATABASE_URL`: Auto-set by Railway
6. Copy backend URL (e.g., `https://your-app.railway.app`)

### 3. Deploy Frontend (Vercel)

1. Go to [vercel.com](https://vercel.com) → Sign up with GitHub
2. Add New Project → Import your repo
3. Configure:
   - Root Directory: `frontend`
   - Framework: Next.js (auto-detected)
4. Add environment variables:
   - `OPENAI_API_KEY`: Your key
   - `NEXT_PUBLIC_BACKEND_URL`: Backend URL from Step 2
   - `NEXT_PUBLIC_ENVIRONMENT`: `production`
5. Deploy!

### 4. Set Up Test Environment

**In Vercel:**
1. Settings → Git → Add branch: `develop`
2. Add environment variables for `develop` branch (same as above, but `ENVIRONMENT=test`)

**In Railway:**
1. Create a second service for test (or use same service with different environment)

### 5. Configure CI/CD (Optional)

1. GitHub → Settings → Secrets → Actions
2. Add:
   - `VERCEL_TOKEN` (from Vercel settings)
   - `VERCEL_ORG_ID` (from Vercel settings)
   - `VERCEL_PROJECT_ID_PROD` (from Vercel project)
   - `VERCEL_PROJECT_ID_TEST` (from Vercel project)
   - `OPENAI_API_KEY`
   - `TEST_BACKEND_URL`
   - `PROD_BACKEND_URL`

Now:
- Push to `main` → Auto-deploys to production
- Push to `develop` → Auto-deploys to test

## ✅ Verify Deployment

- **Production Frontend**: `https://your-app.vercel.app`
- **Backend API Docs**: `https://your-backend.railway.app/docs`
- **Test Frontend**: `https://your-app-git-develop.vercel.app`

## 📋 Branch Strategy

- **`main`** → Production (auto-deploys)
- **`develop`** → Test (auto-deploys)
- **Feature branches** → Merge to `develop` first

## 🆘 Need Help?

See [PRODUCTION_DEPLOYMENT.md](./PRODUCTION_DEPLOYMENT.md) for:
- Detailed step-by-step instructions
- Troubleshooting guide
- Platform-specific configurations
- Advanced setup options

---

**Ready?** Start with Step 1 above! 🎯


# Deployment Checklist

Quick checklist for deploying to production. Follow this in order.

## Pre-Deployment

- [ ] **Backup current codebase** (already done: `backup_20251112_185323.zip`)
- [ ] **Review all environment variables** needed
- [ ] **Test locally** to ensure everything works
- [ ] **Commit all changes** to git

## Step 1: GitHub Setup

- [ ] Create GitHub repository
- [ ] Push code to GitHub
- [ ] Create `develop` branch for testing
- [ ] Set up branch protection (optional but recommended)

## Step 2: Backend Deployment

### Choose Platform: Railway or Render

#### Railway:
- [ ] Create Railway account
- [ ] Connect GitHub repository
- [ ] Deploy backend service
- [ ] Add PostgreSQL database
- [ ] Set environment variables:
  - [ ] `OPENAI_API_KEY`
  - [ ] `AZURE_DOC_INTEL_ENDPOINT` (optional)
  - [ ] `AZURE_DOC_INTEL_KEY` (optional)
  - [ ] `ENVIRONMENT=production`
  - [ ] `DATABASE_URL` (auto-set by Railway)
- [ ] Copy backend URL

#### Render:
- [ ] Create Render account
- [ ] Create Web Service from GitHub
- [ ] Create PostgreSQL database
- [ ] Link database to web service
- [ ] Set environment variables (same as Railway)
- [ ] Copy backend URL

## Step 3: Frontend Deployment (Vercel)

- [ ] Create Vercel account
- [ ] Import GitHub repository
- [ ] Configure project:
  - [ ] Root directory: `frontend`
  - [ ] Framework: Next.js
- [ ] Set environment variables for **Production** (main branch):
  - [ ] `OPENAI_API_KEY`
  - [ ] `NEXT_PUBLIC_BACKEND_URL` (from Step 2)
  - [ ] `NEXT_PUBLIC_ENVIRONMENT=production`
- [ ] Deploy production
- [ ] Configure **Test** environment (develop branch):
  - [ ] Add `develop` branch in Vercel settings
  - [ ] Set environment variables for test:
    - [ ] `OPENAI_API_KEY`
    - [ ] `NEXT_PUBLIC_BACKEND_URL` (test backend URL)
    - [ ] `NEXT_PUBLIC_ENVIRONMENT=test`
- [ ] Copy frontend URLs (production and test)

## Step 4: Database Initialization

- [ ] Verify database is accessible
- [ ] Check backend logs for table creation
- [ ] Verify default personas are seeded
- [ ] Test database connection from backend

## Step 5: GitHub Actions Setup

- [ ] Go to GitHub repository → Settings → Secrets
- [ ] Add secrets:
  - [ ] `OPENAI_API_KEY`
  - [ ] `VERCEL_TOKEN`
  - [ ] `VERCEL_ORG_ID`
  - [ ] `VERCEL_PROJECT_ID_PROD`
  - [ ] `VERCEL_PROJECT_ID_TEST`
  - [ ] `TEST_BACKEND_URL`
  - [ ] `PROD_BACKEND_URL`
- [ ] Test workflow by pushing to `develop` branch
- [ ] Verify test deployment works
- [ ] Test workflow by pushing to `main` branch
- [ ] Verify production deployment works

## Step 6: Testing

### Production Testing:
- [ ] Visit production frontend URL
- [ ] Test job upload
- [ ] Test candidate upload
- [ ] Test evaluation
- [ ] Test expert debate
- [ ] Check backend API docs: `/docs`
- [ ] Verify database is saving data

### Test Environment Testing:
- [ ] Push test change to `develop` branch
- [ ] Verify auto-deployment to test
- [ ] Test changes in test environment
- [ ] Verify test and production are separate

## Step 7: Final Configuration

- [ ] Update CORS settings if needed
- [ ] Set up custom domain (optional)
- [ ] Configure monitoring (optional)
- [ ] Set up error tracking (optional)
- [ ] Document production URLs
- [ ] Share access with team (if applicable)

## Post-Deployment

- [ ] Monitor first few deployments
- [ ] Check error logs
- [ ] Verify all features work
- [ ] Set up regular backups
- [ ] Document any custom configurations

## Quick Links Reference

After deployment, save these URLs:

**Production:**
- Frontend: `https://________________.vercel.app`
- Backend: `https://________________.railway.app` or `.onrender.com`
- API Docs: `https://________________/docs`

**Test:**
- Frontend: `https://________________-git-develop.vercel.app`
- Backend: `https://________________.railway.app` or `.onrender.com`

**GitHub:**
- Repository: `https://github.com/________________/________________`
- Actions: `https://github.com/________________/________________/actions`

---

## Troubleshooting Quick Reference

| Issue | Solution |
|-------|----------|
| Backend won't start | Check DATABASE_URL and PORT environment variables |
| CORS errors | Set CORS_ORIGINS to frontend URL |
| Frontend can't connect | Verify NEXT_PUBLIC_BACKEND_URL is correct |
| Database errors | Check DATABASE_URL connection string |
| Build fails | Check Node.js version and dependencies |

---

**Status**: Ready to deploy! ✅

Follow `PRODUCTION_DEPLOYMENT.md` for detailed instructions.


# Production Deployment Guide

Complete guide for deploying the AI Hiring Assistant to production with separate test and production environments.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Architecture Overview](#architecture-overview)
3. [Step 1: GitHub Repository Setup](#step-1-github-repository-setup)
4. [Step 2: Backend Deployment](#step-2-backend-deployment)
5. [Step 3: Frontend Deployment](#step-3-frontend-deployment)
6. [Step 4: Database Setup](#step-4-database-setup)
7. [Step 5: Environment Configuration](#step-5-environment-configuration)
8. [Step 6: CI/CD Setup](#step-6-cicd-setup)
9. [Step 7: Testing Your Deployment](#step-7-testing-your-deployment)
10. [Branch Strategy](#branch-strategy)
11. [Troubleshooting](#troubleshooting)

---

## Prerequisites

Before starting, ensure you have:

- ✅ GitHub account
- ✅ Vercel account (for frontend)
- ✅ Railway or Render account (for backend)
- ✅ OpenAI API key
- ✅ Azure Document Intelligence credentials (optional)
- ✅ Domain name (optional, for custom domains)

---

## Architecture Overview

```
┌─────────────────┐
│   GitHub Repo   │
│  (main/prod)    │
│  (develop/test) │
└────────┬────────┘
         │
         ├─────────────────┬─────────────────┐
         │                 │                 │
         ▼                 ▼                 ▼
    ┌─────────┐      ┌──────────┐     ┌──────────┐
    │ Vercel  │      │ Railway/ │     │PostgreSQL│
    │Frontend │◄────►│  Render  │◄────│ Database │
    │         │      │ Backend  │     │          │
    └─────────┘      └──────────┘     └──────────┘
```

**Environments:**
- **Test**: `develop` branch → Test deployments
- **Production**: `main` branch → Production deployments

---

## Step 1: GitHub Repository Setup

### 1.1 Initialize Git Repository (if not already done)

```bash
cd /Users/diederikpondman/Documents/ai_demo
git init
git add .
git commit -m "Initial commit - ready for deployment"
```

### 1.2 Create GitHub Repository

1. Go to [GitHub](https://github.com/new)
2. Create a new repository (e.g., `ai-hiring-assistant`)
3. **Do NOT** initialize with README, .gitignore, or license

### 1.3 Push to GitHub

```bash
git remote add origin https://github.com/YOUR_USERNAME/ai-hiring-assistant.git
git branch -M main
git push -u origin main
```

### 1.4 Create Develop Branch for Testing

```bash
git checkout -b develop
git push -u origin develop
```

---

## Step 2: Backend Deployment

Choose one of the following platforms:

### Option A: Railway (Recommended)

#### 2.1 Create Railway Account
1. Go to [railway.app](https://railway.app)
2. Sign up with GitHub
3. Create a new project

#### 2.2 Deploy Backend
1. Click "New Project" → "Deploy from GitHub repo"
2. Select your repository
3. Railway will auto-detect the Python backend
4. Add environment variables (see [Step 5](#step-5-environment-configuration))
5. Add PostgreSQL database:
   - Click "New" → "Database" → "Add PostgreSQL"
   - Railway will automatically set `DATABASE_URL`

#### 2.3 Get Backend URL
- Railway provides a URL like: `https://your-app.railway.app`
- Copy this URL for frontend configuration

### Option B: Render

#### 2.1 Create Render Account
1. Go to [render.com](https://render.com)
2. Sign up with GitHub

#### 2.2 Deploy Backend
1. Click "New" → "Web Service"
2. Connect your GitHub repository
3. Configure:
   - **Name**: `ai-hiring-backend`
   - **Environment**: `Python 3`
   - **Build Command**: `cd backend && pip install -r requirements.txt`
   - **Start Command**: `cd backend && uvicorn main:app --host 0.0.0.0 --port $PORT`
   - **Root Directory**: Leave empty (or set to project root)

#### 2.3 Add PostgreSQL Database
1. Click "New" → "PostgreSQL"
2. Configure:
   - **Name**: `ai-hiring-db`
   - **Database**: `ai_hiring`
   - **User**: `ai_hiring_user`
   - **Plan**: Starter (free tier available)

#### 2.4 Link Database to Backend
1. In your web service settings
2. Go to "Environment" tab
3. Add environment variable:
   - **Key**: `DATABASE_URL`
   - **Value**: Copy from PostgreSQL service's "Internal Database URL"

#### 2.5 Get Backend URL
- Render provides a URL like: `https://ai-hiring-backend.onrender.com`
- Copy this URL for frontend configuration

---

## Step 3: Frontend Deployment

### 3.1 Deploy to Vercel

#### 3.1.1 Create Vercel Account
1. Go to [vercel.com](https://vercel.com)
2. Sign up with GitHub

#### 3.1.2 Deploy Production Frontend
1. Click "Add New Project"
2. Import your GitHub repository
3. Configure:
   - **Framework Preset**: Next.js
   - **Root Directory**: `frontend`
   - **Build Command**: `npm run build` (auto-detected)
   - **Output Directory**: `.next` (auto-detected)
   - **Install Command**: `npm install`

4. Add Environment Variables:
   - `OPENAI_API_KEY`: Your OpenAI API key
   - `NEXT_PUBLIC_BACKEND_URL`: Your backend URL (from Step 2)
   - `NEXT_PUBLIC_ENVIRONMENT`: `production`

5. Click "Deploy"

#### 3.1.3 Create Test Environment
1. In Vercel dashboard, go to your project
2. Go to "Settings" → "Git"
3. Add branch: `develop`
4. Configure environment variables for `develop` branch:
   - `OPENAI_API_KEY`: Your OpenAI API key (can be same or different)
   - `NEXT_PUBLIC_BACKEND_URL`: Your test backend URL
   - `NEXT_PUBLIC_ENVIRONMENT`: `test`

---

## Step 4: Database Setup

### 4.1 Initialize Database Tables

The database tables will be created automatically on first backend startup. However, you can manually initialize:

```bash
# Connect to your production database
# For Railway:
railway run python -c "from backend.main import Base, engine; Base.metadata.create_all(bind=engine)"

# For Render:
# Use the database connection string to connect via psql or a database client
```

### 4.2 Seed Initial Data

The backend automatically seeds default personas and handlers on startup. If you need to manually seed:

```bash
# The seeding happens automatically in main.py on startup
# Check backend/main.py for seed_database() function
```

---

## Step 5: Environment Configuration

### 5.1 Backend Environment Variables

Set these in your backend hosting platform (Railway/Render):

#### Required:
- `OPENAI_API_KEY`: Your OpenAI API key
- `DATABASE_URL`: Automatically set by Railway/Render (PostgreSQL connection string)
- `ENVIRONMENT`: `production` or `test`
- `PORT`: Usually set automatically by platform

#### Optional:
- `AZURE_DOC_INTEL_ENDPOINT`: Azure Document Intelligence endpoint
- `AZURE_DOC_INTEL_KEY`: Azure Document Intelligence key
- `DEBUG`: `False` for production, `True` for test
- `CORS_ORIGINS`: Your frontend URL (e.g., `https://your-app.vercel.app`)

### 5.2 Frontend Environment Variables (Vercel)

#### Production (main branch):
- `OPENAI_API_KEY`: Your OpenAI API key
- `NEXT_PUBLIC_BACKEND_URL`: Production backend URL
- `NEXT_PUBLIC_ENVIRONMENT`: `production`

#### Test (develop branch):
- `OPENAI_API_KEY`: Your OpenAI API key (can be same or different)
- `NEXT_PUBLIC_BACKEND_URL`: Test backend URL
- `NEXT_PUBLIC_ENVIRONMENT`: `test`

### 5.3 Setting Environment Variables in Vercel

1. Go to your project in Vercel
2. Click "Settings" → "Environment Variables"
3. Add each variable
4. Select which environments to apply to:
   - Production (main branch)
   - Preview (all branches)
   - Development (local)

---

## Step 6: CI/CD Setup

### 6.1 GitHub Secrets Configuration

Go to your GitHub repository → Settings → Secrets and variables → Actions

Add the following secrets:

#### Required Secrets:
- `OPENAI_API_KEY`: Your OpenAI API key
- `VERCEL_TOKEN`: Get from Vercel → Settings → Tokens
- `VERCEL_ORG_ID`: Get from Vercel → Settings → General
- `VERCEL_PROJECT_ID_PROD`: Get from Vercel project settings (Production project)
- `VERCEL_PROJECT_ID_TEST`: Get from Vercel project settings (Test project)
- `TEST_BACKEND_URL`: Your test backend URL
- `PROD_BACKEND_URL`: Your production backend URL

### 6.2 How to Get Vercel Tokens

1. Go to [Vercel Settings](https://vercel.com/account/tokens)
2. Create a new token
3. Copy the token value
4. For Org ID and Project ID:
   - Go to your project settings
   - Check the URL or API response

### 6.3 Workflow Behavior

The GitHub Actions workflow (`.github/workflows/deploy.yml`) will:

- **On push to `main`**: Deploy to production
- **On push to `develop`**: Deploy to test
- **On pull request**: Run tests only (no deployment)

---

## Step 7: Testing Your Deployment

### 7.1 Test Production Environment

1. Visit your production frontend URL
2. Test key features:
   - Upload a job description
   - Upload a candidate CV
   - Run an evaluation
   - Check expert debate functionality

### 7.2 Test Environment

1. Make changes on `develop` branch
2. Push to GitHub
3. Verify test deployment updates automatically
4. Test changes in test environment
5. Merge to `main` when ready for production

### 7.3 Health Checks

- **Backend API Docs**: `https://your-backend-url/docs`
- **Backend Health**: `https://your-backend-url/` (should return API info)
- **Frontend**: `https://your-frontend-url.vercel.app`

---

## Branch Strategy

### Main Branch (Production)
- ✅ Stable, tested code
- ✅ Auto-deploys to production
- ✅ Protected branch (recommended)
- ✅ Requires pull request reviews

### Develop Branch (Test)
- ✅ Development and testing
- ✅ Auto-deploys to test environment
- ✅ Merge to main after testing

### Feature Branches
- ✅ Create from `develop`
- ✅ Merge back to `develop` after review
- ✅ Never deploy directly

### Recommended Workflow:

```bash
# 1. Create feature branch
git checkout -b feature/new-feature develop

# 2. Make changes and commit
git add .
git commit -m "Add new feature"

# 3. Push and create PR to develop
git push origin feature/new-feature
# Create PR on GitHub: feature/new-feature → develop

# 4. After merge to develop, test in test environment

# 5. When ready, create PR to main
# Create PR on GitHub: develop → main

# 6. After merge to main, production deploys automatically
```

---

## Troubleshooting

### Backend Issues

#### Database Connection Errors
- Verify `DATABASE_URL` is set correctly
- Check database is running and accessible
- Ensure database credentials are correct

#### CORS Errors
- Set `CORS_ORIGINS` environment variable to your frontend URL
- Check backend CORS middleware configuration

#### Port Issues
- Ensure `PORT` environment variable is set (usually auto-set by platform)
- Check platform-specific port requirements

### Frontend Issues

#### API Connection Errors
- Verify `NEXT_PUBLIC_BACKEND_URL` is set correctly
- Check backend is running and accessible
- Verify CORS is configured on backend

#### Build Errors
- Check Node.js version (should be 18+)
- Verify all dependencies are installed
- Check for TypeScript errors

### Deployment Issues

#### GitHub Actions Failures
- Check GitHub Secrets are set correctly
- Verify Vercel tokens are valid
- Check workflow logs for specific errors

#### Environment Variable Issues
- Verify all required variables are set
- Check variable names match exactly (case-sensitive)
- Ensure variables are set for correct environment (production/test)

---

## Quick Reference

### Production URLs
- **Frontend**: `https://your-app.vercel.app`
- **Backend**: `https://your-backend.railway.app` or `https://your-backend.onrender.com`
- **API Docs**: `https://your-backend-url/docs`

### Test URLs
- **Frontend**: `https://your-app-git-develop.vercel.app`
- **Backend**: `https://your-test-backend.railway.app`

### Important Commands

```bash
# Switch to develop branch
git checkout develop

# Create feature branch
git checkout -b feature/name develop

# Deploy manually (if needed)
# Frontend: Push to GitHub (auto-deploys)
# Backend: Push to GitHub (auto-deploys on Railway/Render)

# Check deployment status
# GitHub Actions: Repository → Actions tab
# Vercel: Dashboard → Deployments
# Railway/Render: Dashboard → Deployments
```

---

## Next Steps

1. ✅ Set up monitoring and logging
2. ✅ Configure custom domain (optional)
3. ✅ Set up error tracking (Sentry, etc.)
4. ✅ Configure backups for database
5. ✅ Set up staging environment (optional)
6. ✅ Add performance monitoring

---

## Support

For issues or questions:
1. Check the troubleshooting section
2. Review platform-specific documentation:
   - [Vercel Docs](https://vercel.com/docs)
   - [Railway Docs](https://docs.railway.app)
   - [Render Docs](https://render.com/docs)
3. Check GitHub Issues in your repository

---

**Last Updated**: November 2024
**Version**: 1.0


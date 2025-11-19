# Render Services Configuration - Complete Guide

## You Have 2 Services:

1. **Backend Service** (Python/FastAPI) - Already working ✅
2. **Frontend Service** (Next.js/Node) - Needs configuration

---

## 🔵 Service 1: Backend (Python/FastAPI)

### Service Settings:
| Setting | Value |
|---------|-------|
| **Name** | `ai-demo-k78k` (or your backend name) |
| **Type** | Web Service |
| **Runtime** | Python |
| **Python Version** | `3.11.0` |
| **Root Directory** | `backend` (or leave empty if using `cd backend &&`) |
| **Build Command** | `cd backend && pip install -r requirements.txt` |
| **Start Command** | `cd backend && uvicorn main:app --host 0.0.0.0 --port $PORT` |
| **Health Check Path** | `/docs` |

### Environment Variables:
```
OPENAI_API_KEY = [your OpenAI API key]
ENVIRONMENT = production
PORT = 8000
DATABASE_URL = [auto-set if using Render PostgreSQL]
AZURE_DOC_INTEL_ENDPOINT = [optional, your Azure endpoint]
AZURE_DOC_INTEL_KEY = [optional, your Azure key]
CORS_ORIGINS = https://your-frontend-url.onrender.com
```

### Current Status:
✅ **Working** at: `https://ai-demo-k78k.onrender.com/`

---

## 🟢 Service 2: Frontend (Next.js/Node)

### Service Settings:
| Setting | Value |
|---------|-------|
| **Name** | `ai-demo-frontend` (or your choice) |
| **Type** | Web Service |
| **Runtime** | Node |
| **Node Version** | `18.0.0` or higher (auto-detected) |
| **Root Directory** | `frontend` ⚠️ **CRITICAL** |
| **Build Command** | `npm install && npm run build` |
| **Start Command** | `npm run start` |
| **Health Check Path** | `/` |

### Environment Variables:
```
NEXT_PUBLIC_BACKEND_URL = https://ai-demo-k78k.onrender.com
NEXT_PUBLIC_ENVIRONMENT = production
```

### Current Status:
⏳ **Needs deployment** - Will be at: `https://ai-demo-frontend.onrender.com` (or your chosen name)

---

## 🔗 Connection Between Services

### Frontend → Backend:
- Frontend uses `NEXT_PUBLIC_BACKEND_URL` to connect to backend
- Backend uses `CORS_ORIGINS` to allow frontend requests

### After Frontend is Deployed:

1. **Update Backend CORS:**
   - Go to Backend service → Environment
   - Update `CORS_ORIGINS` to:
     ```
     https://your-frontend-url.onrender.com
     ```
   - Redeploy backend

2. **Test Connection:**
   - Visit frontend URL
   - Try uploading a file
   - Check browser console for errors

---

## 📋 Quick Checklist

### Backend Service ✅
- [x] Runtime: Python 3.11
- [x] Root Directory: `backend`
- [x] Build Command: `cd backend && pip install -r requirements.txt`
- [x] Start Command: `cd backend && uvicorn main:app --host 0.0.0.0 --port $PORT`
- [x] Environment variables set
- [x] Working at: https://ai-demo-k78k.onrender.com/

### Frontend Service ⏳
- [ ] Runtime: Node
- [ ] Root Directory: `frontend` ⚠️ **MUST BE SET**
- [ ] Build Command: `npm install && npm run build`
- [ ] Start Command: `npm run start`
- [ ] Environment variables set:
  - [ ] `NEXT_PUBLIC_BACKEND_URL = https://ai-demo-k78k.onrender.com`
  - [ ] `NEXT_PUBLIC_ENVIRONMENT = production`

---

## 🎯 Most Important Settings

### Backend:
- **Root Directory:** `backend`
- **Python Version:** `3.11.0`

### Frontend:
- **Root Directory:** `frontend` ⚠️ **THIS IS THE KEY SETTING**
- **Runtime:** Node (not Python!)

---

## 🚨 Common Mistakes

1. ❌ Frontend Root Directory not set → Build fails
2. ❌ Frontend detected as Python → Wrong runtime
3. ❌ Backend CORS not updated → Frontend can't connect
4. ❌ Wrong backend URL in frontend env → Connection fails

---

## ✅ Verification

### Backend Working:
- Visit: `https://ai-demo-k78k.onrender.com/docs`
- Should see API documentation

### Frontend Working:
- Visit: `https://your-frontend-url.onrender.com`
- Should see the application (not white screen)
- Should be able to connect to backend


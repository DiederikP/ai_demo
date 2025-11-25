# Deployment DB Checklist

Use this list every time you deploy to Render to ensure the backend and database are in sync.

1. **Run migrations locally**
   ```bash
   cd backend
   python scripts/run_migrations.py
   ```
2. **Deploy backend (`ai-demo-k78k`)**
   - `Build command`: `python -m pip install -r requirements.txt`
   - `Start command`: `python -m uvicorn main:app --host 0.0.0.0 --port $PORT`
   - `Health check path`: `/health`
3. **Sanity check backend**
   ```bash
   curl https://ai-demo-k78k.onrender.com/health
   curl https://ai-demo-k78k.onrender.com/personas
   ```
   Expect JSON (no SQL errors).
4. **Deploy frontend (`ai-demo-1-nlgg`)**
   - `NEXT_PUBLIC_BACKEND_URL=https://ai-demo-k78k.onrender.com`
   - `BACKEND_URL=https://ai-demo-k78k.onrender.com`
5. **Final validation**
   - `curl https://ai-demo-1-nlgg.onrender.com` → landing page
   - In the UI: Add a “Nieuwe digitale werknemer” (should succeed).

If any step fails, stop the deploy and fix before proceeding. This prevents missing-column issues from reaching production.


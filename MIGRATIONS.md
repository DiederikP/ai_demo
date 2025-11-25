# Database Migrations & Schema Bootstrap

Our backend now bootstraps the schema automatically on startup via `bootstrap_schema()` in `backend/main.py`. This makes sure all tables/columns exist before the API starts serving traffic.

## When to run migrations manually

Before deploying (or whenever the schema changes), run:

```bash
cd backend
python scripts/run_migrations.py
```

This script imports `bootstrap_schema()` and applies the same checks outside of the FastAPI runtime. Run it locally before pushing, or in any CI/CD step before Render deploys.

## Render deployment checklist

1. `python backend/scripts/run_migrations.py`
2. `curl https://<backend-domain>/health` → expect `{"status":"ok"}`
3. `curl https://<backend-domain>/personas` → expect JSON (no SQL errors)
4. Deploy backend (`ai-demo-k78k`). On Render, set `Health check path` to `/health`.
5. Deploy frontend (`ai-demo-1-nlgg`). Ensure `NEXT_PUBLIC_BACKEND_URL` and `BACKEND_URL` both equal `https://ai-demo-k78k.onrender.com`.

If step 3 passes, the frontend (“Nieuwe digitale werknemer”) can safely use the API without missing-column errors.


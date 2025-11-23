# Reset Database on Render

This guide explains how to reset the database on Render to start fresh.

## Method: Admin API Endpoint

A secure admin endpoint has been created that allows you to reset the database without shell access.

### Steps:

1. **Login as Admin**:
   - Go to: `https://ai-demo-frontend.onrender.com/company/login`
   - Login with: `admin@demo.local` / `admin123`

2. **Call the Reset Endpoint**:
   
   **Option A: Using Browser/Postman**:
   ```
   POST https://ai-hiring-backend.onrender.com/admin/reset-database?confirm=true
   ```
   
   Headers:
   ```
   Authorization: Bearer <your_jwt_token>
   Content-Type: application/json
   ```
   
   **Option B: Using curl** (after getting token):
   ```bash
   # First, login to get token
   curl -X POST https://ai-hiring-backend.onrender.com/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email": "admin@demo.local", "password": "admin123"}'
   
   # Copy the access_token from response, then:
   curl -X POST "https://ai-hiring-backend.onrender.com/admin/reset-database?confirm=true" \
     -H "Authorization: Bearer <your_token_here>"
   ```

3. **What Gets Deleted**:
   - ✅ All candidates
   - ✅ All job postings
   - ✅ All evaluations and debates
   - ✅ All notifications
   - ✅ All comments and appointments
   - ✅ All users (except the 4 required users)
   - ✅ All companies (except those needed for required users)

4. **What Happens After Reset**:
   - The auto-setup function will automatically recreate the 4 required users:
     - `admin@demo.local` / `admin123`
     - `user@company.nl` / `company123`
     - `user@recruiter.nl` / `recruiter123`
     - `user@kandidaat.nl` / `kandidaat123`

### Security

- ✅ Requires admin authentication (JWT token)
- ✅ Requires `confirm=true` query parameter
- ✅ Only admins can access this endpoint
- ✅ All actions are logged

### Response

On success, you'll get:
```json
{
  "success": true,
  "message": "Database reset successfully. Required users have been recreated.",
  "deleted": {
    "candidates": "all",
    "job_postings": "all",
    "evaluations": "all",
    "users": "all except 4 required users"
  }
}
```

## Alternative: Direct Database Reset (if you have database access)

If you have direct database access, you can also:
1. Connect to the PostgreSQL database
2. Drop and recreate tables
3. The auto-setup will recreate users on next backend startup

## Notes

- The reset is **irreversible** - all data will be permanently deleted
- The 4 required users will be automatically recreated
- You'll need to log in again after reset (with admin credentials)
- All other data (candidates, jobs, etc.) will need to be recreated


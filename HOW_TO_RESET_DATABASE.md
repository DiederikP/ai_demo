# How to Reset Database on Render

## Quick Method: Admin Reset Page

1. **Login as Admin**:
   - Go to: `https://ai-demo-frontend.onrender.com/company/login`
   - Email: `admin@demo.local`
   - Password: `admin123`

2. **Navigate to Reset Page**:
   - Go to: `https://ai-demo-frontend.onrender.com/admin/reset`
   - Or type the URL directly in your browser

3. **Reset Database**:
   - Click the "🗑️ Database Resetten" button
   - Confirm the warnings
   - Type "RESET" when prompted
   - Wait for confirmation

4. **Done!**
   - Database will be cleared
   - Required users will be automatically recreated
   - You'll be redirected to login page

## What Gets Reset

- ✅ All candidates
- ✅ All job postings  
- ✅ All evaluations and debates
- ✅ All notifications
- ✅ All users (except 4 required users)
- ✅ All companies (except those needed for users)

## After Reset

The following users will be automatically recreated:
- **Admin**: `admin@demo.local` / `admin123`
- **Company**: `user@company.nl` / `company123`
- **Recruiter**: `user@recruiter.nl` / `recruiter123`
- **Candidate**: `user@kandidaat.nl` / `kandidaat123`

## Alternative: API Call

If you prefer using curl or Postman:

```bash
# 1. Login to get token
TOKEN=$(curl -X POST https://ai-hiring-backend.onrender.com/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@demo.local","password":"admin123"}' \
  | jq -r '.access_token')

# 2. Reset database
curl -X POST "https://ai-hiring-backend.onrender.com/admin/reset-database?confirm=true" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json"
```

## Security

- ✅ Requires admin authentication
- ✅ Requires confirmation (`confirm=true`)
- ✅ Requires typing "RESET" as final confirmation
- ✅ Only accessible by admin users


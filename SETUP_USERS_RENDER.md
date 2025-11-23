# Setting Up Users on Render

This guide explains how to set up the required users on your Render deployment.

## Required Users

The following users need to be created with their respective roles:

- **Admin**: `admin@demo.local` / `admin123` (full access to all portals)
- **Company**: `user@company.nl` / `company123` (Company portal only)
- **Recruiter**: `user@recruiter.nl` / `recruiter123` (Recruiter portal only)
- **Candidate**: `user@kandidaat.nl` / `kandidaat123` (Candidate portal only)

## Option 1: Run Setup Script via Render Shell (Recommended)

1. Go to your Render Dashboard
2. Navigate to your backend service (`ai-hiring-backend`)
3. Click on "Shell" tab (or use SSH)
4. Run the following commands:

```bash
cd backend
python3 setup_users.py
```

This will:
- Clear all old data (except the 4 specified users if they exist)
- Create/update the 4 users with correct roles and passwords
- Create necessary companies

## Option 2: Run Setup Script via API (Alternative)

If you have access to the backend API, you can create users via the `/auth/register` endpoint, but the setup script is easier.

## Option 3: Automatic Setup on First Deploy

You can modify the backend startup to automatically run the setup script. Add this to `backend/main.py` at the end of the file (after all imports):

```python
# Auto-setup users on first deploy (only if no users exist)
if __name__ != "__main__":  # Only when running as module (not directly)
    try:
        db = SessionLocal()
        user_count = db.query(UserDB).count()
        if user_count == 0:
            print("No users found, running setup script...")
            import subprocess
            subprocess.run(["python3", "setup_users.py"], cwd=os.path.dirname(__file__))
        db.close()
    except Exception as e:
        print(f"Warning: Could not auto-setup users: {e}")
        # Don't fail startup if setup fails
```

## Verification

After running the setup script, verify the users exist:

1. Try logging in at:
   - Company portal: `https://ai-demo-frontend.onrender.com/company/login`
   - Recruiter portal: `https://ai-demo-frontend.onrender.com/recruiter/login`
   - Candidate portal: `https://ai-demo-frontend.onrender.com/candidate/login`

2. Or check via API:
   ```bash
   curl https://ai-hiring-backend.onrender.com/users
   ```

## Troubleshooting

If users don't work:
1. Check that `JWT_SECRET_KEY` is set in Render environment variables
2. Verify the database connection is working
3. Check backend logs for any errors
4. Ensure the setup script ran successfully

## Notes

- The setup script will preserve existing users with the specified emails
- Passwords are hashed using bcrypt
- All users are created in the same environment for data visibility
- The recruiter user has a separate company for organizational purposes


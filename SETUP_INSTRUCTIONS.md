# User Setup Instructions

## Overview
This setup creates 4 users with role-based access:
- **Admin**: Full CRUD access to all portals
- **Company User**: Only Bedrijf portal access
- **Recruiter User**: Only Recruiter portal access  
- **Candidate User**: Only Candidate portal access

All users are in the same environment so they can see each other's data.

## Setup Steps

### 1. Run the Setup Script

```bash
cd backend
python3 setup_users.py
```

This script will:
- Clear all old data from the database
- Create a demo company/environment
- Create 4 users with proper roles and passwords

### 2. Login Credentials

After running the script, you can login with:

| User | Email | Password | Portal Access |
|------|-------|----------|---------------|
| Admin | admin@demo.local | admin123 | All portals (Company, Recruiter, Candidate) |
| Company | user@company.nl | company123 | Company portal only |
| Recruiter | user@recruiter.nl | recruiter123 | Recruiter portal only |
| Candidate | user@kandidaat.nl | kandidaat123 | Candidate portal only |

### 3. Portal Access

- **Admin users** can see portal links in all navigation panes
- **Company users** can only access `/company/dashboard` and related pages
- **Recruiter users** can only access `/recruiter/dashboard` and related pages
- **Candidate users** can only access `/candidate/dashboard` and related pages

### 4. Data Visibility

All users are in the same environment, so:
- Vacancies created by company users are visible to recruiters
- Candidates submitted by recruiters are visible to company users
- Candidates can see their application status

## Notes

- The setup script removes ALL existing data before creating new users
- All users share the same company/environment for data visibility
- Route protection ensures users can only access their assigned portals
- Navigation components automatically hide portal links based on user role


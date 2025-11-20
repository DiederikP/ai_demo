# UI Flow Testing Checklist

## Portal Switching
- [ ] Company Portal loads
- [ ] Recruiter Portal loads  
- [ ] Candidate Portal loads
- [ ] Portal selector works in navigation

## Company Portal

### Login
- [ ] Login page loads at `/company/login`
- [ ] Can login with `vaatje@zuljehemhebben.nl` / `123`
- [ ] Redirects to dashboard after login
- [ ] Shows error for wrong credentials

### Dashboard
- [ ] Dashboard loads after login
- [ ] Shows statistics
- [ ] Navigation menu works
- [ ] Logout button works

### Vacatures (Job Postings)
- [ ] Vacatures list loads
- [ ] Can view job details
- [ ] Can create new vacancy (`/company/vacatures/nieuw`)
- [ ] Can edit vacancy
- [ ] "Kandidaat Aanbieden" button works in job detail
- [ ] Modal opens for selecting candidates
- [ ] Can select multiple candidates
- [ ] Can assign candidates to vacancy
- [ ] Pipeline visualization works

### Kandidaten (Candidates)
- [ ] Kandidaten list loads
- [ ] Can view candidate details
- [ ] Can add new candidate
- [ ] Can filter candidates (with/without vacancies)
- [ ] Can delete candidate
- [ ] Duplicate warning modal works
- [ ] Can upload resume

### Evaluations
- [ ] Can start new evaluation
- [ ] Can select personas
- [ ] Can select actions
- [ ] Workflow visualization shows progress
- [ ] Results display correctly

## Recruiter Portal

### Login
- [ ] Can login with `recruiter@recruiter-test.nl` / `123`
- [ ] Redirects to recruiter dashboard

### Dashboard
- [ ] Shows recruiter-specific statistics
- [ ] Navigation works

### Vacatures
- [ ] Shows assigned vacancies
- [ ] Can toggle to show new vacancies
- [ ] Can view vacancy details

### Kandidaten
- [ ] Shows submitted candidates
- [ ] Can add new candidate (`/recruiter/kandidaten/nieuw`)
- [ ] Can edit candidate company note
- [ ] Can view candidate details

## Candidate Portal

### Dashboard
- [ ] Shows own applications
- [ ] Shows pipeline status
- [ ] Shows targeted jobs (or all for admin)
- [ ] Admin toggle works (if admin user)

## Common UI Elements

### Navigation
- [ ] Portal selector works
- [ ] Menu items navigate correctly
- [ ] Active state highlights correctly
- [ ] Responsive design works

### Forms
- [ ] All input fields work
- [ ] Validation messages show
- [ ] Submit buttons work
- [ ] Loading states show
- [ ] Error messages display

### Modals
- [ ] Open/close correctly
- [ ] Backdrop click closes modal
- [ ] Escape key closes modal
- [ ] Content loads correctly

### Buttons
- [ ] All action buttons work
- [ ] Disabled states work
- [ ] Loading states work
- [ ] Hover effects work


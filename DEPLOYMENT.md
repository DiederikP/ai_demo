# AI Hiring Assistant v0.1 - Deployment Guide

## Quick Start

### 1. Backend Setup
```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scriptsctivate
pip install -r requirements.txt
cp env.example .env
# Edit .env with your OpenAI API key
python main.py
```

### 2. Frontend Setup
```bash
cd frontend
npm install
cp env.example .env.local
# Edit .env.local with your OpenAI API key
npm run dev
```

### 3. Access the Application
- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- API Docs: http://localhost:8000/docs

## Features Working in v0.1

✅ **Job Management**
- Upload job descriptions (minimal required fields)
- View all job postings
- File attachment support for job details

✅ **Candidate Evaluation**
- Upload CV (PDF/DOC/DOCX/TXT)
- Select job posting for context
- Choose evaluation persona (Finance/Hiring Manager/Tech Lead)
- Get structured evaluation with strengths, weaknesses, risk, verdict

✅ **Expert Debate**
- Multi-persona debate on candidate
- Job-specific context included
- Professional discussion format

✅ **File Processing**
- PyMuPDF for PDF parsing (primary)
- Azure Document Intelligence (fallback)
- AI-based extraction (final fallback)
- Support for multiple file formats

✅ **UI/UX**
- Barnes.nl branding
- Intuitive job selection
- Clean, professional interface
- Responsive design

## Version Info
- Git Tag: v0.1
- Commit: dcd4189
- Status: Stable and fully functional
- Backup: ai_demo_v0.1_backup

# AI Hiring Assistant - Barnes.nl

AI-powered candidate evaluation platform with job-specific assessments and expert debates.

## Version 0.1 - Stable Release

### Features:
- ✅ Job-specific candidate evaluations
- ✅ Multi-expert debate functionality
- ✅ Flexible job posting upload
- ✅ PDF/DOC/DOCX/TXT file support
- ✅ PyMuPDF + Azure Document Intelligence + AI fallback parsing
- ✅ Barnes.nl branding and styling
- ✅ Production-ready Next.js frontend
- ✅ FastAPI backend with SQLite database

### Tech Stack:
- Frontend: Next.js 15.5.6, TypeScript, Tailwind CSS
- Backend: FastAPI, SQLAlchemy, SQLite
- AI: OpenAI GPT-4
- PDF Parsing: PyMuPDF, Azure Document Intelligence

### Status: Fully Functional
- Backend: http://localhost:8000
- Frontend: http://localhost:3000
- All features tested and working

## Installation

### Backend:
```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scriptsctivate
pip install -r requirements.txt
python main.py
```

### Frontend:
```bash
cd frontend
npm install
npm run dev
```

## Environment Setup

### Backend (.env):
```
OPENAI_API_KEY=your_openai_key_here
AZURE_DOC_INTEL_ENDPOINT=https://your-resource.cognitiveservices.azure.com/
AZURE_DOC_INTEL_KEY=your_azure_key_here
```

### Frontend (.env.local):
```
OPENAI_API_KEY=your_openai_key_here
```

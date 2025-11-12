# Data Flow Documentation - Barnes AI Hiring Assistant

## Architecture Overview

```
┌─────────────┐      ┌──────────────┐      ┌─────────────┐      ┌──────────────┐
│   Browser   │─────▶│  Next.js     │─────▶│   FastAPI   │─────▶│   SQLite     │
│  (Client)   │◀─────│  (Frontend)  │◀─────│  (Backend)  │◀─────│  (Database)  │
└─────────────┘      └──────────────┘      └─────────────┘      └──────────────┘
                            │                      │
                            │                      │
                            ▼                      ▼
                     ┌──────────────┐      ┌──────────────┐
                     │ API Routes   │      │   OpenAI    │
                     │ (Proxies)    │      │    API      │
                     └──────────────┘      └──────────────┘
```

## Data Flow Patterns

### 1. **Initial Page Load Flow**

```
User Browser
    │
    ├─▶ GET / (Next.js App Router)
    │   │
    │   ├─▶ Render: Header, Hero, Features
    │   │
    │   └─▶ useEffect() hooks trigger:
    │       │
    │       ├─▶ GET /api/personas
    │       │   │
    │       │   ├─▶ Proxy to: GET http://localhost:8000/personas
    │       │   │   │
    │       │   │   └─▶ Backend queries: SELECT * FROM personas
    │       │   │       │
    │       │   │       └─▶ Returns: { "personas": [PersonaDB...] }
    │       │   │
    │       │   └─▶ Frontend stores: setPersonas([...])
    │       │
    │       └─▶ GET /api/upload-job
    │           │
    │           ├─▶ Proxy to: GET http://localhost:8000/job-descriptions
    │           │   │
    │           │   └─▶ Backend queries: SELECT * FROM job_postings
    │           │       │
    │           │       └─▶ Returns: { "jobs": [JobPostingDB...] }
    │           │
    │           └─▶ Frontend stores: setJobDescriptions([...])
```

**Components Involved:**
- `frontend/src/app/page.tsx` - Main page component
- `frontend/src/app/api/personas/route.ts` - Persona API proxy
- `frontend/src/app/api/upload-job/route.ts` - Job API proxy
- `backend/main.py` - `/personas` and `/job-descriptions` endpoints

---

### 2. **Job Posting CRUD Flow**

#### **CREATE Job Posting**

```
User fills form → JobDescriptionManager component
    │
    ├─▶ POST /api/upload-job (JSON body)
    │   │
    │   ├─▶ Proxy to: POST http://localhost:8000/upload-job-description
    │   │   │
    │   │   ├─▶ Validate: title, company, description (required)
    │   │   │
    │   │   ├─▶ Create: JobPostingDB record
    │   │   │   │
    │   │   │   └─▶ INSERT INTO job_postings (id, title, company, description, ...)
    │   │   │       │
    │   │   │       └─▶ id = uuid4() generated
    │   │   │
    │   │   └─▶ Returns: { "success": true, "job_id": "...", "message": "..." }
    │   │
    │   └─▶ Frontend calls: loadJobDescriptions() to refresh list
    │       │
    │       └─▶ GET /api/upload-job → Re-fetches all jobs
```

#### **READ Job Postings**

```
User opens Job Manager
    │
    └─▶ GET /api/upload-job
        │
        ├─▶ Proxy to: GET http://localhost:8000/job-descriptions
        │   │
        │   ├─▶ Backend: db.query(JobPostingDB).all()
        │   │
        │   └─▶ Returns: { "success": true, "jobs": [...] }
        │
        └─▶ Frontend: setJobDescriptions(result.jobs)
```

#### **UPDATE Job Posting**

```
User edits → PUT /api/upload-job (JSON body with id)
    │
    ├─▶ Proxy to: PUT http://localhost:8000/job-descriptions/{id}
    │   │
    │   ├─▶ Backend: Find job by ID
    │   │   │
    │   │   ├─▶ UPDATE job_postings SET title=..., company=... WHERE id=...
    │   │   │
    │   │   └─▶ Returns: { "success": true, "job": {...} }
    │   │
    │   └─▶ Frontend: loadJobDescriptions() refresh
```

#### **DELETE Job Posting**

```
User clicks delete → DELETE /api/upload-job?id={job_id}
    │
    ├─▶ Proxy to: DELETE http://localhost:8000/job-descriptions/{id}
    │   │
    │   ├─▶ Backend: Safe deletion
    │   │   │
    │   │   ├─▶ Find all candidates with this job_id
    │   │   │   │
    │   │   │   ├─▶ SET candidates.job_id = NULL (orphan handling)
    │   │   │   │
    │   │   │   └─▶ DELETE evaluations WHERE candidate_id IN (...)
    │   │   │
    │   │   └─▶ DELETE FROM job_postings WHERE id=...
    │   │
    │   └─▶ Frontend: loadJobDescriptions() refresh
```

**Files:**
- `frontend/src/components/JobDescriptionManager.tsx`
- `frontend/src/app/api/upload-job/route.ts`
- `backend/main.py` - `/upload-job-description`, `/job-descriptions`, `/job-descriptions/{id}`

---

### 3. **Persona CRUD Flow** (Similar to Jobs)

```
CREATE: POST /api/personas → POST /personas
READ:   GET /api/personas → GET /personas
UPDATE: PUT /api/personas → PUT /personas/{id}
DELETE: DELETE /api/personas?id={id} → DELETE /personas/{id}
```

**Database:** `personas` table
**Files:**
- `frontend/src/components/PersonaManager.tsx`
- `frontend/src/app/api/personas/route.ts`
- `backend/main.py` - `/personas` endpoints

---

### 4. **Candidate Evaluation Flow** (Single Persona)

```
User Action: Select file, persona, job → Click "Evaluate Candidate"
    │
    ├─▶ POST /api/review (FormData)
    │   │
    │   ├─▶ STEP 1: Upload Resume
    │   │   │
    │   │   ├─▶ POST http://localhost:8000/upload-resume
    │   │   │   │
    │   │   │   ├─▶ Extract text from file:
    │   │   │   │   │
    │   │   │   │   ├─▶ PDF → PyMuPDF (primary)
    │   │   │   │   │   │
    │   │   │   │   │   └─▶ Fallback: Azure Document Intelligence
    │   │   │   │   │       │
    │   │   │   │   │       └─▶ Fallback: OpenAI GPT-4 extraction
    │   │   │   │   │
    │   │   │   │   └─▶ Process motivation_file (if provided)
    │   │   │   │       │
    │   │   │   │       └─▶ Extract text from motivation file
    │   │   │   │
    │   │   │   ├─▶ Truncate resume_text (max 3000 chars)
    │   │   │   │
    │   │   │   ├─▶ Create CandidateDB record:
    │   │   │   │   │
    │   │   │   │   └─▶ INSERT INTO candidates (
    │   │   │   │       id, job_id, name, email, resume_text,
    │   │   │   │       motivational_letter, experience_years, ...
    │   │   │   │   )
    │   │   │   │
    │   │   │   └─▶ Returns: { "candidate_id": "..." }
    │   │   │
    │   ├─▶ STEP 2: Evaluate Candidate
    │   │   │
    │   │   ├─▶ POST http://localhost:8000/evaluate-candidate
    │   │   │   │
    │   │   │   ├─▶ Fetch candidate from DB
    │   │   │   │   │
    │   │   │   │   └─▶ SELECT * FROM candidates WHERE id=...
    │   │   │   │
    │   │   │   ├─▶ Fetch job posting (if job_id exists)
    │   │   │   │   │
    │   │   │   │   └─▶ SELECT * FROM job_postings WHERE id=...
    │   │   │   │
    │   │   │   ├─▶ Fetch persona system_prompt
    │   │   │   │   │
    │   │   │   │   └─▶ SELECT system_prompt FROM personas WHERE name=...
    │   │   │   │
    │   │   │   ├─▶ Build OpenAI prompt:
    │   │   │   │   │
    │   │   │   │   ├─▶ System: Persona system_prompt + strictness level
    │   │   │   │   │
    │   │   │   │   └─▶ User: resume_text + job_info + motivational_letter
    │   │   │   │
    │   │   │   ├─▶ Call OpenAI API:
    │   │   │   │   │
    │   │   │   │   └─▶ POST https://api.openai.com/v1/chat/completions
    │   │   │   │       │
    │   │   │   │       └─▶ Model: gpt-4
    │   │   │   │           │
    │   │   │   │           └─▶ Response: JSON with strengths, weaknesses, risk, verdict
    │   │   │   │
    │   │   │   ├─▶ Parse JSON response
    │   │   │   │
    │   │   │   ├─▶ Create EvaluationDB record:
    │   │   │   │   │
    │   │   │   │   └─▶ INSERT INTO evaluations (
    │   │   │   │       id, candidate_id, persona, result_summary
    │   │   │   │   )
    │   │   │   │
    │   │   │   └─▶ Returns: {
    │   │   │       "success": true,
    │   │   │       "evaluation": { strengths, weaknesses, risk, verdict }
    │   │   │     }
    │   │   │
    │   └─▶ Frontend: Transform & Display
    │       │
    │       └─▶ setEvaluationResult({
    │           strengths, weaknesses, risk, verdict
    │         })
```

**Files:**
- `frontend/src/app/page.tsx` - `handleEvaluate()` function
- `frontend/src/app/api/review/route.ts` - Evaluation API proxy
- `backend/main.py` - `/upload-resume` and `/evaluate-candidate` endpoints

**Database Tables:**
- `candidates` - Stores resume and candidate info
- `evaluations` - Stores evaluation results

---

### 5. **Expert Debate Flow** (Multiple Personas)

```
User Action: Select file, multiple personas, job → Click "Expert Debate"
    │
    ├─▶ POST /api/debate (FormData)
    │   │
    │   ├─▶ Extract persona prompts: { "finance_prompt": "...", "hiring_manager_prompt": "..." }
    │   │
    │   ├─▶ STEP 1: Upload Resume (same as evaluation)
    │   │   │
    │   │   └─▶ POST /upload-resume → Returns candidate_id
    │   │
    │   ├─▶ STEP 2: Run Debate
    │   │   │
    │   │   ├─▶ POST http://localhost:8000/debate-candidate
    │   │   │   │
    │   │   │   ├─▶ Extract dynamic persona prompts from FormData
    │   │   │   │   │
    │   │   │   │   └─▶ Filter keys ending with "_prompt"
    │   │   │   │
    │   │   │   ├─▶ Fetch candidate & job (same as evaluation)
    │   │   │   │
    │   │   │   ├─▶ Build debate system prompt:
    │   │   │   │   │
    │   │   │   │   └─▶ "Facilitate debate between {N} personas:
    │   │   │   │       {persona_name_1}: {prompt_1}
    │   │   │   │       {persona_name_2}: {prompt_2}
    │   │   │   │       ..."
    │   │   │   │
    │   │   │   ├─▶ Build user prompt:
    │   │   │   │   │
    │   │   │   │   └─▶ resume_text + job_info + motivational_letter
    │   │   │   │
    │   │   │   ├─▶ Call OpenAI API:
    │   │   │   │   │
    │   │   │   │   └─▶ Model: gpt-4, temperature=0.8
    │   │   │   │       │
    │   │   │   │       └─▶ Response: Multi-persona debate transcript
    │   │   │   │
    │   │   │   └─▶ Returns: {
    │   │   │       "success": true,
    │   │   │       "debate": "Finance Director: ... Hiring Manager: ..."
    │   │   │     }
    │   │   │
    │   └─▶ Frontend: Display Debate
    │       │
    │       └─▶ setDebateResult({ transcript: "..." })
```

**Files:**
- `frontend/src/app/page.tsx` - `handleDebate()` function
- `frontend/src/app/api/debate/route.ts` - Debate API proxy
- `backend/main.py` - `/debate-candidate` endpoint

**Key Difference:** Dynamic persona extraction from FormData keys, not hardcoded field names.

---

### 6. **File Processing Pipeline**

```
Uploaded File (PDF/DOC/DOCX/TXT)
    │
    ├─▶ Read file_content as bytes
    │
    ├─▶ Route by file extension:
    │   │
    │   ├─▶ PDF:
    │   │   │
    │   │   ├─▶ Try: PyMuPDF (fitz) extraction
    │   │   │   │
    │   │   │   └─▶ Success → Return text
    │   │   │
    │   │   ├─▶ Fallback: Azure Document Intelligence
    │   │   │   │
    │   │   │   └─▶ Success → Return text
    │   │   │
    │   │   └─▶ Final Fallback: OpenAI GPT-4
    │   │       │
    │   │       ├─▶ Encode: base64
    │   │       │
    │   │       ├─▶ Prompt: "Extract all text from this PDF..."
    │   │       │
    │   │       └─▶ Return extracted text
    │   │
    │   └─▶ Text Files:
    │       │
    │       └─▶ Decode UTF-8 → Return text
    │
    ├─▶ Truncate text:
    │   │
    │   ├─▶ Resume: max 3000 chars
    │   │
    │   └─▶ Motivation: max 1000 chars
    │
    └─▶ Store in database
```

**Function:** `extract_text_from_file()` in `backend/main.py`

---

### 7. **State Management Flow** (Frontend)

```
React Component State (page.tsx)
    │
    ├─▶ selectedFile: File | null
    │   │
    │   └─▶ Set by: handleFileChange()
    │
    ├─▶ motivationFile: File | null
    │   │
    │   └─▶ Set by: handleMotivationFileChange()
    │
    ├─▶ selectedPersonas: string[]
    │   │
    │   └─▶ Modified by: handlePersonaToggle()
    │       │
    │       └─▶ Toggle array membership
    │
    ├─▶ selectedJob: JobDescription | null
    │   │
    │   └─▶ Set by: handleJobChange()
    │
    ├─▶ personas: Persona[]
    │   │
    │   └─▶ Loaded by: loadPersonas() on mount
    │
    ├─▶ jobDescriptions: JobDescription[]
    │   │
    │   └─▶ Loaded by: loadJobDescriptions() on mount
    │
    ├─▶ evaluationResult: EvaluationResult | null
    │   │
    │   └─▶ Set after: handleEvaluate() completes
    │
    ├─▶ debateResult: DebateResult | null
    │   │
    │   └─▶ Set after: handleDebate() completes
    │
    └─▶ reasoningSteps: ReasoningStep[]
        │
        └─▶ Updated during: Evaluation/Debate process
            │
            ├─▶ addReasoningStep() - Add new step
            │
            └─▶ updateReasoningStep() - Update status/content
```

---

## Database Schema

```sql
-- Job Postings
job_postings (
    id VARCHAR PRIMARY KEY,
    title VARCHAR NOT NULL,
    company VARCHAR NOT NULL,
    description TEXT NOT NULL,
    requirements TEXT,
    location VARCHAR,
    salary_range VARCHAR
)

-- Candidates
candidates (
    id VARCHAR PRIMARY KEY,
    job_id VARCHAR REFERENCES job_postings(id),
    name VARCHAR NOT NULL,
    email VARCHAR,
    resume_text TEXT NOT NULL,
    motivational_letter TEXT,
    experience_years INTEGER,
    skills TEXT,
    education VARCHAR,
    created_at DATETIME
)

-- Evaluations
evaluations (
    id VARCHAR PRIMARY KEY,
    candidate_id VARCHAR REFERENCES candidates(id),
    persona ENUM,
    result_summary TEXT,
    created_at DATETIME
)

-- Personas
personas (
    id VARCHAR PRIMARY KEY,
    name VARCHAR UNIQUE NOT NULL,
    display_name VARCHAR NOT NULL,
    system_prompt TEXT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at DATETIME,
    updated_at DATETIME
)
```

---

## API Endpoints Summary

### Frontend API Routes (Next.js Proxies)
- `GET /api/personas` → `GET http://localhost:8000/personas`
- `POST /api/personas` → `POST http://localhost:8000/personas`
- `PUT /api/personas` → `PUT http://localhost:8000/personas/{id}`
- `DELETE /api/personas` → `DELETE http://localhost:8000/personas/{id}`
- `GET /api/upload-job` → `GET http://localhost:8000/job-descriptions`
- `POST /api/upload-job` → `POST http://localhost:8000/upload-job-description`
- `PUT /api/upload-job` → `PUT http://localhost:8000/job-descriptions/{id}`
- `DELETE /api/upload-job` → `DELETE http://localhost:8000/job-descriptions/{id}`
- `POST /api/review` → `POST http://localhost:8000/upload-resume` + `/evaluate-candidate`
- `POST /api/debate` → `POST http://localhost:8000/upload-resume` + `/debate-candidate`

### Backend Endpoints (FastAPI)
- `GET /` - Root
- `GET /health` - Health check
- `GET /personas` - List all personas
- `POST /personas` - Create persona
- `PUT /personas/{id}` - Update persona
- `DELETE /personas/{id}` - Delete persona
- `GET /job-descriptions` - List all jobs
- `POST /upload-job-description` - Create job
- `PUT /job-descriptions/{id}` - Update job
- `DELETE /job-descriptions/{id}` - Delete job
- `POST /upload-resume` - Upload and extract resume
- `POST /evaluate-candidate` - Run single-persona evaluation
- `POST /debate-candidate` - Run multi-persona debate
- `GET /candidates` - List all candidates

---

## Key Data Transformations

### 1. **Frontend → Backend: Evaluation**
```
FormData {
  file: File,
  persona: "finance",
  prompt: "You are a Finance Director...",
  job_id: "uuid",
  motivation_file: File (optional)
}
    ↓
Backend receives:
- file → Extracted as bytes → Text extraction
- motivation_file → Extracted as bytes → Text extraction
- persona → Used to fetch system_prompt from DB
- job_id → Used to fetch job details
    ↓
OpenAI Prompt:
{
  system: system_prompt + strictness,
  user: resume_text + job_info + motivational_letter
}
```

### 2. **Backend → Frontend: Evaluation Result**
```
OpenAI Response: {
  strengths: "...",
  weaknesses: "...",
  risk: "...",
  verdict: "..."
}
    ↓
Backend stores: EvaluationDB
    ↓
Backend returns: {
  success: true,
  evaluation: { strengths, weaknesses, risk, verdict }
}
    ↓
Frontend API transforms: {
  strengths, weaknesses, risk, verdict
}
    ↓
React state: setEvaluationResult({ strengths, weaknesses, risk, verdict })
```

### 3. **Frontend → Backend: Debate**
```
FormData {
  file: File,
  job_id: "uuid",
  finance_prompt: "...",
  hiring_manager_prompt: "...",
  tech_lead_prompt: "..."
}
    ↓
Backend extracts: Dynamic persona prompts (keys ending with "_prompt")
    ↓
OpenAI Prompt:
{
  system: "Facilitate debate between N personas: ...",
  user: resume_text + job_info + motivational_letter
}
    ↓
Backend returns: {
  success: true,
  debate: "Finance Director: ... Hiring Manager: ..."
}
```

---

## Error Handling Flow

```
User Action → Frontend API → Backend API
    │            │              │
    │            │              ├─▶ Success → Return JSON
    │            │              │
    │            │              └─▶ Error → HTTPException
    │            │                         │
    │            │                         └─▶ Returns: { "detail": "error message" }
    │            │
    │            ├─▶ Success → Transform → Return to component
    │            │
    │            └─▶ Error → Catch → Return error JSON
    │                             │
    │                             └─▶ Component: alert() or setError()
    │
    └─▶ User sees: Error message or loading state
```

---

## CORS Configuration

```
Frontend (localhost:3000) → Backend (localhost:8000)
    │
    └─▶ Backend CORS middleware:
        allow_origins=["*"]
        allow_credentials=True
        allow_methods=["*"]
        allow_headers=["*"]
```

**File:** `backend/main.py` - CORSMiddleware setup

---

## Environment Variables

### Backend (`backend/.env`)
- `OPENAI_API_KEY` - OpenAI API key
- `AZURE_DOC_INTEL_ENDPOINT` - (Optional) Azure Document Intelligence
- `AZURE_DOC_INTEL_KEY` - (Optional) Azure Document Intelligence key

### Frontend (`frontend/.env.local`)
- `OPENAI_API_KEY` - (Not directly used, backend handles OpenAI)

---

## Summary

1. **Frontend** (Next.js) acts as a proxy layer, forwarding requests to the backend
2. **Backend** (FastAPI) handles business logic, file processing, and database operations
3. **Database** (SQLite) stores jobs, candidates, evaluations, and personas
4. **OpenAI API** handles AI evaluation and debate generation
5. **Data flows** are primarily unidirectional: User → Frontend → Backend → Database/OpenAI → Backend → Frontend → User

All API communication between frontend and backend happens over HTTP, with the frontend proxying requests to avoid CORS issues and provide a unified API interface.

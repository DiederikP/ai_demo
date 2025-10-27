from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict
from uuid import uuid4
import openai
import os
from azure.ai.formrecognizer import DocumentAnalysisClient
from azure.core.credentials import AzureKeyCredential
import io
from io import BytesIO
from dotenv import load_dotenv
import traceback
import sys
from sqlalchemy import create_engine, Column, String, Integer, Text, ForeignKey, Enum, DateTime
from sqlalchemy.orm import sessionmaker, declarative_base, relationship
from sqlalchemy.sql import func
import enum
import base64
import fitz  # PyMuPDF

# -----------------------------
# Load environment variables
# -----------------------------
load_dotenv()
openai.api_key = os.getenv("OPENAI_API_KEY")

app = FastAPI(title="Barnes AI Hiring Assistant", version="4.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -----------------------------
# File extraction functions
# -----------------------------

def extract_text_from_file(file_content: bytes, filename: str) -> str:
    """Extract text from various file formats"""
    try:
        print(f"Processing file: {filename}, size: {len(file_content)} bytes")
        
        # Check if it's a PDF file
        if filename.lower().endswith('.pdf'):
            print("Detected PDF file, trying PyMuPDF...")
            # Try PyMuPDF first (most reliable)
            try:
                result = extract_text_from_pdf_pymupdf(file_content)
                print(f"PyMuPDF success: extracted {len(result)} characters")
                return result
            except Exception as e:
                print(f"PyMuPDF failed: {str(e)}, trying Azure...")
                # Fall back to Azure Document Intelligence
                try:
                    result = extract_text_from_pdf_azure(file_content)
                    print(f"Azure success: extracted {len(result)} characters")
                    return result
                except Exception as e2:
                    print(f"Azure failed: {str(e2)}, trying AI extraction...")
                    # Final fallback to AI extraction
                    base64_content = base64.b64encode(file_content).decode('utf-8')
                    result = extract_text_with_ai(base64_content, filename)
                    print(f"AI extraction result: {len(result)} characters")
                    return result
        
        # For plain text files (.txt, etc.)
        try:
            text = file_content.decode('utf-8')
            if text.strip():
                print(f"Plain text extraction: {len(text)} characters")
                return text.strip()
        except UnicodeDecodeError:
            pass
        
        # If nothing works, try AI extraction as fallback
        try:
            base64_content = base64.b64encode(file_content).decode('utf-8')
            result = extract_text_with_ai(base64_content, filename)
            print(f"AI fallback result: {len(result)} characters")
            return result
        except Exception:
            raise ValueError(f"Could not extract text from {filename}")
            
    except Exception as e:
        print(f"Error in extract_text_from_file: {str(e)}")
        raise ValueError(f"Error processing file {filename}: {str(e)}")

def extract_text_from_pdf_pymupdf(pdf_content: bytes) -> str:
    """Extract text from PDF using PyMuPDF (fitz)"""
    try:
        # Open PDF from bytes
        pdf_document = fitz.open(stream=pdf_content, filetype="pdf")
        text = ""
        
        # Extract text from all pages
        for page_num in range(pdf_document.page_count):
            page = pdf_document[page_num]
            text += page.get_text()
        
        pdf_document.close()
        
        if not text.strip():
            raise ValueError("No text extracted from PDF")
        
        return text.strip()
        
    except Exception as e:
        raise ValueError(f"PyMuPDF extraction error: {str(e)}")


def extract_text_from_pdf_azure(pdf_content: bytes) -> str:
    """Extract text from PDF using Azure Document Intelligence"""
    try:
        endpoint = os.getenv("AZURE_DOC_INTEL_ENDPOINT")
        key = os.getenv("AZURE_DOC_INTEL_KEY")
        
        if not endpoint or not key or endpoint == "https://your-resource.cognitiveservices.azure.com/" or key == "your_azure_key_here":
            print("Azure credentials not configured, falling back to AI extraction...")
            # Fall back to AI extraction
            base64_content = base64.b64encode(pdf_content).decode('utf-8')
            return extract_text_with_ai(base64_content, "document.pdf")
        
        client = DocumentAnalysisClient(
            endpoint=endpoint,
            credential=AzureKeyCredential(key)
        )
        
        poller = client.begin_analyze_document(
            "prebuilt-read",
            document=BytesIO(pdf_content)
        )
        result = poller.result()
        
        text = "\n".join(line.content for page in result.pages for line in page.lines)
        
        if not text.strip():
            raise ValueError("No text extracted from PDF")
        
        return text.strip()
        
    except Exception as e:
        print(f"Azure Document Intelligence error: {str(e)}, falling back to AI extraction...")
        # Fall back to AI extraction
        base64_content = base64.b64encode(pdf_content).decode('utf-8')
        return extract_text_with_ai(base64_content, "document.pdf")

def extract_text_with_ai(base64_content: str, filename: str) -> str:
    """Use AI to extract text from file content (fallback for non-PDF files)"""
    try:
        prompt = f"""You are a document processing assistant. I need you to extract all readable text from a document.

File: {filename}

I will provide you with the document content. Please extract ALL readable text and return it exactly as it appears in the document. Do not summarize, do not explain, just extract the raw text content.

If this is a CV/resume, extract all candidate information including name, contact details, experience, skills, education, etc."""
        
        # Send a smaller chunk first to avoid token limits
        chunk_size = 5000  # Smaller chunk size
        if len(base64_content) > chunk_size:
            content_to_send = base64_content[:chunk_size] + "..."
        else:
            content_to_send = base64_content
        
        response = openai.chat.completions.create(
            model="gpt-4",
            messages=[
                {"role": "system", "content": prompt},
                {"role": "user", "content": f"Please extract all text from this document:\n\n{content_to_send}"}
            ],
            max_tokens=4000,
            temperature=0.1
        )
        
        result = response.choices[0].message.content.strip()
        
        # If the AI refuses, try a different approach
        if "can't assist" in result.lower() or "sorry" in result.lower():
            # Try with a different prompt
            prompt2 = f"""Extract text from this document. Return only the text content, no explanations.

Document content:
{content_to_send}"""
            
            response2 = openai.chat.completions.create(
                model="gpt-4",
                messages=[
                    {"role": "user", "content": prompt2}
                ],
                max_tokens=4000,
                temperature=0.1
            )
            
            result = response2.choices[0].message.content.strip()
        
        return result
        
    except Exception as e:
        raise ValueError(f"AI text extraction failed: {str(e)}")

def truncate_text_safely(text: str, max_length: int = 3000) -> str:
    """Safely truncate text to stay within token limits"""
    if len(text) <= max_length:
        return text
    return text[:max_length] + "\n\n[Content truncated for processing...]"

def call_openai_safe(messages: List[Dict], max_tokens: int = 1000, temperature: float = 0.1) -> Dict:
    """Safely call OpenAI API with token management and error handling"""
    try:
        # Estimate token count (rough approximation: 1 token ≈ 4 characters)
        estimated_tokens = sum(len(msg.get('content', '')) // 4 for msg in messages)
        
        # If estimated tokens exceed limit, truncate the last user message
        if estimated_tokens > 6000:  # Leave buffer for system prompt and response
            last_message = messages[-1]
            if last_message and 'content' in last_message:
                max_content_length = 2000  # Conservative limit
                if len(last_message['content']) > max_content_length:
                    messages[-1] = {
                        **last_message,
                        'content': last_message['content'][:max_content_length] + '\n\n[Content truncated for token limits...]'
                    }
        
        response = openai.chat.completions.create(
            model="gpt-4",
            messages=messages,
            max_tokens=max_tokens,
            temperature=temperature
        )
        
        return {
            "success": True,
            "result": response,
            "tokens_used": response.usage.total_tokens if response.usage else 0
        }
        
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }

# -----------------------------
# Database setup
# -----------------------------
DATABASE_URL = "sqlite:///./ai_hiring.db"
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
Base = declarative_base()

class PersonaEnum(str, enum.Enum):
    finance = "Finance"
    hiring = "Hiring"
    tech = "Tech"

class JobPostingDB(Base):
    __tablename__ = "job_postings"
    id = Column(String, primary_key=True, default=lambda: str(uuid4()))
    title = Column(String, nullable=False)
    company = Column(String, nullable=False)
    description = Column(Text, nullable=False)
    requirements = Column(Text)
    location = Column(String)
    salary_range = Column(String)
    candidates = relationship("CandidateDB", back_populates="job")

class CandidateDB(Base):
    __tablename__ = "candidates"
    id = Column(String, primary_key=True, default=lambda: str(uuid4()))
    job_id = Column(String, ForeignKey("job_postings.id"))
    name = Column(String, nullable=False)
    email = Column(String)
    resume_text = Column(Text, nullable=False)
    experience_years = Column(Integer)
    skills = Column(Text)
    education = Column(String)
    job = relationship("JobPostingDB", back_populates="candidates")
    evaluations = relationship("EvaluationDB", back_populates="candidate")

class EvaluationDB(Base):
    __tablename__ = "evaluations"
    id = Column(String, primary_key=True, default=lambda: str(uuid4()))
    candidate_id = Column(String, ForeignKey("candidates.id"))
    persona = Column(Enum(PersonaEnum))
    result_summary = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    candidate = relationship("CandidateDB", back_populates="evaluations")

Base.metadata.create_all(bind=engine)

# -----------------------------
# Pydantic models
# -----------------------------
class JobPosting(BaseModel):
    title: str
    company: str
    description: str
    requirements: List[str]
    location: str
    salary_range: Optional[str] = None

class Candidate(BaseModel):
    job_id: str
    name: str
    email: str
    resume_text: str
    experience_years: int
    skills: List[str]
    education: str

class ScreenCandidateRequest(BaseModel):
    candidate_id: str
    persona: PersonaEnum
    prompt_override: Optional[str] = None
    auto_summarize: bool = True

class CandidateOverview(BaseModel):
    candidate_id: str
    name: str
    evaluations: Dict[str, bool]

class EvaluationResult(BaseModel):
    strengths: str
    weaknesses: str
    risk: str
    verdict: str

# -----------------------------
# Endpoints
# -----------------------------
@app.get("/")
async def root():
    return {"message": "Barnes AI Hiring Assistant API", "version": "4.0.0"}

@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "Barnes AI Hiring Assistant"}

@app.post("/upload-job-description")
async def upload_job_description(
    title: str = Form(...),
    company: str = Form(...),
    description: str = Form(...),
    requirements: Optional[str] = Form(None),
    location: Optional[str] = Form(None),
    salary_range: Optional[str] = Form(None),
    file: Optional[UploadFile] = File(None)
):
    """Upload job description with optional file attachment"""
    try:
        db = SessionLocal()
        
        # If file is provided, extract text from it
        job_description_text = description
        if file and file.filename:
            file_content = await file.read()
            try:
                extracted_text = extract_text_from_file(file_content, file.filename)
                job_description_text = f"{description}\n\nAdditional Details from {file.filename}:\n{extracted_text}"
            except Exception as e:
                print(f"Warning: Could not extract text from job description file: {e}")
        
        # Create job posting with optional fields
        job_posting = JobPostingDB(
            title=title,
            company=company,
            description=job_description_text,
            requirements=requirements or "Not specified",
            location=location or "Not specified",
            salary_range=salary_range or "Not specified"
        )
        
        db.add(job_posting)
        db.commit()
        db.refresh(job_posting)
        db.close()
        
        return {
            "success": True,
            "job_id": job_posting.id,
            "message": "Job description uploaded successfully"
        }
        
    except Exception as e:
        print(f"Error uploading job description: {str(e)}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to upload job description: {str(e)}")

@app.get("/job-descriptions")
async def get_job_descriptions():
    """Get all job descriptions"""
    try:
        db = SessionLocal()
        jobs = db.query(JobPostingDB).all()
        db.close()
        
        return {
            "success": True,
            "jobs": [
                {
                    "id": job.id,
                    "title": job.title,
                    "company": job.company,
                    "description": job.description,
                    "requirements": job.requirements,
                    "location": job.location,
                    "salary_range": job.salary_range,
                    "created_at": "Recently uploaded"
                }
                for job in jobs
            ]
        }
        
    except Exception as e:
        print(f"Error getting job descriptions: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get job descriptions: {str(e)}")

@app.post("/upload-resume")
async def upload_resume(
    file: UploadFile = File(...),
    name: str = Form(...),
    email: str = Form(...),
    experience_years: int = Form(...),
    skills: str = Form(...),
    education: str = Form(...),
    job_id: str = Form(...)
):
    """Upload and process resume file"""
    try:
        # Read file content
        file_content = await file.read()
        
        # Extract text from file
        resume_text = extract_text_from_file(file_content, file.filename)

        # --- Debug logging start ---
        print("="*40)
        print(f"DEBUG: Candidate Resume Extraction")
        print(f"File name: {file.filename}")
        print(f"File type: {'PDF' if file.filename.lower().endswith('.pdf') else 'Other'}")
        print(f"Original file size (bytes): {len(file_content)}")
        print(f"Extracted text type: {type(resume_text).__name__}")
        print(f"Extracted text length: {len(resume_text)}")
        print("First 500 chars of resume text:")
        print(resume_text[:500])
        if resume_text[:10].startswith('%PDF'):
            print("WARNING: Text still looks like raw PDF bytes!")
            print("="*40)
        # --- Debug logging end --- 

        # Safely truncate text
        resume_text = truncate_text_safely(resume_text, 3000)
        
        # Parse skills
        skills_list = [skill.strip() for skill in skills.split(",")]
        
        # Save to database
        db = SessionLocal()
        candidate_db = CandidateDB(
            job_id=job_id,
            name=name,
            email=email,
            resume_text=resume_text,
            experience_years=experience_years,
            skills="|".join(skills_list),
            education=education
        )
        db.add(candidate_db)
        db.commit()
        db.refresh(candidate_db)
        candidate_id = candidate_db.id
        db.close()
        
        return {
            "success": True,
            "candidate_id": candidate_id,
            "resume_length": len(resume_text),
            "extracted_text": resume_text[:500] + "..." if len(resume_text) > 500 else resume_text
        }
        
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }

@app.post("/evaluate-candidate")
async def evaluate_candidate(
    candidate_id: str = Form(...),
    persona: str = Form(...),
    custom_prompt: Optional[str] = Form(None)
):
    """Evaluate candidate with specific persona"""
    try:
        db = SessionLocal()
        candidate = db.query(CandidateDB).filter(CandidateDB.id == candidate_id).first()
        
        if not candidate:
            db.close()
            raise HTTPException(status_code=404, detail="Candidate not found")
        
        # Check if already evaluated
        eval_existing = db.query(EvaluationDB).filter(
            EvaluationDB.candidate_id == candidate.id,
            EvaluationDB.persona == persona
        ).first()
        
        if eval_existing:
            db.close()
            return {"cached_result": eval_existing.result_summary}
        
        # ADD THIS CHECK: Verify resume_text is actually text, not binary
        resume_text = candidate.resume_text
        if not resume_text or len(resume_text.strip()) < 50:
            db.close()
            raise HTTPException(status_code=400, detail="Resume text is empty or invalid. Please re-upload the resume.")
        
        # Prepare evaluation prompt
        persona_prompts = {
            "finance": """You are a Finance Director evaluating a candidate. Focus on:
- Cost-benefit analysis of hiring this person
- Budget impact and ROI potential
- Financial risk assessment
- Salary expectations vs market rate
- Long-term financial value to the company

Provide a structured evaluation with strengths, weaknesses, risks, and final verdict.""",
            
            "hiring": """You are a Senior Hiring Manager with 10+ years experience. Focus on:
- Cultural fit and team dynamics
- Leadership potential and growth trajectory
- Past performance indicators
- Communication skills and soft skills
- Overall hireability and market competitiveness

Provide a structured evaluation with strengths, weaknesses, risks, and final verdict.""",
            
            "tech": """You are a Technical Lead evaluating a candidate. Focus on:
- Technical skills and expertise depth
- Problem-solving approach and methodology
- Code quality and best practices
- Learning agility and technology adoption
- Technical leadership potential

Provide a structured evaluation with strengths, weaknesses, risks, and final verdict."""
        }
        
        system_prompt = persona_prompts.get(persona.lower(), persona_prompts["hiring"])
        if custom_prompt:
            system_prompt = custom_prompt
        
        # Add JSON format instruction to system prompt
        system_prompt += """

IMPORTANT: You must respond with a valid JSON object in exactly this format:
{
  "strengths": "Detailed analysis of candidate's strengths",
  "weaknesses": "Areas of concern or improvement needed", 
  "risk": "Risk assessment and potential issues",
  "verdict": "Final hiring recommendation with reasoning"
}

Do not include any text outside the JSON object. Be thorough, professional, and specific in your analysis."""
        
        # Get job information if available
        job_info = ""
        if candidate.job_id:
            job = db.query(JobPostingDB).filter(JobPostingDB.id == candidate.job_id).first()
            if job:
                job_info = f"""

JOB POSTING DETAILS:
Title: {job.title}
Company: {job.company}
Location: {job.location}
Salary Range: {job.salary_range}
Description: {job.description}
Requirements: {job.requirements}"""
        
        # MAKE SURE we're sending clean text to OpenAI
        user_prompt = f"""Please evaluate this candidate based on their CV and the specific job requirements:

CANDIDATE CV:
{resume_text}{job_info}

Provide a structured evaluation focusing on the perspective of a {persona}. Return your response as a valid JSON object with strengths, weaknesses, risk, and verdict fields."""
        
        # Call OpenAI safely
        openai_result = call_openai_safe([
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ], max_tokens=1000, temperature=0.1)
        
        if not openai_result["success"]:
            db.close()
            raise HTTPException(status_code=500, detail=f"AI evaluation failed: {openai_result['error']}")
        
        response = openai_result["result"].choices[0].message.content
        
        # Try to parse JSON response
        try:
            import json
            evaluation = json.loads(response)
        except:
            # If JSON parsing fails, return structured response
            evaluation = {
                "strengths": response,
                "weaknesses": "Unable to parse structured response",
                "risk": "Response format error",
                "verdict": "Please review the full evaluation above"
            }
        
        # Save evaluation
        evaluation_db = EvaluationDB(
            candidate_id=candidate.id,
            persona=persona,
            result_summary=response
        )
        db.add(evaluation_db)
        db.commit()
        db.close()
        
        return {
            "success": True,
            "evaluation": evaluation,
            "tokens_used": openai_result["tokens_used"]
        }
        
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }

@app.post("/debate-candidate")
async def debate_candidate(
    candidate_id: str = Form(...),
    finance_prompt: str = Form(...),
    hiring_prompt: str = Form(...),
    tech_prompt: str = Form(...)
):
    """Multi-expert debate between all three personas"""
    try:
        db = SessionLocal()
        candidate = db.query(CandidateDB).filter(CandidateDB.id == candidate_id).first()
        
        if not candidate:
            db.close()
            raise HTTPException(status_code=404, detail="Candidate not found")
        
        # Get job information if available
        job_info = ""
        if candidate.job_id:
            job = db.query(JobPostingDB).filter(JobPostingDB.id == candidate.job_id).first()
            if job:
                job_info = f"""

JOB POSTING DETAILS:
Title: {job.title}
Company: {job.company}
Location: {job.location}
Salary Range: {job.salary_range}
Description: {job.description}
Requirements: {job.requirements}"""
        
        # Create debate prompt
        system_prompt = f"""You are facilitating a professional debate between three expert personas evaluating a candidate for a specific job. Each persona should speak in their role and provide their perspective on whether to hire this candidate.

The debate should be structured as follows:

Finance Director: {finance_prompt}
Hiring Manager: {hiring_prompt}
Tech Lead: {tech_prompt}

Each persona should evaluate the candidate from their perspective and then engage in a professional debate about the hiring decision."""
        
        user_prompt = f"""Please facilitate a debate between the three personas about this candidate:

CANDIDATE CV:
{candidate.resume_text}{job_info}

Each persona should provide their evaluation and then engage in a professional discussion about the hiring decision."""
        
        # Call OpenAI safely
        openai_result = call_openai_safe([
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ], max_tokens=1500, temperature=0.8)
        
        if not openai_result["success"]:
            db.close()
            raise HTTPException(status_code=500, detail=f"AI debate failed: {openai_result['error']}")
        
        response = openai_result["result"].choices[0].message.content
        
        db.close()
        
        return {
            "success": True,
            "debate": response,
            "tokens_used": openai_result["tokens_used"]
        }
        
    except Exception as e:
        print(f"Error in debate: {str(e)}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Debate failed: {str(e)}")

# -----------------------------
# Job posting endpoints
# -----------------------------
@app.post("/job-postings")
def create_job_posting(job: JobPosting):
    db = SessionLocal()
    job_db = JobPostingDB(
        title=job.title,
        company=job.company,
        description=job.description,
        requirements="|".join(job.requirements),
        location=job.location,
        salary_range=job.salary_range
    )
    db.add(job_db)
    db.commit()
    db.refresh(job_db)
    db.close()
    return {"job_id": job_db.id}

@app.get("/job-postings")
def list_job_postings():
    db = SessionLocal()
    jobs = db.query(JobPostingDB).all()
    result = [
        {
            "id": j.id,
            "title": j.title,
            "company": j.company,
            "description": j.description,
            "requirements": j.requirements.split("|"),
            "location": j.location,
            "salary_range": j.salary_range
        }
        for j in jobs
    ]
    db.close()
    return result

@app.get("/job-postings/{job_id}/overview")
def job_overview(job_id: str):
    db = SessionLocal()
    candidates = db.query(CandidateDB).filter(CandidateDB.job_id == job_id).all()
    overview = []
    for c in candidates:
        evals = {p.value: False for p in PersonaEnum}
        for e in c.evaluations:
            evals[e.persona.value] = True
        overview.append(CandidateOverview(
            candidate_id=c.id,
            name=c.name,
            evaluations=evals
        ))
    db.close()
    return overview


@app.get("/debug-candidate/{candidate_id}")
def debug_candidate(candidate_id: str):
    """Debug endpoint to see what's stored"""
    db = SessionLocal()
    candidate = db.query(CandidateDB).filter(CandidateDB.id == candidate_id).first()
    db.close()
    
    if not candidate:
        return {"error": "Not found"}
    
    return {
        "name": candidate.name,
        "resume_text_type": type(candidate.resume_text).__name__,
        "resume_text_length": len(candidate.resume_text) if candidate.resume_text else 0,
        "first_100_chars": candidate.resume_text[:100] if candidate.resume_text else "EMPTY",
        "looks_like_binary": candidate.resume_text[:10].startswith('%PDF') if candidate.resume_text else False
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
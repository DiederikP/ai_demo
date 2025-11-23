from fastapi import FastAPI, HTTPException, UploadFile, File, Form, Request, Query, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, EmailStr
from typing import List, Optional, Dict
from uuid import uuid4
import openai
import os
import asyncio
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta
from passlib.context import CryptContext
from jose import JWTError, jwt
try:
    from azure.ai.formrecognizer import DocumentAnalysisClient
    from azure.core.credentials import AzureKeyCredential
    AZURE_AVAILABLE = True
except ImportError:
    AZURE_AVAILABLE = False
    DocumentAnalysisClient = None
    AzureKeyCredential = None
    print("Warning: Azure Document Intelligence not available. PDF parsing will be limited.")
import io
import re
import json
from io import BytesIO
from docx import Document
from dotenv import load_dotenv
import traceback
import sys
from sqlalchemy import create_engine, Column, String, Integer, Text, ForeignKey, Enum, DateTime, Boolean, or_, UniqueConstraint, text
from sqlalchemy.orm import sessionmaker, declarative_base, relationship
from sqlalchemy.sql import func
from sqlalchemy import inspect as sqlalchemy_inspect
import enum
import base64
try:
    import fitz  # PyMuPDF
    FITZ_AVAILABLE = True
except ImportError:
    FITZ_AVAILABLE = False
    print("Warning: PyMuPDF (fitz) not available. PDF parsing will be limited.")
try:
    from PyPDF2 import PdfReader
    PYPDF2_AVAILABLE = True
except ImportError:
    PYPDF2_AVAILABLE = False
    print("Warning: PyPDF2 not available. PDF parsing will be limited.")

# Import centralized configuration
# Use direct import - this is the most reliable approach
try:
    from config import (
        OPENAI_MODEL_EVALUATION, OPENAI_MODEL_DEBATE, OPENAI_MODEL_JOB_ANALYSIS, OPENAI_MODEL_TEXT_EXTRACTION,
        OPENAI_MAX_TOKENS_EVALUATION, OPENAI_MAX_TOKENS_DEBATE, OPENAI_MAX_TOKENS_JOB_ANALYSIS, OPENAI_MAX_TOKENS_TEXT_EXTRACTION,
        OPENAI_TEMPERATURE_EVALUATION, OPENAI_TEMPERATURE_DEBATE, OPENAI_TEMPERATURE_JOB_ANALYSIS, OPENAI_TEMPERATURE_TEXT_EXTRACTION,
        AZURE_ENABLED, MAX_RESUME_CHARS, MAX_MOTIVATION_CHARS, MAX_JOB_DESC_CHARS, MAX_COMPANY_NOTE_CHARS, PDF_EXTRACTION_PRIORITY,
        SCORE_MIN, SCORE_MAX, SCORE_DEFAULT, get_score_scale_prompt_text, get_recommendation_from_score
    )
except ImportError:
    # Fallback defaults if config.py doesn't exist
    OPENAI_MODEL_EVALUATION = "gpt-4o-mini"
    OPENAI_MODEL_DEBATE = "gpt-4o-mini"
    OPENAI_MODEL_JOB_ANALYSIS = "gpt-4o-mini"
    OPENAI_MODEL_TEXT_EXTRACTION = "gpt-4o-mini"
    OPENAI_MAX_TOKENS_EVALUATION = 1000
    OPENAI_MAX_TOKENS_DEBATE = 1500
    OPENAI_MAX_TOKENS_JOB_ANALYSIS = 2000
    OPENAI_MAX_TOKENS_TEXT_EXTRACTION = 2000
    OPENAI_TEMPERATURE_EVALUATION = 0.1
    OPENAI_TEMPERATURE_DEBATE = 0.8
    OPENAI_TEMPERATURE_JOB_ANALYSIS = 0.3
    OPENAI_TEMPERATURE_TEXT_EXTRACTION = 0.0
    AZURE_ENABLED = True
    MAX_RESUME_CHARS = 2000
    MAX_MOTIVATION_CHARS = 500
    MAX_JOB_DESC_CHARS = 1000
    MAX_COMPANY_NOTE_CHARS = 500
    PDF_EXTRACTION_PRIORITY = ['pymupdf', 'azure', 'ai']
    SCORE_MIN = 1.0
    SCORE_MAX = 10.0
    SCORE_DEFAULT = 5.0
    def get_score_scale_prompt_text():
        return "SCORE SCALE: 1 = zeer zwak, 2 = zwak, 3 = onder gemiddeld, 4 = gemiddeld, 5 = boven gemiddeld, 6 = goed, 7 = zeer goed, 8 = uitstekend, 9 = uitzonderlijk, 10 = uitmuntend"
    def get_recommendation_from_score(score: float) -> str:
        if score >= 7.0:
            return "Sterk geschikt / uitnodigen voor gesprek"
        elif score >= 5.0:
            return "Twijfelgeval / meer informatie nodig"
        else:
            return "Niet passend op dit moment"

# -----------------------------
# Load environment variables
# -----------------------------
load_dotenv()
openai.api_key = os.getenv("OPENAI_API_KEY")

app = FastAPI(title="Barnes AI Hiring Assistant", version="4.0.0")

# CORS configuration - environment-aware
cors_origins_env = os.getenv("CORS_ORIGINS", "")
if cors_origins_env:
    # If CORS_ORIGINS is set, use it (comma-separated list)
    allowed_origins = [origin.strip() for origin in cors_origins_env.split(",")]
else:
    # Default: allow all origins (for development)
    # In production, set CORS_ORIGINS to your frontend URL
    allowed_origins = ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -----------------------------
# File extraction functions
# -----------------------------

def extract_text_from_file(file_content: bytes, filename: str) -> Dict[str, any]:
    """Extract text from various file formats. Returns dict with text and extraction_method."""
    try:
        print(f"Processing file: {filename}, size: {len(file_content)} bytes")
        
        # Check if it's a PDF file
        if filename.lower().endswith('.pdf'):
            # Follow extraction priority from config
            for method in PDF_EXTRACTION_PRIORITY:
                try:
                    if method == 'pymupdf':
                        print("Detected PDF file, trying PyMuPDF...")
                        result = extract_text_from_pdf_pymupdf(file_content)
                        print(f"PyMuPDF success: extracted {len(result)} characters")
                        return {"text": result, "extraction_method": "PyMuPDF", "azure_used": False}
                    elif method == 'pypdf2':
                        print("Trying PyPDF2 extraction...")
                        result = extract_text_from_pdf_pypdf2(file_content)
                        print(f"PyPDF2 success: extracted {len(result)} characters")
                        return {"text": result, "extraction_method": "PyPDF2", "azure_used": False}
                    elif method == 'azure' and AZURE_ENABLED:
                        print(f"Trying Azure Document Intelligence...")
                        result = extract_text_from_pdf_azure(file_content)
                        print(f"Azure success: extracted {len(result)} characters")
                        return {"text": result, "extraction_method": "Azure Document Intelligence", "azure_used": True}
                    elif method == 'ai':
                        print(f"Previous methods failed, trying AI extraction...")
                        base64_content = base64.b64encode(file_content).decode('utf-8')
                        result = extract_text_with_ai(base64_content, filename)
                        print(f"AI extraction result: {len(result)} characters")
                        return {"text": result, "extraction_method": "OpenAI GPT-4", "azure_used": False}
                except Exception as e:
                    print(f"{method} failed: {str(e)}, trying next method...")
                    continue
            
            # If all methods failed
            raise ValueError("All extraction methods failed")
        
        # Handle Word documents
        if filename.lower().endswith(('.docx', '.doc')):
            try:
                text = extract_text_from_docx(file_content)
                if text.strip():
                    print(f"DOCX extraction successful: {len(text)} characters")
                    return {"text": text.strip(), "extraction_method": "python-docx", "azure_used": False}
            except Exception as e:
                print(f"DOCX extraction failed: {str(e)}")
        
        # For plain text files (.txt, etc.)
        try:
            text = file_content.decode('utf-8')
            if text.strip():
                print(f"Plain text extraction: {len(text)} characters")
                return {"text": text.strip(), "extraction_method": "Plain Text", "azure_used": False}
        except UnicodeDecodeError:
            pass
        
        # If nothing works, try AI extraction as fallback
        try:
            base64_content = base64.b64encode(file_content).decode('utf-8')
            result = extract_text_with_ai(base64_content, filename)
            print(f"AI fallback result: {len(result)} characters")
            return {"text": result, "extraction_method": "OpenAI GPT-4", "azure_used": False}
        except Exception:
            raise ValueError(f"Could not extract text from {filename}")
            
    except Exception as e:
        print(f"Error in extract_text_from_file: {str(e)}")
        raise ValueError(f"Error processing file {filename}: {str(e)}")

def extract_text_from_pdf_pymupdf(pdf_content: bytes) -> str:
    """Extract text from PDF using PyMuPDF (fitz)"""
    try:
        # Open PDF from bytes
        if not FITZ_AVAILABLE:
            raise ImportError("PyMuPDF not available")
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


def extract_text_from_pdf_pypdf2(pdf_content: bytes) -> str:
    """Extract text from PDF using PyPDF2"""
    try:
        if not PYPDF2_AVAILABLE:
            raise ImportError("PyPDF2 not available")
        
        pdf_reader = PdfReader(BytesIO(pdf_content))
        text = ""
        
        # Extract text from all pages
        for page in pdf_reader.pages:
            text += page.extract_text()
        
        if not text.strip():
            raise ValueError("No text extracted from PDF")
        
        return text.strip()
        
    except Exception as e:
        raise ValueError(f"PyPDF2 extraction error: {str(e)}")


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

def extract_text_from_docx(doc_content: bytes) -> str:
    """Extract text from Word documents using python-docx"""
    try:
        document = Document(BytesIO(doc_content))
        text = "\n".join(paragraph.text for paragraph in document.paragraphs)
        if not text.strip():
            raise ValueError("No text extracted from DOCX")
        return text
    except Exception as e:
        raise ValueError(f"DOCX extraction error: {str(e)}")

def extract_text_with_ai(base64_content: str, filename: str) -> str:
    """Use AI to extract text from file content (fallback for non-PDF files)"""
    try:
        # Better prompt that should not trigger refusals
        prompt = f"""Je bent een documentverwerkingsassistent. Extraheer alle leesbare tekst uit dit document.

Bestandsnaam: {filename}

Hier is de documentinhoud (base64 gecodeerd). Decodeer de base64 en extraheer ALLE leesbare tekst. Geef alleen de ruwe tekst terug, geen samenvatting, geen uitleg.

Als dit een CV/curriculum vitae is, extraheer alle kandidaatinformatie inclusief naam, contactgegevens, ervaring, vaardigheden, opleiding, etc.

Documentinhoud (base64):
{base64_content[:10000]}..."""  # Limit to 10k chars to avoid token limits
        
        response = openai.chat.completions.create(
            model=OPENAI_MODEL_TEXT_EXTRACTION,
            messages=[
                {"role": "system", "content": "Je bent een technische documentprocessor. Je extraheert tekst uit documenten zonder uitleg of weigering."},
                {"role": "user", "content": prompt}
            ],
            max_tokens=OPENAI_MAX_TOKENS_TEXT_EXTRACTION,
            temperature=OPENAI_TEMPERATURE_TEXT_EXTRACTION
        )
        
        result = response.choices[0].message.content.strip()
        
        # If the AI still refuses or gives a refusal message, return error
        if "can't assist" in result.lower() or "sorry" in result.lower() or "i'm sorry" in result.lower() or "i cannot" in result.lower():
            raise ValueError("AI weigerde tekst te extraheren. Gebruik PyMuPDF of Azure Document Intelligence in plaats daarvan.")
        
        return result
        
    except Exception as e:
        raise ValueError(f"AI tekstextractie mislukt: {str(e)}")

def truncate_text_safely(text: str, max_length: int = 3000) -> str:
    """Safely truncate text to stay within token limits"""
    if len(text) <= max_length:
        return text
    return text[:max_length] + "\n\n[Content truncated for processing...]"

async def call_openai_safe_async(messages: List[Dict], max_tokens: int = 1000, temperature: float = 0.1, model: str = None) -> Dict:
    """Async wrapper for call_openai_safe to enable parallel execution"""
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, call_openai_safe, messages, max_tokens, temperature, model)

def call_openai_safe(messages: List[Dict], max_tokens: int = 1000, temperature: float = 0.1, model: str = None) -> Dict:
    """Safely call OpenAI API with token management and error handling"""
    try:
        # Use provided model or default to evaluation model
        # Reference module-level variables - they're imported at top of file
        if model is None:
            # Use the module-level variable that was imported at top
            try:
                model = OPENAI_MODEL_EVALUATION
            except NameError:
                model = "gpt-4o-mini"  # Fallback default
        
        # Estimate token count (rough approximation: 1 token ≈ 4 characters)
        estimated_tokens = sum(len(msg.get('content', '')) // 4 for msg in messages)
        
        # For gpt-4o-mini, use conservative limits
        max_input_tokens = 4000  # Conservative limit for smaller model
        
        # If estimated tokens exceed limit, truncate the last user message
        if estimated_tokens > max_input_tokens:
            last_message = messages[-1]
            if last_message and 'content' in last_message:
                # Calculate how much to keep: leave buffer for system prompt and response
                # System prompt is typically ~500 tokens, response needs max_tokens
                # So we can use: max_input_tokens - 500 - max_tokens
                available_tokens = max_input_tokens - 500 - max_tokens
                max_content_length = max(available_tokens * 4, 1000)  # Convert tokens to chars, min 1000
                
                if len(last_message['content']) > max_content_length:
                    messages[-1] = {
                        **last_message,
                        'content': last_message['content'][:max_content_length] + '\n\n[Content truncated for token limits...]'
                    }
        
        response = openai.chat.completions.create(
            model=model,
            messages=messages,
            max_tokens=max_tokens,
            temperature=temperature
        )
        
        return {
            "success": True,
            "result": response,
            "tokens_used": response.usage.total_tokens if response.usage else 0,
            "model_used": model
        }
        
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }

# -----------------------------
# Database setup
# -----------------------------
# Support both SQLite (local/dev) and PostgreSQL (production)
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./ai_hiring.db")

# Configure engine based on database type
if DATABASE_URL.startswith("sqlite"):
    engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
else:
    # PostgreSQL or other databases
    engine = create_engine(DATABASE_URL, pool_pre_ping=True, pool_recycle=300)
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
    ai_analysis = Column(Text, nullable=True)  # Store AI analysis results
    created_at = Column(DateTime(timezone=True), nullable=True)  # Made nullable for SQLite compatibility
    timeline_stage = Column(String, nullable=True)  # Manual timeline stage override: 'waiting', 'inProgress', 'afterFirst', 'multiRound', 'completed'
    is_active = Column(Boolean, default=True)  # Active/Inactive grouping
    weighted_requirements = Column(Text, nullable=True)  # JSON string of dict { "skill": weight }
    assigned_agency_id = Column(String, ForeignKey("users.id"), nullable=True)  # For recruiter portal
    company_id = Column(String, ForeignKey("companies.id"), nullable=True)  # Portal/company isolation
    candidates = relationship("CandidateDB", back_populates="job")

class CandidateDB(Base):
    __tablename__ = "candidates"
    id = Column(String, primary_key=True, default=lambda: str(uuid4()))
    job_id = Column(String, ForeignKey("job_postings.id"), nullable=True)  # Made nullable - candidates can exist without a job
    name = Column(String, nullable=False)
    email = Column(String)
    resume_text = Column(Text, nullable=False)
    motivational_letter = Column(Text)  # Optional motivational letter
    experience_years = Column(Integer)
    skills = Column(Text)
    education = Column(String)
    preferential_job_ids = Column(Text)  # Comma-separated list of job IDs for preferential vacatures
    company_note = Column(Text)  # Note from the supplying company about the candidate
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Extended candidate fields (structured data)
    motivation_reason = Column(Text)  # Motivation for role / reason for leaving current job
    test_results = Column(Text)  # Test results or skill scores (JSON format)
    age = Column(Integer)  # Candidate age
    years_experience = Column(Integer)  # Years of experience (duplicate of experience_years for clarity)
    skill_tags = Column(Text)  # JSON array of skill tags
    prior_job_titles = Column(Text)  # JSON array of prior job titles
    certifications = Column(Text)  # JSON array of certifications
    education_level = Column(String)  # e.g., "Bachelor", "Master", "PhD"
    location = Column(String)  # Candidate location
    communication_level = Column(String)  # e.g., "Native", "Fluent", "Intermediate"
    availability_per_week = Column(Integer)  # Hours per week available
    notice_period = Column(String)  # e.g., "2 weeks", "1 month"
    salary_expectation = Column(Integer)  # EUR per 40h week
    source = Column(String)  # How candidate was sourced (e.g., "LinkedIn", "Agency XYZ", "Direct")
    submitted_by_company_id = Column(String, ForeignKey("companies.id"), nullable=True)  # Which agency/company submitted this candidate
    pipeline_stage = Column(String)  # Pipeline stage: "introduced", "review", "first_interview", "second_interview", "offer", "complete"
    pipeline_status = Column(String)  # Pipeline status: "active", "on_hold", "rejected", "accepted"
    
    job = relationship("JobPostingDB", back_populates="candidates")
    evaluations = relationship("EvaluationDB", back_populates="candidate")

class CandidateConversationDB(Base):
    __tablename__ = "candidate_conversations"
    id = Column(String, primary_key=True, default=lambda: str(uuid4()))
    candidate_id = Column(String, ForeignKey("candidates.id"), nullable=False)
    job_id = Column(String, ForeignKey("job_postings.id"), nullable=True)
    title = Column(String, nullable=False)
    summary = Column(Text, nullable=False)
    pros = Column(Text, nullable=True)
    cons = Column(Text, nullable=True)
    persona_guidance = Column(Text, nullable=True)  # JSON structure with persona-specific adjustments
    created_by = Column(String, nullable=True)
    conversation_channel = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

class EvaluationDB(Base):
    __tablename__ = "evaluations"
    id = Column(String, primary_key=True, default=lambda: str(uuid4()))
    candidate_id = Column(String, ForeignKey("candidates.id"))
    job_id = Column(String, ForeignKey("job_postings.id"), nullable=True)
    persona = Column(Enum(PersonaEnum))
    result_summary = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    candidate = relationship("CandidateDB", back_populates="evaluations")

class EvaluationResultDB(Base):
    __tablename__ = "evaluation_results"
    id = Column(String, primary_key=True, default=lambda: str(uuid4()))
    candidate_id = Column(String, ForeignKey("candidates.id"), nullable=False)
    job_id = Column(String, ForeignKey("job_postings.id"), nullable=False)
    result_type = Column(String, nullable=False)  # 'evaluation' or 'debate'
    result_data = Column(Text, nullable=False)  # JSON string of full result
    selected_personas = Column(Text)  # JSON array of persona IDs
    company_note = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    candidate = relationship("CandidateDB")
    job = relationship("JobPostingDB")

class PersonaDB(Base):
    __tablename__ = "personas"
    id = Column(String, primary_key=True, default=lambda: str(uuid4()))
    name = Column(String, nullable=False)
    display_name = Column(String, nullable=False)
    system_prompt = Column(Text, nullable=False)
    personal_criteria = Column(Text, nullable=True)  # JSON string with custom evaluation criteria (user-defined, set once)
    company_id = Column(String, ForeignKey("companies.id"), nullable=True)  # Portal/company isolation
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    # Unique constraint: same name cannot exist twice in the same portal/company
    __table_args__ = (UniqueConstraint('name', 'company_id', name='uq_persona_name_company'),)

class EvaluationTemplateDB(Base):
    __tablename__ = "evaluation_templates"
    id = Column(String, primary_key=True, default=lambda: str(uuid4()))
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    job_id = Column(String, ForeignKey("job_postings.id"), nullable=True)
    selected_persona_ids = Column(Text, nullable=False)  # Comma-separated list of persona IDs
    selected_actions = Column(Text, nullable=False)  # Comma-separated list: 'evaluate', 'debate', 'compare'
    company_note = Column(Text, nullable=True)
    use_candidate_company_note = Column(Boolean, default=False)
    created_by = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

class EvaluationHandlerDB(Base):
    __tablename__ = "evaluation_handlers"
    id = Column(String, primary_key=True, default=lambda: str(uuid4()))
    name = Column(String, nullable=False)
    display_name = Column(String, nullable=False)
    guidelines = Column(Text, nullable=False)
    is_default = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class CompanyDB(Base):
    __tablename__ = "companies"
    id = Column(String, primary_key=True, default=lambda: str(uuid4()))
    name = Column(String, nullable=False)
    slug = Column(String, unique=True, nullable=False)
    primary_domain = Column(String, unique=True, nullable=True)
    status = Column(String, default="active")  # active, trial, suspended
    plan = Column(String, default="trial")  # trial, pro, enterprise
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

class UserDB(Base):
    __tablename__ = "users"
    id = Column(String, primary_key=True, default=lambda: str(uuid4()))
    email = Column(String, unique=True, nullable=False)
    name = Column(String, nullable=False)
    password_hash = Column(String, nullable=True)  # Hashed password for authentication
    role = Column(String, default="user")  # admin, recruiter, viewer
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    company_id = Column(String, ForeignKey("companies.id"), nullable=True)
    company = relationship("CompanyDB")

class NotificationDB(Base):
    __tablename__ = "notifications"
    id = Column(String, primary_key=True, default=lambda: str(uuid4()))
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    type = Column(String, nullable=False)  # candidate_update, evaluation_complete, conversation_added, job_created, etc.
    title = Column(String, nullable=False)
    message = Column(Text)
    related_candidate_id = Column(String, ForeignKey("candidates.id"), nullable=True)
    related_job_id = Column(String, ForeignKey("job_postings.id"), nullable=True)
    related_result_id = Column(String, ForeignKey("evaluation_results.id"), nullable=True)
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class CommentDB(Base):
    __tablename__ = "comments"
    id = Column(String, primary_key=True, default=lambda: str(uuid4()))
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    candidate_id = Column(String, ForeignKey("candidates.id"), nullable=True)
    job_id = Column(String, ForeignKey("job_postings.id"), nullable=True)
    result_id = Column(String, ForeignKey("evaluation_results.id"), nullable=True)
    content = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

class JobWatcherDB(Base):
    __tablename__ = "job_watchers"
    id = Column(String, primary_key=True, default=lambda: str(uuid4()))
    job_id = Column(String, ForeignKey("job_postings.id"), nullable=False)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    __table_args__ = (UniqueConstraint('job_id', 'user_id', name='unique_job_watcher'),)

class CandidateWatcherDB(Base):
    __tablename__ = "candidate_watchers"
    id = Column(String, primary_key=True, default=lambda: str(uuid4()))
    candidate_id = Column(String, ForeignKey("candidates.id"), nullable=False)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    __table_args__ = (UniqueConstraint('candidate_id', 'user_id', name='unique_candidate_watcher'),)

class ApprovalDB(Base):
    __tablename__ = "approvals"
    id = Column(String, primary_key=True, default=lambda: str(uuid4()))
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    candidate_id = Column(String, ForeignKey("candidates.id"), nullable=True)
    job_id = Column(String, ForeignKey("job_postings.id"), nullable=True)
    result_id = Column(String, ForeignKey("evaluation_results.id"), nullable=True)
    approval_type = Column(String, nullable=False)  # candidate_hire, candidate_reject, evaluation_approve, decision_approve
    status = Column(String, nullable=False)  # approved, rejected, pending
    comment = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    __table_args__ = (UniqueConstraint('user_id', 'candidate_id', 'job_id', 'approval_type', name='unique_user_approval'),)

class ScheduledAppointmentDB(Base):
    __tablename__ = "scheduled_appointments"
    id = Column(String, primary_key=True, default=lambda: str(uuid4()))
    candidate_id = Column(String, ForeignKey("candidates.id"), nullable=False)
    job_id = Column(String, ForeignKey("job_postings.id"), nullable=False)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)  # User who scheduled it
    conversation_id = Column(String, ForeignKey("candidate_conversations.id"), nullable=True)  # Related conversation if any
    scheduled_at = Column(DateTime(timezone=True), nullable=False)  # Date and time of appointment
    type = Column(String, nullable=False)  # 'Eerste Interview', 'Tweede Interview', 'Technische Test', etc.
    location = Column(String, nullable=True)  # 'Teams/Zoom', 'Kantoor', etc.
    notes = Column(Text, nullable=True)
    status = Column(String, default='scheduled')  # 'scheduled', 'completed', 'cancelled', 'rescheduled'
    calendar_event_id = Column(String, nullable=True)  # For future calendar integration
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

Base.metadata.create_all(bind=engine)

def slugify(value: Optional[str]) -> str:
    if not value:
        return str(uuid4())[:8]
    value = value.lower()
    value = re.sub(r'[^a-z0-9]+', '-', value).strip('-')
    return value or str(uuid4())[:8]

def generate_unique_slug(db, base_slug: str) -> str:
    slug = base_slug
    counter = 1
    while db.query(CompanyDB).filter(CompanyDB.slug == slug).first():
        slug = f"{base_slug}-{counter}"
        counter += 1
    return slug

def ensure_column_exists(table_name: str, column_name: str, declaration: str):
    """Ensure a column exists in a table (works with both SQLite and PostgreSQL)"""
    inspector = sqlalchemy_inspect(engine)
    try:
        # Get existing columns using SQLAlchemy inspector (database-agnostic)
        columns = [col['name'] for col in inspector.get_columns(table_name)]
        if column_name not in columns:
            with engine.connect() as connection:
                # Use database-agnostic ALTER TABLE
                connection.execute(text(f"ALTER TABLE {table_name} ADD COLUMN {column_name} {declaration}"))
                connection.commit()
    except Exception as e:
        # Table might not exist yet, which is fine
        print(f"Note: Could not check columns for {table_name}: {e}")

def ensure_default_company() -> Optional[str]:
    db = SessionLocal()
    try:
        default_name = os.getenv("DEFAULT_COMPANY_NAME", "Barnes Demo")
        default_domain = os.getenv("DEFAULT_COMPANY_DOMAIN", "barnes.nl").lower()
        default_slug = slugify(os.getenv("DEFAULT_COMPANY_SLUG", default_name))
        
        company = db.query(CompanyDB).filter(
            or_(CompanyDB.slug == default_slug, CompanyDB.primary_domain == default_domain)
        ).first()
        if not company:
            slug = generate_unique_slug(db, default_slug)
            company = CompanyDB(
                name=default_name,
                slug=slug,
                primary_domain=default_domain,
                status="active",
                plan="demo"
            )
            db.add(company)
            db.commit()
            db.refresh(company)
        return company.id
    finally:
        db.close()

def assign_users_without_company(default_company_id: Optional[str]):
    if not default_company_id:
        return
    db = SessionLocal()
    try:
        users = db.query(UserDB).filter(or_(UserDB.company_id == None, UserDB.company_id == "")).all()
        if users:
            for user in users:
                user.company_id = default_company_id
            db.commit()
    finally:
        db.close()

def get_or_create_company_by_domain(db, domain: Optional[str], fallback_name: Optional[str] = None) -> CompanyDB:
    company = None
    normalized_domain = domain.lower() if domain else None
    if normalized_domain:
        company = db.query(CompanyDB).filter(func.lower(CompanyDB.primary_domain) == normalized_domain).first()
    if company:
        return company
    name = fallback_name or (normalized_domain.replace('.', ' ').title() if normalized_domain else "Nieuwe organisatie")
    slug_base = slugify(normalized_domain or name)
    slug = generate_unique_slug(db, slug_base)
    company = CompanyDB(
        name=name,
        slug=slug,
        primary_domain=normalized_domain,
        status="active",
        plan="trial"
    )
    db.add(company)
    db.commit()
    db.refresh(company)
    return company

def seed_sample_company_users():
    db = SessionLocal()
    try:
        domain = "zuljehemhebben.nl"
        company = db.query(CompanyDB).filter(func.lower(CompanyDB.primary_domain) == domain).first()
        if not company:
            company = CompanyDB(
                name="Zul Je Hem Hebben",
                slug=generate_unique_slug(db, "zuljehemhebben"),
                primary_domain=domain,
                status="active",
                plan="trial"
            )
            db.add(company)
            db.commit()
            db.refresh(company)
        
        sample_users = [
            ("vaatje@zuljehemhebben.nl", "Vaatje", "123", "admin"),
            ("diederik@zuljehemhebben.nl", "Diederik", None, "admin")
        ]
        created = False
        for email, name, password, role in sample_users:
            existing = db.query(UserDB).filter(UserDB.email == email).first()
            if existing:
                # Update existing user with password if provided
                try:
                    if password and not existing.password_hash:
                        existing.password_hash = get_password_hash(password)
                        existing.name = name
                        existing.role = role
                        existing.is_active = True
                        created = True
                    elif password and existing.password_hash:
                        # Update password if provided
                        existing.password_hash = get_password_hash(password)
                        existing.name = name
                        existing.role = role
                        existing.is_active = True
                        created = True
                except Exception as hash_error:
                    print(f"Warning: Could not hash password for {email}: {str(hash_error)}")
                    # Continue without password - user can set it via API later
                    existing.name = name
                    existing.role = role
                    existing.is_active = True
                    created = True
            else:
                # Create new user
                password_hash = None
                try:
                    if password:
                        password_hash = get_password_hash(password)
                except Exception as hash_error:
                    print(f"Warning: Could not hash password for {email}: {str(hash_error)}")
                    # Continue without password - user can set it via API later
                
                user = UserDB(
                    email=email,
                    name=name,
                    role=role,
                    company_id=company.id,
                    password_hash=password_hash,
                    is_active=True
                )
                db.add(user)
                created = True
        if created:
            db.commit()
    finally:
        db.close()

# Ensure schema upgrades for company support
ensure_column_exists("users", "company_id", "TEXT")
ensure_column_exists("users", "password_hash", "TEXT")
ensure_column_exists("evaluations", "job_id", "TEXT")
# Ensure scheduled_appointments table exists (created by Base.metadata.create_all, but ensure columns exist)
default_company_id = ensure_default_company()
assign_users_without_company(default_company_id)
# seed_sample_company_users() will be called after get_password_hash is defined (see below)

# -----------------------------
# Authentication setup
# -----------------------------
# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# JWT configuration
SECRET_KEY = os.getenv("JWT_SECRET_KEY", "your-secret-key-change-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 days

# Security scheme
security = HTTPBearer()

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against a hash"""
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    """Hash a password"""
    return pwd_context.hash(password)

# Now that password hashing is available, seed sample users
# Wrap in try-catch to prevent startup failure if there are issues
try:
    seed_sample_company_users()
except Exception as e:
    print(f"Warning: Could not seed sample users during startup: {str(e)}")
    print("This is not critical - users can still be created manually or via the API.")
    import traceback
    traceback.print_exc()

# Auto-setup required users if they don't exist (for production deployment)
# This ensures the 4 required users are always available
def auto_setup_users():
    """Automatically set up required users if they don't exist"""
    try:
        db = SessionLocal()
        required_emails = [
            "admin@demo.local",
            "user@company.nl",
            "user@recruiter.nl",
            "user@kandidaat.nl"
        ]
        existing_users = db.query(UserDB).filter(UserDB.email.in_(required_emails)).all()
        existing_emails = {u.email for u in existing_users}
        missing_emails = set(required_emails) - existing_emails
        
        if missing_emails:
            print(f"\n{'='*60}")
            print("⚠ MISSING REQUIRED USERS - AUTO-SETUP STARTING")
            print(f"{'='*60}")
            print(f"Missing: {missing_emails}")
            print("Auto-creating required users...")
            
            # Get or create main company
            main_company = db.query(CompanyDB).filter(CompanyDB.slug == "demo-environment").first()
            if not main_company:
                main_company = CompanyDB(
                    name="Demo Environment",
                    slug="demo-environment",
                    primary_domain="demo.local",
                    status="active",
                    plan="trial"
                )
                db.add(main_company)
                db.commit()
                db.refresh(main_company)
                print(f"✓ Created company: {main_company.name} (ID: {main_company.id})")
            else:
                print(f"✓ Using existing company: {main_company.name} (ID: {main_company.id})")
            
            # Create admin user
            if "admin@demo.local" in missing_emails:
                admin_user = UserDB(
                    email="admin@demo.local",
                    name="Admin User",
                    role="admin",
                    company_id=main_company.id,
                    password_hash=get_password_hash("admin123"),
                    is_active=True
                )
                db.add(admin_user)
                print("✓ Created admin user: admin@demo.local / admin123")
            
            # Create company user
            if "user@company.nl" in missing_emails:
                company_user = UserDB(
                    email="user@company.nl",
                    name="Company User",
                    role="company_admin",
                    company_id=main_company.id,
                    password_hash=get_password_hash("company123"),
                    is_active=True
                )
                db.add(company_user)
                print("✓ Created company user: user@company.nl / company123")
            
            # Get or create recruiter company
            recruiter_company = db.query(CompanyDB).filter(CompanyDB.slug == "recruiter-company").first()
            if not recruiter_company:
                recruiter_company = CompanyDB(
                    name="Recruiter Company",
                    slug="recruiter-company",
                    primary_domain="recruiter.local",
                    status="active",
                    plan="trial"
                )
                db.add(recruiter_company)
                db.commit()
                db.refresh(recruiter_company)
                print(f"✓ Created recruiter company: {recruiter_company.name} (ID: {recruiter_company.id})")
            else:
                print(f"✓ Using existing recruiter company: {recruiter_company.name} (ID: {recruiter_company.id})")
            
            # Create recruiter user
            if "user@recruiter.nl" in missing_emails:
                recruiter_user = UserDB(
                    email="user@recruiter.nl",
                    name="Recruiter User",
                    role="recruiter",
                    company_id=recruiter_company.id,
                    password_hash=get_password_hash("recruiter123"),
                    is_active=True
                )
                db.add(recruiter_user)
                print("✓ Created recruiter user: user@recruiter.nl / recruiter123")
            
            # Create candidate user
            if "user@kandidaat.nl" in missing_emails:
                candidate_user = UserDB(
                    email="user@kandidaat.nl",
                    name="Candidate User",
                    role="candidate",
                    company_id=None,
                    password_hash=get_password_hash("kandidaat123"),
                    is_active=True
                )
                db.add(candidate_user)
                print("✓ Created candidate user: user@kandidaat.nl / kandidaat123")
            
            db.commit()
            print(f"\n{'='*60}")
            print("✓ ALL REQUIRED USERS CREATED SUCCESSFULLY!")
            print(f"{'='*60}")
            print("\nLogin credentials:")
            print("  Admin:      admin@demo.local / admin123")
            print("  Company:    user@company.nl / company123")
            print("  Recruiter:  user@recruiter.nl / recruiter123")
            print("  Candidate:  user@kandidaat.nl / kandidaat123")
            print(f"{'='*60}\n")
        else:
            print("✓ All required users exist")
        
        db.close()
    except Exception as e:
        print(f"\n{'='*60}")
        print(f"⚠ WARNING: Could not auto-setup users: {e}")
        print(f"{'='*60}")
        import traceback
        traceback.print_exc()
        # Don't fail startup if setup fails

# Run auto-setup on startup (after password hashing is available)
try:
    auto_setup_users()
except Exception as e:
    print(f"⚠ Could not run auto-setup on startup: {e}")
    # Don't fail startup if auto-setup fails

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Create a JWT access token"""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> UserDB:
    """Get the current authenticated user from JWT token"""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        token = credentials.credentials
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    
    db = SessionLocal()
    try:
        user = db.query(UserDB).filter(UserDB.id == user_id, UserDB.is_active == True).first()
        if user is None:
            raise credentials_exception
        return user
    finally:
        db.close()

# Permission checking functions
def require_role(allowed_roles: List[str]):
    """Dependency to check if user has one of the required roles"""
    async def role_checker(current_user: UserDB = Depends(get_current_user)) -> UserDB:
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Required roles: {', '.join(allowed_roles)}"
            )
        return current_user
    return role_checker

def require_admin():
    """Dependency to check if user is admin"""
    return require_role(["admin"])

def require_recruiter_or_admin():
    """Dependency to check if user is recruiter or admin"""
    # Return the dependency function directly
    return require_role(["admin", "recruiter"])

def check_permission(user: UserDB, resource: str, action: str = "read") -> bool:
    """Check if user has permission for a resource and action"""
    role = user.role.lower() if user.role else "user"
    
    # Admin has full access
    if role == "admin":
        return True
    
    # Define permissions by role
    permissions = {
        "recruiter": {
            "candidates": ["read", "create", "update", "delete"],
            "jobs": ["read", "create", "update", "delete"],
            "evaluations": ["read", "create"],
            "debates": ["read", "create"],
            "results": ["read"],
            "personas": ["read"],
        },
        "viewer": {
            "candidates": ["read"],
            "jobs": ["read"],
            "evaluations": ["read"],
            "debates": ["read"],
            "results": ["read"],
            "personas": ["read"],
        },
        "user": {
            "candidates": ["read"],
            "jobs": ["read"],
            "evaluations": ["read"],
            "debates": ["read"],
            "results": ["read"],
            "personas": ["read"],
        },
    }
    
    role_perms = permissions.get(role, permissions["user"])
    resource_perms = role_perms.get(resource, [])
    
    return action in resource_perms or "*" in resource_perms

def serialize_company(company: Optional[CompanyDB]):
    if not company:
        return None
    return {
        "id": company.id,
        "name": company.name,
        "slug": company.slug,
        "primary_domain": company.primary_domain,
        "plan": company.plan,
        "status": company.status
    }

def serialize_user(user: UserDB, company: Optional[CompanyDB] = None):
    return {
        "id": user.id,
        "email": user.email,
        "name": user.name,
        "role": user.role,
        "created_at": user.created_at.isoformat() if user.created_at else None,
        "company": serialize_company(company or user.company)
    }

# -----------------------------
# Seed default personas
# -----------------------------

def seed_default_personas():
    """Seed the database with default evaluation personas"""
    try:
        db = SessionLocal()
        
        # Check if personas already exist
        existing_personas = db.query(PersonaDB).count()
        if existing_personas > 0:
            db.close()
            return
        
        default_personas = [
            {
                "name": "hiring_manager",
                "display_name": "Hiring Manager",
                "system_prompt": """Je bent een Hiring Manager. Je beoordeelt kandidaten op de volgende punten:

Technische omschrijving van de functie
Verantwoordelijkheden (niveau, zelfstandigheid, leiderschap)
Relevante ervaring in de sector
Grootte/omvang van vorige werkgevers
Duur per werkgever (stabiliteit, groei)
Jaren relevante werkervaring
Opleiding en certificaten
Taalniveaus

Toelichting: overlapping tussen "ervaring", "verantwoordelijkheden" en "technische omschrijving" mag een versterkend effect hebben op de beoordeling van inhoudelijke geschiktheid.

Wees kritisch en grondig in je evaluatie. Geef een score (1-10), benoem sterke punten, aandachtspunten, en een duidelijk advies.

BELANGRIJK - STRUCTURED SCORING LOGIC:
Je taak is niet om creatief of overtuigend te zijn, maar om een consistente, transparante en vergelijkbare beoordeling te geven op basis van je gedefinieerde perspectief. Gebruik de volgende structuur:
- Baseer je score op objectieve criteria en bewijs uit de CV en motivatiebrief
- Wees consistent in je beoordeling: gelijkaardige profielen moeten gelijkaardige scores krijgen
- Wees transparant: leg duidelijk uit waarom je een bepaalde score geeft
- Wees vergelijkbaar: zorg dat je score kan worden vergeleken met andere evaluaties"""
            },
            {
                "name": "bureaurecruiter",
                "display_name": "Bureaurecruiter",
                "system_prompt": """Je bent een Bureaurecruiter. Je beoordeelt de profieltekst, motivatie en sollicitatie-informatie op:

Motivatie voor de organisatie/functie
Vertrekwens huidige functie
Wens tot ontwikkeling of groei
Consistentie met cv
Beschikbaarheid
Opzegtermijn
Salarisindicatie
Reisafstand
Werkvoorkeur (kantoor/thuis)

Toelichting: overlapping tussen "motivatie", "vertrekwens" en "ontwikkelwens" mag leiden tot een sterker positief of negatief advies over motivatie en commitment.

Wees kritisch en grondig in je evaluatie. Geef een score (1-10), benoem sterke punten, aandachtspunten, en een duidelijk advies.

BELANGRIJK - STRUCTURED SCORING LOGIC:
Je taak is niet om creatief of overtuigend te zijn, maar om een consistente, transparante en vergelijkbare beoordeling te geven op basis van je gedefinieerde perspectief. Gebruik de volgende structuur:
- Baseer je score op objectieve criteria en bewijs uit de CV en motivatiebrief
- Wees consistent in je beoordeling: gelijkaardige profielen moeten gelijkaardige scores krijgen
- Wees transparant: leg duidelijk uit waarom je een bepaalde score geeft
- Wees vergelijkbaar: zorg dat je score kan worden vergeleken met andere evaluaties"""
            },
            {
                "name": "hr_recruiter",
                "display_name": "HR / Inhouse Recruiter",
                "system_prompt": """Je bent een HR / Inhouse Recruiter. Je beoordeelt op:

Cultuurfit en waardenmatch
Langetermijn-geschiktheid (duurzame inzetbaarheid, groeipotentieel)
Communicatiestijl en houding
Arbeidsvoorwaarden-fit (uren, salaris, flexibiliteit)
Diversiteit & inclusie-aspecten
Referenties / betrouwbaarheid / consistentie loopbaan
Compliance en wettelijke volledigheid
Beschikbaarheid voor indiensttreding

Toelichting: een sterke cultuurfit kan de beoordeling op motivatie of communicatie versterken; inconsistenties met arbeidsvoorwaarden kunnen de totaalscore temperen.

Wees kritisch en grondig in je evaluatie. Geef een score (1-10), benoem sterke punten, aandachtspunten, en een duidelijk advies.

BELANGRIJK - STRUCTURED SCORING LOGIC:
Je taak is niet om creatief of overtuigend te zijn, maar om een consistente, transparante en vergelijkbare beoordeling te geven op basis van je gedefinieerde perspectief. Gebruik de volgende structuur:
- Baseer je score op objectieve criteria en bewijs uit de CV en motivatiebrief
- Wees consistent in je beoordeling: gelijkaardige profielen moeten gelijkaardige scores krijgen
- Wees transparant: leg duidelijk uit waarom je een bepaalde score geeft
- Wees vergelijkbaar: zorg dat je score kan worden vergeleken met andere evaluaties"""
            }
        ]
        
        for persona_data in default_personas:
            persona = PersonaDB(**persona_data)
            db.add(persona)
        
        db.commit()
        db.close()
        print("Default personas seeded successfully")
        
    except Exception as e:
        print(f"Error seeding default personas: {str(e)}")

# Seed personas on startup
seed_default_personas()

def seed_default_evaluation_handler():
    """Seed the database with default evaluation handler"""
    try:
        db = SessionLocal()
        
        # Check if handler already exists
        existing_handler = db.query(EvaluationHandlerDB).filter(
            EvaluationHandlerDB.is_default == True
        ).first()
        if existing_handler:
            db.close()
            return
        
        default_handler = EvaluationHandlerDB(
            name="standard_evaluator",
            display_name="Standard Evaluator",
            guidelines="""Je evalueert kandidaten vanuit drie professionele perspectieven: Hiring Manager, Bureaurecruiter, en HR/Inhouse Recruiter.

Voor elk criterium geef je:
- Score (1–10) – 1 = zeer zwak, 10 = uitmuntend
- Korte toelichting (2–3 zinnen)

🧑‍💼 HIRING MANAGER PERSPECTIEF - Beoordeel op:
1. Technische omschrijving van de functie
2. Verantwoordelijkheden (niveau, zelfstandigheid, leiderschap)
3. Relevante ervaring in de sector
4. Grootte/omvang van vorige werkgevers
5. Duur per werkgever (stabiliteit, groei)
6. Jaren relevante werkervaring
7. Opleiding en certificaten
8. Taalniveaus

🤝 BUREAURECRUITER PERSPECTIEF - Beoordeel op:
1. Motivatie voor de organisatie/functie
2. Vertrekwens huidige functie
3. Wens tot ontwikkeling of groei
4. Consistentie met cv
5. Beschikbaarheid
6. Opzegtermijn
7. Salarisindicatie
8. Reisafstand
9. Werkvoorkeur (kantoor/thuis)

🧍‍♀️ HR/INHOUSE RECRUITER PERSPECTIEF - Beoordeel op:
1. Cultuurfit en waardenmatch
2. Langetermijn-geschiktheid (duurzame inzetbaarheid, groeipotentieel)
3. Communicatiestijl en houding
4. Arbeidsvoorwaarden-fit (uren, salaris, flexibiliteit)
5. Diversiteit & inclusie-aspecten
6. Referenties / betrouwbaarheid / consistentie loopbaan
7. Compliance en wettelijke volledigheid
8. Beschikbaarheid voor indiensttreding

Geef een objectieve, op bewijs gebaseerde evaluatie vanuit elk perspectief.""",
            is_active=True,
            is_default=True
        )
        db.add(default_handler)
        db.commit()
        db.close()
    except Exception as e:
        print(f"Error seeding default evaluation handler: {str(e)}")

seed_default_evaluation_handler()

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

class PerspectiveEvaluation(BaseModel):
    average_score: float
    key_strengths: str
    key_development_points: str
    sub_advice: str

class EvaluationResult(BaseModel):
    hiring_manager: PerspectiveEvaluation
    agency_recruiter: PerspectiveEvaluation
    hr_recruiter: PerspectiveEvaluation
    total_score: float
    final_analysis: str
    final_recommendation: str

class DebateChatRequest(BaseModel):
    result_id: str
    question: str
    persona_name: Optional[str] = None

class CandidateConversationRequest(BaseModel):
    candidate_id: str
    job_id: Optional[str] = None
    title: str
    summary: str
    pros: Optional[str] = None
    cons: Optional[str] = None
    persona_guidance: Optional[Dict[str, str]] = None
    created_by: Optional[str] = None
    conversation_channel: Optional[str] = None

def serialize_conversation_record(conversation: CandidateConversationDB):
    import json
    persona_guidance = None
    if conversation.persona_guidance:
        try:
            persona_guidance = json.loads(conversation.persona_guidance)
        except json.JSONDecodeError:
            persona_guidance = conversation.persona_guidance
    return {
        "id": conversation.id,
        "candidate_id": conversation.candidate_id,
        "job_id": conversation.job_id,
        "title": conversation.title,
        "summary": conversation.summary,
        "pros": conversation.pros,
        "cons": conversation.cons,
        "persona_guidance": persona_guidance,
        "conversation_channel": conversation.conversation_channel,
        "created_by": conversation.created_by,
        "created_at": conversation.created_at.isoformat() if conversation.created_at else None,
        "updated_at": conversation.updated_at.isoformat() if conversation.updated_at else None
    }

# -----------------------------
# Endpoints
# -----------------------------
@app.get("/")
async def root():
    return {"message": "Barnes AI Hiring Assistant API", "version": "4.0.0"}

@app.get("/config")
async def get_config():
    """Get current AI model configuration"""
    azure_endpoint = os.getenv("AZURE_DOC_INTEL_ENDPOINT", "")
    azure_key = os.getenv("AZURE_DOC_INTEL_KEY", "")
    azure_configured = bool(
        azure_endpoint and 
        azure_key and 
        azure_endpoint != "https://your-resource.cognitiveservices.azure.com/" and 
        azure_key != "your_azure_key_here"
    )
    
    return {
        "openai_models": {
            "evaluation": OPENAI_MODEL_EVALUATION,
            "debate": OPENAI_MODEL_DEBATE,
            "job_analysis": OPENAI_MODEL_JOB_ANALYSIS,
            "text_extraction": OPENAI_MODEL_TEXT_EXTRACTION
        },
        "openai_max_tokens": {
            "evaluation": OPENAI_MAX_TOKENS_EVALUATION,
            "debate": OPENAI_MAX_TOKENS_DEBATE,
            "job_analysis": OPENAI_MAX_TOKENS_JOB_ANALYSIS,
            "text_extraction": OPENAI_MAX_TOKENS_TEXT_EXTRACTION
        },
        "openai_temperature": {
            "evaluation": OPENAI_TEMPERATURE_EVALUATION,
            "debate": OPENAI_TEMPERATURE_DEBATE,
            "job_analysis": OPENAI_TEMPERATURE_JOB_ANALYSIS,
            "text_extraction": OPENAI_TEMPERATURE_TEXT_EXTRACTION
        },
        "azure_document_intelligence": {
            "enabled": AZURE_ENABLED,
            "configured": azure_configured,
            "endpoint": azure_endpoint if azure_configured else None
        },
        "extraction_priority": PDF_EXTRACTION_PRIORITY
    }

@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "Barnes AI Hiring Assistant"}

# -----------------------------
# Authentication endpoints
# -----------------------------

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    name: str
    company_id: Optional[str] = None

class TokenResponse(BaseModel):
    access_token: str
    token_type: str
    user: dict

@app.post("/auth/login", response_model=TokenResponse)
async def login(login_data: LoginRequest):
    """Authenticate user and return JWT token"""
    db = SessionLocal()
    try:
        user = db.query(UserDB).filter(UserDB.email == login_data.email.lower()).first()
        
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password"
            )
        
        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User account is inactive"
            )
        
        # Check if user has a password hash (new users might not have one yet)
        if not user.password_hash:
            # For backward compatibility, allow login without password if no hash exists
            # In production, this should require password reset
            if login_data.password == "demo":  # Temporary demo password
                # Generate hash for future use
                user.password_hash = get_password_hash(login_data.password)
                db.commit()
            else:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid email or password"
                )
        else:
            # Verify password
            try:
                if not verify_password(login_data.password, user.password_hash):
                    raise HTTPException(
                        status_code=status.HTTP_401_UNAUTHORIZED,
                        detail="Invalid email or password"
                    )
            except Exception as verify_error:
                print(f"Error verifying password for {login_data.email}: {str(verify_error)}")
                import traceback
                traceback.print_exc()
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"Error verifying password: {str(verify_error)}"
                )
        
        # Create access token
        access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = create_access_token(
            data={"sub": user.id, "email": user.email, "role": user.role},
            expires_delta=access_token_expires
        )
        
        return TokenResponse(
            access_token=access_token,
            token_type="bearer",
            user={
                "id": user.id,
                "email": user.email,
                "name": user.name,
                "role": user.role,
                "company_id": user.company_id
            }
        )
    finally:
        db.close()

@app.post("/auth/register", response_model=TokenResponse)
async def register(register_data: RegisterRequest):
    """Register a new user"""
    db = SessionLocal()
    try:
        # Check if user already exists
        existing_user = db.query(UserDB).filter(UserDB.email == register_data.email.lower()).first()
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already registered"
            )
        
        # Create new user
        password_hash = get_password_hash(register_data.password)
        new_user = UserDB(
            email=register_data.email.lower(),
            name=register_data.name,
            password_hash=password_hash,
            role="user",  # Default role
            company_id=register_data.company_id,
            is_active=True
        )
        
        db.add(new_user)
        db.commit()
        db.refresh(new_user)
        
        # Create access token
        access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = create_access_token(
            data={"sub": new_user.id, "email": new_user.email, "role": new_user.role},
            expires_delta=access_token_expires
        )
        
        return TokenResponse(
            access_token=access_token,
            token_type="bearer",
            user={
                "id": new_user.id,
                "email": new_user.email,
                "name": new_user.name,
                "role": new_user.role,
                "company_id": new_user.company_id
            }
        )
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to register user: {str(e)}"
        )
    finally:
        db.close()

@app.get("/auth/me")
async def get_current_user_info(current_user: UserDB = Depends(get_current_user)):
    """Get current authenticated user information"""
    return {
        "id": current_user.id,
        "email": current_user.email,
        "name": current_user.name,
        "role": current_user.role,
        "company_id": current_user.company_id,
        "is_active": current_user.is_active
    }

# -----------------------------
# Persona CRUD endpoints
# -----------------------------

@app.get("/personas")
async def get_personas(company_id: Optional[str] = None):
    """Get all active personas, optionally filtered by company/portal"""
    try:
        db = SessionLocal()
        query = db.query(PersonaDB).filter(PersonaDB.is_active == True)
        
        # Filter by company_id if provided (portal isolation)
        if company_id:
            query = query.filter(
                or_(
                    PersonaDB.company_id == company_id,
                    PersonaDB.company_id.is_(None)  # Include global personas
                )
            )
        else:
            # If no company_id, only return global personas (backward compatibility)
            query = query.filter(PersonaDB.company_id.is_(None))
        
        personas = query.all()
        db.close()
        
        import json
        return {
            "success": True,
            "personas": [
                {
                    "id": persona.id,
                    "name": persona.name,
                    "display_name": persona.display_name,
                    "system_prompt": persona.system_prompt,
                    "personal_criteria": json.loads(persona.personal_criteria) if hasattr(persona, 'personal_criteria') and persona.personal_criteria else None,
                    "company_id": persona.company_id,
                    "is_active": persona.is_active,
                    "created_at": persona.created_at.isoformat() if persona.created_at else None
                }
                for persona in personas
            ]
        }
        
    except Exception as e:
        print(f"Error getting personas: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get personas: {str(e)}")

@app.post("/personas")
async def create_persona(
    request: Request
):
    """Create a new evaluation persona - accepts both JSON and Form data"""
    try:
        db = SessionLocal()
        
        # Check content type to handle both JSON and Form data
        content_type = request.headers.get("content-type", "")
        
        if "application/json" in content_type:
            # Handle JSON request
            data = await request.json()
            name = data.get("name", "")
            display_name = data.get("display_name", "")
            system_prompt = data.get("system_prompt", "")
            personal_criteria = data.get("personal_criteria", None)  # Optional JSON string or dict
        else:
            # Handle Form data
            form_data = await request.form()
            name = form_data.get("name", "")
            display_name = form_data.get("display_name", "")
            system_prompt = form_data.get("system_prompt", "")
            personal_criteria = form_data.get("personal_criteria", None)
        
        # Convert list values to strings if needed
        if isinstance(name, list):
            name = name[0] if name else ""
        if isinstance(display_name, list):
            display_name = display_name[0] if display_name else ""
        if isinstance(system_prompt, list):
            system_prompt = system_prompt[0] if system_prompt else ""
        if isinstance(personal_criteria, list):
            personal_criteria = personal_criteria[0] if personal_criteria else None
        
        # Process personal_criteria - convert to JSON string if needed
        import json
        personal_criteria_str = None
        if personal_criteria:
            if isinstance(personal_criteria, str):
                # Try to validate JSON if it's a string
                try:
                    json.loads(personal_criteria)  # Validate JSON
                    personal_criteria_str = personal_criteria
                except:
                    # If not valid JSON, treat as plain text and convert to JSON
                    personal_criteria_str = json.dumps([personal_criteria])
            elif isinstance(personal_criteria, (list, dict)):
                # Convert dict/list to JSON string
                personal_criteria_str = json.dumps(personal_criteria)
        
        # Validate required fields
        if not name or not display_name or not system_prompt:
            db.close()
            raise HTTPException(status_code=400, detail="Name, display_name, and system_prompt are required")
        
        # Get company_id from request (for portal isolation)
        company_id = None
        if "application/json" in content_type:
            company_id = data.get("company_id", None)
        else:
            company_id_form = form_data.get("company_id", None)
            if isinstance(company_id_form, list):
                company_id = company_id_form[0] if company_id_form else None
            else:
                company_id = company_id_form
        
        # Check if persona with this name already exists in the same portal/company
        # Prevent duplicate specialists in the same portal
        query = db.query(PersonaDB).filter(PersonaDB.name == name)
        if company_id:
            query = query.filter(PersonaDB.company_id == company_id)
        else:
            # If no company_id, check for global personas (company_id is NULL)
            query = query.filter(PersonaDB.company_id.is_(None))
        
        existing = query.first()
        if existing:
            db.close()
            portal_msg = f"in this portal" if company_id else "globally"
            raise HTTPException(
                status_code=400, 
                detail=f"Persona with name '{name}' already exists {portal_msg}. Each portal can only have one specialist with the same name."
            )
        
        persona = PersonaDB(
            name=name,
            display_name=display_name,
            system_prompt=system_prompt,
            personal_criteria=personal_criteria_str,
            company_id=company_id  # Associate with portal/company for isolation
        )
        
        db.add(persona)
        db.commit()
        db.refresh(persona)
        db.close()
        
        return {
            "success": True,
            "message": "Persona created successfully",
            "persona": {
                "id": persona.id,
                "name": persona.name,
                "display_name": persona.display_name,
                "system_prompt": persona.system_prompt
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error creating persona: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to create persona: {str(e)}")

@app.put("/personas/{persona_id}")
async def update_persona(
    persona_id: str,
    request: Request
):
    """Update a persona - accepts both JSON and Form data"""
    try:
        db = SessionLocal()
        
        persona = db.query(PersonaDB).filter(PersonaDB.id == persona_id).first()
        if not persona:
            db.close()
            raise HTTPException(status_code=404, detail="Persona not found")
        
        # Check content type to handle both JSON and Form data
        content_type = request.headers.get("content-type", "")
        
        if "application/json" in content_type:
            # Handle JSON request
            data = await request.json()
            name = data.get("name")
            display_name = data.get("display_name")
            system_prompt = data.get("system_prompt")
            personal_criteria = data.get("personal_criteria", None)  # Optional
            is_active = data.get("is_active")
        else:
            # Handle Form data
            form_data = await request.form()
            name = form_data.get("name")
            display_name = form_data.get("display_name")
            system_prompt = form_data.get("system_prompt")
            personal_criteria = form_data.get("personal_criteria", None)
            is_active = form_data.get("is_active")
            # Convert is_active from string to bool if present
            if is_active is not None:
                is_active = str(is_active).lower() in ('true', '1', 'yes', 'on')
        
        # Convert list values to strings if needed
        if isinstance(name, list):
            name = name[0] if name else None
        if isinstance(display_name, list):
            display_name = display_name[0] if display_name else None
        if isinstance(system_prompt, list):
            system_prompt = system_prompt[0] if system_prompt else None
        if isinstance(personal_criteria, list):
            personal_criteria = personal_criteria[0] if personal_criteria else None
        
        # Process personal_criteria - convert to JSON string if needed
        import json
        if personal_criteria is not None:
            if isinstance(personal_criteria, str):
                # Try to validate JSON if it's a string
                try:
                    json.loads(personal_criteria)  # Validate JSON
                    persona.personal_criteria = personal_criteria
                except:
                    # If not valid JSON, treat as plain text and convert to JSON
                    persona.personal_criteria = json.dumps([personal_criteria])
            elif isinstance(personal_criteria, (list, dict)):
                # Convert dict/list to JSON string
                persona.personal_criteria = json.dumps(personal_criteria)
            elif personal_criteria == "":
                # Clear personal_criteria
                persona.personal_criteria = None
        
        # Get company_id (use existing if not provided in update)
        current_company_id = persona.company_id
        if "application/json" in content_type:
            update_company_id = data.get("company_id", current_company_id)
        else:
            company_id_form = form_data.get("company_id", None)
            if company_id_form:
                update_company_id = company_id_form[0] if isinstance(company_id_form, list) else company_id_form
            else:
                update_company_id = current_company_id
        
        # Update only provided fields
        if name is not None:
            # Check if new name conflicts with existing persona in the same portal
            # Prevent duplicate specialists in the same portal (excluding current persona)
            query = db.query(PersonaDB).filter(
                PersonaDB.name == name,
                PersonaDB.id != persona_id
            )
            if update_company_id:
                query = query.filter(PersonaDB.company_id == update_company_id)
            else:
                query = query.filter(PersonaDB.company_id.is_(None))
            
            existing = query.first()
            if existing:
                db.close()
                portal_msg = f"in this portal" if update_company_id else "globally"
                raise HTTPException(
                    status_code=400, 
                    detail=f"Persona with name '{name}' already exists {portal_msg}. Each portal can only have one specialist with the same name."
                )
            persona.name = name
        
        # Update company_id if provided
        if update_company_id != current_company_id:
            persona.company_id = update_company_id
        if display_name is not None:
            persona.display_name = display_name
        if system_prompt is not None:
            persona.system_prompt = system_prompt
        if is_active is not None:
            persona.is_active = is_active
        
        db.commit()
        db.refresh(persona)
        db.close()
        
        return {
            "success": True,
            "message": "Persona updated successfully",
            "persona": {
                "id": persona.id,
                "name": persona.name,
                "display_name": persona.display_name,
                "system_prompt": persona.system_prompt,
                "is_active": persona.is_active
            }
        }
        
    except Exception as e:
        print(f"Error updating persona: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to update persona: {str(e)}")

# -----------------------------
# Evaluation Handler endpoints
# -----------------------------
@app.get("/evaluation-handlers")
async def get_evaluation_handlers():
    """Get all active evaluation handlers"""
    try:
        db = SessionLocal()
        handlers = db.query(EvaluationHandlerDB).filter(EvaluationHandlerDB.is_active == True).all()
        db.close()
        
        return {
            "success": True,
            "handlers": [
                {
                    "id": h.id,
                    "name": h.name,
                    "display_name": h.display_name,
                    "guidelines": h.guidelines,
                    "is_default": h.is_default,
                    "created_at": h.created_at.isoformat() if h.created_at else None
                }
                for h in handlers
            ]
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }

@app.post("/evaluation-handlers")
async def create_evaluation_handler(
    name: str = Form(...),
    display_name: str = Form(...),
    guidelines: str = Form(...),
    is_default: Optional[bool] = Form(False)
):
    """Create a new evaluation handler"""
    try:
        db = SessionLocal()
        
        # If setting as default, unset other defaults
        if is_default:
            existing_defaults = db.query(EvaluationHandlerDB).filter(
                EvaluationHandlerDB.is_default == True
            ).all()
            for default_handler in existing_defaults:
                default_handler.is_default = False
        
        handler = EvaluationHandlerDB(
            name=name,
            display_name=display_name,
            guidelines=guidelines,
            is_active=True,
            is_default=is_default
        )
        db.add(handler)
        db.commit()
        db.refresh(handler)
        db.close()
        
        return {
            "success": True,
            "handler_id": handler.id
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }

@app.put("/evaluation-handlers/{handler_id}")
async def update_evaluation_handler(
    handler_id: str,
    name: Optional[str] = Form(None),
    display_name: Optional[str] = Form(None),
    guidelines: Optional[str] = Form(None),
    is_default: Optional[bool] = Form(None)
):
    """Update an evaluation handler"""
    try:
        db = SessionLocal()
        handler = db.query(EvaluationHandlerDB).filter(EvaluationHandlerDB.id == handler_id).first()
        
        if not handler:
            db.close()
            raise HTTPException(status_code=404, detail="Evaluation handler not found")
        
        if name is not None:
            handler.name = name
        if display_name is not None:
            handler.display_name = display_name
        if guidelines is not None:
            handler.guidelines = guidelines
        if is_default is not None:
            # If setting as default, unset other defaults
            if is_default:
                existing_defaults = db.query(EvaluationHandlerDB).filter(
                    EvaluationHandlerDB.is_default == True,
                    EvaluationHandlerDB.id != handler_id
                ).all()
                for default_handler in existing_defaults:
                    default_handler.is_default = False
            handler.is_default = is_default
        
        db.commit()
        db.refresh(handler)
        db.close()
        
        return {
            "success": True,
            "handler": {
                "id": handler.id,
                "name": handler.name,
                "display_name": handler.display_name,
                "guidelines": handler.guidelines,
                "is_default": handler.is_default
            }
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }

@app.delete("/evaluation-handlers/{handler_id}")
async def delete_evaluation_handler(handler_id: str):
    """Soft delete an evaluation handler (set is_active to False)"""
    try:
        db = SessionLocal()
        
        handler = db.query(EvaluationHandlerDB).filter(EvaluationHandlerDB.id == handler_id).first()
        if not handler:
            db.close()
            raise HTTPException(status_code=404, detail="Evaluation handler not found")
        
        # Don't allow deleting the default handler
        if handler.is_default:
            db.close()
            raise HTTPException(status_code=400, detail="Cannot delete the default evaluation handler")
        
        handler.is_active = False
        db.commit()
        db.close()
        
        return {
            "success": True,
            "message": "Evaluation handler deleted successfully"
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }

@app.delete("/personas/{persona_id}")
async def delete_persona(persona_id: str):
    """Soft delete a persona (set is_active to False)"""
    try:
        db = SessionLocal()
        
        persona = db.query(PersonaDB).filter(PersonaDB.id == persona_id).first()
        if not persona:
            db.close()
            raise HTTPException(status_code=404, detail="Persona not found")
        
        # Soft delete - set is_active to False
        persona.is_active = False
        db.commit()
        db.close()
        
        return {
            "success": True,
            "message": f"Persona '{persona.display_name}' deactivated successfully"
        }
        
    except Exception as e:
        print(f"Error deleting persona: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to delete persona: {str(e)}")

# -----------------------------
# Job posting endpoints
# -----------------------------

@app.post("/upload-job-description")
async def upload_job_description(
    request: Request
):
    """Upload job description - accepts both JSON and Form data"""
    try:
        db = SessionLocal()
        
        # Check content type to handle both JSON and Form data
        content_type = request.headers.get("content-type", "")
        
        watcher_user_ids = []
        
        if "application/json" in content_type:
            # Handle JSON request
            data = await request.json()
            title = data.get("title", "")
            company = data.get("company", "")
            description = data.get("description", "")
            requirements = data.get("requirements", "Not specified")
            location = data.get("location", "Not specified")
            salary_range = data.get("salary_range", "Not specified")
            watcher_user_ids = data.get("watcher_user_ids", [])
            weighted_requirements = data.get("weighted_requirements", None)  # JSON string or dict
        else:
            # Handle Form data (for file uploads)
            form_data = await request.form()
            title = form_data.get("title", "")
            company = form_data.get("company", "")
            description = form_data.get("description", "")
            requirements = form_data.get("requirements", "Not specified")
            location = form_data.get("location", "Not specified")
            salary_range = form_data.get("salary_range", "Not specified")
            file = form_data.get("file")
            
            # If file is provided, extract text from it
            if file and hasattr(file, 'filename') and file.filename:
                file_content = await file.read()
                try:
                    extraction_result = extract_text_from_file(file_content, file.filename)
                    extracted_text = extraction_result["text"]
                    description = f"{description}\n\nAdditional Details from {file.filename}:\n{extracted_text}"
                except Exception as e:
                    print(f"Warning: Could not extract text from job description file: {e}")
        
        # Convert string values to proper types
        if isinstance(title, list):
            title = title[0] if title else ""
        if isinstance(company, list):
            company = company[0] if company else ""
        if isinstance(description, list):
            description = description[0] if description else ""
        if isinstance(requirements, list):
            requirements = requirements[0] if requirements else "Not specified"
        if isinstance(location, list):
            location = location[0] if location else "Not specified"
        if isinstance(salary_range, list):
            salary_range = salary_range[0] if salary_range else "Not specified"
        
        # Validate required fields
        if not title or not company or not description:
            db.close()
            raise HTTPException(status_code=400, detail="Title, company, and description are required")
        
        # Get current user to set company_id (for multi-portal isolation)
        current_user = None
        auth_header = request.headers.get("authorization") or request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            try:
                token = auth_header.replace("Bearer ", "")
                payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
                user_id = payload.get("sub")
                if user_id:
                    current_user = db.query(UserDB).filter(UserDB.id == user_id, UserDB.is_active == True).first()
                    if current_user:
                        print(f"[DEBUG] Found user: {current_user.email}, company_id: {current_user.company_id}, role: {current_user.role}")
                    else:
                        print(f"[DEBUG] User not found for user_id: {user_id}")
            except (JWTError, Exception) as e:
                # Not authenticated - job will be created without company_id (backward compatibility)
                print(f"[DEBUG] Auth error: {e}")
                pass
        else:
            print(f"[DEBUG] No auth header found")
        
        # Get company_id from user or request data
        job_company_id = None
        if "application/json" in content_type:
            job_company_id = data.get("company_id", None)
        else:
            company_id_form = form_data.get("company_id", None)
            if company_id_form:
                job_company_id = company_id_form[0] if isinstance(company_id_form, list) else company_id_form
        
        # If no company_id in request, use current user's company_id
        # IMPORTANT: Always use current user's company_id if available (for multi-portal isolation)
        if not job_company_id and current_user:
            if current_user.company_id:
                job_company_id = current_user.company_id
                print(f"[DEBUG] Using current user's company_id: {job_company_id}")
            else:
                print(f"[DEBUG] No company_id set. User: {current_user.email}, role: {current_user.role}, user.company_id: {current_user.company_id}")
        
        # Process weighted_requirements - convert to JSON string if needed
        import json
        weighted_requirements_str = None
        if weighted_requirements:
            if isinstance(weighted_requirements, str):
                # Already a JSON string, validate it
                try:
                    json.loads(weighted_requirements)  # Validate JSON
                    weighted_requirements_str = weighted_requirements
                except:
                    weighted_requirements_str = None  # Invalid JSON, ignore
            elif isinstance(weighted_requirements, dict):
                # Convert dict to JSON string
                weighted_requirements_str = json.dumps(weighted_requirements)
        
        # Create job posting with optional fields
        from datetime import datetime
        job_posting = JobPostingDB(
            title=title,
            company=company,
            description=description,
            requirements=requirements or "Not specified",
            location=location or "Not specified",
            salary_range=salary_range or "Not specified",
            created_at=datetime.now(),  # Set created_at explicitly for SQLite compatibility
            weighted_requirements=weighted_requirements_str,
            company_id=job_company_id,  # Set company_id for multi-portal isolation
            is_active=True  # New vacancies are active by default
        )
        
        db.add(job_posting)
        db.commit()
        db.refresh(job_posting)
        job_id = job_posting.id
        
        # Also add watchers to JobWatcherDB
        if watcher_user_ids:
            try:
                for user_id in watcher_user_ids:
                    if user_id and user_id.strip():
                        # Check if already watching
                        existing = db.query(JobWatcherDB).filter(
                            JobWatcherDB.job_id == job_id,
                            JobWatcherDB.user_id == user_id.strip()
                        ).first()
                        if not existing:
                            watcher = JobWatcherDB(job_id=job_id, user_id=user_id.strip())
                            db.add(watcher)
                db.commit()
            except Exception as watcher_error:
                print(f"Error adding job watchers: {str(watcher_error)}")
        
        # Create notifications for watchers
        if watcher_user_ids:
            try:
                for user_id in watcher_user_ids:
                    if user_id and user_id.strip():
                        notification = NotificationDB(
                            user_id=user_id.strip(),
                            type="job_created",
                            title=f"Nieuwe vacature: {title}",
                            message=f"Een nieuwe vacature '{title}' bij {company} is aangemaakt",
                            related_job_id=job_id
                        )
                        db.add(notification)
                db.commit()
            except Exception as notif_error:
                print(f"Error creating job notifications: {str(notif_error)}")
        
        # Notify all recruiter companies about the new vacancy
        # Find all companies with recruiter role users
        try:
            recruiter_companies = db.query(CompanyDB).join(UserDB).filter(
                UserDB.role == "recruiter",
                UserDB.is_active == True
            ).distinct().all()
            
            for recruiter_company in recruiter_companies:
                # Get all active recruiter users in this company
                recruiter_users = db.query(UserDB).filter(
                    UserDB.company_id == recruiter_company.id,
                    UserDB.role == "recruiter",
                    UserDB.is_active == True
                ).all()
                
                for recruiter_user in recruiter_users:
                    notification = NotificationDB(
                        user_id=recruiter_user.id,
                        type="new_vacancy_available",
                        title=f"Nieuwe vacature beschikbaar: {title}",
                        message=f"Bedrijf {company} heeft een nieuwe vacature '{title}' geplaatst",
                        related_job_id=job_id
                    )
                    db.add(notification)
            
            db.commit()
        except Exception as recruiter_notif_error:
            print(f"Error creating recruiter notifications: {str(recruiter_notif_error)}")
        
        # Verify the job was created with correct company_id BEFORE closing DB
        created_job = db.query(JobPostingDB).filter(JobPostingDB.id == job_id).first()
        actual_company_id = created_job.company_id if created_job else None
        actual_is_active = created_job.is_active if created_job and hasattr(created_job, 'is_active') else True
        
        print(f"[DEBUG] Created job posting: id={job_id}, title={title}, company={company}")
        print(f"[DEBUG]   Expected company_id: {job_company_id}, Actual company_id: {actual_company_id}")
        print(f"[DEBUG]   Expected is_active: True, Actual is_active: {actual_is_active}")
        
        db.close()
        
        return {
            "success": True,
            "job": {
                "id": job_id,
                "title": title,
                "company": company,
                "company_id": actual_company_id,  # Return actual value from DB
                "is_active": actual_is_active  # Return actual value from DB
            },
            "id": job_id,  # Also return id at top level for compatibility
            "message": "Job description uploaded successfully"
        }
        
    except Exception as e:
        print(f"Error uploading job description: {str(e)}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to upload job description: {str(e)}")

@app.get("/job-descriptions")
async def get_job_descriptions(
    request: Request,
    company_id: Optional[str] = None,
    recruiter_id: Optional[str] = None
):
    """Get all job descriptions, optionally filtered by company_id or recruiter_id
    
    Allows unauthenticated requests for public pages, but filters by company/recruiter if authenticated.
    """
    try:
        import json
        from fastapi import Request
        db = SessionLocal()
        query = db.query(JobPostingDB)
        
        # Try to get current user (optional - allow unauthenticated requests)
        current_user = None
        auth_header = request.headers.get("authorization") or request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            try:
                token = auth_header.replace("Bearer ", "")
                payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
                user_id = payload.get("sub")
                if user_id:
                    current_user = db.query(UserDB).filter(UserDB.id == user_id, UserDB.is_active == True).first()
            except (JWTError, Exception):
                # Not authenticated - allow request but don't filter by user
                pass
        
        # Filter by recruiter_id if provided (recruiter portal)
        if recruiter_id:
            query = query.filter(JobPostingDB.assigned_agency_id == recruiter_id)
        elif current_user and current_user.role == "recruiter":
            # Recruiters see all vacancies (not just assigned) - they can see company vacancies
            # The recruiter portal endpoint handles filtering for assigned vs new
            pass  # Don't filter here - show all vacancies
        
        # Filter by company_id if provided (multi-portal isolation)
        # Include jobs with NULL company_id for backward compatibility with old data
        if company_id:
            query = query.filter(
                or_(
                    JobPostingDB.company_id == company_id,
                    JobPostingDB.company_id.is_(None)  # Include old jobs without company_id
                )
            )
        elif current_user and current_user.company_id:
            # If user is authenticated and has company_id, filter by user's company
            # Include jobs with NULL company_id for backward compatibility
            query = query.filter(
                or_(
                    JobPostingDB.company_id == current_user.company_id,
                    JobPostingDB.company_id.is_(None)  # Include old jobs without company_id
                )
            )
        
        jobs = query.all()
        
        # Debug logging
        print(f"[DEBUG get_job_descriptions] Found {len(jobs)} jobs")
        print(f"[DEBUG get_job_descriptions] company_id param: {company_id}")
        print(f"[DEBUG get_job_descriptions] current_user: {current_user.email if current_user else 'None'}, company_id: {current_user.company_id if current_user else 'None'}")
        for job in jobs[:3]:  # Log first 3 jobs
            print(f"[DEBUG] Job: {job.title}, company_id: {job.company_id}, is_active: {getattr(job, 'is_active', 'N/A')}")
        
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
                    "ai_analysis": json.loads(job.ai_analysis) if job.ai_analysis else None,
                    "created_at": job.created_at.isoformat() if job.created_at else "Recently uploaded",
                    "timeline_stage": job.timeline_stage,
                    "is_active": job.is_active if hasattr(job, 'is_active') else True,  # Default to active if not set
                    "weighted_requirements": job.weighted_requirements if hasattr(job, 'weighted_requirements') else None,
                    "assigned_agency_id": job.assigned_agency_id if hasattr(job, 'assigned_agency_id') else None,
                    "company_id": job.company_id if hasattr(job, 'company_id') else None  # Include company_id in response
                }
                for job in jobs
            ]
        }
        
    except Exception as e:
        print(f"Error getting job descriptions: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get job descriptions: {str(e)}")

@app.delete("/job-descriptions/{job_id}")
async def delete_job_description(job_id: str):
    """Delete a job description with safe cascade handling"""
    try:
        db = SessionLocal()
        
        # Check if job exists
        job = db.query(JobPostingDB).filter(JobPostingDB.id == job_id).first()
        if not job:
            db.close()
            raise HTTPException(status_code=404, detail="Job posting not found")
        
        # Check for associated candidates
        candidates = db.query(CandidateDB).filter(CandidateDB.job_id == job_id).all()
        if candidates:
            # Option 1: Soft delete - set job_id to NULL for candidates
            for candidate in candidates:
                candidate.job_id = None
            
            # Delete associated evaluations
            db.query(EvaluationDB).filter(
                EvaluationDB.candidate_id.in_([c.id for c in candidates])
            ).delete()
        
        # Delete the job posting
        db.delete(job)
        db.commit()
        db.close()
        
        return {
            "success": True,
            "message": f"Job posting '{job.title}' deleted successfully",
            "candidates_affected": len(candidates)
        }
        
    except Exception as e:
        print(f"Error deleting job description: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to delete job description: {str(e)}")

@app.post("/extract-job-from-url")
async def extract_job_from_url(request: Request):
    """Extract job posting details from a URL using AI"""
    try:
        data = await request.json()
        url = data.get("url", "").strip()
        
        if not url:
            raise HTTPException(status_code=400, detail="URL is required")
        
        # Fetch the webpage content
        import httpx
        try:
            async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
                response = await client.get(url, headers={
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
                    "Accept-Language": "nl-NL,nl;q=0.9,en-US;q=0.8,en;q=0.7",
                    "Accept-Encoding": "gzip, deflate, br",
                    "Connection": "keep-alive",
                    "Upgrade-Insecure-Requests": "1"
                })
                response.raise_for_status()
                html_content = response.text
        except httpx.TimeoutException:
            raise HTTPException(status_code=408, detail="Request timeout - URL took too long to respond")
        except httpx.HTTPStatusError as e:
            raise HTTPException(status_code=e.response.status_code, detail=f"HTTP error {e.response.status_code} when fetching URL")
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Failed to fetch URL: {str(e)}")
        
        # Extract text from HTML (simple approach - remove tags)
        import re
        # Remove script and style tags
        html_content = re.sub(r'<script[^>]*>.*?</script>', '', html_content, flags=re.DOTALL | re.IGNORECASE)
        html_content = re.sub(r'<style[^>]*>.*?</style>', '', html_content, flags=re.DOTALL | re.IGNORECASE)
        # Extract text from remaining HTML
        text_content = re.sub(r'<[^>]+>', ' ', html_content)
        text_content = re.sub(r'\s+', ' ', text_content).strip()
        
        # Limit content length but keep more for better extraction
        if len(text_content) > 20000:
            text_content = text_content[:20000] + "..."
        
        # Use AI to extract structured job posting information
        from config import OPENAI_MODEL_JOB_EXTRACTION
        
        system_prompt = """Je bent een expert in het extraheren van vacatureinformatie van webpagina's. 
Haal de volgende informatie uit de gegeven tekst:
- Titel van de functie
- Bedrijfsnaam
- Functieomschrijving
- Vereisten/kwalificaties
- Locatie
- Salarisrange (indien beschikbaar)

IMPORTANT: Je moet antwoorden met een geldig JSON object in exact dit formaat:
{
  "title": "Functietitel",
  "company": "Bedrijfsnaam",
  "description": "Volledige functieomschrijving",
  "requirements": "Vereisten en kwalificaties",
  "location": "Locatie",
  "salary_range": "Salarisrange (indien beschikbaar, anders leeg)"
}

Geef geen tekst buiten het JSON object. Als informatie niet beschikbaar is, gebruik een lege string."""
        
        user_prompt = f"""Extraheer de vacatureinformatie uit de volgende tekst van deze URL: {url}

TEKST VAN WEBPAGINA:
{text_content}

Extraheer alle beschikbare informatie en vul het JSON object in."""
        
        openai_result = call_openai_safe([
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ], max_tokens=1500, temperature=0.1, model=OPENAI_MODEL_JOB_EXTRACTION)
        
        if not openai_result["success"]:
            raise HTTPException(status_code=500, detail=f"AI extraction failed: {openai_result.get('error', 'Unknown error')}")
        
        response_text = openai_result["result"].choices[0].message.content
        
        # Parse JSON response
        import json
        import re
        
        cleaned_response = response_text.strip()
        if "```json" in cleaned_response:
            json_match = re.search(r'```json\s*(.*?)\s*```', cleaned_response, re.DOTALL)
            if json_match:
                cleaned_response = json_match.group(1).strip()
        elif "```" in cleaned_response:
            json_match = re.search(r'```\s*(.*?)\s*```', cleaned_response, re.DOTALL)
            if json_match:
                cleaned_response = json_match.group(1).strip()
        
        if not cleaned_response.startswith('{'):
            json_match = re.search(r'\{.*\}', cleaned_response, re.DOTALL)
            if json_match:
                cleaned_response = json_match.group(0)
        
        try:
            job_data = json.loads(cleaned_response)
        except json.JSONDecodeError as e:
            print(f"JSON parsing error: {str(e)}")
            print(f"Response (first 500 chars): {cleaned_response[:500]}")
            # Return partial data if possible
            job_data = {
                "title": "",
                "company": "",
                "description": text_content[:1000] if text_content else "",
                "requirements": "",
                "location": "",
                "salary_range": ""
            }
        
        return {
            "success": True,
            "job": job_data
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error extracting job from URL: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to extract job posting: {str(e)}")

@app.put("/job-descriptions/{job_id}")
async def update_job_description(
    job_id: str,
    request: Request,
    title: Optional[str] = Form(None),
    company: Optional[str] = Form(None),
    description: Optional[str] = Form(None),
    requirements: Optional[str] = Form(None),
    location: Optional[str] = Form(None),
    salary_range: Optional[str] = Form(None),
    timeline_stage: Optional[str] = Form(None),
    is_active: Optional[str] = Form(None)
):
    """Update a job description - supports both Form data and JSON"""
    try:
        db = SessionLocal()
        
        job = db.query(JobPostingDB).filter(JobPostingDB.id == job_id).first()
        if not job:
            db.close()
            raise HTTPException(status_code=404, detail="Job posting not found")
        
        # Check if request is JSON
        content_type = request.headers.get("content-type", "")
        data = {}
        
        if "application/json" in content_type:
            # Parse JSON body
            try:
                data = await request.json()
            except:
                pass
        else:
            # Use Form data (already parsed by FastAPI)
            form_data = await request.form()
            data = {
                "title": title,
                "company": company,
                "description": description,
                "requirements": requirements,
                "location": location,
                "salary_range": salary_range,
                "timeline_stage": timeline_stage,
                "is_active": is_active,
                "weighted_requirements": form_data.get("weighted_requirements", None)
            }
        
        # Update only provided fields
        if "title" in data and data["title"] is not None:
            job.title = data["title"]
        if "company" in data and data["company"] is not None:
            job.company = data["company"]
        if "description" in data and data["description"] is not None:
            job.description = data["description"]
        if "requirements" in data and data["requirements"] is not None:
            job.requirements = data["requirements"]
        if "location" in data and data["location"] is not None:
            job.location = data["location"]
        if "salary_range" in data and data["salary_range"] is not None:
            job.salary_range = data["salary_range"]
        if "timeline_stage" in data and data["timeline_stage"] is not None:
            # Validate timeline_stage value
            valid_stages = ['waiting', 'inProgress', 'afterFirst', 'multiRound', 'completed']
            if data["timeline_stage"] in valid_stages:
                job.timeline_stage = data["timeline_stage"]
            else:
                db.close()
                raise HTTPException(status_code=400, detail=f"Invalid timeline_stage. Must be one of: {', '.join(valid_stages)}")
        if "is_active" in data and data["is_active"] is not None:
            # Convert string to bool if needed (Form data always strings)
            if isinstance(data["is_active"], str):
                job.is_active = data["is_active"].lower() in ('true', '1', 'yes', 'on')
            else:
                job.is_active = bool(data["is_active"])
        
        if "weighted_requirements" in data and data["weighted_requirements"] is not None:
            # Process weighted_requirements - convert to JSON string if needed
            import json
            weighted_requirements = data["weighted_requirements"]
            if isinstance(weighted_requirements, str):
                # Already a JSON string, validate it
                try:
                    json.loads(weighted_requirements)  # Validate JSON
                    job.weighted_requirements = weighted_requirements
                except:
                    pass  # Invalid JSON, keep existing value
            elif isinstance(weighted_requirements, dict):
                # Convert dict to JSON string
                job.weighted_requirements = json.dumps(weighted_requirements)
            elif weighted_requirements == "" or weighted_requirements is None:
                # Clear weighted requirements
                job.weighted_requirements = None
        
        db.commit()
        db.refresh(job)
        db.close()
        
        return {
            "success": True,
            "message": "Job posting updated successfully",
            "job": {
                "id": job.id,
                "title": job.title,
                "company": job.company,
                "description": job.description,
                "requirements": job.requirements,
                "location": job.location,
                "salary_range": job.salary_range,
                "is_active": job.is_active if hasattr(job, 'is_active') else True,
                "timeline_stage": job.timeline_stage
            }
        }
        
    except Exception as e:
        print(f"Error updating job description: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to update job description: {str(e)}")

@app.post("/upload-resume")
async def upload_resume(
    request: Request,
    file: UploadFile = File(...),
    name: Optional[str] = Form(None),
    email: Optional[str] = Form(None),
    experience_years: Optional[int] = Form(None),
    skills: Optional[str] = Form(None),
    education: Optional[str] = Form(None),
    job_id: Optional[str] = Form(None),
    job_ids: Optional[str] = Form(None),  # Comma-separated list of job IDs for preferential vacatures
    motivational_letter: Optional[str] = Form(None),
    motivation_file: Optional[UploadFile] = File(None),
    company_note: Optional[str] = Form(None),
    company_note_file: Optional[UploadFile] = File(None),
    candidate_id: Optional[str] = Form(None),
    # Extended candidate fields - Form() always returns strings
    motivation_reason: Optional[str] = Form(None),
    test_results: Optional[str] = Form(None),
    age: Optional[str] = Form(None),  # Accept as string, convert to int
    years_experience: Optional[str] = Form(None),  # Accept as string, convert to int
    skill_tags: Optional[str] = Form(None),  # JSON array as string
    prior_job_titles: Optional[str] = Form(None),  # JSON array as string
    certifications: Optional[str] = Form(None),  # JSON array as string
    education_level: Optional[str] = Form(None),
    location: Optional[str] = Form(None),
    communication_level: Optional[str] = Form(None),
    availability_per_week: Optional[str] = Form(None),  # Accept as string, convert to int
    notice_period: Optional[str] = Form(None),
    salary_expectation: Optional[str] = Form(None),  # Accept as string, convert to int
    source: Optional[str] = Form(None),
    pipeline_stage: Optional[str] = Form(None),
    pipeline_status: Optional[str] = Form(None),
    submitted_by_company_id: Optional[str] = Form(None),  # Which agency/company is submitting this candidate
    force_duplicate: Optional[str] = Form(None),  # 'true' to force create duplicate, 'overwrite' to replace existing
    duplicate_candidate_id: Optional[str] = Form(None)  # ID of existing candidate to overwrite
):
    """Upload and process resume file"""
    try:
        # Try to get authenticated user (optional - allows unauthenticated uploads for backward compatibility)
        current_user = None
        try:
            auth_header = request.headers.get("authorization") or request.headers.get("Authorization")
            if auth_header and auth_header.startswith("Bearer "):
                token = auth_header.replace("Bearer ", "")
                from jose import jwt
                payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
                user_id = payload.get("sub")
                if user_id:
                    db = SessionLocal()
                    current_user = db.query(UserDB).filter(UserDB.id == user_id, UserDB.is_active == True).first()
                    db.close()
        except:
            # Authentication failed or not provided - continue without it
            pass
        
        # If user is a recruiter and no submitted_by_company_id is provided, use their company_id
        final_submitted_by_company_id = submitted_by_company_id
        if current_user and current_user.role == "recruiter" and not final_submitted_by_company_id and current_user.company_id:
            final_submitted_by_company_id = current_user.company_id
        # Read file content
        file_content = await file.read()
        
        # Extract text from file
        extraction_result = extract_text_from_file(file_content, file.filename)
        resume_text = extraction_result["text"]
        extraction_method = extraction_result["extraction_method"]
        azure_used = extraction_result.get("azure_used", False)

        # --- Debug logging start ---
        print("="*40)
        print(f"DEBUG: Candidate Resume Extraction")
        print(f"File name: {file.filename}")
        print(f"File type: {'PDF' if file.filename.lower().endswith('.pdf') else 'Other'}")
        print(f"Original file size (bytes): {len(file_content)}")
        print(f"Extraction method: {extraction_method}")
        print(f"Azure Document Intelligence used: {azure_used}")
        print(f"Extracted text length: {len(resume_text)}")
        print("First 500 chars of resume text:")
        print(resume_text[:500])
        if resume_text[:10].startswith('%PDF'):
            print("WARNING: Text still looks like raw PDF bytes!")
        print("="*40)
        # --- Debug logging end --- 

        # Safely truncate text
        resume_text = truncate_text_safely(resume_text, MAX_RESUME_CHARS)
        
        # Normalize name and email (handle empty strings, None, etc.)
        name = name.strip() if name and isinstance(name, str) and name.strip() else None
        email = email.strip() if email and isinstance(email, str) and email.strip() else None
        
        print(f"[DEBUG] Initial name: {name}, email: {email}")
        
        # Extract name and email from resume text if not provided
        # IMPORTANT: This happens BEFORE any validation to ensure name is always set
        if not name or not email:
            try:
                import re
                # Extract email using regex pattern
                if not email:
                    email_pattern = r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b'
                    email_match = re.search(email_pattern, resume_text)
                    if email_match:
                        email = email_match.group(0)
                        print(f"[DEBUG] Extracted email from CV: {email}")
                
                # Extract name from first few lines (usually at top of CV)
                if not name:
                    print(f"[DEBUG] Attempting to extract name from CV...")
                    first_lines = resume_text.split('\n')[:15]  # Check more lines
                    for i, line in enumerate(first_lines):
                        line = line.strip()
                        # Skip empty lines and lines that look like headers or contact info
                        if not line:
                            continue
                        skip_keywords = ['email', 'phone', 'tel', 'address', 'linkedin', 'www', 'http', 'cv', 'resume', 'curriculum', 'vitae', 'mobile', 'telefoon']
                        if any(skip in line.lower() for skip in skip_keywords):
                            continue
                        # Check if line looks like a name (2-4 words, mostly letters, possibly with dots or hyphens)
                        words = line.split()
                        if 2 <= len(words) <= 4:
                            # Check if all words are mostly alphabetic (allow dots, hyphens, apostrophes)
                            if all(re.match(r'^[A-Za-zÀ-ÿ\-\'\.]+$', word) for word in words):
                                name = line
                                print(f"[DEBUG] Extracted name from CV (line {i+1}): {name}")
                                break
                    
                    # If still no name, try first non-empty line that's not a header
                    if not name:
                        for i, line in enumerate(first_lines[:5]):
                            line = line.strip()
                            if line and len(line) > 3 and not any(skip in line.lower() for skip in skip_keywords):
                                # Use first substantial line as name
                                name = line[:50]  # Limit length
                                print(f"[DEBUG] Using first substantial line as name: {name}")
                                break
            except Exception as e:
                print(f"[DEBUG] Error extracting name/email from CV: {str(e)}")
                import traceback
                traceback.print_exc()
        
        # If still no name, use a random number (MUST have a name for database)
        if not name or not name.strip():
            import random
            random_number = random.randint(10000, 99999)
            name = f"Kandidaat-{random_number}"
            print(f"[DEBUG] Could not extract name from CV, using random name '{name}'")
        
        # Final safety check - ensure name is not None or empty at this point
        if not name or not str(name).strip():
            import random
            random_number = random.randint(10000, 99999)
            name = f"Kandidaat-{random_number}"
            print(f"[DEBUG] CRITICAL: Name was still missing after extraction, using random name '{name}'")
        
        # Ensure name is a proper string
        name = str(name).strip()
        print(f"[DEBUG] Final name before candidate creation: '{name}'")
        
        # Process motivational letter file if provided
        motivation_text = motivational_letter
        motivation_azure_used = False
        if motivation_file and motivation_file.filename:
            try:
                motivation_content = await motivation_file.read()
                motivation_result = extract_text_from_file(motivation_content, motivation_file.filename)
                motivation_text = motivation_result["text"]
                motivation_azure_used = motivation_result.get("azure_used", False)
                motivation_text = truncate_text_safely(motivation_text, MAX_MOTIVATION_CHARS)
                print(f"Motivation letter extracted: {len(motivation_text)} characters using {motivation_result['extraction_method']}")
            except Exception as e:
                print(f"Error processing motivation file: {str(e)}")
                motivation_text = motivational_letter  # Fallback to text input
        
        # Process company note file if provided
        company_note_text = company_note
        company_note_azure_used = False
        if company_note_file and company_note_file.filename:
            try:
                company_note_content = await company_note_file.read()
                company_note_result = extract_text_from_file(company_note_content, company_note_file.filename)
                company_note_text = company_note_result["text"]
                company_note_azure_used = company_note_result.get("azure_used", False)
                print(f"Company note extracted: {len(company_note_text)} characters using {company_note_result['extraction_method']}")
            except Exception as e:
                print(f"Error processing company note file: {str(e)}")
                company_note_text = company_note  # Fallback to text input
        
        # Parse skills - provide default if not provided
        if skills:
            skills_list = [skill.strip() for skill in skills.split(",") if skill.strip()]
        else:
            skills_list = []
        
        # Provide defaults for optional fields
        experience_years = experience_years if experience_years is not None else 0
        education = education if education else "Not specified"
        
        # Parse job_ids for preferential vacatures (many-to-many)
        preferential_job_ids = []
        if job_ids:
            preferential_job_ids = [jid.strip() for jid in job_ids.split(",") if jid.strip()]
        elif job_id:
            # If single job_id provided, add it to preferential list
            preferential_job_ids = [job_id]
        
        # Save to database
        db = SessionLocal()
        existing_candidate = None
        if candidate_id:
            existing_candidate = db.query(CandidateDB).filter(CandidateDB.id == candidate_id).first()
            if not existing_candidate:
                db.close()
                raise HTTPException(status_code=404, detail="Candidate not found for update")
        
        # Parse extended fields - handle empty strings and convert types
        skill_tags_json = skill_tags if skill_tags and skill_tags.strip() else None
        prior_job_titles_json = prior_job_titles if prior_job_titles and prior_job_titles.strip() else None
        certifications_json = certifications if certifications and certifications.strip() else None
        
        # Use years_experience if provided, otherwise fall back to experience_years
        # Convert years_experience if it's a string
        try:
            years_experience_int = int(years_experience) if years_experience is not None and str(years_experience).strip() else None
        except (ValueError, TypeError):
            years_experience_int = None
        final_years_experience = years_experience_int if years_experience_int is not None else experience_years
        
        # Convert age and other integers - handle empty strings
        try:
            age_int = int(age) if age is not None and str(age).strip() else None
        except (ValueError, TypeError):
            age_int = None
        
        try:
            availability_per_week_int = int(availability_per_week) if availability_per_week is not None and str(availability_per_week).strip() else None
        except (ValueError, TypeError):
            availability_per_week_int = None
        
        try:
            salary_expectation_int = int(salary_expectation) if salary_expectation is not None and str(salary_expectation).strip() else None
        except (ValueError, TypeError):
            salary_expectation_int = None
        
        # Convert strings - handle empty strings
        education_level_str = education_level if education_level and education_level.strip() else None
        location_str = location if location and location.strip() else None
        communication_level_str = communication_level if communication_level and communication_level.strip() else None
        notice_period_str = notice_period if notice_period and notice_period.strip() else None
        source_str = source if source and source.strip() else None
        pipeline_stage_str = pipeline_stage if pipeline_stage and pipeline_stage.strip() else None
        pipeline_status_str = pipeline_status if pipeline_status and pipeline_status.strip() else None
        motivation_reason_str = motivation_reason if motivation_reason and motivation_reason.strip() else None
        test_results_str = test_results if test_results and test_results.strip() else None
        
        # Debug logging for extended fields
        print(f"DEBUG: Extended fields received (raw):")
        print(f"  age: {age} (type: {type(age)})")
        print(f"  years_experience: {years_experience} (type: {type(years_experience)})")
        print(f"  skill_tags: {skill_tags}")
        print(f"  prior_job_titles: {prior_job_titles}")
        print(f"  certifications: {certifications}")
        print(f"  education_level: {education_level}")
        print(f"  location: {location}")
        print(f"  communication_level: {communication_level}")
        print(f"  availability_per_week: {availability_per_week} (type: {type(availability_per_week)})")
        print(f"  notice_period: {notice_period}")
        print(f"  salary_expectation: {salary_expectation} (type: {type(salary_expectation)})")
        print(f"  source: {source}")
        print(f"  pipeline_stage: {pipeline_stage}")
        print(f"  pipeline_status: {pipeline_status}")
        print(f"  motivation_reason: {motivation_reason}")
        print(f"  test_results: {test_results}")
        print(f"\nDEBUG: Extended fields processed:")
        print(f"  age_int: {age_int}")
        print(f"  availability_per_week_int: {availability_per_week_int}")
        print(f"  salary_expectation_int: {salary_expectation_int}")
        print(f"  skill_tags_json: {skill_tags_json}")
        print(f"  prior_job_titles_json: {prior_job_titles_json}")
        print(f"  certifications_json: {certifications_json}")
        
        if existing_candidate:
            # Update existing candidate
            existing_candidate.name = name or existing_candidate.name
            existing_candidate.email = email or existing_candidate.email
            existing_candidate.resume_text = resume_text
            existing_candidate.motivational_letter = motivation_text or existing_candidate.motivational_letter
            if final_years_experience is not None:
                existing_candidate.experience_years = final_years_experience
                existing_candidate.years_experience = final_years_experience
            if skills_list:
                existing_candidate.skills = "|".join(skills_list)
            if education:
                existing_candidate.education = education
            if job_id:
                existing_candidate.job_id = job_id
            if preferential_job_ids:
                existing_candidate.preferential_job_ids = ",".join(preferential_job_ids)
            if company_note_text:
                existing_candidate.company_note = company_note_text
            
            # Update extended fields - use processed values
            existing_candidate.motivation_reason = motivation_reason_str
            existing_candidate.test_results = test_results_str
            existing_candidate.age = age_int
            existing_candidate.skill_tags = skill_tags_json
            existing_candidate.prior_job_titles = prior_job_titles_json
            existing_candidate.certifications = certifications_json
            existing_candidate.education_level = education_level_str
            existing_candidate.location = location_str
            existing_candidate.communication_level = communication_level_str
            existing_candidate.availability_per_week = availability_per_week_int
            existing_candidate.notice_period = notice_period_str
            existing_candidate.salary_expectation = salary_expectation_int
            existing_candidate.source = source_str
            existing_candidate.pipeline_stage = pipeline_stage_str or 'introduced'
            existing_candidate.pipeline_status = pipeline_status_str or 'active'
            
            db.commit()
            db.refresh(existing_candidate)
            candidate_db = existing_candidate
        else:
            # Create new candidate
            # CRITICAL: Name MUST be set at this point (should have been extracted from CV or set to random number)
            # Multiple safety checks to ensure name is NEVER None or empty
            
            print(f"[DEBUG] Before candidate creation - name value: {repr(name)}, type: {type(name)}")
            
            # Check 1: Handle None
            if name is None:
                import random
                random_number = random.randint(10000, 99999)
                name = f"Kandidaat-{random_number}"
                print(f"[DEBUG] Check 1: Name was None, set to '{name}'")
            
            # Check 2: Convert to string and handle empty
            name = str(name) if name is not None else f"Kandidaat-{random.randint(10000, 99999)}"
            name = name.strip()
            
            # Check 3: If still empty after strip, use random
            if not name:
                import random
                random_number = random.randint(10000, 99999)
                name = f"Kandidaat-{random_number}"
                print(f"[DEBUG] Check 3: Name was empty after strip, set to '{name}'")
            
            # Final verification
            if not name or len(name.strip()) == 0:
                import random
                random_number = random.randint(10000, 99999)
                name = f"Kandidaat-{random_number}"
                print(f"[DEBUG] FINAL CHECK: Name was still invalid, forcing to '{name}'")
            
            name = str(name).strip()
            print(f"[DEBUG] FINAL name value before CandidateDB creation: '{name}' (length: {len(name)})")
            
            # Assert that name is definitely set
            assert name and len(name) > 0, f"Name must be set but was: {repr(name)}"
            
            # Check for duplicate candidate (prevent second agency from submitting same candidate)
            # Check by email if provided, otherwise by name (less reliable but better than nothing)
            duplicate_candidate = None
            if email and email.strip():
                # Check for existing candidate with same email (case-insensitive)
                duplicate_candidate = db.query(CandidateDB).filter(
                    func.lower(CandidateDB.email) == email.strip().lower()
                ).first()
            elif name:
                # If no email, check by name (case-insensitive exact match)
                duplicate_candidate = db.query(CandidateDB).filter(
                    func.lower(CandidateDB.name) == name.strip().lower()
                ).first()
            
            # If duplicate found and submitted by different company/agency, prevent submission
            if duplicate_candidate:
                existing_source = None
                existing_source_name = "Unknown"
                
                # Check if duplicate was submitted by a different company
                if hasattr(duplicate_candidate, 'submitted_by_company_id') and duplicate_candidate.submitted_by_company_id:
                    existing_source = duplicate_candidate.submitted_by_company_id
                    existing_company = db.query(CompanyDB).filter(CompanyDB.id == existing_source).first()
                    existing_source_name = existing_company.name if existing_company else existing_source
                elif duplicate_candidate.source:
                    existing_source_name = duplicate_candidate.source
                
                # Block duplicate if:
                # 1. Different company is trying to submit (both have company_id and they differ)
                # 2. New submission has company_id but existing one doesn't (prevent agencies from claiming existing candidates)
                # 3. New submission doesn't have company_id but existing one does (same agency protection)
                should_block = False
                
                # Get existing source (company_id if available, otherwise source field)
                existing_company_id = None
                if hasattr(duplicate_candidate, 'submitted_by_company_id') and duplicate_candidate.submitted_by_company_id:
                    existing_company_id = duplicate_candidate.submitted_by_company_id
                
                if final_submitted_by_company_id and existing_company_id:
                    # Both have company_id - block if different
                    should_block = final_submitted_by_company_id != existing_company_id
                elif final_submitted_by_company_id and not existing_company_id:
                    # New has company_id, existing doesn't - block to prevent agencies claiming existing candidates
                    should_block = True
                    existing_source_name = existing_source_name if existing_source_name != "Unknown" else "een andere partij"
                elif not final_submitted_by_company_id and existing_company_id:
                    # New doesn't have company_id, existing does - block to protect existing agency
                    should_block = True
                elif not final_submitted_by_company_id and not existing_company_id:
                    # Neither has company_id - allow for backward compatibility (legacy candidates without company tracking)
                    # But if source field is set and different, still warn/block
                    if duplicate_candidate.source and source_str and duplicate_candidate.source != source_str:
                        should_block = True
                        existing_source_name = duplicate_candidate.source
                    else:
                        should_block = False
                
                # Check if user wants to force duplicate or overwrite
                force_duplicate_flag = force_duplicate and str(force_duplicate).lower() == 'true'
                overwrite_existing = duplicate_candidate_id == duplicate_candidate.id
                
                if should_block and not force_duplicate_flag and not overwrite_existing:
                    # Return duplicate warning instead of blocking
                    # This allows frontend to show a modal with options
                    db.close()
                    return {
                        "success": False,
                        "duplicate_detected": True,
                        "existing_candidate_id": duplicate_candidate.id,
                        "existing_candidate_name": duplicate_candidate.name,
                        "existing_candidate_email": duplicate_candidate.email,
                        "existing_source_name": existing_source_name,
                        "existing_source_id": existing_company_id,
                        "message": f"Deze kandidaat is al eerder ingediend door {existing_source_name}. "
                                  f"Wil je deze kandidaat overschrijven, onderbreken of toch toevoegen?"
                    }
                
                # If force_duplicate or overwrite, continue with creation/update
                if overwrite_existing:
                    # Update existing candidate instead of creating new one
                    existing_candidate = duplicate_candidate
                    existing_candidate.name = name or existing_candidate.name
                    existing_candidate.email = email or existing_candidate.email
                    existing_candidate.resume_text = resume_text
                    existing_candidate.motivational_letter = motivation_text or existing_candidate.motivational_letter
                    if final_years_experience is not None:
                        existing_candidate.experience_years = final_years_experience
                        existing_candidate.years_experience = final_years_experience
                    if skills_list:
                        existing_candidate.skills = "|".join(skills_list)
                    if education:
                        existing_candidate.education = education
                    if job_id:
                        existing_candidate.job_id = job_id
                    if preferential_job_ids:
                        existing_candidate.preferential_job_ids = ",".join(preferential_job_ids)
                    if company_note_text:
                        existing_candidate.company_note = company_note_text
                    
                    # Update extended fields
                    existing_candidate.motivation_reason = motivation_reason_str
                    existing_candidate.test_results = test_results_str
                    existing_candidate.age = age_int
                    existing_candidate.skill_tags = skill_tags_json
                    existing_candidate.prior_job_titles = prior_job_titles_json
                    existing_candidate.certifications = certifications_json
                    existing_candidate.education_level = education_level_str
                    existing_candidate.location = location_str
                    existing_candidate.communication_level = communication_level_str
                    existing_candidate.availability_per_week = availability_per_week_int
                    existing_candidate.notice_period = notice_period_str
                    existing_candidate.salary_expectation = salary_expectation_int
                    existing_candidate.source = source_str
                    existing_candidate.submitted_by_company_id = final_submitted_by_company_id
                    existing_candidate.pipeline_stage = pipeline_stage_str or existing_candidate.pipeline_stage or 'introduced'
                    existing_candidate.pipeline_status = pipeline_status_str or existing_candidate.pipeline_status or 'active'
                    
                    db.commit()
                    db.refresh(existing_candidate)
                    candidate_db = existing_candidate
                    
                    # Skip duplicate check and creation since we're updating
                    response_payload = {
                        "success": True,
                        "candidate_id": candidate_db.id,
                        "resume_length": len(resume_text),
                        "extracted_text": resume_text[:500] + "..." if len(resume_text) > 500 else resume_text,
                        "extraction_method": extraction_method,
                        "azure_used": azure_used or motivation_azure_used,
                        "overwritten": True
                    }
                    db.close()
                    return response_payload
            
            # ABSOLUTE FINAL check: name MUST be set (should have been extracted or set to random number by now)
            # This should NEVER happen, but we check anyway
            if not name or not str(name).strip():
                import random
                random_number = random.randint(10000, 99999)
                name = f"Kandidaat-{random_number}"
                print(f"[DEBUG] ABSOLUTE FINAL: Name was still missing when creating CandidateDB, forcing to '{name}'")
            
            # Convert to string and ensure it's not empty
            name = str(name).strip()
            if not name:
                import random
                name = f"Kandidaat-{random.randint(10000, 99999)}"
            
            print(f"[DEBUG] Creating CandidateDB with name='{name}' (type: {type(name)}, length: {len(name)})")
            
            # Final assertion - this will raise an error if name is still invalid
            if not name or len(name) == 0:
                import random
                name = f"Kandidaat-{random.randint(10000, 99999)}"
                print(f"[DEBUG] EMERGENCY: Name was empty, forced to '{name}'")
            
            # One more check - if name is still somehow invalid, use random
            try:
                assert name and len(str(name).strip()) > 0, f"Name validation failed: {repr(name)}"
            except AssertionError:
                import random
                name = f"Kandidaat-{random.randint(10000, 99999)}"
                print(f"[DEBUG] ASSERTION FAILED: Name was invalid, forced to '{name}'")
            
            candidate_db = CandidateDB(
                job_id=job_id,
                name=str(name).strip(),  # Guaranteed to be set and non-empty at this point
                email=email,
                resume_text=resume_text,
                motivational_letter=motivation_text,
                experience_years=final_years_experience if final_years_experience is not None else 0,
                years_experience=final_years_experience if final_years_experience is not None else 0,
                skills="|".join(skills_list) if skills_list else "",
                education=education or "Not specified",
                company_note=company_note_text,
                # Extended fields - use processed values
                motivation_reason=motivation_reason_str,
                test_results=test_results_str,
                age=age_int,
                skill_tags=skill_tags_json,
                prior_job_titles=prior_job_titles_json,
                certifications=certifications_json,
                education_level=education_level_str,
                location=location_str,
                communication_level=communication_level_str,
                availability_per_week=availability_per_week_int,
                notice_period=notice_period_str,
                salary_expectation=salary_expectation_int,
                source=source_str,
                submitted_by_company_id=final_submitted_by_company_id,  # Track which agency/company submitted
                pipeline_stage=pipeline_stage_str or 'introduced',
                pipeline_status=pipeline_status_str or 'active'
            )
            
            # Try to add and commit, catch any database errors
            try:
                print(f"[DEBUG] About to add candidate to database with name='{candidate_db.name}' (type: {type(candidate_db.name)}, length: {len(str(candidate_db.name))})")
                db.add(candidate_db)
                db.commit()
                print(f"[DEBUG] Candidate successfully added to database with ID: {candidate_db.id}")
                db.refresh(candidate_db)
            except Exception as db_error:
                db.rollback()
                error_msg = str(db_error)
                print(f"[DEBUG] Database error when creating candidate: {error_msg}")
                print(f"[DEBUG] Error type: {type(db_error)}")
                import traceback
                traceback.print_exc()
                # If it's a constraint violation about name, we have a serious problem
                if 'name' in error_msg.lower() or 'null' in error_msg.lower() or 'not null' in error_msg.lower():
                    # This should NEVER happen, but if it does, try one more time with a guaranteed name
                    import random
                    new_name = f"Kandidaat-{random.randint(10000, 99999)}"
                    print(f"[DEBUG] Retrying with forced name: '{new_name}'")
                    candidate_db.name = new_name
                    db.add(candidate_db)
                    db.commit()
                    db.refresh(candidate_db)
                else:
                    # Re-raise if it's a different error
                    raise
            candidate_id = candidate_db.id
            if preferential_job_ids:
                candidate_db.preferential_job_ids = ",".join(preferential_job_ids)
                db.commit()
        
        # Create notification if candidate is submitted by recruiter for a job
        if final_submitted_by_company_id and job_id:
            # This is a recruiter submitting a candidate for a job
            job = db.query(JobPostingDB).filter(JobPostingDB.id == job_id).first()
            if job and job.company_id:
                # Find company users for this job
                company_users = db.query(UserDB).filter(
                    UserDB.company_id == job.company_id,
                    UserDB.is_active == True
                ).all()
                
                for user in company_users:
                    notification = NotificationDB(
                        user_id=user.id,
                        type="candidate_proposed",
                        title=f"Nieuwe kandidaat voorgesteld: {candidate_db.name}",
                        message=f"Recruiter heeft kandidaat '{candidate_db.name}' voorgesteld voor vacature '{job.title}'",
                        related_candidate_id=candidate_db.id,
                        related_job_id=job_id
                    )
                    db.add(notification)
                db.commit()
        
        response_payload = {
            "success": True,
            "candidate_id": candidate_db.id,
            "resume_length": len(resume_text),
            "extracted_text": resume_text[:500] + "..." if len(resume_text) > 500 else resume_text,
            "extraction_method": extraction_method,
            "azure_used": azure_used or motivation_azure_used
        }
        db.close()
        return response_payload
        
    except HTTPException:
        # Re-raise HTTP exceptions (they have proper status codes)
        raise
    except Exception as e:
        import traceback
        error_trace = traceback.format_exc()
        print(f"ERROR in upload_resume: {str(e)}")
        print(f"Traceback: {error_trace}")
        # Close DB if it's still open
        try:
            db.close()
        except:
            pass
        raise HTTPException(
            status_code=500,
            detail=f"Failed to upload resume: {str(e)}"
        )

@app.post("/upload-motivation-letter")
async def upload_motivation_letter(
    candidate_id: str = Form(...),
    motivation_text: Optional[str] = Form(None),
    motivation_file: Optional[UploadFile] = File(None)
):
    """Upload or update a motivation letter for an existing candidate"""
    try:
        db = SessionLocal()
        candidate = db.query(CandidateDB).filter(CandidateDB.id == candidate_id).first()
        if not candidate:
            db.close()
            raise HTTPException(status_code=404, detail="Candidate not found")

        extracted_text = motivation_text
        azure_used = False

        if motivation_file and motivation_file.filename:
            file_content = await motivation_file.read()
            extraction_result = extract_text_from_file(file_content, motivation_file.filename)
            extracted_text = extraction_result["text"]
            azure_used = extraction_result.get("azure_used", False)
            extracted_text = truncate_text_safely(extracted_text, MAX_MOTIVATION_CHARS)

        if not extracted_text:
            db.close()
            raise HTTPException(status_code=400, detail="Motivatiebrief ontbreekt of kon niet worden gelezen.")

        candidate.motivational_letter = extracted_text
        db.commit()
        db.refresh(candidate)
        db.close()

        return {
            "success": True,
            "candidate_id": candidate_id,
            "motivation_length": len(extracted_text),
            "azure_used": azure_used
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to upload motivation letter: {str(e)}")

@app.delete("/candidates/{candidate_id}/motivation")
async def delete_motivation_letter(candidate_id: str):
    """Remove stored motivation letter for a candidate"""
    try:
        db = SessionLocal()
        candidate = db.query(CandidateDB).filter(CandidateDB.id == candidate_id).first()
        if not candidate:
            db.close()
            raise HTTPException(status_code=404, detail="Candidate not found")
        candidate.motivational_letter = None
        db.commit()
        db.close()
        return {"success": True}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete motivation letter: {str(e)}")

@app.delete("/candidates/{candidate_id}/resume")
async def delete_resume(candidate_id: str):
    """Remove stored resume text for a candidate"""
    try:
        db = SessionLocal()
        candidate = db.query(CandidateDB).filter(CandidateDB.id == candidate_id).first()
        if not candidate:
            db.close()
            raise HTTPException(status_code=404, detail="Candidate not found")
        candidate.resume_text = None
        db.commit()
        db.close()
        return {"success": True}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete resume: {str(e)}")

@app.post("/evaluate-candidate")
async def evaluate_candidate(
    candidate_id: str = Form(...),
    job_id: Optional[str] = Form(None),  # Allow job_id to be passed from frontend
    handler_id: Optional[str] = Form(None),
    custom_guidelines: Optional[str] = Form(None),
    strictness: Optional[str] = Form("medium"),
    company_note: Optional[str] = Form(None),
    request: Request = None
):
    """Evaluate candidate using selected personas - each persona evaluates from three perspectives"""
    # CRITICAL FIX: Initialize variables at the very start to prevent scoping issues
    # Python was treating these as local variables, causing "cannot access local variable" error
    # Initialize with defaults first, then use module-level values if available
    OPENAI_MAX_TOKENS_EVALUATION = 4096  # Default initialization
    OPENAI_TEMPERATURE_EVALUATION = 0.1  # Default initialization
    OPENAI_MODEL_EVALUATION = "gpt-4o-mini"  # Default initialization
    
    # Now try to get the actual module-level values
    try:
        import sys
        current_module = sys.modules[__name__]
        OPENAI_MAX_TOKENS_EVALUATION = getattr(current_module, 'OPENAI_MAX_TOKENS_EVALUATION', 4096)
        OPENAI_TEMPERATURE_EVALUATION = getattr(current_module, 'OPENAI_TEMPERATURE_EVALUATION', 0.1)
        OPENAI_MODEL_EVALUATION = getattr(current_module, 'OPENAI_MODEL_EVALUATION', "gpt-4o-mini")
    except:
        pass  # Use defaults if we can't access module-level
    
    # Store in local variables for use in the function
    _max_tokens_eval = OPENAI_MAX_TOKENS_EVALUATION
    _temp_eval = OPENAI_TEMPERATURE_EVALUATION
    _model_eval = OPENAI_MODEL_EVALUATION
    
    try:
        db = SessionLocal()
        candidate = db.query(CandidateDB).filter(CandidateDB.id == candidate_id).first()
        
        if not candidate:
            db.close()
            raise HTTPException(status_code=404, detail="Candidate not found")
        
        # Determine which job_id to use: passed parameter, candidate.job_id, or first preferential job
        evaluation_job_id = None
        if job_id:
            evaluation_job_id = job_id
        elif candidate.job_id:
            evaluation_job_id = candidate.job_id
        elif candidate.preferential_job_ids:
            # Use first preferential job if no job_id is set
            preferential_list = [jid.strip() for jid in candidate.preferential_job_ids.split(",") if jid.strip()]
            if preferential_list:
                evaluation_job_id = preferential_list[0]
        
        if not evaluation_job_id:
            db.close()
            raise HTTPException(status_code=400, detail="Evaluation requires a job posting. Please select a job before evaluating.")
        
        # Verify job posting exists
        job = db.query(JobPostingDB).filter(JobPostingDB.id == evaluation_job_id).first()
        if not job:
            db.close()
            raise HTTPException(status_code=404, detail="Associated job posting not found")
        
        # ADD THIS CHECK: Verify resume_text is actually text, not binary
        # IMPORTANT: Truncate resume text BEFORE using it in prompts
        resume_text = candidate.resume_text
        if not resume_text or len(resume_text.strip()) < 50:
            db.close()
            raise HTTPException(status_code=400, detail="Resume text is empty or invalid. Please re-upload the resume.")
        
        # Truncate resume text to stay within token limits
        resume_text = truncate_text_safely(resume_text, MAX_RESUME_CHARS)
        
        # Get selected personas from form data
        persona_prompts = {}
        if request:
            form_data = await request.form()
            for key, value in form_data.items():
                if key.endswith('_prompt'):
                    persona_name = key.replace('_prompt', '')
                    persona_prompts[persona_name] = value
        
        # If no personas selected, return error
        if not persona_prompts:
            db.close()
            raise HTTPException(status_code=400, detail="At least one persona must be selected for evaluation")
        
        # Get persona details from database
        persona_objects = []
        for persona_name in persona_prompts.keys():
            persona = db.query(PersonaDB).filter(PersonaDB.name == persona_name).first()
            if persona:
                persona_objects.append(persona)
        
        if not persona_objects:
            db.close()
            raise HTTPException(status_code=404, detail="Selected personas not found in database")
        
        # Add strictness filter
        strictness_instructions = {
            "lenient": "Be lenient in your evaluation. Focus on potential and growth opportunities. Give candidates the benefit of the doubt.",
            "medium": "Provide a balanced evaluation considering both strengths and areas for improvement.",
            "strict": "Be thorough and critical in your evaluation. Focus on meeting all requirements and potential risks.",
            "severe": "Be extremely strict and demanding. Only recommend candidates who exceed expectations in all areas."
        }
        
        strictness_instruction = strictness_instructions.get(strictness.lower(), strictness_instructions["medium"])
        
        # Get job information if available (outside loop, shared for all personas)
        # IMPORTANT: Truncate all text BEFORE building prompts to stay within token limits
        job_info = ""
        if evaluation_job_id:
            job = db.query(JobPostingDB).filter(JobPostingDB.id == evaluation_job_id).first()
            if job:
                # Truncate job description and requirements to stay within limits
                job_desc = truncate_text_safely(job.description or "", MAX_JOB_DESC_CHARS)
                job_req = truncate_text_safely(job.requirements or "", MAX_JOB_DESC_CHARS)
                job_info = f"""

JOB POSTING DETAILS:
Title: {job.title}
Company: {job.company}
Location: {job.location or 'N/A'}
Salary Range: {job.salary_range or 'N/A'}
Description: {job_desc}
Requirements: {job_req}"""
        
        # Include motivational letter if available (truncated)
        motivational_info = ""
        if candidate.motivational_letter:
            motivation_text = truncate_text_safely(candidate.motivational_letter, MAX_MOTIVATION_CHARS)
            motivational_info = f"""

MOTIVATIONAL LETTER:
{motivation_text}"""
        
        # Include company note if provided (truncated)
        # IMPORTANT: Company note is an impartial party that provides additional information about the candidate
        company_note_info = ""
        if company_note:
            company_note_text = truncate_text_safely(company_note, MAX_COMPANY_NOTE_CHARS)
            company_note_info = f"""

BELANGRIJK - BEDRIJFSNOTITIE (Informatie van bemiddelingsbureau):
Deze bedrijfsnotitie bevat belangrijke informatie over de kandidaat van het bemiddelingsbureau, inclusief:
- Salarisverwachtingen en salarisindicaties
- Beschikbaarheid en opzegtermijn
- Specifieke voorkeuren en vereisten
- Aanvullende context die niet in het CV staat

LET OP: Als Bureaurecruiter of HR/Inhouse Recruiter moet je deze informatie actief gebruiken. Als er salarisinformatie in staat, gebruik deze in je evaluatie. Als er tegenstrijdigheden zijn tussen CV en bedrijfsnotitie, vertrouw de bedrijfsnotitie.
{company_note_text}"""
        
        # Helper function to filter extended candidate info by persona relevance
        def get_persona_relevant_fields(persona_name: str, candidate) -> List[str]:
            """Get only the extended candidate fields relevant to this persona"""
            import json
            relevant_fields = []
            
            persona_name_lower = persona_name.lower()
            
            # Parse JSON fields once
            skill_tags_list = []
            if candidate.skill_tags:
                try:
                    skill_tags_list = json.loads(candidate.skill_tags) if isinstance(candidate.skill_tags, str) else candidate.skill_tags
                except:
                    skill_tags_list = []
            
            prior_job_titles_list = []
            if candidate.prior_job_titles:
                try:
                    prior_job_titles_list = json.loads(candidate.prior_job_titles) if isinstance(candidate.prior_job_titles, str) else candidate.prior_job_titles
                except:
                    prior_job_titles_list = []
            
            certifications_list = []
            if candidate.certifications:
                try:
                    certifications_list = json.loads(candidate.certifications) if isinstance(candidate.certifications, str) else candidate.certifications
                except:
                    certifications_list = []
            
            # Define field relevance per persona type
            # Tech Lead / Hiring Manager: Technical skills, experience, certifications, test results
            if 'tech' in persona_name_lower or 'hiring' in persona_name_lower:
                if candidate.years_experience or candidate.experience_years:
                    years = candidate.years_experience or candidate.experience_years
                    relevant_fields.append(f"Jaren ervaring: {years}")
                if skill_tags_list:
                    skill_tags_str = ", ".join(skill_tags_list) if isinstance(skill_tags_list, list) else str(skill_tags_list)
                    relevant_fields.append(f"Vaardigheden tags: {skill_tags_str}")
                if prior_job_titles_list:
                    prior_jobs_str = ", ".join(prior_job_titles_list) if isinstance(prior_job_titles_list, list) else str(prior_job_titles_list)
                    relevant_fields.append(f"Eerdere functietitels: {prior_jobs_str}")
                if certifications_list:
                    certs_str = ", ".join(certifications_list) if isinstance(certifications_list, list) else str(certifications_list)
                    relevant_fields.append(f"Certificeringen: {certs_str}")
                if candidate.education_level:
                    relevant_fields.append(f"Opleidingsniveau: {candidate.education_level}")
                if candidate.test_results:
                    relevant_fields.append(f"Testresultaten / Vaardigheidsscores: {candidate.test_results}")
            
            # Finance Director: Salary, availability, notice period, compensation-related
            if 'finance' in persona_name_lower:
                if candidate.salary_expectation:
                    relevant_fields.append(f"Salarisverwachting: €{candidate.salary_expectation}/jaar (op basis van 40 uur/week)")
                if candidate.availability_per_week:
                    relevant_fields.append(f"Beschikbaarheid per week: {candidate.availability_per_week} uur/week")
                if candidate.notice_period:
                    relevant_fields.append(f"Opzegtermijn: {candidate.notice_period}")
            
            # HR Recruiter / Bureaurecruiter: Motivation, communication, availability, notice period, location, source
            if 'hr' in persona_name_lower or 'recruiter' in persona_name_lower or 'bureau' in persona_name_lower:
                if candidate.motivation_reason:
                    relevant_fields.append(f"Motivatie voor rol / Reden van vertrek: {candidate.motivation_reason}")
                if candidate.communication_level:
                    relevant_fields.append(f"Communicatieniveau: {candidate.communication_level}")
                if candidate.location:
                    relevant_fields.append(f"Locatie: {candidate.location}")
                if candidate.availability_per_week:
                    relevant_fields.append(f"Beschikbaarheid per week: {candidate.availability_per_week} uur/week")
                if candidate.notice_period:
                    relevant_fields.append(f"Opzegtermijn: {candidate.notice_period}")
                if candidate.source:
                    relevant_fields.append(f"Bron / Hoe gevonden: {candidate.source}")
                if candidate.age:
                    relevant_fields.append(f"Leeftijd: {candidate.age} jaar")  # For diversity/inclusion considerations
            
            # HR / Inhouse Recruiter: Also education level for compliance
            if 'hr' in persona_name_lower or 'inhouse' in persona_name_lower:
                if candidate.education_level:
                    relevant_fields.append(f"Opleidingsniveau: {candidate.education_level}")
            
            return relevant_fields
        
        # Evaluate for each selected persona - PARALLELIZED for performance
        async def evaluate_single_persona(persona):
            """Evaluate a single persona - designed to run in parallel"""
            persona_prompt = persona_prompts.get(persona.name, persona.system_prompt)
            
            # Get persona-relevant extended fields only (filter by role)
            persona_relevant_fields = get_persona_relevant_fields(persona.name, candidate)
            persona_extended_info = ""
            if persona_relevant_fields:
                persona_extended_text = "\n".join(persona_relevant_fields)
                persona_extended_info = f"""

BELANGRIJK - STRUCTUREDE KANDIDAATINFORMATIE (Relevant voor {persona.display_name}):
Deze gestructureerde informatie is expliciet opgeslagen voor deze kandidaat en is relevant voor jouw evaluatie vanuit jouw perspectief. Gebruik deze informatie actief in je beoordeling.

{truncate_text_safely(persona_extended_text, 1500)}"""
            
            # Get personal criteria if available
            import json
            personal_criteria_text = ""
            if hasattr(persona, 'personal_criteria') and persona.personal_criteria:
                try:
                    personal_criteria_data = json.loads(persona.personal_criteria) if isinstance(persona.personal_criteria, str) else persona.personal_criteria
                    if personal_criteria_data:
                        if isinstance(personal_criteria_data, list):
                            personal_criteria_items = personal_criteria_data
                        elif isinstance(personal_criteria_data, dict):
                            personal_criteria_items = list(personal_criteria_data.values())
                        else:
                            personal_criteria_items = [str(personal_criteria_data)]
                        
                        if personal_criteria_items:
                            criteria_list = "\n".join([f"- {item}" for item in personal_criteria_items if item])
                            personal_criteria_text = f"""

BELANGRIJK - PERSOONLIJKE EVALUATIECRITERIA (Aangepast voor deze digitale werknemer):
De volgende persoonlijke criteria zijn aangepast voor deze digitale werknemer en moeten actief worden gebruikt in je evaluatie:
{criteria_list}"""
                except:
                    pass  # Ignore invalid JSON
            
            # Build system prompt for this persona - they evaluate from their own perspective
            system_prompt = f"""Je bent {persona.display_name}. Je beoordelingsstijl: {persona_prompt}{personal_criteria_text}

Je evalueert deze kandidaat vanuit jouw perspectief. Geef een beoordeling met scores, sterke punten, aandachtspunten en advies.

BELANGRIJK: Maak actief gebruik van alle beschikbare informatie die relevant is voor jouw perspectief. Focus alleen op aspecten die binnen jouw expertise vallen.{' Gebruik daarnaast actief de persoonlijke evaluatiecriteria hierboven.' if personal_criteria_text else ''}

IMPORTANT: Antwoord met een geldig JSON object:
{{
  "score": 7.5,
  "strengths": "Belangrijkste sterke punten",
  "weaknesses": "Belangrijkste aandachtspunten",
  "analysis": "Gedetailleerde analyse (5-8 zinnen). Benoem expliciet grote matches (big hits) of grote mismatches (big misses) als die er zijn.",
  "recommendation": "Sterk geschikt / uitnodigen voor gesprek" OF "Twijfelgeval / meer informatie nodig" OF "Niet passend op dit moment",
  "big_hits": "Optioneel: Grote matches",
  "big_misses": "Optioneel: Grote mismatches"
}}

{get_score_scale_prompt_text()}

BELANGRIJK:
- Score MOET tussen 1.0 en 10.0 liggen
- Recommendation moet consistent zijn met score: >= 7.0 = "Sterk geschikt", >= 5.0 = "Twijfelgeval", < 5.0 = "Niet passend"
- Maak gebruik van alle beschikbare kandidaatgegevens (gestructureerde velden en CV) in je beoordeling

Geef geen tekst buiten het JSON object."""
            
            # MAKE SURE we're sending clean text to OpenAI
            # All text is already truncated above, so we can safely build the prompt
            # Use persona-specific extended info (filtered by role relevance)
            user_prompt = f"""Evalueer deze kandidaat vanuit jouw perspectief als {persona.display_name}:

CV:
{resume_text}{motivational_info}{persona_extended_info}{job_info}{company_note_info}

BELANGRIJK: Maak actief gebruik van alle beschikbare informatie die relevant is voor jouw rol:
- CV en motivatiebrief (basis informatie)
- Gestructureerde kandidaatgegevens (alleen velden relevant voor jouw expertise - zie hierboven)
- Vacaturevereisten
- Bedrijfsnotitie (indien beschikbaar)

FOCUS: Evalueer alleen op aspecten die binnen jouw expertise vallen. Laat andere aspecten (buiten jouw expertise) buiten beschouwing of verwijs kort naar anderen.

Geef een score (1-10), sterke punten, aandachtspunten, analyse en advies. Benoem expliciet grote matches of mismatches."""
            
            # Final safety check: ensure the user prompt itself isn't too long
            # For gpt-4o-mini, limit to ~3000 chars for ~750 tokens
            # This leaves room for system prompt (~500 tokens) and response (max_tokens)
            if len(user_prompt) > 3000:
                user_prompt = user_prompt[:3000] + "\n\n[Prompt truncated for token limits...]"
            
            # Call OpenAI safely for this persona - ASYNC VERSION
            openai_result = await call_openai_safe_async([
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ], max_tokens=_max_tokens_eval, temperature=_temp_eval, model=_model_eval)
            
            if not openai_result["success"]:
                print(f"AI evaluation failed for persona {persona.name}: {openai_result['error']}")
                return persona.name, {
                    "error": f"Evaluation failed: {openai_result['error']}",
                    "persona_display_name": persona.display_name
                }
            
            response = openai_result["result"].choices[0].message.content
            
            # Try to parse JSON response for this persona
            try:
                import json
                import re
                
                # Clean response - remove markdown code blocks if present
                cleaned_response = response.strip()
                if "```json" in cleaned_response:
                    json_match = re.search(r'```json\s*(.*?)\s*```', cleaned_response, re.DOTALL)
                    if json_match:
                        cleaned_response = json_match.group(1).strip()
                elif "```" in cleaned_response:
                    json_match = re.search(r'```\s*(.*?)\s*```', cleaned_response, re.DOTALL)
                    if json_match:
                        cleaned_response = json_match.group(1).strip()
                
                # Try to find JSON object if not at start
                if not cleaned_response.startswith('{'):
                    json_match = re.search(r'\{.*\}', cleaned_response, re.DOTALL)
                    if json_match:
                        cleaned_response = json_match.group(0)
                
                evaluation = json.loads(cleaned_response)
                
                # Validate and normalize the response structure
                # Ensure all required fields exist
                if "score" not in evaluation:
                    # Try to get score from other possible fields
                    evaluation["score"] = evaluation.get("total_score", evaluation.get("average_score", SCORE_DEFAULT))
                
                # CRITICAL: Validate score is in configured range and clamp if necessary
                raw_score = float(evaluation.get("score", SCORE_DEFAULT))
                # Clamp score to configured range (in case AI returns out of range)
                if raw_score > SCORE_MAX:
                    print(f"WARNING: Persona {persona.name} returned score {raw_score} > {SCORE_MAX}. Clamping to {SCORE_MAX}")
                    raw_score = SCORE_MAX
                elif raw_score < SCORE_MIN:
                    print(f"WARNING: Persona {persona.name} returned score {raw_score} < {SCORE_MIN}. Clamping to {SCORE_MIN}")
                    raw_score = SCORE_MIN
                evaluation["score"] = raw_score
                
                if "strengths" not in evaluation:
                    evaluation["strengths"] = evaluation.get("key_strengths", "Niet beschikbaar")
                
                if "weaknesses" not in evaluation:
                    evaluation["weaknesses"] = evaluation.get("key_development_points", evaluation.get("weaknesses", "Niet beschikbaar"))
                
                if "analysis" not in evaluation:
                    evaluation["analysis"] = evaluation.get("final_analysis", evaluation.get("verdict", "Evaluatie beschikbaar"))
                
                # CRITICAL: Always validate recommendation matches the score
                # Override AI recommendation if it doesn't match score thresholds
                score = float(evaluation["score"])  # Use validated score
                correct_recommendation = get_recommendation_from_score(score)
                
                # If AI provided recommendation, check if it matches score
                ai_recommendation = evaluation.get("recommendation", "")
                if ai_recommendation and ai_recommendation != correct_recommendation:
                    # Log mismatch but use correct recommendation based on score
                    print(f"WARNING: Persona {persona.name} provided recommendation '{ai_recommendation}' for score {score}, but should be '{correct_recommendation}'. Using score-based recommendation.")
                
                # Store evaluation for this persona
                return persona.name, {
                    "score": score,
                    "strengths": evaluation.get("strengths", "Niet beschikbaar"),
                    "weaknesses": evaluation.get("weaknesses", "Niet beschikbaar"),
                    "analysis": evaluation.get("analysis", "Evaluatie beschikbaar"),
                    "big_hits": evaluation.get("big_hits"),  # Optional big hits
                    "big_misses": evaluation.get("big_misses"),  # Optional big misses
                    "recommendation": correct_recommendation,  # Always use score-based recommendation
                    "persona_display_name": persona.display_name,
                    "persona_name": persona.name
                }
                
            except json.JSONDecodeError as e:
                print(f"JSON parsing error for persona {persona.name}: {str(e)}")
                print(f"Response (first 500 chars): {response[:500]}")
                # Fallback structured response
                return persona.name, {
                    "score": SCORE_DEFAULT,
                    "strengths": "Niet beschikbaar - parsing error",
                    "weaknesses": "Niet beschikbaar - parsing error",
                    "analysis": response[:500] if len(response) > 0 else "Geen response",
                    "recommendation": get_recommendation_from_score(SCORE_DEFAULT),
                    "persona_display_name": persona.display_name,
                    "persona_name": persona.name
                }
                
            except Exception as e:
                print(f"Unexpected error parsing evaluation for persona {persona.name}: {str(e)}")
                return persona.name, {
                    "score": SCORE_DEFAULT,
                    "strengths": "Niet beschikbaar",
                    "weaknesses": "Niet beschikbaar",
                    "analysis": f"Er is een fout opgetreden: {str(e)}",
                    "recommendation": get_recommendation_from_score(SCORE_DEFAULT),
                    "persona_display_name": persona.display_name,
                    "persona_name": persona.name
                }
        
        # Run all persona evaluations in parallel
        print(f"Running {len(persona_objects)} persona evaluations in parallel...")
        evaluation_tasks = [evaluate_single_persona(persona) for persona in persona_objects]
        evaluation_results = await asyncio.gather(*evaluation_tasks)
        
        # Convert results to dictionary
        persona_evaluations = {}
        for persona_name, evaluation_data in evaluation_results:
            persona_evaluations[persona_name] = evaluation_data
        
        db.close()
        
        # Generate combined analysis if we have multiple evaluations
        combined_analysis = None
        combined_recommendation = None
        combined_score = None  # Initialize combined_score
        
        if len(persona_evaluations) > 1:
            try:
                # Collect all evaluations for combined analysis
                evaluation_summaries = []
                for persona_name, eval_data in persona_evaluations.items():
                    if "error" not in eval_data:
                        persona_obj = next((p for p in persona_objects if p.name == persona_name), None)
                        display_name = persona_obj.display_name if persona_obj else persona_name
                        # Create concise summary
                        strengths_preview = eval_data.get('strengths', '')[:150] if eval_data.get('strengths') else 'N/A'
                        evaluation_summaries.append(
                            f"{display_name} ({eval_data.get('score', 'N/A')}/{SCORE_MAX}): {eval_data.get('recommendation', 'N/A')}. "
                            f"Punten: {strengths_preview}"
                        )
                
                # Create combined analysis prompt with ratings overview
                # Join summaries outside f-string to avoid backslash issue
                summaries_text = '\n\n'.join(evaluation_summaries)
                
                # Build ratings overview table
                ratings_overview = []
                for persona_name, eval_data in persona_evaluations.items():
                    if "error" not in eval_data:
                        persona_obj = next((p for p in persona_objects if p.name == persona_name), None)
                        display_name = persona_obj.display_name if persona_obj else persona_name
                        score = eval_data.get('score', 'N/A')
                        recommendation = eval_data.get('recommendation', 'N/A')
                        ratings_overview.append(f"- {display_name}: Score {score}/{SCORE_MAX}, Advies: {recommendation}")
                
                ratings_text = '\n'.join(ratings_overview)
                
                combined_prompt = f"""Combineer deze evaluaties tot een samenvattend advies:

SCORES:
{ratings_text}

EVALUATIES:
{summaries_text}

{get_score_scale_prompt_text()}

Geef een totaalanalyse (8-12 zinnen) met:
1. Overzicht van alle scores (gebruik X/10 notatie, bijv. 7.5/10)
2. Samenvatting belangrijkste opmerkingen
3. Analyse overeenkomsten/verschillen tussen beoordelaars
4. Eindadvies gebaseerd op alle perspectieven

Antwoord met JSON:
{{
  "combined_analysis": "Totaalanalyse met scores (X/10), opmerkingen, overeenkomsten/verschillen, eindadvies",
  "combined_recommendation": "Sterk geschikt / uitnodigen voor gesprek" OF "Twijfelgeval / meer informatie nodig" OF "Niet passend op dit moment",
  "combined_score": 7.5
}}

combined_score is optioneel (wordt automatisch berekend). Gebruik ALTIJD /10 notatie."""
                
                # Call OpenAI for combined analysis
                # Use the already imported variables from top of file
                combined_system_message = f"""Je combineert evaluaties tot een samenhangend advies.

BELANGRIJK:
- Alle scores zijn op 1-10 schaal
- Gebruik ALTIJD /10 notatie (bijv. 7.5/10, 8.0/10)
- >= 7.0 = goed, >= 8.5 = uitstekend"""
                
                combined_result = call_openai_safe([
                    {"role": "system", "content": combined_system_message},
                    {"role": "user", "content": combined_prompt}
                ], max_tokens=800, temperature=0.3, model=OPENAI_MODEL_EVALUATION)
                
                if combined_result["success"]:
                    combined_response = combined_result["result"].choices[0].message.content
                    import json
                    import re
                    
                    # Clean and parse JSON
                    cleaned = combined_response.strip()
                    if "```json" in cleaned:
                        json_match = re.search(r'```json\s*(.*?)\s*```', cleaned, re.DOTALL)
                        if json_match:
                            cleaned = json_match.group(1).strip()
                    elif "```" in cleaned:
                        json_match = re.search(r'```\s*(.*?)\s*```', cleaned, re.DOTALL)
                        if json_match:
                            cleaned = json_match.group(1).strip()
                    
                    if not cleaned.startswith('{'):
                        json_match = re.search(r'\{.*\}', cleaned, re.DOTALL)
                        if json_match:
                            cleaned = json_match.group(0)
                    
                    try:
                        combined_data = json.loads(cleaned)
                        combined_analysis = combined_data.get("combined_analysis", "Gecombineerde analyse beschikbaar")
                        combined_recommendation = combined_data.get("combined_recommendation", "Twijfelgeval / meer informatie nodig")
                        combined_score = combined_data.get("combined_score")
                        # Calculate if not provided
                        if combined_score is None:
                            scores = [float(e.get('score', SCORE_DEFAULT)) for e in persona_evaluations.values() if 'error' not in e and e.get('score')]
                            # Validate all scores are in configured range before averaging
                            validated_scores = [min(max(s, SCORE_MIN), SCORE_MAX) for s in scores]
                            combined_score = sum(validated_scores) / len(validated_scores) if validated_scores else SCORE_DEFAULT
                        # Clamp combined_score to configured range (in case AI returned out of range)
                        combined_score = min(max(float(combined_score), SCORE_MIN), SCORE_MAX)
                    except:
                        # Fallback if parsing fails
                        combined_analysis = "Gecombineerde analyse van alle geselecteerde perspectieven."
                        scores = [float(e.get('score', SCORE_DEFAULT)) for e in persona_evaluations.values() if 'error' not in e and e.get('score')]
                        # Validate all scores are in configured range before averaging
                        validated_scores = [min(max(s, SCORE_MIN), SCORE_MAX) for s in scores]
                        avg_score = sum(validated_scores) / len(validated_scores) if validated_scores else SCORE_DEFAULT
                        combined_score = min(max(avg_score, SCORE_MIN), SCORE_MAX)  # Clamp to configured range
                        combined_recommendation = get_recommendation_from_score(avg_score)
                else:
                    # Fallback if API call fails
                    scores = [float(e.get('score', SCORE_DEFAULT)) for e in persona_evaluations.values() if 'error' not in e and e.get('score')]
                    # Validate all scores are in configured range before averaging
                    validated_scores = [min(max(s, SCORE_MIN), SCORE_MAX) for s in scores]
                    avg_score = sum(validated_scores) / len(validated_scores) if validated_scores else SCORE_DEFAULT
                    combined_score = min(max(avg_score, SCORE_MIN), SCORE_MAX)  # Clamp to configured range
                    combined_analysis = f"Gemiddelde score van {len(persona_evaluations)} perspectieven: {avg_score:.1f}/{SCORE_MAX}"
                    combined_recommendation = get_recommendation_from_score(avg_score)
            except Exception as e:
                print(f"Error generating combined analysis: {str(e)}")
                # Fallback
                scores = [float(e.get('score', SCORE_DEFAULT)) for e in persona_evaluations.values() if 'error' not in e and e.get('score')]
                # Validate all scores are in configured range before averaging
                validated_scores = [min(max(s, SCORE_MIN), SCORE_MAX) for s in scores]
                avg_score = sum(validated_scores) / len(validated_scores) if validated_scores else SCORE_DEFAULT
                combined_score = min(max(avg_score, SCORE_MIN), SCORE_MAX)  # Clamp to configured range
                combined_analysis = f"Gemiddelde score van {len(persona_evaluations)} perspectieven: {avg_score:.1f}/{SCORE_MAX}"
                combined_recommendation = get_recommendation_from_score(avg_score)
        else:
            # Single persona evaluation - calculate score directly
            if len(persona_evaluations) == 1:
                eval_data = list(persona_evaluations.values())[0]
                if 'error' not in eval_data:
                    combined_score = float(eval_data.get('score', SCORE_DEFAULT))
                    combined_score = min(max(combined_score, SCORE_MIN), SCORE_MAX)
                    combined_analysis = eval_data.get('analysis', 'Evaluatie beschikbaar')
                    combined_recommendation = eval_data.get('recommendation', get_recommendation_from_score(combined_score))
                else:
                    combined_score = SCORE_DEFAULT
                    combined_analysis = "Evaluatie beschikbaar"
                    combined_recommendation = get_recommendation_from_score(SCORE_DEFAULT)
            else:
                # No evaluations - fallback
                combined_score = SCORE_DEFAULT
                combined_analysis = "Geen evaluaties beschikbaar"
                combined_recommendation = get_recommendation_from_score(SCORE_DEFAULT)
        
        # Ensure combined_score is always defined
        if combined_score is None:
            scores = [float(e.get('score', SCORE_DEFAULT)) for e in persona_evaluations.values() if 'error' not in e and e.get('score')]
            validated_scores = [min(max(s, SCORE_MIN), SCORE_MAX) for s in scores]
            combined_score = sum(validated_scores) / len(validated_scores) if validated_scores else SCORE_DEFAULT
            combined_score = min(max(combined_score, SCORE_MIN), SCORE_MAX)
        
        # Prepare result data
        result_data = {
            "evaluations": persona_evaluations,
            "persona_count": len(persona_evaluations),
            "combined_analysis": combined_analysis,
            "combined_recommendation": combined_recommendation,
            "combined_score": combined_score
        }
        result_data["persona_prompts"] = persona_prompts
        
        # Initialize result_id variable
        result_id = None
        
        # Save result to database
        try:
            import json
            result_json = json.dumps(result_data)
            # Sort persona IDs for consistent comparison
            persona_ids_json = json.dumps(sorted(list(persona_prompts.keys())))
            
            # Check if result already exists (for caching)
            existing_result = db.query(EvaluationResultDB).filter(
                EvaluationResultDB.candidate_id == candidate_id,
                EvaluationResultDB.job_id == evaluation_job_id,
                EvaluationResultDB.result_type == 'evaluation',
                EvaluationResultDB.selected_personas == persona_ids_json
            ).first()
            
            result_id = None
            if existing_result:
                # Update existing result
                existing_result.result_data = result_json
                existing_result.company_note = company_note
                existing_result.updated_at = func.now()
                result_id = existing_result.id
            else:
                # Create new result
                evaluation_result = EvaluationResultDB(
                    candidate_id=candidate_id,
                    job_id=evaluation_job_id,
                    result_type='evaluation',
                    result_data=result_json,
                    selected_personas=persona_ids_json,
                    company_note=company_note
                )
                db.add(evaluation_result)
            
            db.commit()
            if not result_id:
                db.refresh(evaluation_result)
                result_id = evaluation_result.id
                
                # Create notifications for job watchers
                try:
                    watchers = db.query(JobWatcherDB).filter(JobWatcherDB.job_id == evaluation_job_id).all()
                    for watcher in watchers:
                        notification = NotificationDB(
                            user_id=watcher.user_id,
                            type="evaluation_complete",
                            title=f"Evaluatie voltooid voor {candidate.name}",
                            message=f"Evaluatie is voltooid voor {candidate.name} bij {job.title if job else 'vacature'}",
                            related_candidate_id=candidate_id,
                            related_job_id=evaluation_job_id,
                            related_result_id=result_id
                        )
                        db.add(notification)
                    db.commit()
                except Exception as notif_error:
                    print(f"Error creating notifications: {str(notif_error)}")
                    # Don't fail the whole request if notifications fail
        except Exception as e:
            print(f"Error saving evaluation result: {str(e)}")
            import traceback
            traceback.print_exc()
            # Continue even if saving fails
        
        # Ensure database is closed before returning
        if db:
            try:
                db.close()
            except:
                pass
        
        # Return evaluations from all personas with combined analysis
        return {
            "success": True,
            "evaluations": persona_evaluations,  # Dictionary of persona_name -> evaluation
            "persona_count": len(persona_evaluations),
            "combined_analysis": combined_analysis,
            "combined_recommendation": combined_recommendation,
            "combined_score": combined_score,
            "result_id": result_id  # Include result_id so frontend can navigate directly
        }
        
    except HTTPException:
        # Re-raise HTTPExceptions (they already have proper status codes)
        if db:
            try:
                db.close()
            except:
                pass
        raise
    except Exception as e:
        # Log the full error with traceback
        print(f"Unexpected error in evaluate-candidate endpoint: {str(e)}")
        import traceback
        traceback.print_exc()
        
        # Ensure database is closed
        if db:
            try:
                db.close()
            except:
                pass
        
        # Raise HTTPException with proper status code
        raise HTTPException(
            status_code=500,
            detail=f"Evaluation failed: {str(e)}"
        )

@app.get("/candidates")
async def get_candidates(
    job_id: Optional[str] = None,
    company_id: Optional[str] = None,
    current_user: UserDB = Depends(get_current_user)
):
    """Get all evaluated candidates with their evaluations, optionally filtered by job_id or company_id
    
    For company users: Only shows candidates submitted by recruiters (submitted_by_company_id is set)
    For recruiter users: Shows all candidates they submitted (submitted_by_company_id matches their company_id)
    For admin users: Shows all candidates
    """
    try:
        db = SessionLocal()
        
        # Get candidates with their evaluations and job info
        query = db.query(CandidateDB)
        
        # Role-based filtering
        user_role = current_user.role.lower() if current_user.role else ""
        
        if user_role == "admin":
            # Admins see all candidates
            pass
        elif user_role == "recruiter":
            # Recruiters see only candidates they submitted (or from their company)
            if current_user.company_id:
                query = query.filter(CandidateDB.submitted_by_company_id == current_user.company_id)
        elif user_role in ["company_admin", "company_user", "viewer"]:
            # Company users see candidates submitted by recruiters for their company's jobs
            # Also include legacy candidates (without submitted_by_company_id) that are assigned to their jobs
            # This ensures backward compatibility with existing data
            
            # Also filter by company's jobs if company_id is provided or from user context
            effective_company_id = company_id or current_user.company_id
            if effective_company_id:
                company_jobs = db.query(JobPostingDB.id).filter(JobPostingDB.company_id == effective_company_id).all()
                company_job_ids = [job[0] for job in company_jobs]
                
                if company_job_ids:
                    # Filter candidates assigned to this company's jobs
                    # Include candidates that:
                    # 1. Are assigned to company's jobs (job_id or preferential_job_ids), AND
                    # 2. Either have submitted_by_company_id set (recruiter-submitted) OR
                    #    have no submitted_by_company_id (legacy candidates for backward compatibility)
                    query = query.filter(
                        or_(
                            CandidateDB.job_id.in_(company_job_ids),
                            # Also check preferential_job_ids
                            or_(*[CandidateDB.preferential_job_ids.like(f"%{job_id}%") for job_id in company_job_ids])
                        )
                    )
                    # Allow both recruiter-submitted candidates and legacy candidates (no submitted_by_company_id)
                    query = query.filter(
                        or_(
                            CandidateDB.submitted_by_company_id.isnot(None),  # Recruiter-submitted
                            CandidateDB.submitted_by_company_id.is_(None)  # Legacy candidates (backward compatibility)
                        )
                    )
                else:
                    # No jobs for this company, return empty
                    db.close()
                    return {
                        "success": True,
                        "candidates": []
                    }
        
        # Legacy company_id filtering (for backward compatibility, but now handled by role-based filtering above)
        # Only apply if not already filtered by role
        if company_id and user_role not in ["company_admin", "company_user", "viewer"]:
            # Filter candidates that belong to this company (either directly submitted by company or through job)
            subquery = db.query(JobPostingDB.id).filter(JobPostingDB.company_id == company_id).subquery()
            query = query.filter(
                or_(
                    CandidateDB.submitted_by_company_id == company_id,
                    CandidateDB.job_id.in_(subquery)
                )
            )
        
        if job_id:
            # Filter by job_id OR by preferential_job_ids containing the job_id
            query = query.filter(
                or_(
                    CandidateDB.job_id == job_id,
                    CandidateDB.preferential_job_ids.like(f"%{job_id}%")
                )
            )
        candidates = query.all()
        
        result = []
        for candidate in candidates:
            # Get job info
            job_info = None
            if candidate.job_id:
                job = db.query(JobPostingDB).filter(JobPostingDB.id == candidate.job_id).first()
                if job:
                    job_info = {
                        "id": job.id,
                        "title": job.title,
                        "company": job.company,
                        "location": job.location
                    }
            
            # Parse JSON fields
            skill_tags = None
            if candidate.skill_tags:
                try:
                    skill_tags = json.loads(candidate.skill_tags) if isinstance(candidate.skill_tags, str) else candidate.skill_tags
                except:
                    skill_tags = candidate.skill_tags
            
            prior_job_titles = None
            if candidate.prior_job_titles:
                try:
                    prior_job_titles = json.loads(candidate.prior_job_titles) if isinstance(candidate.prior_job_titles, str) else candidate.prior_job_titles
                except:
                    prior_job_titles = candidate.prior_job_titles
            
            certifications = None
            if candidate.certifications:
                try:
                    certifications = json.loads(candidate.certifications) if isinstance(candidate.certifications, str) else candidate.certifications
                except:
                    certifications = candidate.certifications
            
            # Get evaluations
            evaluations = db.query(EvaluationDB).filter(EvaluationDB.candidate_id == candidate.id).all()
            conversation_count = db.query(CandidateConversationDB).filter(CandidateConversationDB.candidate_id == candidate.id).count()
            
            # Get company name if submitted by recruiter
            submitted_by_company_name = None
            if candidate.submitted_by_company_id:
                recruiter_company = db.query(CompanyDB).filter(CompanyDB.id == candidate.submitted_by_company_id).first()
                if recruiter_company:
                    submitted_by_company_name = recruiter_company.name
            
            result.append({
                "id": candidate.id,
                "name": candidate.name,
                "email": candidate.email,
                "experience_years": candidate.experience_years,
                "skills": candidate.skills,
                "education": candidate.education,
                "motivational_letter": candidate.motivational_letter,  # Include motivation letter
                "resume_text": candidate.resume_text[:200] + "..." if candidate.resume_text and len(candidate.resume_text) > 200 else candidate.resume_text,  # Preview
                "created_at": candidate.created_at.isoformat() if candidate.created_at else None,
                "job": job_info,
                "job_id": candidate.job_id,
                "preferential_job_ids": candidate.preferential_job_ids,  # Include preferential job IDs
                "company_note": candidate.company_note,  # Include company note from supplying company
                "submitted_by_company_id": candidate.submitted_by_company_id,  # Include recruiter company ID
                "submitted_by_company_name": submitted_by_company_name,  # Include recruiter company name
                "evaluations": [
                    {
                        "id": eval.id,
                        "persona": eval.persona.value if eval.persona else None,
                        "result_summary": eval.result_summary,
                        "created_at": eval.created_at.isoformat() if eval.created_at else None
                    }
                    for eval in evaluations
                ],
                "evaluation_count": len(evaluations),
                "conversation_count": conversation_count,
                # Extended fields
                "motivation_reason": candidate.motivation_reason,
                "test_results": candidate.test_results,
                "age": candidate.age,
                "years_experience": candidate.years_experience,
                "skill_tags": skill_tags,
                "prior_job_titles": prior_job_titles,
                "certifications": certifications,
                "education_level": candidate.education_level,
                "location": candidate.location,
                "communication_level": candidate.communication_level,
                "availability_per_week": candidate.availability_per_week,
                "notice_period": candidate.notice_period,
                "salary_expectation": candidate.salary_expectation,
                "source": candidate.source,
                "pipeline_stage": candidate.pipeline_stage,
                "pipeline_status": candidate.pipeline_status,
            })
        
        db.close()
        
        return {
            "success": True,
            "candidates": result
        }
        
    except Exception as e:
        print(f"Error getting candidates: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get candidates: {str(e)}")

@app.get("/candidate-conversations")
async def get_candidate_conversations(candidate_id: str = Query(...), job_id: Optional[str] = Query(None)):
    """Fetch stored candidate conversations"""
    try:
        db = SessionLocal()
        query = db.query(CandidateConversationDB).filter(CandidateConversationDB.candidate_id == candidate_id)
        if job_id:
            query = query.filter(
                or_(
                    CandidateConversationDB.job_id == job_id,
                    CandidateConversationDB.job_id.is_(None)
                )
            )
        conversations = query.order_by(CandidateConversationDB.created_at.desc()).all()
        result = [serialize_conversation_record(conv) for conv in conversations]
        db.close()
        return {"success": True, "conversations": result}
    except Exception as e:
        print(f"Error fetching candidate conversations: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch conversations: {str(e)}")

@app.post("/scheduled-appointments")
async def create_scheduled_appointment(
    candidate_id: str = Form(...),
    job_id: str = Form(...),
    scheduled_at: str = Form(...),  # ISO format datetime string
    type: str = Form(...),
    location: Optional[str] = Form(None),
    notes: Optional[str] = Form(None),
    conversation_id: Optional[str] = Form(None),
    current_user: UserDB = Depends(get_current_user)
):
    """Create a scheduled appointment for a candidate"""
    try:
        db = SessionLocal()
        
        # Verify candidate and job exist
        candidate = db.query(CandidateDB).filter(CandidateDB.id == candidate_id).first()
        if not candidate:
            db.close()
            raise HTTPException(status_code=404, detail="Candidate not found")
        
        job = db.query(JobPostingDB).filter(JobPostingDB.id == job_id).first()
        if not job:
            db.close()
            raise HTTPException(status_code=404, detail="Job not found")
        
        # Parse scheduled_at datetime
        try:
            from dateutil import parser
            scheduled_datetime = parser.isoparse(scheduled_at)
        except Exception as e:
            db.close()
            raise HTTPException(status_code=400, detail=f"Invalid datetime format: {str(e)}")
        
        # Create appointment
        appointment = ScheduledAppointmentDB(
            candidate_id=candidate_id,
            job_id=job_id,
            user_id=current_user.id,
            conversation_id=conversation_id,
            scheduled_at=scheduled_datetime,
            type=type,
            location=location,
            notes=notes,
            status='scheduled'
        )
        
        db.add(appointment)
        db.commit()
        db.refresh(appointment)
        
        # Create notification for relevant users
        if job.company_id:
            company_users = db.query(UserDB).filter(
                UserDB.company_id == job.company_id,
                UserDB.is_active == True,
                UserDB.id != current_user.id  # Don't notify the user who created it
            ).all()
            
            for user in company_users:
                notification = NotificationDB(
                    user_id=user.id,
                    type="appointment_scheduled",
                    title=f"Afspraak gepland: {candidate.name}",
                    message=f"Afspraak '{type}' gepland voor {candidate.name} op {scheduled_datetime.strftime('%d-%m-%Y %H:%M')}",
                    related_candidate_id=candidate_id,
                    related_job_id=job_id
                )
                db.add(notification)
        
        db.commit()
        
        appointment_dict = {
            "id": appointment.id,
            "candidate_id": appointment.candidate_id,
            "job_id": appointment.job_id,
            "user_id": appointment.user_id,
            "conversation_id": appointment.conversation_id,
            "scheduled_at": appointment.scheduled_at.isoformat(),
            "type": appointment.type,
            "location": appointment.location,
            "notes": appointment.notes,
            "status": appointment.status,
            "created_at": appointment.created_at.isoformat() if appointment.created_at else None
        }
        
        db.close()
        return {
            "success": True,
            "appointment": appointment_dict
        }
    except HTTPException:
        raise
    except Exception as e:
        db.close()
        raise HTTPException(status_code=500, detail=f"Failed to create appointment: {str(e)}")

@app.get("/scheduled-appointments")
async def get_scheduled_appointments(
    candidate_id: Optional[str] = None,
    job_id: Optional[str] = None,
    current_user: UserDB = Depends(get_current_user)
):
    """Get scheduled appointments, optionally filtered by candidate or job"""
    try:
        db = SessionLocal()
        
        query = db.query(ScheduledAppointmentDB)
        
        # Filter by candidate or job if provided
        if candidate_id:
            query = query.filter(ScheduledAppointmentDB.candidate_id == candidate_id)
        if job_id:
            query = query.filter(ScheduledAppointmentDB.job_id == job_id)
        
        # Only show appointments for jobs in user's company
        if current_user.company_id:
            query = query.join(JobPostingDB, ScheduledAppointmentDB.job_id == JobPostingDB.id).filter(
                JobPostingDB.company_id == current_user.company_id
            )
        
        appointments = query.order_by(ScheduledAppointmentDB.scheduled_at.asc()).all()
        
        appointments_list = []
        for appointment in appointments:
            appointments_list.append({
                "id": appointment.id,
                "candidate_id": appointment.candidate_id,
                "job_id": appointment.job_id,
                "user_id": appointment.user_id,
                "conversation_id": appointment.conversation_id,
                "scheduled_at": appointment.scheduled_at.isoformat() if appointment.scheduled_at else None,
                "type": appointment.type,
                "location": appointment.location,
                "notes": appointment.notes,
                "status": appointment.status,
                "created_at": appointment.created_at.isoformat() if appointment.created_at else None
            })
        
        db.close()
        return {
            "success": True,
            "appointments": appointments_list
        }
    except Exception as e:
        db.close()
        raise HTTPException(status_code=500, detail=f"Failed to get appointments: {str(e)}")

@app.post("/candidate-conversations")
async def create_candidate_conversation(request_data: CandidateConversationRequest):
    """Store a new candidate conversation and optional persona guidance"""
    try:
        import json
        db = SessionLocal()
        candidate = db.query(CandidateDB).filter(CandidateDB.id == request_data.candidate_id).first()
        if not candidate:
            db.close()
            raise HTTPException(status_code=404, detail="Candidate not found")

        conversation = CandidateConversationDB(
            candidate_id=request_data.candidate_id,
            job_id=request_data.job_id or candidate.job_id,
            title=request_data.title,
            summary=request_data.summary,
            pros=request_data.pros,
            cons=request_data.cons,
            created_by=request_data.created_by,
            conversation_channel=request_data.conversation_channel
        )

        if request_data.persona_guidance:
            conversation.persona_guidance = json.dumps(request_data.persona_guidance)

        db.add(conversation)
        db.commit()
        db.refresh(conversation)
        conversation_id = conversation.id
        
        # Create notifications for job and candidate watchers
        try:
            job_id_for_notif = request_data.job_id or candidate.job_id
            if job_id_for_notif:
                # Notify job watchers
                job_watchers = db.query(JobWatcherDB).filter(JobWatcherDB.job_id == job_id_for_notif).all()
                for watcher in job_watchers:
                    notification = NotificationDB(
                        user_id=watcher.user_id,
                        type="conversation_added",
                        title=f"Nieuw gesprek met {candidate.name}",
                        message=f"Een nieuw gesprek is toegevoegd voor {candidate.name}: {request_data.title}",
                        related_candidate_id=request_data.candidate_id,
                        related_job_id=job_id_for_notif
                    )
                    db.add(notification)
            
            # Notify candidate watchers
            candidate_watchers = db.query(CandidateWatcherDB).filter(CandidateWatcherDB.candidate_id == request_data.candidate_id).all()
            for watcher in candidate_watchers:
                notification = NotificationDB(
                    user_id=watcher.user_id,
                    type="conversation_added",
                    title=f"Nieuw gesprek met {candidate.name}",
                    message=f"Een nieuw gesprek is toegevoegd voor {candidate.name}: {request_data.title}",
                    related_candidate_id=request_data.candidate_id,
                    related_job_id=job_id_for_notif
                )
                db.add(notification)
            
            db.commit()
        except Exception as notif_error:
            print(f"Error creating conversation notifications: {str(notif_error)}")
            # Don't fail the whole request if notifications fail

        response = serialize_conversation_record(conversation)
        db.close()
        return {"success": True, "conversation": response}
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error creating conversation: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to save conversation: {str(e)}")

@app.put("/candidates/{candidate_id}")
async def update_candidate(
    candidate_id: str,
    request: Request,
    current_user: UserDB = Depends(get_current_user)
):
    """Update candidate details (company note, etc.)"""
    try:
        db = SessionLocal()
        candidate = db.query(CandidateDB).filter(CandidateDB.id == candidate_id).first()
        if not candidate:
            db.close()
            raise HTTPException(status_code=404, detail="Candidate not found")
        
        # Check permissions - only recruiter who submitted or admin can update
        is_admin = current_user.role == "admin"
        is_submitter = candidate.submitted_by_company_id == current_user.company_id
        
        if not (is_admin or is_submitter):
            db.close()
            raise HTTPException(
                status_code=403,
                detail="You can only update candidates you submitted or if you are an admin"
            )
        
        # Parse request body
        content_type = request.headers.get("content-type", "")
        data = {}
        
        if "application/json" in content_type:
            try:
                data = await request.json()
            except:
                pass
        else:
            form_data = await request.form()
            data = dict(form_data)
        
        # Update company note if provided
        if "company_note" in data:
            candidate.company_note = data["company_note"] if data["company_note"] else None
        
        # Update job_id if provided (for assigning candidate to vacancy)
        if "job_id" in data:
            job_id = data["job_id"]
            if job_id:
                # Verify job exists
                job = db.query(JobPostingDB).filter(JobPostingDB.id == job_id).first()
                if not job:
                    db.close()
                    raise HTTPException(status_code=404, detail="Job not found")
                
                # If candidate doesn't have submitted_by_company_id yet, set it to recruiter's company
                if not candidate.submitted_by_company_id and current_user.role == "recruiter" and current_user.company_id:
                    candidate.submitted_by_company_id = current_user.company_id
                
                # Assign candidate to job
                candidate.job_id = job_id
                
                # Create notification for company about new candidate
                # Find company users for this job
                if job.company_id:
                    company_users = db.query(UserDB).filter(
                        UserDB.company_id == job.company_id,
                        UserDB.is_active == True
                    ).all()
                    
                    for user in company_users:
                        notification = NotificationDB(
                            user_id=user.id,
                            type="candidate_proposed",
                            title=f"Nieuwe kandidaat voorgesteld: {candidate.name}",
                            message=f"Recruiter heeft kandidaat '{candidate.name}' voorgesteld voor vacature '{job.title}'",
                            related_candidate_id=candidate.id,
                            related_job_id=job_id
                        )
                        db.add(notification)
        
        db.commit()
        db.refresh(candidate)
        
        # Serialize candidate for response
        job = None
        if candidate.job_id:
            job = db.query(JobPostingDB).filter(JobPostingDB.id == candidate.job_id).first()
        
        job_info = None
        if job:
            job_info = {
                "id": job.id,
                "title": job.title,
                "company": job.company
            }
        
        # Parse JSON fields
        import json
        skill_tags = None
        if candidate.skill_tags:
            try:
                skill_tags = json.loads(candidate.skill_tags) if isinstance(candidate.skill_tags, str) else candidate.skill_tags
            except:
                skill_tags = candidate.skill_tags
        
        db.close()
        
        return {
            "success": True,
            "candidate": {
                "id": candidate.id,
                "name": candidate.name,
                "email": candidate.email,
                "job": job_info,
                "job_id": candidate.job_id,
                "company_note": candidate.company_note,
                "pipeline_stage": candidate.pipeline_stage,
                "pipeline_status": candidate.pipeline_status,
                "submitted_by_company_id": candidate.submitted_by_company_id,
                "created_at": candidate.created_at.isoformat() if candidate.created_at else None
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error updating candidate: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to update candidate: {str(e)}")

@app.get("/candidates/{candidate_id}")
async def get_candidate_detail(candidate_id: str):
    """Detailed candidate view including full resume and conversations"""
    try:
        db = SessionLocal()
        candidate = db.query(CandidateDB).filter(CandidateDB.id == candidate_id).first()
        if not candidate:
            db.close()
            raise HTTPException(status_code=404, detail="Candidate not found")

        job_info = None
        if candidate.job_id:
            job = db.query(JobPostingDB).filter(JobPostingDB.id == candidate.job_id).first()
            if job:
                job_info = {
                    "id": job.id,
                    "title": job.title,
                    "company": job.company,
                    "location": job.location
                }

        conversation_count = db.query(CandidateConversationDB).filter(CandidateConversationDB.candidate_id == candidate.id).count()

        # Parse JSON fields for candidate detail
        skill_tags = None
        if candidate.skill_tags:
            try:
                skill_tags = json.loads(candidate.skill_tags) if isinstance(candidate.skill_tags, str) else candidate.skill_tags
            except:
                skill_tags = candidate.skill_tags
        
        prior_job_titles = None
        if candidate.prior_job_titles:
            try:
                prior_job_titles = json.loads(candidate.prior_job_titles) if isinstance(candidate.prior_job_titles, str) else candidate.prior_job_titles
            except:
                prior_job_titles = candidate.prior_job_titles
        
        certifications = None
        if candidate.certifications:
            try:
                certifications = json.loads(candidate.certifications) if isinstance(candidate.certifications, str) else candidate.certifications
            except:
                certifications = candidate.certifications
        
        result = {
            "id": candidate.id,
            "name": candidate.name,
            "email": candidate.email,
            "job_id": candidate.job_id,
            "job": job_info,
            "job_title": job_info["title"] if job_info else None,  # Add job_title for frontend compatibility
            "resume_text": candidate.resume_text,
            "motivational_letter": candidate.motivational_letter,
            "experience_years": candidate.experience_years,
            "skills": candidate.skills,
            "education": candidate.education,
            "preferential_job_ids": candidate.preferential_job_ids,
            "company_note": candidate.company_note,
            "created_at": candidate.created_at.isoformat() if candidate.created_at else None,
            "conversation_count": conversation_count,
            # Extended fields
            "motivation_reason": candidate.motivation_reason,
            "test_results": candidate.test_results,
            "age": candidate.age,
            "years_experience": candidate.years_experience,
            "skill_tags": skill_tags,
            "prior_job_titles": prior_job_titles,
            "certifications": certifications,
            "education_level": candidate.education_level,
            "location": candidate.location,
            "communication_level": candidate.communication_level,
            "availability_per_week": candidate.availability_per_week,
            "notice_period": candidate.notice_period,
            "salary_expectation": candidate.salary_expectation,
            "source": candidate.source,
            "pipeline_stage": candidate.pipeline_stage,
            "pipeline_status": candidate.pipeline_status,
            "submitted_by_company_id": candidate.submitted_by_company_id,  # Add for frontend
        }
        db.close()
        return {"success": True, "candidate": result}
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error fetching candidate detail: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch candidate detail: {str(e)}")

@app.put("/candidates/{candidate_id}/pipeline")
async def update_candidate_pipeline(
    candidate_id: str,
    request: Request
):
    """Update candidate pipeline stage, status, and job assignments - supports both JSON and Form data"""
    try:
        db = SessionLocal()
        candidate = db.query(CandidateDB).filter(CandidateDB.id == candidate_id).first()
        if not candidate:
            db.close()
            raise HTTPException(status_code=404, detail="Candidate not found")
        
        # Check if request is JSON
        content_type = request.headers.get("content-type", "")
        data = {}
        
        if "application/json" in content_type:
            try:
                data = await request.json()
            except:
                pass
        else:
            form_data = await request.form()
            data = {
                "pipeline_stage": form_data.get("pipeline_stage"),
                "pipeline_status": form_data.get("pipeline_status"),
                "job_id": form_data.get("job_id"),
                "preferential_job_ids": form_data.get("preferential_job_ids")
            }
        
        # Update job_id if provided
        if "job_id" in data and data["job_id"] is not None:
            # Verify job exists
            job = db.query(JobPostingDB).filter(JobPostingDB.id == data["job_id"]).first()
            if job:
                candidate.job_id = data["job_id"]
            else:
                db.close()
                raise HTTPException(status_code=404, detail=f"Job {data['job_id']} not found")
        
        # Update preferential_job_ids if provided
        if "preferential_job_ids" in data and data["preferential_job_ids"] is not None:
            # Verify all jobs exist
            pref_job_ids = [jid.strip() for jid in str(data["preferential_job_ids"]).split(",") if jid.strip()]
            for job_id in pref_job_ids:
                job = db.query(JobPostingDB).filter(JobPostingDB.id == job_id).first()
                if not job:
                    db.close()
                    raise HTTPException(status_code=404, detail=f"Job {job_id} not found")
            candidate.preferential_job_ids = data["preferential_job_ids"]
        
        # Validate and update pipeline_stage
        valid_stages = ['introduced', 'review', 'first_interview', 'second_interview', 'offer', 'complete']
        if "pipeline_stage" in data and data["pipeline_stage"] is not None:
            if data["pipeline_stage"] not in valid_stages:
                db.close()
                raise HTTPException(status_code=400, detail=f"Invalid pipeline_stage. Must be one of: {', '.join(valid_stages)}")
            candidate.pipeline_stage = data["pipeline_stage"]
        
        # Validate and update pipeline_status
        valid_statuses = ['active', 'on_hold', 'rejected', 'accepted']
        if "pipeline_status" in data and data["pipeline_status"] is not None:
            if data["pipeline_status"] not in valid_statuses:
                db.close()
                raise HTTPException(status_code=400, detail=f"Invalid pipeline_status. Must be one of: {', '.join(valid_statuses)}")
            candidate.pipeline_status = data["pipeline_status"]
        
        db.commit()
        db.refresh(candidate)
        
        # Parse JSON fields for response
        skill_tags = None
        if candidate.skill_tags:
            try:
                skill_tags = json.loads(candidate.skill_tags) if isinstance(candidate.skill_tags, str) else candidate.skill_tags
            except:
                skill_tags = candidate.skill_tags
        
        prior_job_titles = None
        if candidate.prior_job_titles:
            try:
                prior_job_titles = json.loads(candidate.prior_job_titles) if isinstance(candidate.prior_job_titles, str) else candidate.prior_job_titles
            except:
                prior_job_titles = candidate.prior_job_titles
        
        certifications = None
        if candidate.certifications:
            try:
                certifications = json.loads(candidate.certifications) if isinstance(candidate.certifications, str) else candidate.certifications
            except:
                certifications = candidate.certifications
        
        result = {
            "success": True,
            "message": "Candidate pipeline updated successfully",
            "candidate": {
                "id": candidate.id,
                "name": candidate.name,
                "pipeline_stage": candidate.pipeline_stage,
                "pipeline_status": candidate.pipeline_status,
                "skill_tags": skill_tags,
                "prior_job_titles": prior_job_titles,
                "certifications": certifications
            }
        }
        db.close()
        return result
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error updating candidate pipeline: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to update candidate pipeline: {str(e)}")

@app.post("/debate-candidate")
async def debate_candidate(
    candidate_id: str = Form(...),
    job_id: Optional[str] = Form(None),  # Allow job_id to be passed from frontend
    company_note: Optional[str] = Form(None),
    company_note_file: Optional[UploadFile] = File(None),
    request: Request = None
):
    """Multi-expert debate between selected personas"""
    db = None
    try:
        print(f"\n=== DEBATE REQUEST START ===")
        print(f"candidate_id: {candidate_id}")
        print(f"job_id: {job_id}")
        print(f"company_note: {'present' if company_note else 'none'}")
        # Get form data to extract dynamic persona prompts
        form_data = await request.form()
        
        # Extract persona prompts dynamically
        persona_prompts = {}
        for key, value in form_data.items():
            if key.endswith('_prompt'):
                persona_name = key.replace('_prompt', '')
                persona_prompts[persona_name] = value
        
        if not persona_prompts:
            raise HTTPException(status_code=400, detail="No persona prompts provided")
        
        db = SessionLocal()
        candidate = db.query(CandidateDB).filter(CandidateDB.id == candidate_id).first()
        
        if not candidate:
            db.close()
            raise HTTPException(status_code=404, detail="Candidate not found")
        
        # Determine which job_id to use: passed parameter, candidate.job_id, or first preferential job
        debate_job_id = None
        if job_id:
            debate_job_id = job_id
        elif candidate.job_id:
            debate_job_id = candidate.job_id
        elif candidate.preferential_job_ids:
            # Use first preferential job if no job_id is set
            preferential_list = [jid.strip() for jid in candidate.preferential_job_ids.split(",") if jid.strip()]
            if preferential_list:
                debate_job_id = preferential_list[0]
        
        if not debate_job_id:
            db.close()
            raise HTTPException(status_code=400, detail="Debate requires a job posting. Please select a job before running debate.")
        
        # Get job information if available
        job_info = ""
        if debate_job_id:
            job = db.query(JobPostingDB).filter(JobPostingDB.id == debate_job_id).first()
            if job:
                job_info = f"""

JOB POSTING DETAILS:
Title: {job.title}
Company: {job.company}
Location: {job.location}
Salary Range: {job.salary_range}
Description: {job.description}
Requirements: {job.requirements}"""
        
        # Create dynamic debate prompt
        persona_descriptions = []
        for persona_name, prompt in persona_prompts.items():
            persona_descriptions.append(f"{persona_name.replace('_', ' ').title()}: {prompt}")
        
        personas_text = "\n".join(persona_descriptions)
        
        # This prompt is not used when LangChain is active, but kept for fallback
        system_prompt = f"""You are facilitating a professional debate between {len(persona_prompts)} expert personas evaluating a candidate for a specific job. Each persona should speak in their role and provide their perspective on whether to hire this candidate.

The personas and their roles are:

{personas_text}

Each persona should evaluate the candidate from their perspective and then engage in a professional debate about the hiring decision."""
        
        # Include motivational letter if available
        motivational_info = ""
        if candidate.motivational_letter:
            motivational_info = f"""

MOTIVATIONAL LETTER:
{candidate.motivational_letter}"""
        
        # Build extended candidate information section for debate (candidate-5: ensure digital employees assess all new fields)
        # Re-use same logic as in evaluate-candidate
        debate_extended_info_sections = []
        
        # Parse JSON fields
        import json
        debate_skill_tags_list = []
        if candidate.skill_tags:
            try:
                debate_skill_tags_list = json.loads(candidate.skill_tags) if isinstance(candidate.skill_tags, str) else candidate.skill_tags
            except:
                debate_skill_tags_list = []
        
        debate_prior_job_titles_list = []
        if candidate.prior_job_titles:
            try:
                debate_prior_job_titles_list = json.loads(candidate.prior_job_titles) if isinstance(candidate.prior_job_titles, str) else candidate.prior_job_titles
            except:
                debate_prior_job_titles_list = []
        
        debate_certifications_list = []
        if candidate.certifications:
            try:
                debate_certifications_list = json.loads(candidate.certifications) if isinstance(candidate.certifications, str) else candidate.certifications
            except:
                debate_certifications_list = []
        
        # Build structured extended information for debate
        if candidate.motivation_reason:
            debate_extended_info_sections.append(f"Motivatie voor rol / Reden van vertrek: {candidate.motivation_reason}")
        
        if candidate.test_results:
            debate_extended_info_sections.append(f"Testresultaten / Vaardigheidsscores: {candidate.test_results}")
        
        if candidate.age:
            debate_extended_info_sections.append(f"Leeftijd: {candidate.age} jaar")
        
        if candidate.years_experience:
            debate_extended_info_sections.append(f"Jaren ervaring: {candidate.years_experience}")
        elif candidate.experience_years:
            debate_extended_info_sections.append(f"Jaren ervaring: {candidate.experience_years}")
        
        if debate_skill_tags_list:
            skill_tags_str = ", ".join(debate_skill_tags_list) if isinstance(debate_skill_tags_list, list) else str(debate_skill_tags_list)
            debate_extended_info_sections.append(f"Vaardigheden tags: {skill_tags_str}")
        
        if debate_prior_job_titles_list:
            prior_jobs_str = ", ".join(debate_prior_job_titles_list) if isinstance(debate_prior_job_titles_list, list) else str(debate_prior_job_titles_list)
            debate_extended_info_sections.append(f"Eerdere functietitels: {prior_jobs_str}")
        
        if debate_certifications_list:
            certs_str = ", ".join(debate_certifications_list) if isinstance(debate_certifications_list, list) else str(debate_certifications_list)
            debate_extended_info_sections.append(f"Certificeringen: {certs_str}")
        
        if candidate.education_level:
            debate_extended_info_sections.append(f"Opleidingsniveau: {candidate.education_level}")
        
        if candidate.location:
            debate_extended_info_sections.append(f"Locatie: {candidate.location}")
        
        if candidate.communication_level:
            debate_extended_info_sections.append(f"Communicatieniveau: {candidate.communication_level}")
        
        if candidate.availability_per_week:
            debate_extended_info_sections.append(f"Beschikbaarheid per week: {candidate.availability_per_week} uur/week")
        
        if candidate.notice_period:
            debate_extended_info_sections.append(f"Opzegtermijn: {candidate.notice_period}")
        
        if candidate.salary_expectation:
            debate_extended_info_sections.append(f"Salarisverwachting: €{candidate.salary_expectation}/jaar (op basis van 40 uur/week)")
        
        if candidate.source:
            debate_extended_info_sections.append(f"Bron / Hoe gevonden: {candidate.source}")
        
        # Combine extended info for debate
        debate_extended_candidate_info = ""
        if debate_extended_info_sections:
            extended_info_text = "\n".join(debate_extended_info_sections)
            debate_extended_candidate_info = f"""

BELANGRIJK - STRUCTUREDE KANDIDAATINFORMATIE:
Deze gestructureerde informatie is expliciet opgeslagen voor deze kandidaat. Gebruik deze informatie actief in je discussie, vooral als deze relevanter of actueler is dan informatie uit het CV.

{truncate_text_safely(extended_info_text, 2000)}"""
        
        # Include company note if provided (guidance only, not ground truth)
        company_note_text = company_note
        if company_note_file and company_note_file.filename:
            try:
                company_note_content = await company_note_file.read()
                company_note_result = extract_text_from_file(company_note_content, company_note_file.filename)
                company_note_text = company_note_result["text"]
            except Exception as e:
                print(f"Error processing company note file in debate: {str(e)}")
                company_note_text = company_note  # Fallback to text input
        
        company_note_info = ""
        if company_note_text:
            company_note_text = truncate_text_safely(company_note_text, MAX_COMPANY_NOTE_CHARS)
            company_note_info = f"""

BEDRIJFSNOTITIE (Belangrijke informatie over de kandidaat van de makelaar):
Deze bedrijfsnotitie bevat belangrijke informatie over de kandidaat van de makelaar. 
Neem deze informatie serieus mee in je discussie en evaluatie.
{company_note_text}"""
        
        # Initialize variables before try block
        response = None
        timing_data = {}
        full_prompt_text = ""
        
        # Use LangChain multi-agent system for realistic debate
        try:
            # Try to import langchain_debate - this will fail if langchain_openai is not installed
            from langchain_debate import run_multi_agent_debate
            LANGCHAIN_AVAILABLE = True
            
            # For debate, we still include all candidate info in the base candidate_info
            # But personas will focus on what's relevant to them based on their prompts and instructions
            # This allows them to reference other aspects if needed in discussion, but focus on their domain
            candidate_info_base = f"{candidate.resume_text}{motivational_info}"
            
            # Optionally add a note about structured fields being available but to focus on relevant ones
            if debate_extended_candidate_info:
                # Add a note that structured info is available but personas should focus on their domain
                candidate_info_base += f"""

BELANGRIJK - STRUCTUREDE KANDIDAATINFORMATIE (beschikbaar voor alle experts):
Deze gestructureerde informatie is expliciet opgeslagen voor deze kandidaat. Focus in je discussie alleen op aspecten die relevant zijn voor jouw expertise.
{debate_extended_candidate_info.replace('BELANGRIJK - STRUCTUREDE KANDIDAATINFORMATIE:', 'STRUCTUREDE INFORMATIE (focus op wat relevant is voor jouw rol):')}
"""
            
            candidate_info = candidate_info_base
            
            print(f"Calling run_multi_agent_debate with {len(persona_prompts)} personas...")
            try:
                debate_result = await run_multi_agent_debate(
                    persona_prompts=persona_prompts,
                    candidate_info=candidate_info,
                    job_info=job_info,
                    company_note=company_note_text if company_note_text else None,
                    track_timing=True
                )
            except Exception as debate_error:
                print(f"Error in run_multi_agent_debate: {debate_error}")
                traceback.print_exc()
                raise HTTPException(
                    status_code=500, 
                    detail=f"Debate execution failed: {str(debate_error)}"
                )
            
            # Handle tuple return (response, timing_data)
            try:
                if isinstance(debate_result, tuple) and len(debate_result) == 2:
                    response, timing_data = debate_result
                    print(f"✓ Extracted tuple: response type={type(response)}, timing_data keys={list(timing_data.keys()) if timing_data else []}")
                elif isinstance(debate_result, tuple):
                    # Handle unexpected tuple length
                    response = debate_result[0] if len(debate_result) > 0 else ""
                    if len(debate_result) > 1:
                        timing_data = debate_result[1] if isinstance(debate_result[1], dict) else {}
                    print(f"⚠ Unexpected tuple length: {len(debate_result)}, using first element")
                else:
                    response = debate_result
                    timing_data = {}
                    print(f"⚠ Debate result is not a tuple, type: {type(debate_result)}")
                
                # Ensure response is not None
                if response is None:
                    raise ValueError("Debate response is None")
                
                print(f"Debate response type: {type(response)}, length: {len(str(response)) if response else 0}")
                
                # Validate response is JSON string
                if isinstance(response, str):
                    try:
                        import json
                        parsed = json.loads(response)
                        if isinstance(parsed, list):
                            print(f"✓ Valid JSON array with {len(parsed)} messages")
                        else:
                            print(f"⚠ Response is JSON but not an array: {type(parsed)}")
                    except json.JSONDecodeError:
                        print(f"⚠ Response is not valid JSON string, first 200 chars: {str(response)[:200]}")
            except Exception as unpack_error:
                print(f"Error unpacking debate result: {unpack_error}")
                traceback.print_exc()
                raise HTTPException(status_code=500, detail=f"Failed to process debate result: {str(unpack_error)}")
            
            # Build full prompt for display
            full_prompt_text = f"LANGCHAIN MULTI-AGENT DEBATE SYSTEM\n\nModerator + {len(persona_prompts)} Persona Agents\n\nPersonas: {', '.join(persona_prompts.keys())}\n\nDebate structured with:\n1. Moderator introduction\n2. Initial thoughts from each persona\n3. Multiple rounds of discussion\n4. Final summary from moderator"
            
        except ImportError as e:
            print(f"ImportError: {e}")
            traceback.print_exc()
            # Fallback to simple OpenAI if LangChain not available
            print("LangChain not available, falling back to simple debate...")
            user_prompt = f"""Please facilitate a debate between the {len(persona_prompts)} personas about this candidate:

CANDIDATE CV:
{candidate.resume_text}{motivational_info}{job_info}{company_note_info}

Each persona should provide their evaluation and then engage in a professional discussion about the hiring decision."""
            
            openai_result = call_openai_safe([
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ], max_tokens=OPENAI_MAX_TOKENS_DEBATE, temperature=OPENAI_TEMPERATURE_DEBATE, model=OPENAI_MODEL_DEBATE)
            
            if not openai_result["success"]:
                db.close()
                raise HTTPException(status_code=500, detail=f"AI debate failed: {openai_result['error']}")
            
            # Ensure response and timing_data are initialized
            response = openai_result["result"].choices[0].message.content
            full_prompt_text = f"SYSTEM PROMPT:\n{system_prompt}\n\nUSER PROMPT:\n{user_prompt}"
            timing_data = {}  # Create empty timing data for fallback
        
        # Response is already unpacked above (if from LangChain), now format it
        # Ensure response is initialized
        if response is None:
            db.close()
            raise HTTPException(status_code=500, detail="Debate returned no response")
        
        debate_response = response
        debate_timing_data = timing_data if timing_data else {}
        
        print(f"Processing debate_response: type={type(debate_response)}, timing_data steps={len(debate_timing_data.get('steps', []))}")
        
        # Ensure debate_response is a string
        if isinstance(debate_response, (dict, list)):
            debate_response = json.dumps(debate_response, ensure_ascii=False)
        elif not isinstance(debate_response, str):
            debate_response = str(debate_response) if debate_response else ""
        
        if not debate_response:
            db.close()
            raise HTTPException(status_code=500, detail="Debate returned empty response")
        
        result_data = {
            "debate": debate_response,
            "full_prompt": full_prompt_text,
            "tokens_used": 0,  # LangChain doesn't return token count in same format
            "timing_data": debate_timing_data
        }
        
        # Initialize result_id variable
        result_id = None
        
        # Save debate result to database
        try:
            import json
            result_json = json.dumps(result_data)
            # Sort persona IDs for consistent comparison
            persona_ids_json = json.dumps(sorted(list(persona_prompts.keys())))
            
            # Check if result already exists (for caching)
            existing_result = db.query(EvaluationResultDB).filter(
                EvaluationResultDB.candidate_id == candidate_id,
                EvaluationResultDB.job_id == debate_job_id,
                EvaluationResultDB.result_type == 'debate',
                EvaluationResultDB.selected_personas == persona_ids_json
            ).first()
            if existing_result:
                # Update existing result
                existing_result.result_data = result_json
                existing_result.company_note = company_note
                existing_result.updated_at = func.now()
                result_id = existing_result.id
            else:
                # Create new result
                debate_result = EvaluationResultDB(
                    candidate_id=candidate_id,
                    job_id=debate_job_id,
                    result_type='debate',
                    result_data=result_json,
                    selected_personas=persona_ids_json,
                    company_note=company_note
                )
                db.add(debate_result)
            
            db.commit()
            if not result_id:
                db.refresh(debate_result)
                result_id = debate_result.id
                
                # Create notifications for job watchers
                try:
                    watchers = db.query(JobWatcherDB).filter(JobWatcherDB.job_id == debate_job_id).all()
                    for watcher in watchers:
                        notification = NotificationDB(
                            user_id=watcher.user_id,
                            type="debate_complete",
                            title=f"Expert debat voltooid voor {candidate.name}",
                            message=f"Expert debat is voltooid voor {candidate.name} bij {job.title if job else 'vacature'}",
                            related_candidate_id=candidate_id,
                            related_job_id=debate_job_id,
                            related_result_id=result_id
                        )
                        db.add(notification)
                    db.commit()
                except Exception as notif_error:
                    print(f"Error creating notifications: {str(notif_error)}")
                    # Don't fail the whole request if notifications fail
        except Exception as e:
            print(f"Error saving debate result: {str(e)}")
            traceback.print_exc()
            # Continue even if saving fails
        
        db.close()
        
        # Ensure debate_response is properly formatted (already formatted above, but double-check)
        final_debate_response = debate_response
        if isinstance(final_debate_response, (dict, list)):
            final_debate_response = json.dumps(final_debate_response, ensure_ascii=False)
        elif not isinstance(final_debate_response, str):
            final_debate_response = str(final_debate_response) if final_debate_response else ""
        
        # Ensure timing_data is serializable
        try:
            # Convert timing_data to ensure it's JSON-serializable
            if debate_timing_data and isinstance(debate_timing_data, dict):
                # Convert timestamps to numbers if needed
                processed_timing = {
                    'start_time': float(debate_timing_data.get('start_time', 0)) if isinstance(debate_timing_data.get('start_time'), (int, float)) else 0,
                    'end_time': float(debate_timing_data.get('end_time', 0)) if isinstance(debate_timing_data.get('end_time'), (int, float)) else 0,
                    'total': float(debate_timing_data.get('total', 0)) if isinstance(debate_timing_data.get('total'), (int, float)) else 0,
                    'steps': []
                }
                # Process steps array
                if 'steps' in debate_timing_data and isinstance(debate_timing_data['steps'], list):
                    for step in debate_timing_data['steps']:
                        if isinstance(step, dict):
                            processed_step = {}
                            for key, value in step.items():
                                # Convert timestamp to float if it's a number
                                if key == 'timestamp':
                                    processed_step[key] = float(value) if isinstance(value, (int, float)) else value
                                elif key == 'duration':
                                    processed_step[key] = float(value) if isinstance(value, (int, float)) else value
                                # Keep other fields as-is (strings, lists, etc.)
                                else:
                                    processed_step[key] = value
                            processed_timing['steps'].append(processed_step)
                        else:
                            processed_timing['steps'].append(step)
                debate_timing_data = processed_timing
        except Exception as timing_error:
            print(f"Error processing timing data: {timing_error}")
            traceback.print_exc()
            debate_timing_data = {}
        
        print(f"Final return: debate length={len(final_debate_response)}, timing_data steps={len(debate_timing_data.get('steps', []))}")
        
        return {
            "success": True,
            "debate": final_debate_response,
            "tokens_used": 0,  # LangChain doesn't return token count in same format
            "full_prompt": full_prompt_text,
            "timing_data": debate_timing_data,  # Include timing data for workflow visualization
            "result_id": result_id  # Include result_id so frontend can navigate directly
        }
        
    except HTTPException:
        # Re-raise HTTPExceptions (they already have proper status codes)
        if db:
            try:
                db.close()
            except:
                pass
        raise
    except Exception as e:
        error_msg = f"Error in debate endpoint: {str(e)}"
        error_type = type(e).__name__
        
        # Log to console
        print(f"\n{'='*60}")
        print(f"ERROR IN DEBATE ENDPOINT")
        print(f"{'='*60}")
        print(f"Error: {error_msg}")
        print(f"Error type: {error_type}")
        print(f"\nFull traceback:")
        traceback.print_exc()
        print(f"{'='*60}\n")
        
        # Log to file for debugging
        try:
            import os
            log_dir = os.path.join(os.path.dirname(__file__), 'logs')
            os.makedirs(log_dir, exist_ok=True)
            log_file = os.path.join(log_dir, 'debate_errors.log')
            with open(log_file, 'a') as f:
                from datetime import datetime
                f.write(f"\n{'='*60}\n")
                f.write(f"ERROR AT {datetime.now().isoformat()}\n")
                f.write(f"{'='*60}\n")
                f.write(f"Error: {error_msg}\n")
                f.write(f"Error type: {error_type}\n")
                f.write(f"Full traceback:\n")
                traceback.print_exception(type(e), e, e.__traceback__, file=f)
                f.write(f"{'='*60}\n\n")
            print(f"Error logged to: {log_file}")
        except Exception as log_error:
            print(f"Failed to write error log: {log_error}")
        
        # Ensure database is closed
        if db:
            try:
                db.close()
            except:
                pass
        
        # Create detailed error message
        error_detail = f"Debate failed: {str(e)}"
        # Try to get more context about the error
        if "tuple" in str(e).lower() or "unpack" in str(e).lower():
            error_detail = f"Debate failed - Error processing response: {str(e)}"
        elif "response" in str(e).lower() and ("not defined" in str(e).lower() or "None" in str(e)):
            error_detail = f"Debate failed - Response processing error: {str(e)}"
        
        raise HTTPException(status_code=500, detail=error_detail)

@app.post("/debate-chat")
async def debate_chat(request: DebateChatRequest):
    """Allow users to chat with personas after a debate has concluded"""
    try:
        import json

        question = (request.question or "").strip()
        if not question:
            raise HTTPException(status_code=400, detail="Question is required")

        db = SessionLocal()
        try:
            result = db.query(EvaluationResultDB).filter(EvaluationResultDB.id == request.result_id).first()
            if not result or result.result_type != 'debate':
                raise HTTPException(status_code=404, detail="Debate result not found")

            debate_data = result.result_data
            if isinstance(debate_data, str):
                try:
                    debate_data = json.loads(debate_data)
                except json.JSONDecodeError:
                    debate_data = {"debate": debate_data}

            candidate = db.query(CandidateDB).filter(CandidateDB.id == result.candidate_id).first()
            job = db.query(JobPostingDB).filter(JobPostingDB.id == result.job_id).first()

            selected_personas = []
            if result.selected_personas:
                try:
                    selected_personas = json.loads(result.selected_personas) if isinstance(result.selected_personas, str) else result.selected_personas
                except json.JSONDecodeError:
                    selected_personas = []

            persona_records = []
            if selected_personas:
                persona_records = db.query(PersonaDB).filter(PersonaDB.name.in_(selected_personas)).all()
            persona_map = {p.name: p for p in persona_records}

            persona_focus = None
            if request.persona_name:
                persona_focus = persona_map.get(request.persona_name)
                if not persona_focus:
                    raise HTTPException(status_code=400, detail="Selected persona was not part of the debate")

            debate_summary = ""
            transcript = debate_data.get("debate") if isinstance(debate_data, dict) else None
            if isinstance(transcript, list):
                debate_summary = "\n".join([
                    f"{msg.get('role', 'Expert')}: {msg.get('content', '').strip()}"
                    for msg in transcript if msg.get('content')
                ])
            elif isinstance(transcript, str):
                debate_summary = transcript

            company_note = result.company_note or ""

            if persona_focus:
                responder_name = persona_focus.display_name
                system_prompt = (
                    f"Je bent {persona_focus.display_name}, een digitale werknemer die kandidaten beoordeelt voor {job.title if job else 'deze functie'}.\n"
                    "Beantwoord vervolgvragen gebaseerd op het eerdere debat en spreek altijd in het Nederlands vanuit jouw perspectief."
                )
            else:
                responder_name = "Moderator"
                system_prompt = (
                    "Je bent de moderator van het expertdebat en geeft antwoorden namens alle digitale werknemers.\n"
                    "Vat relevante inzichten samen en antwoord in het Nederlands."
                )

            context_sections = []
            if job:
                context_sections.append(f"Vacature: {job.title} bij {job.company} ({job.location or 'locatie onbekend'})")
            if candidate:
                context_sections.append(f"Kandidaat: {candidate.name} ({candidate.email or 'email onbekend'})")
            if company_note:
                context_sections.append(f"Bedrijfsnotitie: {company_note}")
            if debate_summary:
                context_sections.append(f"Samenvatting debat:\n{debate_summary}")

            context_text = "\n\n".join(context_sections)
            user_prompt = (
                f"{context_text}\n\n"
                f"Vraag van gebruiker: {question}\n\n"
                "Geef een concreet en bruikbaar antwoord. Verwijs naar inzichten uit het debat indien relevant."
            )

            ai_response = call_openai_safe(
                [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                max_tokens=700,
                temperature=0.4,
                model=OPENAI_MODEL_DEBATE
            )

            if not ai_response["success"]:
                raise HTTPException(status_code=500, detail=f"AI chat failed: {ai_response['error']}")

            answer = ai_response["result"].choices[0].message.content.strip()
            return {
                "success": True,
                "answer": answer,
                "persona": responder_name
            }
        finally:
            db.close()
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in debate_chat: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to chat with personas: {str(e)}")

# -----------------------------
# Job Analysis endpoint
# -----------------------------
@app.post("/analyze-job")
async def analyze_job(job_id: str = Form(...)):
    """AI analysis of job posting: correctness, research quality, role extension"""
    try:
        print(f"Received job analysis request. job_id: {repr(job_id)}, type: {type(job_id)}, length: {len(job_id) if job_id else 0}")
        
        if not job_id or not job_id.strip():
            raise HTTPException(
                status_code=400, 
                detail="Job ID is required. Please select a job posting first."
            )
        
        # Clean and normalize job_id
        job_id = job_id.strip()
        print(f"Normalized job_id: {repr(job_id)}")
        
        db = SessionLocal()
        
        # Check if job exists - try exact match first
        job = db.query(JobPostingDB).filter(JobPostingDB.id == job_id).first()
        
        # Debug output
        if job:
            print(f"✅ Found job: {job.title} at {job.company}")
        else:
            print(f"❌ Job NOT FOUND with ID: {repr(job_id)}")
        
        if not job:
            print(f"Job not found with exact match. Searching all jobs...")
            # Debug: List all jobs
            all_jobs = db.query(JobPostingDB).all()
            print(f"Total jobs in database: {len(all_jobs)}")
            for j in all_jobs:
                print(f"  DB Job ID: {repr(j.id)} (type: {type(j.id)}, title: {j.title})")
                print(f"  Requested ID: {repr(job_id)} (type: {type(job_id)})")
                print(f"  Match: {j.id == job_id}, Match (str): {str(j.id) == str(job_id)}")
            
            # Try string comparison as fallback (in case of type mismatch)
            # Also try case-insensitive comparison and cleaned comparison
            all_jobs = db.query(JobPostingDB).all()
            for j in all_jobs:
                j_id_str = str(j.id).strip()
                req_id_str = str(job_id).strip()
                if j_id_str.lower() == req_id_str.lower():
                    job = j
                    print(f"Found job using case-insensitive string match: {job.title}")
                    print(f"Matched: DB ID '{j_id_str}' == Requested ID '{req_id_str}'")
                    break
                # Also try without any hyphens/dashes in case of formatting differences
                j_id_clean = j_id_str.replace('-', '').replace('_', '').replace(' ', '').lower()
                req_id_clean = req_id_str.replace('-', '').replace('_', '').replace(' ', '').lower()
                if j_id_clean == req_id_clean and len(j_id_clean) > 10:  # Only if cleaned IDs are substantial
                    job = j
                    print(f"Found job using cleaned ID match: {job.title}")
                    print(f"Matched: DB ID cleaned '{j_id_clean}' == Requested ID cleaned '{req_id_clean}'")
                    break
        
        if not job:
            # Check if any jobs exist at all
            total_jobs = db.query(JobPostingDB).count()
            
            if total_jobs == 0:
                db.close()
                raise HTTPException(
                    status_code=404, 
                    detail="No job postings found in the system. Please create a job posting first before analyzing."
                )
            else:
                # Get a list of available job titles for context
                available_jobs = db.query(JobPostingDB).limit(3).all()
                
                job_list = ", ".join([f"'{j.title} at {j.company}' (ID: {j.id[:8]}...)" for j in available_jobs])
                available_info = f" Available jobs include: {job_list}" if available_jobs else ""
                
                # Also check if maybe the job_id has extra characters or encoding issues
                all_jobs_for_debug = db.query(JobPostingDB).all()
                similar_ids = []
                for j in all_jobs_for_debug:
                    if len(j.id) == len(job_id) or abs(len(j.id) - len(job_id)) <= 2:
                        similar_ids.append(f"{j.title} (ID: {repr(j.id)}, length: {len(j.id)})")
                
                db.close()
                
                debug_info = f"\nRequested ID: {repr(job_id)} (length: {len(job_id)})\nSimilar IDs in database: {', '.join(similar_ids[:3])}" if similar_ids else ""
                
                raise HTTPException(
                    status_code=404, 
                    detail=f"Job posting with ID '{job_id}' not found. The job may have been deleted or the ID is invalid. Please select a valid job posting from the dropdown.{available_info}{debug_info}"
                )
        
        # Build comprehensive analysis prompt (in Dutch)
        system_prompt = """Je bent een Nederlandstalige HR-consultant en arbeidsmarktanalist. Je onderzoekt vacatures kritisch en levert beknopte, kwantitatieve inzichten.

Richtlijnen:
1. Analyseer steeds vanuit vier invalshoeken: Analyse, Match, Correctheid en Kwaliteit.
2. Geef voor elk onderdeel een score tussen 1 en 10 (met één decimaal) en een korte samenvatting (max. 4 zinnen).
3. Formuleer voor roluitbreiding concrete vervolgstappen met prioriteit en impact.
4. Antwoord altijd uitsluitend in het Nederlands.

Lever uitsluitend het gevraagde JSON-formaat aan en respecteer de rating-range strikt."""
        
        # Prepare detailed user prompt (in Dutch)
        description_text = job.description or "Geen beschrijving opgegeven"
        requirements_text = job.requirements or "Geen vereisten gespecificeerd"
        location_text = job.location or "Niet gespecificeerd"
        salary_text = job.salary_range or "Niet gespecificeerd"
        
        user_prompt = f"""Voer een grondige analyse uit van deze vacature:

FUNCTIETITEL: {job.title}
BEDRIJF: {job.company}
LOCATIE: {location_text}
SALARISBEREIK: {salary_text}

VACATUREBESCHRIJVING:
{description_text}

FUNCTIE-EISEN:
{requirements_text}

Analyseer deze vacature grondig. Overweeg:
- Komt de vacaturetekst overeen met wat iemand met de titel "{job.title}" typisch doet?
- Zijn er discrepanties tussen de titel en de beschreven taken?
- Is de beschrijving uitgebreid genoeg? Wat ontbreekt er?
- Zijn de vereisten afgestemd op de rolverwachtingen?
- Op basis van industrie-standaarden, moet deze rol gesplitst, uitgebreid of blijven zoals het is?

BELANGRIJK: reageer ALLEEN met geldig JSON (geen markdown). Gebruik exact dit formaat:

{{
  "analysis": {{
    "summary": "Korte analyse in het Nederlands",
    "rating": 8.4
  }},
  "match": {{
    "summary": "Hoe goed de beschrijving overeenkomt met de titel",
    "rating": 7.1
  }},
  "correctness": {{
    "summary": "Beoordeling van realisme en volledigheid",
    "rating": 8.0
  }},
  "quality": {{
    "summary": "Kwaliteit van onderzoek/onderbouwing",
    "rating": 7.6
  }},
  "extension": {{
    "overview": "Belangrijkste observaties over roluitbreiding",
    "advice": "handhaven|uitbreiden|opsplitsen",
    "recommended_actions": [
      {{
        "title": "Concrete stap",
        "impact": "Waarom dit belangrijk is",
        "priority": "hoog|middel|laag"
      }}
    ]
  }}
}}

Regels:
- Geef voor Analyse, Match, Correctheid en Kwaliteit altijd een score tussen 1 en 10 met één decimaal.
- Houd elke summary compact (max. 4 zinnen) en actiegericht.
- Lever maximaal drie aanbevolen acties met duidelijke prioriteit.
- Antwoord volledig in het Nederlands en geef niets buiten het JSON-object."""
        
        # Call OpenAI with web search capability
        print(f"Calling OpenAI for job analysis. Model: {OPENAI_MODEL_JOB_ANALYSIS}, Max tokens: {OPENAI_MAX_TOKENS_JOB_ANALYSIS}")
        openai_result = call_openai_safe([
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ], max_tokens=OPENAI_MAX_TOKENS_JOB_ANALYSIS, temperature=OPENAI_TEMPERATURE_JOB_ANALYSIS, model=OPENAI_MODEL_JOB_ANALYSIS)
        
        if not openai_result["success"]:
            db.close()
            error_msg = openai_result.get('error', 'Unknown error')
            print(f"OpenAI call failed: {error_msg}")
            raise HTTPException(status_code=500, detail=f"AI analysis failed: {error_msg}")
        
        # Check if we have a result
        if not openai_result.get("result"):
            db.close()
            print("OpenAI returned no result object")
            raise HTTPException(status_code=500, detail="AI returned invalid response structure")
        
        if not hasattr(openai_result["result"], "choices") or len(openai_result["result"].choices) == 0:
            db.close()
            print("OpenAI returned no choices")
            raise HTTPException(status_code=500, detail="AI returned no response choices")
        
        response = openai_result["result"].choices[0].message.content
        
        if not response or len(response.strip()) == 0:
            db.close()
            print("OpenAI returned empty response")
            raise HTTPException(status_code=500, detail="AI returned empty response content")
        
        print(f"AI Analysis Response received: {len(response)} characters")
        
        # Parse JSON response
        try:
            import json
            import re
            
            # Try to extract JSON if wrapped in markdown code blocks
            cleaned_response = response.strip()
            
            # Remove markdown code blocks if present
            if "```json" in cleaned_response:
                json_match = re.search(r'```json\s*(.*?)\s*```', cleaned_response, re.DOTALL)
                if json_match:
                    cleaned_response = json_match.group(1).strip()
            elif "```" in cleaned_response:
                json_match = re.search(r'```\s*(.*?)\s*```', cleaned_response, re.DOTALL)
                if json_match:
                    cleaned_response = json_match.group(1).strip()
            
            # Try to find JSON object in the text if not properly formatted
            if not cleaned_response.startswith('{'):
                json_match = re.search(r'\{.*\}', cleaned_response, re.DOTALL)
                if json_match:
                    cleaned_response = json_match.group(0)
            
            print(f"Attempting to parse JSON (length: {len(cleaned_response)})")
            analysis = json.loads(cleaned_response)
            print("JSON parsing successful")
        except json.JSONDecodeError as e:
            print(f"JSON parsing error: {str(e)}")
            print(f"Attempted to parse: {cleaned_response[:500]}...")
            print(f"Full response (first 1000 chars): {response[:1000]}")
            # Fallback if JSON parsing fails - try to extract meaningful content
            analysis = {
                "role_analysis": "JSON parsing failed. Raw response: " + (response[:300] if len(response) > 0 else "No response"),
                "description_match": "See role analysis above",
                "correctness": "Unable to parse structured response - check logs",
                "research_quality": "Unable to parse structured response - check logs",
                "role_extension": "Unable to parse structured response - check logs"
            }
        except Exception as e:
            print(f"Unexpected parsing error: {str(e)}")
            print(f"Response type: {type(response)}, length: {len(response) if response else 0}")
            # Fallback if parsing fails completely
            analysis = {
                "role_analysis": f"Error: {str(e)}",
                "description_match": "Analysis unavailable due to parsing error",
                "correctness": response[:500] if response and len(response) > 0 else "Analysis unavailable",
                "research_quality": "See analysis above",
                "role_extension": "See analysis above"
            }
        
        # Ensure we have at least some analysis data
        if not analysis or len(analysis) == 0:
            print("Warning: Empty analysis object")
            analysis = {
                "analysis": {"summary": "Analyse niet beschikbaar", "rating": None},
                "match": {"summary": "Match niet beschikbaar", "rating": None},
                "correctness": {"summary": "Correctheid niet beschikbaar", "rating": None},
                "quality": {"summary": "Kwaliteit niet beschikbaar", "rating": None},
                "extension": {"overview": "Geen gegevens", "advice": "", "recommended_actions": []}
            }

        def clamp_rating(value):
            try:
                rating = float(value)
                return round(max(1.0, min(10.0, rating)), 1)
            except (TypeError, ValueError):
                return None

        def extract_value(source, keys):
            if not isinstance(source, dict):
                return None
            for key in keys:
                if key in source:
                    return source[key]
            return None

        def normalize_section(keys, label, fallback_text):
            raw_section = extract_value(analysis, keys)
            summary = ""
            rating = None
            if isinstance(raw_section, dict):
                summary = raw_section.get("summary") or raw_section.get("samenvatting") or raw_section.get("analysis") or raw_section.get("description") or ""
                rating = clamp_rating(raw_section.get("rating") or raw_section.get("score"))
            elif isinstance(raw_section, (str, int, float)):
                summary = str(raw_section)
            elif raw_section is None:
                summary = ""

            summary = (summary or "").strip() or fallback_text
            return {
                "label": label,
                "summary": summary,
                "rating": rating
            }

        def normalize_extension():
            raw_extension = extract_value(analysis, ["extension", "uitbreiding", "role_extension"])
            overview = ""
            advice = ""
            recommended_actions = []

            if isinstance(raw_extension, dict):
                overview = raw_extension.get("overview") or raw_extension.get("samenvatting") or raw_extension.get("analysis") or ""
                advice = raw_extension.get("advice") or raw_extension.get("advies") or raw_extension.get("status") or ""
                raw_actions = raw_extension.get("recommended_actions") or raw_extension.get("aanbevolen_acties") or raw_extension.get("actions") or []
            elif isinstance(raw_extension, str):
                overview = raw_extension
                raw_actions = []
            else:
                raw_actions = []

            normalized_actions = []
            if isinstance(raw_actions, list):
                for action in raw_actions:
                    if isinstance(action, dict):
                        normalized_actions.append({
                            "title": action.get("title") or action.get("naam") or action.get("actie") or "Aanbeveling",
                            "impact": action.get("impact") or action.get("toelichting") or "",
                            "priority": (action.get("priority") or action.get("prioriteit") or "middel").lower()
                        })
                    elif isinstance(action, str):
                        normalized_actions.append({
                            "title": action,
                            "impact": "",
                            "priority": "middel"
                        })
            elif isinstance(raw_actions, str):
                normalized_actions.append({
                    "title": raw_actions,
                    "impact": "",
                    "priority": "middel"
                })

            return {
                "overview": (overview or "Geen extra informatie").strip(),
                "advice": (advice or "").strip(),
                "recommended_actions": normalized_actions
            }

        normalized_analysis = {
            "analysis": normalize_section(["analysis", "analyse", "role_analysis"], "Analyse", "Geen analyse beschikbaar"),
            "match": normalize_section(["match", "description_match", "beschrijving_match"], "Match", "Geen match-informatie beschikbaar"),
            "correctness": normalize_section(["correctness", "juistheid"], "Correctheid", "Geen beoordeling beschikbaar"),
            "quality": normalize_section(["quality", "research_quality", "onderzoekskwaliteit"], "Kwaliteit", "Geen onderbouwing beschikbaar"),
            "extension": normalize_extension()
        }

        # Save AI analysis to database
        try:
            import json
            analysis_json = json.dumps(normalized_analysis)
            job.ai_analysis = analysis_json
            db.commit()
            print(f"AI analysis saved to job {job.id}")
        except Exception as e:
            print(f"Error saving AI analysis to database: {str(e)}")
            # Continue even if saving fails
        
        db.close()
        
        result = {
            "success": True,
            **normalized_analysis
        }
        
        print("Returning analysis result with updated scoring model")
        return result
        
    except HTTPException:
        # Re-raise HTTP exceptions as-is (they already have user-friendly messages)
        raise
    except Exception as e:
        error_type = type(e).__name__
        error_msg = str(e)
        print(f"Error analyzing job ({error_type}): {error_msg}")
        traceback.print_exc()
        
        # Close database if still open
        try:
            db.close()
        except:
            pass
        
        # Handle specific OpenAI errors
        if 'openai' in error_type.lower() or 'api' in error_msg.lower() or 'rate limit' in error_msg.lower():
            if 'rate limit' in error_msg.lower():
                raise HTTPException(
                    status_code=503,
                    detail="AI service rate limit reached. Please wait a moment and try again."
                )
            elif 'api key' in error_msg.lower() or 'authentication' in error_msg.lower():
                raise HTTPException(
                    status_code=503,
                    detail="OpenAI API key is missing or invalid. Please check your API configuration."
                )
            else:
                raise HTTPException(
                    status_code=503,
                    detail=f"AI service is temporarily unavailable: {error_msg}. Please try again in a moment."
                )
        # Handle database errors
        elif 'database' in error_msg.lower() or 'sql' in error_msg.lower():
            raise HTTPException(
                status_code=500,
                detail="Database error occurred. Please ensure the database is accessible and try again."
            )
        # Handle connection errors
        elif 'connection' in error_msg.lower() or 'timeout' in error_msg.lower():
            raise HTTPException(
                status_code=503,
                detail="Connection to AI service failed. Please check your internet connection and try again."
            )
        # Generic error
        else:
            raise HTTPException(
                status_code=500,
                detail=f"An unexpected error occurred while analyzing the job posting: {error_msg}. Please try again."
            )

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

# -----------------------------
# Result Storage and Retrieval endpoints
# -----------------------------
@app.get("/evaluation-results")
async def get_evaluation_results(
    candidate_id: Optional[str] = None,
    job_id: Optional[str] = None,
    result_type: Optional[str] = None,
    company_id: Optional[str] = None
):
    """Get saved evaluation or debate results, optionally filtered by company_id"""
    try:
        db = SessionLocal()
        query = db.query(EvaluationResultDB)
        
        # Filter by company_id if provided (multi-portal isolation)
        # Results belong to a company through the candidate's submitted_by_company_id or job's company_id
        if company_id:
            # Get candidates for this company
            candidate_subquery = db.query(CandidateDB.id).filter(
                CandidateDB.submitted_by_company_id == company_id
            ).subquery()
            # Get jobs for this company
            job_subquery = db.query(JobPostingDB.id).filter(
                JobPostingDB.company_id == company_id
            ).subquery()
            # Filter results that belong to candidates or jobs from this company
            query = query.filter(
                or_(
                    EvaluationResultDB.candidate_id.in_(candidate_subquery),
                    EvaluationResultDB.job_id.in_(job_subquery)
                )
            )
        
        if candidate_id:
            query = query.filter(EvaluationResultDB.candidate_id == candidate_id)
        if job_id:
            query = query.filter(EvaluationResultDB.job_id == job_id)
        if result_type:
            query = query.filter(EvaluationResultDB.result_type == result_type)
        
        results = query.order_by(EvaluationResultDB.created_at.desc()).all()
        candidate_cache = {}
        job_cache = {}
        
        import json
        result_list = []
        for result in results:
            try:
                result_data = json.loads(result.result_data)
                persona_ids = json.loads(result.selected_personas) if result.selected_personas else []
                
                if result.candidate_id not in candidate_cache:
                    candidate_obj = db.query(CandidateDB).filter(CandidateDB.id == result.candidate_id).first()
                    candidate_cache[result.candidate_id] = candidate_obj.name if candidate_obj else None
                if result.job_id not in job_cache:
                    job_obj = db.query(JobPostingDB).filter(JobPostingDB.id == result.job_id).first()
                    job_cache[result.job_id] = job_obj.title if job_obj else None
                
                result_list.append({
                    "id": result.id,
                    "candidate_id": result.candidate_id,
                    "candidate_name": candidate_cache.get(result.candidate_id),
                    "job_id": result.job_id,
                    "job_title": job_cache.get(result.job_id),
                    "result_type": result.result_type,
                    "selected_personas": persona_ids,
                    "company_note": result.company_note,
                    "created_at": result.created_at.isoformat() if result.created_at else None,
                    "updated_at": result.updated_at.isoformat() if result.updated_at else None,
                    "result_data": result_data
                })
            except Exception as e:
                print(f"Error parsing result {result.id}: {str(e)}")
                continue
        
        db.close()
        
        return {
            "success": True,
            "results": result_list
        }
    except Exception as e:
        print(f"Error getting evaluation results: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get evaluation results: {str(e)}")

@app.get("/evaluation-results/{result_id}")
async def get_evaluation_result(result_id: str):
    """Get a specific evaluation or debate result by ID"""
    try:
        db = SessionLocal()
        result = db.query(EvaluationResultDB).filter(EvaluationResultDB.id == result_id).first()
        
        if not result:
            db.close()
            raise HTTPException(status_code=404, detail="Result not found")
        
        import json
        result_data = json.loads(result.result_data)
        persona_ids = json.loads(result.selected_personas) if result.selected_personas else []
        
        db.close()
        
        return {
            "success": True,
            "id": result.id,
            "candidate_id": result.candidate_id,
            "job_id": result.job_id,
            "result_type": result.result_type,
            "selected_personas": persona_ids,
            "company_note": result.company_note,
            "created_at": result.created_at.isoformat() if result.created_at else None,
            "updated_at": result.updated_at.isoformat() if result.updated_at else None,
            "result_data": result_data
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error getting evaluation result: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get evaluation result: {str(e)}")

@app.delete("/evaluation-results/{result_id}")
async def delete_evaluation_result(result_id: str):
    """Delete an evaluation or debate result"""
    try:
        print(f"DELETE request received for evaluation result: {result_id}")
        db = SessionLocal()
        result = db.query(EvaluationResultDB).filter(EvaluationResultDB.id == result_id).first()
        
        if not result:
            db.close()
            print(f"Result not found: {result_id}")
            raise HTTPException(status_code=404, detail="Result not found")
        
        # Log what we're deleting
        print(f"Deleting result: ID={result.id}, Type={result.result_type}, Candidate={result.candidate_id}, Job={result.job_id}")
        
        db.delete(result)
        db.commit()
        db.close()
        
        print(f"Successfully deleted result: {result_id}")
        return {
            "success": True,
            "message": "Result deleted successfully"
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error deleting evaluation result: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to delete evaluation result: {str(e)}")

@app.delete("/candidates/{candidate_id}")
async def delete_candidate(candidate_id: str):
    """Delete a candidate and all associated data"""
    try:
        db = SessionLocal()
        candidate = db.query(CandidateDB).filter(CandidateDB.id == candidate_id).first()
        
        if not candidate:
            db.close()
            raise HTTPException(status_code=404, detail="Candidate not found")
        
        # Delete associated evaluations
        evaluations = db.query(EvaluationDB).filter(EvaluationDB.candidate_id == candidate_id).all()
        for eval in evaluations:
            db.delete(eval)
        
        # Delete associated evaluation results
        results = db.query(EvaluationResultDB).filter(EvaluationResultDB.candidate_id == candidate_id).all()
        for result in results:
            db.delete(result)
        
        # Delete the candidate
        db.delete(candidate)
        db.commit()
        db.close()
        
        return {"success": True, "message": "Candidate deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error deleting candidate: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to delete candidate: {str(e)}")

@app.put("/candidates/{candidate_id}/assign-jobs")
async def assign_jobs_to_candidate(
    candidate_id: str,
    job_ids: List[str] = Form(...)
):
    """Assign multiple jobs to a candidate"""
    try:
        db = SessionLocal()
        candidate = db.query(CandidateDB).filter(CandidateDB.id == candidate_id).first()
        
        if not candidate:
            db.close()
            raise HTTPException(status_code=404, detail="Candidate not found")
        
        # For now, we'll update the primary job_id to the first job
        # In a full implementation, you'd want a many-to-many relationship
        if job_ids:
            # Verify all jobs exist
            for job_id in job_ids:
                job = db.query(JobPostingDB).filter(JobPostingDB.id == job_id).first()
                if not job:
                    db.close()
                    raise HTTPException(status_code=404, detail=f"Job {job_id} not found")
            
            # Set primary job to first one
            candidate.job_id = job_ids[0]
            db.commit()
        
        db.close()
        return {
            "success": True,
            "message": f"Assigned {len(job_ids)} job(s) to candidate",
            "primary_job_id": job_ids[0] if job_ids else None,
            "all_job_ids": job_ids
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error assigning jobs: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to assign jobs: {str(e)}")

# -----------------------------
# User Management Endpoints
# -----------------------------

@app.get("/users")
async def get_users(user_id: Optional[str] = None, email: Optional[str] = None, company_id: Optional[str] = None):
    """Get all users"""
    try:
        db = SessionLocal()
        query = db.query(UserDB, CompanyDB).outerjoin(CompanyDB, UserDB.company_id == CompanyDB.id)
        query = query.filter(UserDB.is_active == True)
        if user_id:
            query = query.filter(UserDB.id == user_id)
        if email:
            query = query.filter(func.lower(UserDB.email) == email.lower())
        if company_id:
            query = query.filter(UserDB.company_id == company_id)
        users = query.all()
        db.close()
        return {
            "success": True,
            "users": [
                serialize_user(user, company)
                for user, company in users
            ]
        }
    except Exception as e:
        print(f"Error getting users: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get users: {str(e)}")

@app.post("/users")
async def create_user(
    email: str = Form(...),
    name: str = Form(...),
    role: str = Form("user"),
    company_id: Optional[str] = Form(None),
    company_name: Optional[str] = Form(None)
):
    """Create a new user"""
    try:
        db = SessionLocal()
        # Check if user already exists
        existing = db.query(UserDB).filter(UserDB.email == email).first()
        if existing:
            db.close()
            raise HTTPException(status_code=400, detail="User with this email already exists")
        
        company = None
        if company_id:
            company = db.query(CompanyDB).filter(CompanyDB.id == company_id).first()
            if not company:
                db.close()
                raise HTTPException(status_code=404, detail="Company not found")
        
        if not company:
            domain = email.split('@')[1].lower() if '@' in email else None
            company = get_or_create_company_by_domain(db, domain, company_name or name)
        
        user = UserDB(email=email, name=name, role=role, company_id=company.id if company else None)
        db.add(user)
        db.commit()
        db.refresh(user)
        serialized_user = serialize_user(user, company)
        db.close()
        
        return {
            "success": True,
            "user": serialized_user
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error creating user: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to create user: {str(e)}")

# -----------------------------
# Company Endpoints
# -----------------------------

@app.get("/companies")
async def get_companies(company_id: Optional[str] = None, slug: Optional[str] = None, domain: Optional[str] = None):
    """Get company records"""
    try:
        db = SessionLocal()
        query = db.query(CompanyDB)
        if company_id:
            query = query.filter(CompanyDB.id == company_id)
        if slug:
            query = query.filter(CompanyDB.slug == slug)
        if domain:
            query = query.filter(func.lower(CompanyDB.primary_domain) == domain.lower())
        companies = query.all()
        db.close()
        return {
            "success": True,
            "companies": [serialize_company(company) for company in companies]
        }
    except Exception as e:
        print(f"Error getting companies: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get companies: {str(e)}")

@app.post("/companies")
async def create_company(
    name: str = Form(...),
    slug: Optional[str] = Form(None),
    primary_domain: Optional[str] = Form(None),
    plan: Optional[str] = Form("trial"),
    status: Optional[str] = Form("active")
):
    """Create a company"""
    try:
        db = SessionLocal()
        slug_base = slugify(slug or name)
        unique_slug = generate_unique_slug(db, slug_base)
        normalized_domain = primary_domain.lower() if primary_domain else None
        if normalized_domain:
            existing_domain = db.query(CompanyDB).filter(func.lower(CompanyDB.primary_domain) == normalized_domain).first()
            if existing_domain:
                db.close()
                raise HTTPException(status_code=400, detail="A company with this domain already exists")
        company = CompanyDB(
            name=name,
            slug=unique_slug,
            primary_domain=normalized_domain,
            plan=plan,
            status=status
        )
        db.add(company)
        db.commit()
        db.refresh(company)
        payload = serialize_company(company)
        db.close()
        return {"success": True, "company": payload}
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error creating company: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to create company: {str(e)}")

# -----------------------------
# Recruiter Portal Endpoints
# -----------------------------

@app.get("/recruiter/vacancies")
async def get_recruiter_vacancies(
    include_new: bool = Query(True, description="Include new vacancies not yet assigned (default: True)"),
    current_user: UserDB = Depends(require_role(["admin", "recruiter"]))
):
    """Get all vacancies visible to recruiters (assigned + new vacancies from company portals)
    
    Recruiters see:
    - Vacancies assigned to them (assigned_agency_id == current_user.id)
    - All active vacancies from company portals (except their own company's vacancies)
    """
    try:
        import json
        db = SessionLocal()
        
        # Get all vacancies from company portals (active and inactive)
        # Exclude vacancies from the recruiter's own company (if they have one)
        all_vacancies_query = db.query(JobPostingDB)
        
        # Don't filter by is_active - show all vacancies (including old ones)
        # Old vacancies might not have is_active set, so we show everything
        
        # Exclude vacancies from recruiter's own company (if they have a company_id)
        # Recruiters shouldn't see their own company's vacancies
        # But include jobs with NULL company_id (old jobs) for backward compatibility
        if current_user.company_id:
            all_vacancies_query = all_vacancies_query.filter(
                or_(
                    JobPostingDB.company_id != current_user.company_id,
                    JobPostingDB.company_id.is_(None)  # Include old jobs without company_id
                )
            )
        # If no company_id, show all vacancies (including NULL company_id)
        
        # Apply include_new filter
        if not include_new:
            # If include_new is False, only show assigned vacancies
            all_vacancies_query = all_vacancies_query.filter(JobPostingDB.assigned_agency_id == current_user.id)
        # else: If include_new is True (default), show all vacancies (assigned or not)
        # Don't filter by assigned_agency_id - we'll mark them as assigned/not assigned in the response
        
        all_jobs = all_vacancies_query.all()
        
        # Debug logging
        print(f"[DEBUG get_recruiter_vacancies] Found {len(all_jobs)} jobs")
        print(f"[DEBUG get_recruiter_vacancies] Recruiter user: {current_user.email}, company_id: {current_user.company_id}")
        print(f"[DEBUG get_recruiter_vacancies] include_new: {include_new}")
        for job in all_jobs[:3]:  # Log first 3 jobs
            print(f"[DEBUG] Job: {job.title}, company_id: {job.company_id}, is_active: {getattr(job, 'is_active', 'N/A')}")
        
        result = []
        assigned_job_ids = set()
        
        # First, collect assigned jobs to mark them
        assigned_query = db.query(JobPostingDB).filter(JobPostingDB.assigned_agency_id == current_user.id)
        assigned_jobs = assigned_query.all()
        for job in assigned_jobs:
            assigned_job_ids.add(job.id)
        
        # Process all jobs
        for job in all_jobs:
            is_assigned = job.id in assigned_job_ids
            
            # Count candidates submitted by this recruiter for this vacancy
            candidates_count = 0
            if current_user.company_id:
                candidates_count = db.query(CandidateDB).filter(
                    CandidateDB.job_id == job.id,
                    CandidateDB.submitted_by_company_id == current_user.company_id
                ).count()
            
            # Determine if vacancy is "new" (no candidates submitted by this recruiter yet)
            is_new = candidates_count == 0 and not is_assigned
            
            result.append({
                "id": job.id,
                "title": job.title,
                "company": job.company,
                "description": job.description,
                "requirements": job.requirements,
                "location": job.location,
                "salary_range": job.salary_range,
                "created_at": job.created_at.isoformat() if job.created_at else None,
                "is_active": job.is_active if hasattr(job, 'is_active') else True,
                "assigned_agency_id": job.assigned_agency_id,
                "is_assigned": is_assigned,
                "is_new": is_new,  # Mark as new if no candidates submitted yet
                "candidates_count": candidates_count,
                "company_id": job.company_id if hasattr(job, 'company_id') else None
            })
        
        # Sort by created_at descending (newest first), handle None values
        result.sort(key=lambda x: x.get("created_at") or "", reverse=True)
        
        db.close()
        
        return {
            "success": True,
            "vacancies": result
        }
    except Exception as e:
        print(f"Error getting recruiter vacancies: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get recruiter vacancies: {str(e)}")

@app.get("/recruiter/candidates")
async def get_recruiter_candidates(job_id: Optional[str] = None, current_user: UserDB = Depends(require_role(["admin", "recruiter"]))):
    """Get ALL candidates for recruiter (recruiter should see all candidates in the system)"""
    try:
        db = SessionLocal()
        
        # Get ALL candidates (recruiter should see all candidates, not just their own)
        query = db.query(CandidateDB)
        
        if job_id:
            query = query.filter(CandidateDB.job_id == job_id)
        
        candidates = query.all()
        
        result = []
        for candidate in candidates:
            # Parse JSON fields
            skill_tags = None
            if candidate.skill_tags:
                try:
                    import json
                    skill_tags = json.loads(candidate.skill_tags) if isinstance(candidate.skill_tags, str) else candidate.skill_tags
                except:
                    skill_tags = candidate.skill_tags
            
            # Get evaluation status for this candidate (check EvaluationResultDB, not EvaluationDB)
            evaluations = db.query(EvaluationResultDB).filter(
                EvaluationResultDB.candidate_id == candidate.id,
                EvaluationResultDB.result_type == 'evaluation'
            ).all()
            has_evaluation = len(evaluations) > 0
            
            # Get job info if assigned
            job_info = None
            if candidate.job_id:
                job = db.query(JobPostingDB).filter(JobPostingDB.id == candidate.job_id).first()
                if job:
                    job_info = {
                        "id": job.id,
                        "title": job.title,
                        "company": job.company
                    }
            
            result.append({
                "id": candidate.id,
                "name": candidate.name,
                "email": candidate.email,
                "job_id": candidate.job_id,
                "job": job_info,
                "created_at": candidate.created_at.isoformat() if candidate.created_at else None,
                "pipeline_stage": candidate.pipeline_stage,
                "pipeline_status": candidate.pipeline_status,
                "skill_tags": skill_tags,
                "has_evaluation": has_evaluation,
                "evaluation_count": len(evaluations),
                "submitted_by_company_id": candidate.submitted_by_company_id
            })
        
        db.close()
        
        return {
            "success": True,
            "candidates": result
        }
    except Exception as e:
        print(f"Error getting recruiter candidates: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get recruiter candidates: {str(e)}")

@app.post("/recruiter/workspaces/assign")
async def assign_workspace(
    job_id: str = Form(...),
    recruiter_id: str = Form(...),
    current_user: UserDB = Depends(require_role(["admin"]))
):
    """Assign a vacancy (workspace) to a recruiter (admin only)"""
    try:
        db = SessionLocal()
        
        # Verify job exists
        job = db.query(JobPostingDB).filter(JobPostingDB.id == job_id).first()
        if not job:
            db.close()
            raise HTTPException(status_code=404, detail="Vacancy not found")
        
        # Verify recruiter exists and has recruiter role
        recruiter = db.query(UserDB).filter(UserDB.id == recruiter_id, UserDB.role == "recruiter").first()
        if not recruiter:
            db.close()
            raise HTTPException(status_code=404, detail="Recruiter not found")
        
        # Assign vacancy to recruiter
        job.assigned_agency_id = recruiter_id
        db.commit()
        db.close()
        
        return {
            "success": True,
            "message": f"Vacancy '{job.title}' assigned to recruiter '{recruiter.name}'"
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error assigning workspace: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to assign workspace: {str(e)}")

# -----------------------------
# Notification Endpoints
# -----------------------------
# -----------------------------
# Notification Endpoints
# -----------------------------

@app.get("/notifications")
async def get_notifications(user_id: Optional[str] = Query(None), unread_only: bool = Query(False)):
    """Get notifications for a user"""
    try:
        db = SessionLocal()
        query = db.query(NotificationDB)
        
        if user_id:
            query = query.filter(NotificationDB.user_id == user_id)
        
        if unread_only:
            query = query.filter(NotificationDB.is_read == False)
        
        notifications = query.order_by(NotificationDB.created_at.desc()).limit(50).all()
        db.close()
        
        return {
            "success": True,
            "notifications": [
                {
                    "id": n.id,
                    "type": n.type,
                    "title": n.title,
                    "message": n.message,
                    "related_candidate_id": n.related_candidate_id,
                    "related_job_id": n.related_job_id,
                    "related_result_id": n.related_result_id,
                    "is_read": n.is_read,
                    "created_at": n.created_at.isoformat() if n.created_at else None
                }
                for n in notifications
            ]
        }
    except Exception as e:
        print(f"Error getting notifications: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get notifications: {str(e)}")

@app.post("/notifications")
async def create_notification(
    user_id: str = Form(...),
    type: str = Form(...),
    title: str = Form(...),
    message: Optional[str] = Form(None),
    related_candidate_id: Optional[str] = Form(None),
    related_job_id: Optional[str] = Form(None),
    related_result_id: Optional[str] = Form(None)
):
    """Create a notification"""
    try:
        db = SessionLocal()
        notification = NotificationDB(
            user_id=user_id,
            type=type,
            title=title,
            message=message,
            related_candidate_id=related_candidate_id,
            related_job_id=related_job_id,
            related_result_id=related_result_id
        )
        db.add(notification)
        db.commit()
        db.refresh(notification)
        notification_id = notification.id
        db.close()
        
        return {
            "success": True,
            "notification": {
                "id": notification_id,
                "type": type,
                "title": title
            }
        }
    except Exception as e:
        print(f"Error creating notification: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to create notification: {str(e)}")

@app.put("/notifications/{notification_id}/read")
async def mark_notification_read(notification_id: str):
    """Mark a notification as read"""
    try:
        db = SessionLocal()
        notification = db.query(NotificationDB).filter(NotificationDB.id == notification_id).first()
        if not notification:
            db.close()
            raise HTTPException(status_code=404, detail="Notification not found")
        
        notification.is_read = True
        db.commit()
        db.close()
        
        return {"success": True, "message": "Notification marked as read"}
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error marking notification as read: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to mark notification as read: {str(e)}")

@app.put("/notifications/read-all")
async def mark_all_notifications_read(user_id: str = Form(...)):
    """Mark all notifications as read for a user"""
    try:
        db = SessionLocal()
        notifications = db.query(NotificationDB).filter(
            NotificationDB.user_id == user_id,
            NotificationDB.is_read == False
        ).all()
        
        for notification in notifications:
            notification.is_read = True
        
        db.commit()
        db.close()
        
        return {"success": True, "message": f"Marked {len(notifications)} notifications as read"}
    except Exception as e:
        print(f"Error marking all notifications as read: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to mark all notifications as read: {str(e)}")

# -----------------------------
# Comment Endpoints
# -----------------------------

@app.get("/comments")
async def get_comments(
    candidate_id: Optional[str] = Query(None),
    job_id: Optional[str] = Query(None),
    result_id: Optional[str] = Query(None)
):
    """Get comments"""
    try:
        db = SessionLocal()
        query = db.query(CommentDB)
        
        if candidate_id:
            query = query.filter(CommentDB.candidate_id == candidate_id)
        if job_id:
            query = query.filter(CommentDB.job_id == job_id)
        if result_id:
            query = query.filter(CommentDB.result_id == result_id)
        
        comments = query.order_by(CommentDB.created_at.desc()).all()
        db.close()
        
        # Get user names for comments
        db = SessionLocal()
        comments_with_users = []
        for comment in comments:
            user = db.query(UserDB).filter(UserDB.id == comment.user_id).first()
            comments_with_users.append({
                "id": comment.id,
                "user_id": comment.user_id,
                "user_name": user.name if user else "Unknown",
                "user_email": user.email if user else "",
                "candidate_id": comment.candidate_id,
                "job_id": comment.job_id,
                "result_id": comment.result_id,
                "content": comment.content,
                "created_at": comment.created_at.isoformat() if comment.created_at else None,
                "updated_at": comment.updated_at.isoformat() if comment.updated_at else None
            })
        db.close()
        
        return {
            "success": True,
            "comments": comments_with_users
        }
    except Exception as e:
        print(f"Error getting comments: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get comments: {str(e)}")

@app.post("/comments")
async def create_comment(
    user_id: str = Form(...),
    content: str = Form(...),
    candidate_id: Optional[str] = Form(None),
    job_id: Optional[str] = Form(None),
    result_id: Optional[str] = Form(None)
):
    """Create a comment"""
    try:
        db = SessionLocal()
        comment = CommentDB(
            user_id=user_id,
            content=content,
            candidate_id=candidate_id,
            job_id=job_id,
            result_id=result_id
        )
        db.add(comment)
        db.commit()
        db.refresh(comment)
        comment_id = comment.id
        db.close()
        
        return {
            "success": True,
            "comment": {
                "id": comment_id,
                "content": content
            }
        }
    except Exception as e:
        print(f"Error creating comment: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to create comment: {str(e)}")

@app.put("/comments/{comment_id}")
async def update_comment(comment_id: str, content: str = Form(...)):
    """Update a comment"""
    try:
        db = SessionLocal()
        comment = db.query(CommentDB).filter(CommentDB.id == comment_id).first()
        if not comment:
            db.close()
            raise HTTPException(status_code=404, detail="Comment not found")
        
        comment.content = content
        comment.updated_at = func.now()
        db.commit()
        db.close()
        
        return {"success": True, "message": "Comment updated"}
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error updating comment: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to update comment: {str(e)}")

@app.delete("/comments/{comment_id}")
async def delete_comment(comment_id: str):
    """Delete a comment"""
    try:
        db = SessionLocal()
        comment = db.query(CommentDB).filter(CommentDB.id == comment_id).first()
        if not comment:
            db.close()
            raise HTTPException(status_code=404, detail="Comment not found")
        
        db.delete(comment)
        db.commit()
        db.close()
        
        return {"success": True, "message": "Comment deleted"}
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error deleting comment: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to delete comment: {str(e)}")

# -----------------------------
# Approval Endpoints
# -----------------------------

@app.get("/approvals")
async def get_approvals(
    candidate_id: Optional[str] = Query(None),
    job_id: Optional[str] = Query(None),
    result_id: Optional[str] = Query(None),
    approval_type: Optional[str] = Query(None),
    user_id: Optional[str] = Query(None)
):
    """Get approvals"""
    try:
        db = SessionLocal()
        query = db.query(ApprovalDB)
        
        if candidate_id:
            query = query.filter(ApprovalDB.candidate_id == candidate_id)
        if job_id:
            query = query.filter(ApprovalDB.job_id == job_id)
        if result_id:
            query = query.filter(ApprovalDB.result_id == result_id)
        if approval_type:
            query = query.filter(ApprovalDB.approval_type == approval_type)
        if user_id:
            query = query.filter(ApprovalDB.user_id == user_id)
        
        approvals = query.order_by(ApprovalDB.created_at.desc()).all()
        
        # Get user names for approvals
        approvals_with_users = []
        for approval in approvals:
            user = db.query(UserDB).filter(UserDB.id == approval.user_id).first()
            approvals_with_users.append({
                "id": approval.id,
                "user_id": approval.user_id,
                "user_name": user.name if user else "Unknown",
                "user_email": user.email if user else "",
                "candidate_id": approval.candidate_id,
                "job_id": approval.job_id,
                "result_id": approval.result_id,
                "approval_type": approval.approval_type,
                "status": approval.status,
                "comment": approval.comment,
                "created_at": approval.created_at.isoformat() if approval.created_at else None,
                "updated_at": approval.updated_at.isoformat() if approval.updated_at else None
            })
        db.close()
        
        return {
            "success": True,
            "approvals": approvals_with_users
        }
    except Exception as e:
        print(f"Error getting approvals: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get approvals: {str(e)}")

@app.post("/approvals")
async def create_approval(
    user_id: str = Form(...),
    approval_type: str = Form(...),
    status: str = Form(...),
    candidate_id: Optional[str] = Form(None),
    job_id: Optional[str] = Form(None),
    result_id: Optional[str] = Form(None),
    comment: Optional[str] = Form(None)
):
    """Create or update an approval"""
    try:
        db = SessionLocal()
        
        # Validate status
        if status not in ['approved', 'rejected', 'pending']:
            db.close()
            raise HTTPException(status_code=400, detail="Status must be 'approved', 'rejected', or 'pending'")
        
        # Check if approval already exists
        existing = db.query(ApprovalDB).filter(
            ApprovalDB.user_id == user_id,
            ApprovalDB.candidate_id == candidate_id,
            ApprovalDB.job_id == job_id,
            ApprovalDB.approval_type == approval_type
        ).first()
        
        if existing:
            # Update existing approval
            existing.status = status
            if comment:
                existing.comment = comment
            existing.updated_at = func.now()
            db.commit()
            db.refresh(existing)
            approval_id = existing.id
        else:
            # Create new approval
            approval = ApprovalDB(
                user_id=user_id,
                candidate_id=candidate_id,
                job_id=job_id,
                result_id=result_id,
                approval_type=approval_type,
                status=status,
                comment=comment
            )
            db.add(approval)
            db.commit()
            db.refresh(approval)
            approval_id = approval.id
        
        db.close()
        
        return {
            "success": True,
            "approval": {
                "id": approval_id,
                "status": status
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error creating approval: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to create approval: {str(e)}")

@app.put("/approvals/{approval_id}")
async def update_approval(
    approval_id: str,
    status: Optional[str] = Form(None),
    comment: Optional[str] = Form(None)
):
    """Update an approval"""
    try:
        db = SessionLocal()
        approval = db.query(ApprovalDB).filter(ApprovalDB.id == approval_id).first()
        
        if not approval:
            db.close()
            raise HTTPException(status_code=404, detail="Approval not found")
        
        if status:
            if status not in ['approved', 'rejected', 'pending']:
                db.close()
                raise HTTPException(status_code=400, detail="Status must be 'approved', 'rejected', or 'pending'")
            approval.status = status
        
        if comment is not None:
            approval.comment = comment
        
        approval.updated_at = func.now()
        db.commit()
        db.refresh(approval)
        db.close()
        
        return {
            "success": True,
            "approval": {
                "id": approval.id,
                "status": approval.status,
                "comment": approval.comment
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error updating approval: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to update approval: {str(e)}")

@app.delete("/approvals/{approval_id}")
async def delete_approval(approval_id: str):
    """Delete an approval"""
    try:
        db = SessionLocal()
        approval = db.query(ApprovalDB).filter(ApprovalDB.id == approval_id).first()
        
        if not approval:
            db.close()
            raise HTTPException(status_code=404, detail="Approval not found")
        
        db.delete(approval)
        db.commit()
        db.close()
        
        return {"success": True, "message": "Approval deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error deleting approval: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to delete approval: {str(e)}")

# -----------------------------
# Job Watcher Endpoints
# -----------------------------

@app.get("/job-watchers/{job_id}")
async def get_job_watchers(job_id: str):
    """Get users watching a job"""
    try:
        db = SessionLocal()
        watchers = db.query(JobWatcherDB).filter(JobWatcherDB.job_id == job_id).all()
        
        user_ids = [w.user_id for w in watchers]
        users = db.query(UserDB).filter(UserDB.id.in_(user_ids)).all() if user_ids else []
        db.close()
        
        return {
            "success": True,
            "watchers": [
                {
                    "id": u.id,
                    "email": u.email,
                    "name": u.name,
                    "role": u.role
                }
                for u in users
            ]
        }
    except Exception as e:
        print(f"Error getting job watchers: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get job watchers: {str(e)}")

@app.post("/job-watchers")
async def add_job_watcher(job_id: str = Form(...), user_id: str = Form(...)):
    """Add a user as a watcher for a job"""
    try:
        db = SessionLocal()
        # Check if already watching
        existing = db.query(JobWatcherDB).filter(
            JobWatcherDB.job_id == job_id,
            JobWatcherDB.user_id == user_id
        ).first()
        
        if existing:
            db.close()
            return {"success": True, "message": "User already watching this job"}
        
        watcher = JobWatcherDB(job_id=job_id, user_id=user_id)
        db.add(watcher)
        db.commit()
        db.close()
        
        return {"success": True, "message": "User added as watcher"}
    except Exception as e:
        print(f"Error adding job watcher: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to add job watcher: {str(e)}")

@app.delete("/job-watchers/{job_id}/{user_id}")
async def remove_job_watcher(job_id: str, user_id: str):
    """Remove a user as a watcher for a job"""
    try:
        db = SessionLocal()
        watcher = db.query(JobWatcherDB).filter(
            JobWatcherDB.job_id == job_id,
            JobWatcherDB.user_id == user_id
        ).first()
        
        if watcher:
            db.delete(watcher)
            db.commit()
        
        db.close()
        return {"success": True, "message": "Watcher removed"}
    except Exception as e:
        print(f"Error removing job watcher: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to remove job watcher: {str(e)}")

# -----------------------------
# Candidate Watcher Endpoints
# -----------------------------

@app.get("/candidate-watchers/{candidate_id}")
async def get_candidate_watchers(candidate_id: str):
    """Get users watching a candidate"""
    try:
        db = SessionLocal()
        watchers = db.query(CandidateWatcherDB).filter(CandidateWatcherDB.candidate_id == candidate_id).all()
        
        user_ids = [w.user_id for w in watchers]
        users = db.query(UserDB).filter(UserDB.id.in_(user_ids)).all() if user_ids else []
        db.close()
        
        return {
            "success": True,
            "watchers": [
                {
                    "id": u.id,
                    "email": u.email,
                    "name": u.name,
                    "role": u.role
                }
                for u in users
            ]
        }
    except Exception as e:
        print(f"Error getting candidate watchers: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get candidate watchers: {str(e)}")

@app.post("/candidate-watchers")
async def add_candidate_watcher(candidate_id: str = Form(...), user_id: str = Form(...)):
    """Add a user as a watcher for a candidate"""
    try:
        db = SessionLocal()
        # Check if already watching
        existing = db.query(CandidateWatcherDB).filter(
            CandidateWatcherDB.candidate_id == candidate_id,
            CandidateWatcherDB.user_id == user_id
        ).first()
        
        if existing:
            db.close()
            return {"success": True, "message": "User already watching this candidate"}
        
        watcher = CandidateWatcherDB(candidate_id=candidate_id, user_id=user_id)
        db.add(watcher)
        db.commit()
        db.close()
        
        return {"success": True, "message": "User added as watcher"}
    except Exception as e:
        print(f"Error adding candidate watcher: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to add candidate watcher: {str(e)}")

@app.delete("/candidate-watchers/{candidate_id}/{user_id}")
async def remove_candidate_watcher(candidate_id: str, user_id: str):
    """Remove a user as a watcher for a candidate"""
    try:
        db = SessionLocal()
        watcher = db.query(CandidateWatcherDB).filter(
            CandidateWatcherDB.candidate_id == candidate_id,
            CandidateWatcherDB.user_id == user_id
        ).first()
        
        if watcher:
            db.delete(watcher)
            db.commit()
        
        db.close()
        return {"success": True, "message": "Watcher removed"}
    except Exception as e:
        print(f"Error removing candidate watcher: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to remove candidate watcher: {str(e)}")

# -----------------------------
# Evaluation Template Endpoints
# -----------------------------

@app.get("/evaluation-templates")
async def get_evaluation_templates():
    """Get all evaluation templates"""
    try:
        db = SessionLocal()
        templates = db.query(EvaluationTemplateDB).order_by(EvaluationTemplateDB.created_at.desc()).all()
        db.close()
        
        return {
            "success": True,
            "templates": [
                {
                    "id": t.id,
                    "name": t.name,
                    "description": t.description,
                    "job_id": t.job_id,
                    "selected_persona_ids": t.selected_persona_ids.split(",") if t.selected_persona_ids else [],
                    "selected_actions": t.selected_actions.split(",") if t.selected_actions else [],
                    "company_note": t.company_note,
                    "use_candidate_company_note": t.use_candidate_company_note,
                    "created_by": t.created_by,
                    "created_at": t.created_at.isoformat() if t.created_at else None,
                    "updated_at": t.updated_at.isoformat() if t.updated_at else None
                }
                for t in templates
            ]
        }
    except Exception as e:
        print(f"Error getting evaluation templates: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get evaluation templates: {str(e)}")

@app.post("/evaluation-templates")
async def create_evaluation_template(
    name: str = Form(...),
    description: Optional[str] = Form(None),
    job_id: Optional[str] = Form(None),
    selected_persona_ids: str = Form(...),  # Comma-separated
    selected_actions: str = Form(...),  # Comma-separated
    company_note: Optional[str] = Form(None),
    use_candidate_company_note: bool = Form(False),
    created_by: Optional[str] = Form(None)
):
    """Create a new evaluation template"""
    try:
        db = SessionLocal()
        
        template = EvaluationTemplateDB(
            name=name,
            description=description,
            job_id=job_id,
            selected_persona_ids=selected_persona_ids,
            selected_actions=selected_actions,
            company_note=company_note,
            use_candidate_company_note=use_candidate_company_note,
            created_by=created_by
        )
        
        db.add(template)
        db.commit()
        db.refresh(template)
        db.close()
        
        return {
            "success": True,
            "template": {
                "id": template.id,
                "name": template.name,
                "description": template.description,
                "job_id": template.job_id,
                "selected_persona_ids": template.selected_persona_ids.split(",") if template.selected_persona_ids else [],
                "selected_actions": template.selected_actions.split(",") if template.selected_actions else [],
                "company_note": template.company_note,
                "use_candidate_company_note": template.use_candidate_company_note,
                "created_by": template.created_by,
                "created_at": template.created_at.isoformat() if template.created_at else None
            },
            "message": "Template created successfully"
        }
    except Exception as e:
        print(f"Error creating evaluation template: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to create evaluation template: {str(e)}")

@app.delete("/evaluation-templates/{template_id}")
async def delete_evaluation_template(template_id: str):
    """Delete an evaluation template"""
    try:
        db = SessionLocal()
        template = db.query(EvaluationTemplateDB).filter(EvaluationTemplateDB.id == template_id).first()
        
        if not template:
            db.close()
            raise HTTPException(status_code=404, detail="Template not found")
        
        db.delete(template)
        db.commit()
        db.close()
        
        return {"success": True, "message": "Template deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error deleting evaluation template: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to delete evaluation template: {str(e)}")

# -----------------------------
# Pydantic Models
# -----------------------------

class CandidateSummaryRequest(BaseModel):
    candidate_name: str
    evaluations: str

# -----------------------------
# AI Summary Generation
# -----------------------------

@app.post("/generate-candidate-summary")
async def generate_candidate_summary(request: CandidateSummaryRequest):
    """Generate an AI summary of a candidate based on all evaluations"""
    try:
        from config import OPENAI_MODEL_EVALUATION, OPENAI_MAX_TOKENS_EVALUATION, OPENAI_TEMPERATURE_EVALUATION
        
        candidate_name = request.candidate_name
        evaluations_text = request.evaluations

        system_prompt = """Je bent een expert HR-analist. Je taak is om een beknopte, professionele samenvatting te maken van een kandidaat op basis van meerdere evaluaties.

Maak een samenvatting die:
- De belangrijkste sterke punten benadrukt
- Belangrijke aandachtspunten noemt
- Een duidelijk beeld geeft van de geschiktheid
- Maximaal 3-4 paragrafen lang is
- Professioneel en objectief is

Schrijf in het Nederlands."""

        user_prompt = f"""Hieronder staan alle evaluaties voor kandidaat {candidate_name}:

{evaluations_text}

Maak een beknopte, professionele samenvatting van deze kandidaat op basis van alle evaluaties."""

        openai_result = call_openai_safe([
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ], max_tokens=500, temperature=0.3, model=OPENAI_MODEL_EVALUATION)

        if not openai_result["success"]:
            raise HTTPException(status_code=500, detail=f"AI summary generation failed: {openai_result.get('error', 'Unknown error')}")

        summary_text = openai_result["result"].choices[0].message.content

        return {
            "success": True,
            "summary": summary_text
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error generating candidate summary: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to generate summary: {str(e)}")

# -----------------------------
# AI-Powered Candidate Matching
# -----------------------------

@app.post("/match-candidates")
async def match_candidates_to_job(job_id: str = Form(...), limit: Optional[int] = Form(10)):
    """AI-powered matching of candidates to a job posting"""
    try:
        db = SessionLocal()
        
        # Get job posting
        job = db.query(JobPostingDB).filter(JobPostingDB.id == job_id).first()
        if not job:
            db.close()
            raise HTTPException(status_code=404, detail="Job posting not found")
        
        # Get all candidates (or candidates related to this job)
        candidates = db.query(CandidateDB).filter(
            or_(
                CandidateDB.job_id == job_id,
                CandidateDB.preferential_job_ids.like(f"%{job_id}%")
            )
        ).all()
        
        if not candidates:
            db.close()
            return {
                "success": True,
                "matches": [],
                "message": "No candidates found for this job"
            }
        
        # Prepare job information
        job_info = (f"VACATURE: {job.title}\n"
                   f"BEDRIJF: {job.company}\n"
                   f"LOCATIE: {job.location}\n"
                   f"SALARIS: {job.salary_range}\n\n"
                   f"BESCHRIJVING:\n{truncate_text_safely(job.description, 1500)}\n\n"
                   f"EISEN:\n{truncate_text_safely(job.requirements, 1500)}")
        
        # Match each candidate using AI
        matches = []
        matching_tasks = []
        
        for candidate in candidates:
            # Prepare candidate information
            candidate_info = (f"KANDIDAAT: {candidate.name}\n"
                            f"EMAIL: {candidate.email or 'Niet opgegeven'}\n"
                            f"ERVARING: {candidate.experience_years or 'Niet opgegeven'} jaar\n"
                            f"VAARDIGHEDEN: {candidate.skills or 'Niet opgegeven'}\n"
                            f"OPLEIDING: {candidate.education or 'Niet opgegeven'}\n\n"
                            f"CV:\n{truncate_text_safely(candidate.resume_text or '', 1500)}\n\n"
                            f"MOTIVATIEBRIEF:\n{truncate_text_safely(candidate.motivational_letter or '', 1000)}")
            
            if candidate.company_note:
                candidate_info += f"\nBEDRIJFSNOTITIE (van leverancier):\n{truncate_text_safely(candidate.company_note, 500)}\n"
            
            # Get evaluation scores if available
            evaluations = db.query(EvaluationResultDB).filter(
                EvaluationResultDB.candidate_id == candidate.id,
                EvaluationResultDB.job_id == job_id,
                EvaluationResultDB.result_type == 'evaluation'
            ).all()
            
            evaluation_scores = []
            if evaluations:
                for eval in evaluations:
                    if eval.result_data:
                        try:
                            import json
                            result_data = json.loads(eval.result_data) if isinstance(eval.result_data, str) else eval.result_data
                            if isinstance(result_data, dict):
                                if 'combined_score' in result_data:
                                    evaluation_scores.append(result_data['combined_score'])
                                elif 'evaluations' in result_data:
                                    for eval_data in result_data['evaluations'].values():
                                        if isinstance(eval_data, dict) and 'score' in eval_data:
                                            evaluation_scores.append(eval_data['score'])
                        except Exception:
                            pass
            
            avg_score = sum(evaluation_scores) / len(evaluation_scores) if evaluation_scores else None
            
            # Create matching prompt
            system_prompt = ("Je bent een expert HR-matcher. Je taak is om te beoordelen hoe goed een kandidaat matcht met een vacature.\n\n"
                            "Geef een match score van 1-10, waarbij:\n"
                            "- 1-3: Zeer slechte match (kandidaat voldoet niet aan basisvereisten)\n"
                            "- 4-5: Zwakke match (kandidaat voldoet aan enkele vereisten maar mist belangrijke aspecten)\n"
                            "- 6-7: Goede match (kandidaat voldoet aan de meeste vereisten)\n"
                            "- 8-9: Uitstekende match (kandidaat voldoet aan vrijwel alle vereisten en heeft extra kwaliteiten)\n"
                            "- 10: Perfecte match (kandidaat is ideaal voor deze functie)\n\n"
                            "Geef ook een korte motivatie (2-3 zinnen) waarom deze score is gegeven.\n\n"
                            "Antwoord in JSON formaat met match_score (1-10), reasoning, strengths en concerns.")

            eval_info = f"\nBESTAANDE EVALUATIES: Gemiddelde score: {avg_score:.1f}/10" if avg_score else ""
            user_prompt = "VACATURE:\n" + str(job_info) + "\n\nKANDIDAAT:\n" + str(candidate_info) + "\n" + eval_info + "\n\nBeoordeel hoe goed deze kandidaat matcht met deze vacature. Geef een match score en motivatie."

            matching_tasks.append({
                "candidate": candidate,
                "prompt": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                "avg_score": avg_score
            })
        
        # Process matches in parallel (but limit concurrent requests)
        from config import OPENAI_MODEL_EVALUATION, OPENAI_MAX_TOKENS_EVALUATION, OPENAI_TEMPERATURE_EVALUATION
        
        async def process_match(task):
            try:
                result = await call_openai_safe_async(
                    task["prompt"],
                    max_tokens=800,
                    temperature=0.2,
                    model=OPENAI_MODEL_EVALUATION
                )
                
                if result["success"]:
                    import json
                    import re
                    content = result["result"].choices[0].message.content
                    
                    # Try to extract JSON from response
                    json_match = re.search(r'\{[^{}]*"match_score"[^{}]*\}', content, re.DOTALL)
                    if json_match:
                        match_data = json.loads(json_match.group())
                    else:
                        # Fallback: try to parse the whole content
                        match_data = json.loads(content)
                    
                    return {
                        "candidate_id": task["candidate"].id,
                        "candidate_name": task["candidate"].name,
                        "match_score": match_data.get("match_score", 5.0),
                        "reasoning": match_data.get("reasoning", "Geen motivatie beschikbaar"),
                        "strengths": match_data.get("strengths", []),
                        "concerns": match_data.get("concerns", []),
                        "evaluation_score": task["avg_score"]
                    }
                else:
                    return {
                        "candidate_id": task["candidate"].id,
                        "candidate_name": task["candidate"].name,
                        "match_score": task["avg_score"] or 5.0,
                        "reasoning": "AI matching niet beschikbaar, gebruikt evaluatie score",
                        "strengths": [],
                        "concerns": [],
                        "evaluation_score": task["avg_score"]
                    }
            except Exception as e:
                print(f"Error matching candidate {task['candidate'].id}: {str(e)}")
                return {
                    "candidate_id": task["candidate"].id,
                    "candidate_name": task["candidate"].name,
                    "match_score": task["avg_score"] or 5.0,
                    "reasoning": f"Fout bij matching: {str(e)}",
                    "strengths": [],
                    "concerns": [],
                    "evaluation_score": task["avg_score"]
                }
        
        # Process matches with limited concurrency (5 at a time)
        semaphore = asyncio.Semaphore(5)
        async def process_with_semaphore(task):
            async with semaphore:
                return await process_match(task)
        
        match_results = await asyncio.gather(*[process_with_semaphore(task) for task in matching_tasks])
        
        # Sort by match score (descending)
        match_results.sort(key=lambda x: x["match_score"], reverse=True)
        
        # Apply limit
        if limit:
            match_results = match_results[:limit]
        
        db.close()
        
        return {
            "success": True,
            "job": {
                "id": job.id,
                "title": job.title,
                "company": job.company
            },
            "matches": match_results,
            "total_candidates": len(candidates),
            "matched": len(match_results)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error matching candidates: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to match candidates: {str(e)}")

# -----------------------------
# LLM Judge Endpoint
# -----------------------------

# -----------------------------
# Admin Endpoints
# -----------------------------

@app.post("/admin/reset-database")
async def reset_database(
    current_user: UserDB = Depends(require_role(["admin"])),
    confirm: bool = Query(False, description="Must be True to confirm database reset")
):
    """Reset the entire database - ADMIN ONLY
    
    WARNING: This will delete ALL data including:
    - All users (except the 4 required users if they exist)
    - All candidates
    - All job postings
    - All evaluations and debates
    - All notifications
    - All companies (except those needed for required users)
    
    After reset, the auto-setup will recreate the 4 required users.
    """
    if not confirm:
        raise HTTPException(
            status_code=400,
            detail="Must set confirm=true to reset database. This action cannot be undone."
        )
    
    db = SessionLocal()
    try:
        print(f"\n{'='*60}")
        print("⚠ DATABASE RESET INITIATED BY ADMIN")
        print(f"User: {current_user.email} ({current_user.role})")
        print(f"{'='*60}")
        
        # Keep these user emails (will be recreated by auto-setup)
        keep_emails = [
            "admin@demo.local",
            "user@company.nl",
            "user@recruiter.nl",
            "user@kandidaat.nl"
        ]
        
        # Get IDs of users to keep
        users_to_keep = db.query(UserDB).filter(UserDB.email.in_(keep_emails)).all()
        user_ids_to_keep = [u.id for u in users_to_keep]
        
        print(f"Keeping {len(user_ids_to_keep)} users: {keep_emails}")
        
        # Delete in order to respect foreign key constraints
        print("Deleting approvals...")
        if user_ids_to_keep:
            db.query(ApprovalDB).filter(~ApprovalDB.user_id.in_(user_ids_to_keep)).delete(synchronize_session=False)
        else:
            db.query(ApprovalDB).delete()
        
        print("Deleting candidate watchers...")
        db.query(CandidateWatcherDB).delete()
        
        print("Deleting job watchers...")
        db.query(JobWatcherDB).delete()
        
        print("Deleting candidate conversations...")
        db.query(CandidateConversationDB).delete()
        
        print("Deleting scheduled appointments...")
        db.query(ScheduledAppointmentDB).delete()
        
        print("Deleting comments...")
        db.query(CommentDB).delete()
        
        print("Deleting notifications...")
        db.query(NotificationDB).delete()
        
        print("Deleting evaluation results...")
        db.query(EvaluationResultDB).delete()
        
        print("Deleting evaluations...")
        db.query(EvaluationDB).delete()
        
        print("Deleting candidates...")
        db.query(CandidateDB).delete()
        
        print("Deleting job postings...")
        db.query(JobPostingDB).delete()
        
        # Delete users except the ones we want to keep
        print("Deleting users...")
        if user_ids_to_keep:
            db.query(UserDB).filter(~UserDB.id.in_(user_ids_to_keep)).delete(synchronize_session=False)
            print(f"✓ Deleted all users except {len(user_ids_to_keep)} specified users")
        else:
            db.query(UserDB).delete()
            print("✓ Deleted all users (none to keep)")
        
        # Delete companies that aren't needed (we'll recreate them)
        print("Deleting companies...")
        # Keep companies that are referenced by users we're keeping
        company_ids_to_keep = set()
        for user in users_to_keep:
            if user.company_id:
                company_ids_to_keep.add(user.company_id)
        
        if company_ids_to_keep:
            db.query(CompanyDB).filter(~CompanyDB.id.in_(company_ids_to_keep)).delete(synchronize_session=False)
        else:
            db.query(CompanyDB).delete()
        
        db.commit()
        
        print(f"{'='*60}")
        print("✓ DATABASE RESET COMPLETE")
        print(f"{'='*60}\n")
        
        # Trigger auto-setup to recreate required users
        print("Running auto-setup to recreate required users...")
        auto_setup_users()
        
        db.close()
        
        return {
            "success": True,
            "message": "Database reset successfully. Required users have been recreated.",
            "deleted": {
                "candidates": "all",
                "job_postings": "all",
                "evaluations": "all",
                "users": f"all except {len(user_ids_to_keep)} required users"
            }
        }
        
    except Exception as e:
        db.rollback()
        print(f"Error resetting database: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to reset database: {str(e)}")
    finally:
        db.close()

# -----------------------------
# LLM Judge System Endpoints
# -----------------------------

@app.post("/llm-judge/evaluate")
async def evaluate_llm_performance(
    result_id: str = Form(...),
    request: Request = None
):
    try:
        from llm_judge import get_judge
        
        db = SessionLocal()
        result = db.query(EvaluationResultDB).filter(EvaluationResultDB.id == result_id).first()
        
        if not result:
            db.close()
            raise HTTPException(status_code=404, detail="Evaluation result not found")
        
        # Parse result data
        import json
        try:
            result_data = json.loads(result.result_data) if isinstance(result.result_data, str) else result.result_data
        except:
            result_data = {'debate': str(result.result_data), 'evaluations': {}}
        
        # Get timing data if available
        timing_data = result_data.get('timing_data', {})
        if not timing_data:
            # Fallback: create basic timing if not available
            timing_data = {
                'total': 0,
                'duration': 0
            }
        
        # Prepare input data for judge
        personas_list = []
        if result.selected_personas:
            try:
                personas_list = json.loads(result.selected_personas) if isinstance(result.selected_personas, str) else result.selected_personas
            except:
                personas_list = []
        
        input_data = {
            'candidate_id': result.candidate_id or '',
            'job_id': result.job_id or '',
            'personas': personas_list if isinstance(personas_list, list) else [],
            'company_note': result.company_note or ''
        }
        
        # Get output (debate or evaluation)
        output = ''
        if result.result_type == 'debate':
            output = result_data.get('debate', '') or result_data.get('transcript', '') or ''
        else:
            # For evaluation, combine all evaluations into text
            evaluations = result_data.get('evaluations', {})
            if evaluations:
                output = json.dumps(evaluations, ensure_ascii=False)
            else:
                output = str(result_data)
        
        # Ensure output is a string
        if not isinstance(output, str):
            output = json.dumps(output, ensure_ascii=False)
        
        # Get historical outputs for comparison (to check if similar inputs yield similar outputs)
        historical_results = db.query(EvaluationResultDB).filter(
            EvaluationResultDB.candidate_id == result.candidate_id,
            EvaluationResultDB.id != result.id,
            EvaluationResultDB.result_type == result.result_type
        ).limit(10).all()
        
        historical_outputs = []
        for hist in historical_results:
            try:
                hist_data = json.loads(hist.result_data) if isinstance(hist.result_data, str) else hist.result_data
                
                hist_personas = []
                if hist.selected_personas:
                    try:
                        hist_personas = json.loads(hist.selected_personas) if isinstance(hist.selected_personas, str) else hist.selected_personas
                    except:
                        hist_personas = []
                
                hist_output = ''
                if hist.result_type == 'debate':
                    hist_output = hist_data.get('debate', '') or hist_data.get('transcript', '') or ''
                else:
                    hist_evaluations = hist_data.get('evaluations', {})
                    if hist_evaluations:
                        hist_output = json.dumps(hist_evaluations, ensure_ascii=False)
                
                if hist_output:
                    historical_outputs.append({
                        'input': {
                            'candidate_id': hist.candidate_id or '',
                            'job_id': hist.job_id or '',
                            'personas': hist_personas if isinstance(hist_personas, list) else [],
                            'company_note': hist.company_note or ''
                        },
                        'output': hist_output
                    })
            except Exception as e:
                print(f"Error processing historical result {hist.id}: {e}")
                continue
        
        # Get judge instance and evaluate
        judge = get_judge()
        evaluation = judge.judge_llm_performance(
            input_data=input_data,
            output=output,
            timing=timing_data,
            historical_outputs=historical_outputs
        )
        
        db.close()
        
        return {
            "success": True,
            "evaluation": evaluation
        }
        
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Judge evaluation failed: {str(e)}")


@app.post("/llm-settings/truncation")
async def update_truncation_settings(
    disable_truncation: bool = Form(False),
    prompt_density_multiplier: float = Form(1.0)
):
    try:
        from llm_judge import get_judge
        
        # Update judge settings
        judge = get_judge()
        judge.update_settings(
            truncation_enabled=not disable_truncation,
            prompt_density_multiplier=prompt_density_multiplier
        )
        
        # In production, store these in database or config file
        # For now, they're stored in memory in the judge instance
        
        return {
            "success": True,
            "settings": {
                "truncation_disabled": disable_truncation,
                "truncation_enabled": not disable_truncation,
                "prompt_density_multiplier": prompt_density_multiplier
            },
            "message": "Instellingen bijgewerkt"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update settings: {str(e)}")


@app.get("/llm-settings")
async def get_llm_settings():
    pass  # Get current LLM settings
    try:
        from config import (
            OPENAI_MAX_TOKENS_EVALUATION,
            OPENAI_MAX_TOKENS_DEBATE,
            OPENAI_MAX_TOKENS_JOB_ANALYSIS
        )
        from llm_judge import get_judge
        
        # Get current settings from judge
        judge = get_judge()
        judge_settings = judge.settings
        
        return {
            "success": True,
            "settings": {
                "max_tokens_evaluation": OPENAI_MAX_TOKENS_EVALUATION,
                "max_tokens_debate": OPENAI_MAX_TOKENS_DEBATE,
                "max_tokens_job_analysis": OPENAI_MAX_TOKENS_JOB_ANALYSIS,
                "truncation_enabled": judge_settings.get('truncation_enabled', True),
                "truncation_disabled": not judge_settings.get('truncation_enabled', True),
                "prompt_density_multiplier": judge_settings.get('prompt_density_multiplier', 1.0)
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get settings: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    # Note: reload=True requires running as: uvicorn main:app --reload
    # For direct execution, reload is disabled
    uvicorn.run(app, host="0.0.0.0", port=8000)
from fastapi import FastAPI, HTTPException, UploadFile, File, Form, Request
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
from sqlalchemy import create_engine, Column, String, Integer, Text, ForeignKey, Enum, DateTime, Boolean
from sqlalchemy.orm import sessionmaker, declarative_base, relationship
from sqlalchemy.sql import func
import enum
import base64
import fitz  # PyMuPDF

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
                    elif method == 'azure' and AZURE_ENABLED:
                        print(f"PyMuPDF not available or failed, trying Azure Document Intelligence...")
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
    motivational_letter = Column(Text)  # Optional motivational letter
    experience_years = Column(Integer)
    skills = Column(Text)
    education = Column(String)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
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
    name = Column(String, nullable=False, unique=True)
    display_name = Column(String, nullable=False)
    system_prompt = Column(Text, nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

class EvaluationHandlerDB(Base):
    __tablename__ = "evaluation_handlers"
    id = Column(String, primary_key=True, default=lambda: str(uuid4()))
    name = Column(String, nullable=False, unique=True)
    display_name = Column(String, nullable=False)
    guidelines = Column(Text, nullable=False)  # Guidelines for how to handle evaluation
    is_active = Column(Boolean, default=True)
    is_default = Column(Boolean, default=False)  # Default handler for evaluations
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

Base.metadata.create_all(bind=engine)

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
# Persona CRUD endpoints
# -----------------------------

@app.get("/personas")
async def get_personas():
    """Get all active personas"""
    try:
        db = SessionLocal()
        personas = db.query(PersonaDB).filter(PersonaDB.is_active == True).all()
        db.close()
        
        return {
            "success": True,
            "personas": [
                {
                    "id": persona.id,
                    "name": persona.name,
                    "display_name": persona.display_name,
                    "system_prompt": persona.system_prompt,
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
    name: str = Form(...),
    display_name: str = Form(...),
    system_prompt: str = Form(...)
):
    """Create a new evaluation persona"""
    try:
        db = SessionLocal()
        
        # Check if persona with this name already exists
        existing = db.query(PersonaDB).filter(PersonaDB.name == name).first()
        if existing:
            db.close()
            raise HTTPException(status_code=400, detail=f"Persona with name '{name}' already exists")
        
        persona = PersonaDB(
            name=name,
            display_name=display_name,
            system_prompt=system_prompt
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
        
    except Exception as e:
        print(f"Error creating persona: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to create persona: {str(e)}")

@app.put("/personas/{persona_id}")
async def update_persona(
    persona_id: str,
    name: Optional[str] = Form(None),
    display_name: Optional[str] = Form(None),
    system_prompt: Optional[str] = Form(None),
    is_active: Optional[bool] = Form(None)
):
    """Update a persona"""
    try:
        db = SessionLocal()
        
        persona = db.query(PersonaDB).filter(PersonaDB.id == persona_id).first()
        if not persona:
            db.close()
            raise HTTPException(status_code=404, detail="Persona not found")
        
        # Update only provided fields
        if name is not None:
            # Check if new name conflicts with existing persona
            existing = db.query(PersonaDB).filter(PersonaDB.name == name, PersonaDB.id != persona_id).first()
            if existing:
                db.close()
                raise HTTPException(status_code=400, detail=f"Persona with name '{name}' already exists")
            persona.name = name
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
        
        if "application/json" in content_type:
            # Handle JSON request
            data = await request.json()
            title = data.get("title", "")
            company = data.get("company", "")
            description = data.get("description", "")
            requirements = data.get("requirements", "Not specified")
            location = data.get("location", "Not specified")
            salary_range = data.get("salary_range", "Not specified")
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
        
        # Create job posting with optional fields
        job_posting = JobPostingDB(
            title=title,
            company=company,
            description=description,
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
    title: Optional[str] = Form(None),
    company: Optional[str] = Form(None),
    description: Optional[str] = Form(None),
    requirements: Optional[str] = Form(None),
    location: Optional[str] = Form(None),
    salary_range: Optional[str] = Form(None)
):
    """Update a job description"""
    try:
        db = SessionLocal()
        
        job = db.query(JobPostingDB).filter(JobPostingDB.id == job_id).first()
        if not job:
            db.close()
            raise HTTPException(status_code=404, detail="Job posting not found")
        
        # Update only provided fields
        if title is not None:
            job.title = title
        if company is not None:
            job.company = company
        if description is not None:
            job.description = description
        if requirements is not None:
            job.requirements = requirements
        if location is not None:
            job.location = location
        if salary_range is not None:
            job.salary_range = salary_range
        
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
                "salary_range": job.salary_range
            }
        }
        
    except Exception as e:
        print(f"Error updating job description: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to update job description: {str(e)}")

@app.post("/upload-resume")
async def upload_resume(
    file: UploadFile = File(...),
    name: str = Form(...),
    email: str = Form(...),
    experience_years: int = Form(...),
    skills: str = Form(...),
    education: str = Form(...),
    job_id: str = Form(...),
    motivational_letter: Optional[str] = Form(None),
    motivation_file: Optional[UploadFile] = File(None),
    company_note: Optional[str] = Form(None),
    company_note_file: Optional[UploadFile] = File(None)
):
    """Upload and process resume file"""
    try:
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
        
        # Parse skills
        skills_list = [skill.strip() for skill in skills.split(",")]
        
        # Save to database
        db = SessionLocal()
        candidate_db = CandidateDB(
            job_id=job_id,
            name=name,
            email=email,
            resume_text=resume_text,
            motivational_letter=motivation_text,
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
            "extracted_text": resume_text[:500] + "..." if len(resume_text) > 500 else resume_text,
            "extraction_method": extraction_method,
            "azure_used": azure_used or motivation_azure_used
        }
        
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }

@app.post("/evaluate-candidate")
async def evaluate_candidate(
    candidate_id: str = Form(...),
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
        
        # ENFORCE JOB-SPECIFIC EVALUATION: Must have job_id
        if not candidate.job_id:
            db.close()
            raise HTTPException(status_code=400, detail="Evaluation requires a job posting. Please select a job before evaluating.")
        
        # Verify job posting exists
        job = db.query(JobPostingDB).filter(JobPostingDB.id == candidate.job_id).first()
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
        if candidate.job_id:
            job = db.query(JobPostingDB).filter(JobPostingDB.id == candidate.job_id).first()
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
        
        # Evaluate for each selected persona
        persona_evaluations = {}
        
        for persona in persona_objects:
            persona_prompt = persona_prompts.get(persona.name, persona.system_prompt)
            
            # Build system prompt for this persona - they evaluate from their own perspective
            system_prompt = f"""Je bent {persona.display_name}. Je beoordelingsstijl: {persona_prompt}

Je evalueert deze kandidaat vanuit jouw perspectief. Geef een beoordeling met scores, sterke punten, aandachtspunten en advies.

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

Geef geen tekst buiten het JSON object."""
            
            # MAKE SURE we're sending clean text to OpenAI
            # All text is already truncated above, so we can safely build the prompt
            user_prompt = f"""Evalueer deze kandidaat vanuit jouw perspectief als {persona.display_name}:

CV:
{resume_text}{motivational_info}{job_info}{company_note_info}

Geef een score (1-10), sterke punten, aandachtspunten, analyse en advies. Benoem expliciet grote matches of mismatches."""
            
            # Final safety check: ensure the user prompt itself isn't too long
            # For gpt-4o-mini, limit to ~3000 chars for ~750 tokens
            # This leaves room for system prompt (~500 tokens) and response (max_tokens)
            if len(user_prompt) > 3000:
                user_prompt = user_prompt[:3000] + "\n\n[Prompt truncated for token limits...]"
            
            # Call OpenAI safely for this persona
            # Use local variables to avoid scoping issues
            openai_result = call_openai_safe([
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ], max_tokens=_max_tokens_eval, temperature=_temp_eval, model=_model_eval)
            
            if not openai_result["success"]:
                print(f"AI evaluation failed for persona {persona.name}: {openai_result['error']}")
                persona_evaluations[persona.name] = {
                    "error": f"Evaluation failed: {openai_result['error']}",
                    "persona_display_name": persona.display_name
                }
                continue
            
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
                persona_evaluations[persona.name] = {
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
                persona_evaluations[persona.name] = {
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
                persona_evaluations[persona.name] = {
                    "score": SCORE_DEFAULT,
                    "strengths": "Niet beschikbaar",
                    "weaknesses": "Niet beschikbaar",
                    "analysis": f"Er is een fout opgetreden: {str(e)}",
                    "recommendation": get_recommendation_from_score(SCORE_DEFAULT),
                    "persona_display_name": persona.display_name,
                    "persona_name": persona.name
                }
        
        db.close()
        
        # Generate combined analysis if we have multiple evaluations
        combined_analysis = None
        combined_recommendation = None
        
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
        
        # Return evaluations from all personas with combined analysis
        return {
            "success": True,
            "evaluations": persona_evaluations,  # Dictionary of persona_name -> evaluation
            "persona_count": len(persona_evaluations),
            "combined_analysis": combined_analysis,
            "combined_recommendation": combined_recommendation
        }
        
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }

@app.get("/candidates")
async def get_candidates(job_id: Optional[str] = None):
    """Get all evaluated candidates with their evaluations"""
    try:
        db = SessionLocal()
        
        # Get candidates with their evaluations and job info
        query = db.query(CandidateDB)
        if job_id:
            query = query.filter(CandidateDB.job_id == job_id)
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
            
            # Get evaluations
            evaluations = db.query(EvaluationDB).filter(EvaluationDB.candidate_id == candidate.id).all()
            
            result.append({
                "id": candidate.id,
                "name": candidate.name,
                "email": candidate.email,
                "experience_years": candidate.experience_years,
                "skills": candidate.skills,
                "education": candidate.education,
                "created_at": candidate.created_at.isoformat() if candidate.created_at else None,
                "job": job_info,
                "evaluations": [
                    {
                        "id": eval.id,
                        "persona": eval.persona.value if eval.persona else None,
                        "result_summary": eval.result_summary,
                        "created_at": eval.created_at.isoformat() if eval.created_at else None
                    }
                    for eval in evaluations
                ],
                "evaluation_count": len(evaluations)
            })
        
        db.close()
        
        return {
            "success": True,
            "candidates": result
        }
        
    except Exception as e:
        print(f"Error getting candidates: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get candidates: {str(e)}")

@app.post("/debate-candidate")
async def debate_candidate(
    candidate_id: str = Form(...),
    company_note: Optional[str] = Form(None),
    company_note_file: Optional[UploadFile] = File(None),
    request: Request = None
):
    """Multi-expert debate between selected personas"""
    try:
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
        
        # Use LangChain multi-agent system for realistic debate
        try:
            from langchain_debate import run_multi_agent_debate
            
            candidate_info = f"{candidate.resume_text}{motivational_info}"
            
            print(f"Calling run_multi_agent_debate with {len(persona_prompts)} personas...")
            response = await run_multi_agent_debate(
                persona_prompts=persona_prompts,
                candidate_info=candidate_info,
                job_info=job_info,
                company_note=company_note_text if company_note_text else None
            )
            
            print(f"Debate response type: {type(response)}, length: {len(str(response))}")
            
            # Validate response is JSON
            try:
                import json
                parsed = json.loads(response)
                if isinstance(parsed, list):
                    print(f"✓ Valid JSON array with {len(parsed)} messages")
                else:
                    print(f"⚠ Response is JSON but not an array: {type(parsed)}")
            except json.JSONDecodeError:
                print(f"⚠ Response is not valid JSON, first 200 chars: {str(response)[:200]}")
            
            # Build full prompt for display
            full_prompt_text = f"LANGCHAIN MULTI-AGENT DEBATE SYSTEM\n\nModerator + {len(persona_prompts)} Persona Agents\n\nPersonas: {', '.join(persona_prompts.keys())}\n\nDebate structured with:\n1. Moderator introduction\n2. Initial thoughts from each persona\n3. Multiple rounds of discussion\n4. Final summary from moderator"
            
        except ImportError as e:
            print(f"ImportError: {e}")
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
            
            response = openai_result["result"].choices[0].message.content
            full_prompt_text = f"SYSTEM PROMPT:\n{system_prompt}\n\nUSER PROMPT:\n{user_prompt}"
        
        db.close()
        
        return {
            "success": True,
            "debate": response,
            "tokens_used": 0,  # LangChain doesn't return token count in same format
            "full_prompt": full_prompt_text
        }
        
    except Exception as e:
        print(f"Error in debate: {str(e)}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Debate failed: {str(e)}")

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
        
        # Build comprehensive analysis prompt
        system_prompt = """You are an expert job market analyst and HR consultant. Thoroughly analyze job postings with deep insight into:

1. **Role Analysis**: Deep dive into what this role actually entails based on the title and description
2. **Correctness**: Are the requirements realistic? Is the description accurate and complete?
3. **Description-to-Role Match**: Does the job description accurately reflect the job title? Are they aligned?
4. **Research Quality**: Is the role well-defined? Are expectations clear and industry-standard?
5. **Role Extension**: Should this role be split, extended, or combined? Research similar roles in the market.

Provide detailed, actionable analysis based on industry standards and market research."""
        
        # Prepare detailed user prompt
        description_text = job.description or "No description provided"
        requirements_text = job.requirements or "No requirements specified"
        location_text = job.location or "Not specified"
        salary_text = job.salary_range or "Not specified"
        
        user_prompt = f"""Conduct a comprehensive analysis of this job posting:

JOB TITLE: {job.title}
COMPANY: {job.company}
LOCATION: {location_text}
SALARY RANGE: {salary_text}

JOB DESCRIPTION:
{description_text}

JOB REQUIREMENTS:
{requirements_text}

Analyze this posting thoroughly. Consider:
- Does the job description accurately match what someone with the title "{job.title}" typically does?
- Are there discrepancies between the title and the actual duties described?
- Is the description comprehensive enough? What's missing?
- Are the requirements aligned with the role expectations?
- Based on industry standards, should this role be split, extended, or remain as-is?

IMPORTANT: You MUST respond with ONLY valid JSON. No markdown code blocks, no explanations outside the JSON. Return ONLY a JSON object in this exact format:

{{
  "role_analysis": "Detailed analysis of what this role actually entails based on the title and description",
  "description_match": "Assessment of whether the description accurately matches the role title and typical responsibilities",
  "correctness": "Assessment of requirements realism, description accuracy, and completeness",
  "research_quality": "Quality of role definition, clarity of expectations, and industry alignment",
  "role_extension": "Recommendation on whether role should be extended/split, with market research findings"
}}

Be thorough, specific, and provide actionable insights. Return ONLY the JSON object, nothing else."""
        
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
                "role_analysis": "Analysis completed but returned empty",
                "description_match": "Analysis unavailable",
                "correctness": "Analysis unavailable",
                "research_quality": "Analysis unavailable",
                "role_extension": "Analysis unavailable"
            }
        
        db.close()
        
        result = {
            "success": True,
            "role_analysis": analysis.get("role_analysis", "Analysis unavailable"),
            "description_match": analysis.get("description_match", "Analysis unavailable"),
            "correctness": analysis.get("correctness", "Analysis unavailable"),
            "research_quality": analysis.get("research_quality", "Analysis unavailable"),
            "role_extension": analysis.get("role_extension", "Analysis unavailable")
        }
        
        print(f"Returning analysis result with {len([k for k, v in result.items() if v and v != 'Analysis unavailable']) - 1} populated fields")
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

# -----------------------------
# Result Storage and Retrieval endpoints
# -----------------------------
@app.get("/evaluation-results")
async def get_evaluation_results(
    candidate_id: Optional[str] = None,
    job_id: Optional[str] = None,
    result_type: Optional[str] = None
):
    """Get saved evaluation or debate results"""
    try:
        db = SessionLocal()
        query = db.query(EvaluationResultDB)
        
        if candidate_id:
            query = query.filter(EvaluationResultDB.candidate_id == candidate_id)
        if job_id:
            query = query.filter(EvaluationResultDB.job_id == job_id)
        if result_type:
            query = query.filter(EvaluationResultDB.result_type == result_type)
        
        results = query.order_by(EvaluationResultDB.created_at.desc()).all()
        
        import json
        result_list = []
        for result in results:
            try:
                result_data = json.loads(result.result_data)
                persona_ids = json.loads(result.selected_personas) if result.selected_personas else []
                
                result_list.append({
                    "id": result.id,
                    "candidate_id": result.candidate_id,
                    "job_id": result.job_id,
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

if __name__ == "__main__":
    import uvicorn
    # Note: reload=True requires running as: uvicorn main:app --reload
    # For direct execution, reload is disabled
    uvicorn.run(app, host="0.0.0.0", port=8000)
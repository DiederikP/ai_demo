import os
import glob
import asyncio
import httpx
from backend.main import SessionLocal, CandidateDB, JobPostingDB, extract_text_from_file, truncate_text_safely
from fastapi import UploadFile

# -----------------------------
# CONFIG
# -----------------------------
RESUME_FOLDER = "backend/resumes"  # Folder where PDFs are stored
MAX_RESUME_CHARS = 3000
PERSONA = "hiring"  # Can be "finance", "hiring", or "tech"

# -----------------------------
# Pick the latest PDF
# -----------------------------
pdf_files = sorted(glob.glob(os.path.join(RESUME_FOLDER, "*.pdf")), key=os.path.getmtime, reverse=True)
if not pdf_files:
    raise FileNotFoundError(f"No PDFs found in {RESUME_FOLDER}")
PDF_PATH = pdf_files[0]
print(f"Using PDF: {PDF_PATH}")

# -----------------------------
# Pick the latest job
# -----------------------------
# Use the job ID we just created
JOB_ID = "39ffb624-0e16-4e31-b8be-e83ba2166937"
print(f"Using Job ID: {JOB_ID}")

# -----------------------------
# Read PDF and prepare UploadFile
# -----------------------------
with open(PDF_PATH, "rb") as f:
    pdf_bytes = f.read()

# Create UploadFile properly
file = UploadFile(
    filename=os.path.basename(PDF_PATH),
    file=open(PDF_PATH, "rb")
)

# Example candidate data
candidate_name = "Auto Test Candidate"
candidate_email = "test@example.com"
candidate_experience = 5
candidate_skills = "Python, SQL, FastAPI"
candidate_education = "Bachelor in Computer Science"

# -----------------------------
# Upload resume
# -----------------------------
async def main():
    async with httpx.AsyncClient() as client:
        # Upload resume via API
        with open(PDF_PATH, "rb") as f:
            files = {"file": (os.path.basename(PDF_PATH), f, "application/pdf")}
            data = {
                "name": candidate_name,
                "email": candidate_email,
                "experience_years": candidate_experience,
                "skills": candidate_skills,
                "education": candidate_education,
                "job_id": JOB_ID
            }
            
            upload_response = await client.post("http://localhost:8000/upload-resume", files=files, data=data)
            upload_result = upload_response.json()
            
        candidate_id = upload_result["candidate_id"]
        print(f"Uploaded candidate ID: {candidate_id}")
        print(f"Extracted text (first 200 chars): {upload_result['extracted_text'][:200]}")

        # -----------------------------
        # Evaluate candidate
        # -----------------------------
        eval_data = {
            "candidate_id": candidate_id,
            "persona": PERSONA
        }
        
        eval_response = await client.post("http://localhost:8000/evaluate-candidate", data=eval_data)
        evaluation_result = eval_response.json()
        print(f"Evaluation result:\n{evaluation_result}")

# Run the async main function
asyncio.run(main())

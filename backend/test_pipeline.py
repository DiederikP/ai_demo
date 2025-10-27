import requests

# -----------------------------
# Config
# -----------------------------
BACKEND_URL = "http://localhost:8000"
PDF_PATH = "resumes/Diederik_Pondman_Curriculum_vitae.pdf"
JOB_ID = "<your_job_id_here>"
PERSONA = "hiring"

# Candidate info
candidate_data = {
    "name": "John Doe",
    "email": "john@example.com",
    "experience_years": 5,
    "skills": "Python, SQL, FastAPI",
    "education": "BSc Computer Science",
    "job_id": JOB_ID
}

# -----------------------------
# 1. Upload Resume
# -----------------------------
with open(PDF_PATH, "rb") as f:
    files = {"file": (PDF_PATH, f, "application/pdf")}
    response = requests.post(f"{BACKEND_URL}/upload-resume", data=candidate_data, files=files)

if response.status_code != 200:
    print("Upload failed:", response.text)
    exit(1)

upload_result = response.json()
print("Upload result:", upload_result)

candidate_id = upload_result.get("candidate_id")
if not candidate_id:
    print("No candidate_id returned, aborting")
    exit(1)

# -----------------------------
# 2. Debug candidate
# -----------------------------
debug_resp = requests.get(f"{BACKEND_URL}/debug-candidate/{candidate_id}")
debug_info = debug_resp.json()
print("Debug candidate info:", debug_info)

# -----------------------------
# 3. Evaluate candidate
# -----------------------------
evaluate_data = {
    "candidate_id": candidate_id,
    "persona": PERSONA
}

eval_resp = requests.post(f"{BACKEND_URL}/evaluate-candidate", data=evaluate_data)
if eval_resp.status_code != 200:
    print("Evaluation failed:", eval_resp.text)
    exit(1)

evaluation_result = eval_resp.json()
print("Evaluation result:", evaluation_result)

# -----------------------------
# 4. Optional: Overview
# -----------------------------
overview_resp = requests.get(f"{BACKEND_URL}/job-postings/{JOB_ID}/overview")
print("Job overview:", overview_resp.json())

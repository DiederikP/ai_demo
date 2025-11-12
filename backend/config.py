"""
Centralized configuration for AI models and services.
Adjust models and versions here to affect the entire application.
"""

# OpenAI GPT Configuration
# Using gpt-4o-mini for testing - change to "gpt-4" for production
OPENAI_MODEL_EVALUATION = "gpt-4o-mini"  # Model for candidate evaluations
OPENAI_MODEL_DEBATE = "gpt-4o-mini"  # Model for expert debates
OPENAI_MODEL_JOB_ANALYSIS = "gpt-4o-mini"  # Model for job posting analysis
OPENAI_MODEL_TEXT_EXTRACTION = "gpt-4o-mini"  # Model for text extraction (fallback)
OPENAI_MODEL_JOB_EXTRACTION = "gpt-4o-mini"  # Model for extracting job posting from URL

# Model Parameters
OPENAI_MAX_TOKENS_EVALUATION = 1000
OPENAI_MAX_TOKENS_DEBATE = 1500
OPENAI_MAX_TOKENS_JOB_ANALYSIS = 2000  # Increased for comprehensive analysis
OPENAI_MAX_TOKENS_TEXT_EXTRACTION = 2000

OPENAI_TEMPERATURE_EVALUATION = 0.1  # Lower for structured evaluation
OPENAI_TEMPERATURE_DEBATE = 0.8  # Higher for creative debate
OPENAI_TEMPERATURE_JOB_ANALYSIS = 0.3  # Medium for analysis
OPENAI_TEMPERATURE_TEXT_EXTRACTION = 0.0  # Low for accurate extraction

# Azure Document Intelligence Configuration
AZURE_ENABLED = True  # Set to False to disable Azure entirely
AZURE_TIMEOUT_SECONDS = 30

# File Processing Configuration
# Reduced limits for gpt-4o-mini to stay within token limits
MAX_RESUME_CHARS = 2000  # Reduced from 3000 for smaller model
MAX_MOTIVATION_CHARS = 500  # Reduced from 1000 for smaller model
MAX_JOB_DESC_CHARS = 1000  # Reduced from 2000 for smaller model
MAX_COMPANY_NOTE_CHARS = 500  # Limit for company notes

# PDF Extraction Priority (in order of preference)
# Options: 'pymupdf', 'azure', 'ai'
# Use PyMuPDF first (most reliable), then Azure, then AI as fallback
PDF_EXTRACTION_PRIORITY = ['pymupdf', 'azure', 'ai']

# Scoring System Configuration
SCORE_MIN = 1.0  # Minimum score value
SCORE_MAX = 10.0  # Maximum score value
SCORE_DEFAULT = 5.0  # Default/fallback score (middle of range)

# Score scale definitions (for prompts)
SCORE_SCALE_DEFINITION = {
    1: "zeer zwak",
    2: "zwak",
    3: "onder gemiddeld",
    4: "gemiddeld",
    5: "boven gemiddeld",
    6: "goed",
    7: "zeer goed",
    8: "uitstekend",
    9: "uitzonderlijk",
    10: "uitmuntend"
}

# Recommendation thresholds based on score (for automatic recommendation generation)
RECOMMENDATION_THRESHOLDS = {
    "strong_fit": 7.0,  # >= this score → "Sterk geschikt / uitnodigen voor gesprek"
    "uncertain": 5.0    # >= this score → "Twijfelgeval / meer informatie nodig"
    # < uncertain threshold → "Niet passend op dit moment"
}

# Function to get recommendation text based on score
def get_recommendation_from_score(score: float) -> str:
    """Get recommendation text based on score thresholds"""
    if score >= RECOMMENDATION_THRESHOLDS["strong_fit"]:
        return "Sterk geschikt / uitnodigen voor gesprek"
    elif score >= RECOMMENDATION_THRESHOLDS["uncertain"]:
        return "Twijfelgeval / meer informatie nodig"
    else:
        return "Niet passend op dit moment"

# Function to format score scale for prompts
def get_score_scale_prompt_text() -> str:
    """Get formatted score scale text for use in prompts"""
    scale_parts = [f"{k} = {v}" for k, v in SCORE_SCALE_DEFINITION.items()]
    return "SCORE SCALE: " + ", ".join(scale_parts)

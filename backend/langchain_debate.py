"""
LangChain Multi-Agent Debate System
Structured turn-based debate with JSON output format
"""

from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from typing import Dict, List, Optional
import os
import json

# Import config
try:
    from config import OPENAI_MODEL_DEBATE, OPENAI_TEMPERATURE_DEBATE
except ImportError:
    OPENAI_MODEL_DEBATE = "gpt-4o-mini"
    OPENAI_TEMPERATURE_DEBATE = 0.8


def create_persona_prompt_template(persona_name: str, persona_prompt: str, candidate_info: str, job_info: str, company_note: Optional[str] = None) -> ChatPromptTemplate:
    """Create a prompt template for a specific persona"""
    
    company_note_text = ""
    if company_note:
        company_note_text = f"""

BEDRIJFSNOTITIE (Context - gebruik maar herhaal NIET):
{company_note}

**KRITIEKE REGEL**: Deze bedrijfsnotitie bevat contextuele informatie (zoals salaris, beschikbaarheid, etc.). 
- Gebruik deze informatie EEN KEER als relevant voor je beoordeling
- Als salaris, beschikbaarheid, of andere bedrijfsnotitie-details AL in het debat genoemd zijn, NOEM ZE NIET MEER
- Verwijs hooguit kort ("zoals eerder besproken") maar ga direct verder met andere aspecten
- Focus op nieuwe perspectieven: technische vaardigheden, ervaring, risico's, conclusies"""
    
    system_prompt = f"""Je bent {persona_name}, een expert beoordelaar die een kandidaat evalueert voor een functie.

Je rol en perspectief:
{persona_prompt}

KANDIDAAT INFORMATIE:
{candidate_info}

FUNCTIE INFORMATIE:
{job_info}{company_note_text}

KRITIEKE INSTRUCTIES:
1. Je bespreekt de kandidaat MET andere experts - de kandidaat is NIET aanwezig. Spreek dus NIET tegen de kandidaat.
2. Hoge informatiedichtheid: direct, zakelijk, geen beleefdheden of onnodige woorden
3. Berichten zijn kort en to-the-point (1-2 zinnen, max 3)
4. Reageer op anderen door hun naam te noemen, maar wees direct
5. **KRITIEK**: Bedrijfsnotitie is CONTEXT - gebruik EEN KEER als relevant. Als salaris/beschikbaarheid AL genoemd zijn, NOEM ZE NIET MEER. Ga direct verder met andere aspecten (ervaring, vaardigheden, risico's, conclusies).
6. **DOEL**: Werk naar eindbeslissing: afwijzen, geschikt, of verdere evaluatie
7. Geef GEEN scores, evaluaties, of formele beoordelingen - alleen discussie
8. Geef GEEN "Sterke punten" of "Aandachtspunten" - alleen zakelijke dialoog
9. Voeg nieuwe perspectieven toe of trek conclusies - geen herhaling
10. Focus op feiten, risico's, en beslissingscriteria - geen small talk

Je spreekt als {persona_name} - zakelijk, direct, informatiedicht."""
    
    return ChatPromptTemplate.from_messages([
        ("system", system_prompt),
        ("human", "{conversation_context}")
    ])


def create_orchestrator_prompt_template(persona_names: List[str], candidate_info: str, job_info: str, company_note: Optional[str] = None, is_summary: bool = False) -> ChatPromptTemplate:
    """Create a prompt template for the orchestrator"""
    
    company_note_text = ""
    if company_note:
        company_note_text = f"""

BELANGRIJFSNOTITIE:
{company_note}"""
    
    if is_summary:
        system_prompt = f"""Je bent de moderator van een debat tussen {len(persona_names)} experts: {', '.join(persona_names)}.

Het debat is afgelopen. Geef een korte, duidelijke samenvatting (3-4 zinnen) met:
1. Belangrijkste punten uit de discussie (max 1-2 zinnen)
2. Consensus of belangrijke verschillen tussen de experts (max 1 zin)
3. **EINDBESLISSING** (verplicht): Geef een duidelijk advies - één van deze drie opties:
   - "Afwijzen" - kandidaat voldoet niet aan de eisen
   - "Geschikt" - kandidaat is geschikt voor de functie
   - "Verdere evaluatie nodig" - meer informatie of gesprek nodig

Geef GEEN scores, evaluaties, of formele beoordelingen - alleen een natuurlijke samenvatting met een duidelijk eindadvies.

KANDIDAAT: {candidate_info[:200]}...
FUNCTIE: {job_info[:200]}...{company_note_text}"""
    else:
        system_prompt = f"""Je bent de moderator van een gestructureerd debat tussen {len(persona_names)} experts: {', '.join(persona_names)}.

Jouw rol:
- Begeleid zakelijk en direct - geen beleefdheden
- Stel gerichte vragen (1 zin, max 2) om de discussie vooruit te helpen
- Houd focus op eindbeslissing: afwijzen, geschikt, of verdere evaluatie
- **KRITIEK**: Als bedrijfsnotitie-informatie (salaris, beschikbaarheid) al besproken is, stuur de discussie naar ANDERE aspecten (ervaring, vaardigheden, risico's, conclusies)
- Geef GEEN evaluaties, scores, of samenvattingen - alleen begeleiding
- Hoge informatiedichtheid - direct en to-the-point

KANDIDAAT INFORMATIE:
{candidate_info}

FUNCTIE INFORMATIE:
{job_info}{company_note_text}

Huidige gespreksstatus:
{{conversation_status}}

Geef een korte, directe begeleiding of vraag (1 zin) die de discussie naar een beslissing leidt. Focus op aspecten die NOG NIET besproken zijn."""
    
    return ChatPromptTemplate.from_messages([
        ("system", system_prompt),
        ("human", "Geef je bericht voor het debat.")
    ])


def create_persona_llm() -> ChatOpenAI:
    """Create a LangChain LLM instance for personas"""
    return ChatOpenAI(
        model=OPENAI_MODEL_DEBATE,
        temperature=OPENAI_TEMPERATURE_DEBATE,
        model_kwargs={"response_format": {"type": "text"}}
    )


def create_orchestrator_llm() -> ChatOpenAI:
    """Create a LangChain LLM instance for orchestrator"""
    return ChatOpenAI(
        model=OPENAI_MODEL_DEBATE,
        temperature=OPENAI_TEMPERATURE_DEBATE,
        model_kwargs={"response_format": {"type": "text"}}
    )


def format_conversation_context(conversation: List[Dict[str, str]], persona_name: str, company_note: Optional[str] = None) -> str:
    """Format the conversation context for a persona to read"""
    if not conversation:
        return "Je begint het debat. Geef je eerste indruk van de kandidaat op basis van je expertise (1-3 zinnen)."
    
    formatted = "HUIDIG DEBAT:\n\n"
    for entry in conversation:
        role = entry.get('role', 'Unknown')
        content = entry.get('content', '').strip()
        if content:
            formatted += f"{role}: {content}\n\n"
    
    # Detect if company note topics have been discussed
    company_note_mentioned = False
    if company_note:
        # Check if any company note keywords appear in conversation
        note_keywords = ['salaris', 'beschikbaar', '€', 'euro', 'maand', 'week', 'opzegtermijn', 'bedrijfsnotitie', '4000', 'salarisindicatie']
        conversation_text = ' '.join([entry.get('content', '').lower() for entry in conversation])
        company_note_mentioned = any(keyword in conversation_text for keyword in note_keywords)
        
        # Also check for specific patterns from company note
        if company_note:
            note_lower = company_note.lower()
            # Extract key phrases from company note
            if 'salaris' in note_lower or '€' in note_lower:
                if 'salaris' in conversation_text or '€' in conversation_text or 'euro' in conversation_text:
                    company_note_mentioned = True
            if 'beschikbaar' in note_lower or 'maand' in note_lower:
                if 'beschikbaar' in conversation_text or 'maand' in conversation_text:
                    company_note_mentioned = True
    
    formatted += f"\nJe beurt ({persona_name}). Reageer zakelijk en direct op wat anderen hebben gezegd (1-2 zinnen, max 3)."
    formatted += "\n\nBELANGRIJK:"
    formatted += "\n- Je bespreekt de kandidaat MET experts - spreek NIET tegen de kandidaat"
    formatted += "\n- Hoge informatiedichtheid: direct, zakelijk, geen beleefdheden"
    
    if company_note_mentioned:
        formatted += "\n- **KRITIEK**: Informatie uit de bedrijfsnotitie (salaris, beschikbaarheid, etc.) is AL BESPREKEN in dit debat."
        formatted += "\n- **VERBODEN**: NOEM salaris, beschikbaarheid, opzegtermijn, of andere bedrijfsnotitie-details NIET MEER."
        formatted += "\n- **VERPLICHT**: Focus op ANDERE aspecten: technische vaardigheden, ervaring, cultuurfit, risico's, stabiliteit, of trek conclusies."
        formatted += "\n- Als je niets nieuws hebt, geef dan een conclusie of vraag om verduideliking over ANDERE aspecten."
    else:
        formatted += "\n- Bedrijfsnotitie informatie (salaris, beschikbaarheid) mag EEN KEER genoemd worden als relevant, daarna NIET MEER"
    
    formatted += "\n- Herhaal GEEN andere informatie die al genoemd is"
    formatted += "\n- Verwijs kort naar eerdere punten maar herhaal ze niet"
    formatted += "\n- Voeg nieuwe perspectieven toe of trek conclusies"
    formatted += "\n- Werk naar eindbeslissing: afwijzen, geschikt, of verdere evaluatie"
    formatted += "\n- Geef GEEN scores of formele evaluaties - alleen zakelijke discussie"
    return formatted


def get_conversation_status(conversation: List[Dict[str, str]], persona_names: List[str]) -> str:
    """Get a summary of conversation status for orchestrator"""
    if not conversation:
        return "Het debat begint net. Stel een opening vraag of vraag om eerste indrukken."
    
    # Count messages per persona
    message_counts = {}
    for entry in conversation:
        role = entry.get('role', '')
        if role and role != 'Moderator':
            message_counts[role] = message_counts.get(role, 0) + 1
    
    # Find who hasn't spoken much
    quiet_personas = [name.replace('_', ' ').title() for name in persona_names if message_counts.get(name.replace('_', ' ').title(), 0) < 2]
    
    status = f"Er zijn {len(conversation)} berichten geweest. "
    if quiet_personas:
        status += f"{', '.join(quiet_personas)} hebben nog weinig gezegd. "
    
    # Guide towards conclusion based on conversation length
    if len(conversation) >= 14:
        status += "Het debat loopt ten einde. Stuur aan op een eindbeslissing: afwijzen, geschikt, of verdere evaluatie nodig. "
    elif len(conversation) >= 10:
        status += "Werk naar een conclusie toe. Vraag naar eindbeoordelingen en voorkeuren. "
    elif len(conversation) >= 6:
        status += "Verdiep de discussie. Voorkom herhaling van al genoemde informatie. "
    
    # Get last few messages for context
    last_messages = conversation[-3:] if len(conversation) >= 3 else conversation
    recent_topics = [entry.get('content', '')[:50] for entry in last_messages]
    status += f"Recent besproken: {', '.join(recent_topics)}"
    
    return status


async def invoke_persona(
    persona_name: str,
    persona_prompt: str,
    candidate_info: str,
    job_info: str,
    conversation: List[Dict[str, str]],
    company_note: Optional[str] = None
) -> Dict[str, str]:
    """Invoke a persona to generate a natural conversational response"""
    
    prompt_template = create_persona_prompt_template(
        persona_name, persona_prompt, candidate_info, job_info, company_note
    )
    llm = create_persona_llm()
    
    # Format conversation context for this persona
    conversation_context = format_conversation_context(conversation, persona_name, company_note)
    
    # Invoke LLM
    chain = prompt_template | llm
    result = await chain.ainvoke({"conversation_context": conversation_context})
    
    # Extract content
    message_content = result.content if hasattr(result, 'content') else str(result)
    
    # Clean up message - remove any system/assistant labels, scores, evaluations
    message_content = message_content.strip()
    
    # Remove persona name prefix if present
    display_name = persona_name.replace('_', ' ').title()
    if message_content.startswith(f"{display_name}:"):
        message_content = message_content[len(f"{display_name}:"):].strip()
    if message_content.startswith(f"{persona_name}:"):
        message_content = message_content[len(f"{persona_name}:"):].strip()
    
    # Remove common evaluation patterns
    import re
    message_content = re.sub(r'(?i)(score|beoordeling|evaluatie|sterke punten|aandachtspunten):\s*.*', '', message_content)
    
    # Check if company note info was already mentioned in conversation
    if company_note and conversation:
        note_keywords = ['salaris', 'beschikbaar', '€', 'euro', 'maand', 'week', 'opzegtermijn', '4000', 'salarisindicatie']
        conversation_text = ' '.join([entry.get('content', '').lower() for entry in conversation])
        company_note_mentioned = any(keyword in conversation_text for keyword in note_keywords)
        
        if company_note_mentioned:
            # Remove explicit mentions of company note details from this message
            message_lower = message_content.lower()
            # Check if this message contains company note keywords
            contains_note_keywords = any(kw in message_lower for kw in note_keywords)
            
            if contains_note_keywords:
                # Split into sentences and filter out those mentioning company note
                sentences = re.split(r'([.!?]+)', message_content)
                cleaned_parts = []
                i = 0
                while i < len(sentences):
                    sentence = sentences[i]
                    sentence_lower = sentence.lower()
                    # Check if sentence heavily references company note (short sentences with keywords are likely about company note)
                    is_about_company_note = any(
                        kw in sentence_lower and (len(sentence) < 150 or 'salaris' in sentence_lower or 'beschikbaar' in sentence_lower)
                        for kw in note_keywords
                    )
                    
                    if not is_about_company_note:
                        cleaned_parts.append(sentence)
                        # Add punctuation if next item is punctuation
                        if i + 1 < len(sentences) and sentences[i + 1] in ['.', '!', '?']:
                            cleaned_parts.append(sentences[i + 1])
                            i += 1
                    i += 1
                
                if cleaned_parts:
                    message_content = ''.join(cleaned_parts).strip()
                else:
                    # If all sentences were about company note, replace with a generic continuation
                    message_content = "Laten we verder kijken naar andere aspecten van de kandidaat."
    
    message_content = message_content.strip()
    
    # Return formatted entry
    return {
        'speaker': persona_name,
        'message': message_content
    }


async def invoke_orchestrator(
    persona_names: List[str],
    candidate_info: str,
    job_info: str,
    conversation: List[Dict[str, str]],
    company_note: Optional[str] = None
) -> Dict[str, str]:
    """Invoke orchestrator to guide the conversation"""
    
    prompt_template = create_orchestrator_prompt_template(
        persona_names, candidate_info, job_info, company_note, is_summary=False
    )
    llm = create_orchestrator_llm()
    
    # Get conversation status
    conversation_status = get_conversation_status(conversation, persona_names)
    
    # Invoke LLM
    chain = prompt_template | llm
    result = await chain.ainvoke({"conversation_status": conversation_status})
    
    # Extract content
    message_content = result.content if hasattr(result, 'content') else str(result)
    message_content = message_content.strip()
    
    return {
        'speaker': 'Moderator',
        'message': message_content
    }


async def invoke_orchestrator_summary(
    persona_names: List[str],
    candidate_info: str,
    job_info: str,
    conversation: List[Dict[str, str]],
    company_note: Optional[str] = None
) -> Dict[str, str]:
    """Invoke orchestrator to provide a final summary of the conversation"""
    
    prompt_template = create_orchestrator_prompt_template(
        persona_names, candidate_info, job_info, company_note, is_summary=True
    )
    llm = create_orchestrator_llm()
    
    # Get conversation status for context
    conversation_status = get_conversation_status(conversation, persona_names)
    
    # Invoke LLM
    chain = prompt_template | llm
    result = await chain.ainvoke({"conversation_status": conversation_status})
    
    # Extract content
    message_content = result.content if hasattr(result, 'content') else str(result)
    message_content = message_content.strip()
    
    return {
        'speaker': 'Moderator',
        'message': message_content
    }


async def run_multi_agent_debate(
    persona_prompts: Dict[str, str],
    candidate_info: str,
    job_info: str,
    company_note: Optional[str] = None
) -> str:
    """
    Run a structured turn-based debate and return JSON format
    
    Args:
        persona_prompts: Dict mapping persona names to their system prompts
        candidate_info: Candidate CV and motivation letter
        job_info: Job posting details
        company_note: Optional company guidance
    
    Returns:
        JSON string array of conversation messages: [{"role": "Speaker", "content": "message"}, ...]
    """
    openai_api_key = os.getenv("OPENAI_API_KEY")
    if not openai_api_key:
        raise ValueError("OPENAI_API_KEY not found in environment")
    
    persona_names = list(persona_prompts.keys())
    
    if len(persona_names) == 0:
        raise ValueError("No personas provided for debate")
    
    # Initialize conversation messages list
    conversation: List[Dict[str, str]] = []
    
    # Extended conversation flow: structured turns
    # Target: ~20-25 messages total
    
    print(f"\n=== DEBAT START ===\nPersonas: {', '.join(persona_names)}")
    
    # 1. Moderator opens
    print("  → Moderator opent debat...")
    entry = await invoke_orchestrator(persona_names, candidate_info, job_info, conversation, company_note)
    conversation.append({"role": "Moderator", "content": entry['message']})
    
    # 2. Each persona gives initial thoughts
    for persona_name in persona_names:
        print(f"  → {persona_name} geeft eerste indruk...")
        entry = await invoke_persona(
            persona_name,
            persona_prompts[persona_name],
            candidate_info,
            job_info,
            conversation.copy(),
            company_note
        )
        # Format persona name for display
        display_name = persona_name.replace('_', ' ').title()
        conversation.append({"role": display_name, "content": entry['message']})
    
    # 3. Moderator guides discussion
    print("  → Moderator begeleidt discussie...")
    entry = await invoke_orchestrator(persona_names, candidate_info, job_info, conversation, company_note)
    conversation.append({"role": "Moderator", "content": entry['message']})
    
    # 4. Personas respond (round 2)
    for persona_name in persona_names:
        print(f"  → {persona_name} reageert...")
        entry = await invoke_persona(
            persona_name,
            persona_prompts[persona_name],
            candidate_info,
            job_info,
            conversation.copy(),
            company_note
        )
        display_name = persona_name.replace('_', ' ').title()
        conversation.append({"role": display_name, "content": entry['message']})
    
    # 5. Moderator deepens discussion
    print("  → Moderator verdiept discussie...")
    entry = await invoke_orchestrator(persona_names, candidate_info, job_info, conversation, company_note)
    conversation.append({"role": "Moderator", "content": entry['message']})
    
    # 6. Personas continue (round 3)
    for persona_name in persona_names:
        print(f"  → {persona_name} gaat verder...")
        entry = await invoke_persona(
            persona_name,
            persona_prompts[persona_name],
            candidate_info,
            job_info,
            conversation.copy(),
            company_note
        )
        display_name = persona_name.replace('_', ' ').title()
        conversation.append({"role": display_name, "content": entry['message']})
    
    # 7. Moderator asks for final thoughts
    print("  → Moderator vraagt om afronding...")
    entry = await invoke_orchestrator(persona_names, candidate_info, job_info, conversation, company_note)
    conversation.append({"role": "Moderator", "content": entry['message']})
    
    # 8. Each persona gives final perspective
    for persona_name in persona_names:
        print(f"  → {persona_name} geeft laatste perspectief...")
        entry = await invoke_persona(
            persona_name,
            persona_prompts[persona_name],
            candidate_info,
            job_info,
            conversation.copy(),
            company_note
        )
        display_name = persona_name.replace('_', ' ').title()
        conversation.append({"role": display_name, "content": entry['message']})
    
    # 9. Moderator provides final summary
    print("  → Moderator geeft samenvatting...")
    entry = await invoke_orchestrator_summary(persona_names, candidate_info, job_info, conversation, company_note)
    conversation.append({"role": "Moderator", "content": entry['message']})
    
    # Return as JSON string
    json_output = json.dumps(conversation, ensure_ascii=False, indent=2)
    
    print(f"\n=== DEBAT VOLTOOID ===")
    print(f"Totaal aantal berichten: {len(conversation)}")
    
    return json_output

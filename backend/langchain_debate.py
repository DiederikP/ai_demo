"""
LangChain Multi-Agent Debate System
Structured turn-based debate with JSON output format
"""

from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from typing import Dict, List, Optional, Tuple, Any
import os
import json
import asyncio
import time

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
    
    # Add persona-specific focus instruction based on persona name
    persona_name_lower = persona_name.lower()
    focus_instruction = ""
    if 'tech' in persona_name_lower or 'hiring' in persona_name_lower:
        focus_instruction = "\n**FOCUS**: Bespreek alleen technische vaardigheden, ervaring, certificeringen, testresultaten, en opleiding. Laat financiële aspecten (salaris) en HR-aspecten (motivatie, bron) aan anderen."
    elif 'finance' in persona_name_lower:
        focus_instruction = "\n**FOCUS**: Bespreek alleen financiële aspecten: salarisverwachting, beschikbaarheid, opzegtermijn. Laat technische vaardigheden en HR-aspecten aan anderen."
    elif 'hr' in persona_name_lower or 'recruiter' in persona_name_lower or 'bureau' in persona_name_lower:
        focus_instruction = "\n**FOCUS**: Bespreek motivatie, communicatie, locatie, beschikbaarheid, opzegtermijn, bron. Laat technische vaardigheden aan de tech lead/hiring manager en financiële aspecten aan de finance director."
    
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
10. Focus op feiten, risico's, en beslissingscriteria - geen small talk{focus_instruction}

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

Jouw rol als moderator:
- **Begeleid het debat actief**: Stel gerichte vragen, reageer op wat experts zeggen, stuur de discussie
- **Faciliteer redenering**: Laat elk expert vanuit hun eigen perspectief redeneren en argumenteren
- **Diepgaande discussie**: Verdiep belangrijke punten, vraag naar details, onderzoek tegenstrijdigheden
- **Werk naar consensus**: Help de experts om tot een gezamenlijke conclusie te komen
- **Houd focus**: Eindbeslissing moet zijn: afwijzen, geschikt, of verdere evaluatie nodig

Belangrijke regels:
- Geef zakelijke, directe begeleiding (1-2 zinnen)
- Reageer op wat experts hebben gezegd door specifieke punten te benoemen
- Stel vragen die dieper ingaan op aspecten die genoemd zijn
- **KRITIEK**: Als bedrijfsnotitie-informatie (salaris, beschikbaarheid) al besproken is, stuur naar ANDERE aspecten
- Voorkom herhaling - focus op nieuwe perspectieven of verdieping
- Geef GEEN eigen evaluaties - alleen begeleiding en vragen

KANDIDAAT INFORMATIE:
{candidate_info}

FUNCTIE INFORMATIE:
{job_info}{company_note_text}

Huidige gespreksstatus:
{{conversation_status}}

Geef een korte, directe begeleiding of vraag (1-2 zinnen) die de discussie vooruit helpt. Reageer op wat experts hebben gezegd en stuur naar verdieping of conclusie."""
    
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
        # First turn - moderator has opened, personas should share their perspective
        return f"""De moderator heeft het debat geopend. Jouw beurt ({persona_name}).

De evaluatie is al gedaan. Spring direct in op specifieke aspecten vanuit jouw perspectief:
- Welke risico's zie je?
- Welke aspecten zijn belangrijk vanuit jouw expertise?
- Wat zijn de belangrijkste overwegingen?

Houd het kort (1-2 zinnen) en zakelijk. Geen herhaling van evaluatie-resultaten - focus op discussie."""
    
    formatted = "HUIDIG DEBAT:\n\n"
    for entry in conversation:
        role = entry.get('role', 'Unknown')
        content = entry.get('content', '').strip()
        if content:
            formatted += f"{role}: {content}\n\n"
    
    # Detect if company note topics have been discussed
    company_note_mentioned = False
    if company_note:
        note_keywords = ['salaris', 'beschikbaar', '€', 'euro', 'maand', 'week', 'opzegtermijn', 'bedrijfsnotitie', 'salarisindicatie']
        conversation_text = ' '.join([entry.get('content', '').lower() for entry in conversation])
        company_note_mentioned = any(keyword in conversation_text for keyword in note_keywords)
    
    # Get recent messages from other personas (not just moderator)
    recent_persona_messages = []
    for entry in reversed(conversation[-5:]):  # Look at last 5 messages
        role = entry.get('role', '')
        if role and role != 'Moderator' and role != persona_name.replace('_', ' ').title():
            recent_persona_messages.append({
                'role': role,
                'content': entry.get('content', '')[:150]  # First 150 chars
            })
            if len(recent_persona_messages) >= 2:  # Get last 2 persona messages
                break
    
    # Get what moderator said last
    moderator_last_message = None
    for entry in reversed(conversation):
        if entry.get('role') == 'Moderator':
            moderator_last_message = entry.get('content', '')
            break
    
    display_name = persona_name.replace('_', ' ').title()
    formatted += f"\nJouw beurt ({display_name}).\n"
    
    # Encourage reacting to other personas, not just moderator
    if recent_persona_messages:
        formatted += "\n**BELANGRIJK - Reageer op andere experts:**\n"
        for msg in recent_persona_messages:
            formatted += f"- {msg['role']} zei: \"{msg['content']}{'...' if len(msg['content']) >= 150 else ''}\"\n"
        formatted += "\n**Reageer direct op wat andere experts hebben gezegd.** Noem ze bij naam, beantwoord hun vragen, of bouw voort op hun punten.\n"
    elif moderator_last_message:
        formatted += f"\nDe moderator vroeg/zei: \"{moderator_last_message[:100]}{'...' if len(moderator_last_message) > 100 else ''}\"\n"
        formatted += "Reageer op de moderator's vraag, maar ook op wat andere experts hebben gezegd als dat relevant is.\n"
    else:
        formatted += "Reageer zakelijk en direct op wat anderen hebben gezegd.\n"
    
    formatted += "\nBELANGRIJK:"
    formatted += "\n- **Reageer op andere experts**: Noem ze bij naam, beantwoord hun vragen, of bouw voort op hun punten"
    formatted += "\n- **Dit is een gesprek**: Iedereen reageert op elkaar, niet alleen op de moderator"
    formatted += "\n- Redeneer vanuit jouw eigen standpunt en expertise"
    formatted += "\n- Bespreek de kandidaat MET andere experts (niet tegen de kandidaat)"
    formatted += "\n- Houd berichten kort (1-2 zinnen, max 3)"
    formatted += "\n- Hoge informatiedichtheid: direct, zakelijk, geen beleefdheden"
    formatted += "\n- Voeg nieuwe perspectieven toe of verdiep punten die anderen hebben gemaakt"
    
    if company_note_mentioned:
        formatted += "\n- **KRITIEK**: Bedrijfsnotitie-informatie (salaris, beschikbaarheid) is AL besproken."
        formatted += "\n- **VERBODEN**: Noem deze details NIET MEER."
        formatted += "\n- **VERPLICHT**: Focus op andere aspecten: vaardigheden, ervaring, risico's, conclusies."
    else:
        formatted += "\n- Bedrijfsnotitie-informatie mag EEN KEER genoemd worden als relevant"
    
    formatted += "\n- Voorkom herhaling - focus op nieuwe perspectieven of verdieping"
    formatted += "\n- **Als iemand een vraag stelt of een punt maakt, reageer daarop**"
    formatted += "\n- Werk naar eindbeslissing: afwijzen, geschikt, of verdere evaluatie"
    formatted += "\n- Geef GEEN scores of formele evaluaties - alleen zakelijke discussie"
    
    return formatted


def get_conversation_status(conversation: List[Dict[str, str]], persona_names: List[str]) -> str:
    """Get a summary of conversation status for orchestrator"""
    if not conversation:
        return "Je start het debat. De evaluaties zijn al gedaan. Stel een gerichte vraag over een specifiek aspect (bijv. risico's, ervaring, cultuurfit, technische vaardigheden) om de discussie te starten. Vraag NIET om eerste indrukken of herhaling van evaluatie-resultaten."
    
    # Count messages per persona and moderator
    message_counts = {}
    moderator_count = 0
    for entry in conversation:
        role = entry.get('role', '')
        if role == 'Moderator':
            moderator_count += 1
        elif role and role != 'Moderator':
            message_counts[role] = message_counts.get(role, 0) + 1
    
    total_messages = len(conversation)
    persona_count = len(persona_names)
    
    # Determine phase of conversation
    if moderator_count == 1:
        # Just after opening, personas should have responded
        if total_messages <= persona_count + 1:
            status = "Personas hebben net hun eerste perspectief gedeeld. Verdiep de discussie door te vragen naar specifieke aspecten, risico's, of tegenstrijdigheden tussen de perspectieven."
        else:
            status = "Eerste ronde is compleet. Stuur de discussie naar verdieping: vraag naar details, risico's, of aspecten die nog niet goed besproken zijn."
    elif moderator_count == 2:
        status = "Tweede ronde van discussie. Verdiep door te focussen op belangrijke verschillen, risico's, of aspecten die consensus vereisen."
    elif moderator_count == 3:
        status = "Laatste ronde. Werk naar een conclusie: vraag om definitieve standpunten en begeleid naar een eindbeslissing (afwijzen, geschikt, of verdere evaluatie)."
    else:
        # Final moderator turn - time for conclusion
        status = "Het debat is compleet. Geef een duidelijke samenvatting met eindbeslissing: afwijzen, geschikt, of verdere evaluatie nodig."
    
    # Get key topics from recent messages
    if total_messages >= 3:
        recent_messages = conversation[-3:]
        status += f" Laatste berichten gaan over: {', '.join([msg.get('content', '')[:40] + '...' for msg in recent_messages])}"
    
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
    
    # Invoke LLM with error handling
    try:
        chain = prompt_template | llm
        result = await chain.ainvoke({"conversation_context": conversation_context})
    except Exception as e:
        print(f"Error invoking persona {persona_name}: {str(e)}")
        import traceback
        traceback.print_exc()
        # Return a fallback message
        return {
            'speaker': persona_name,
            'message': f"Er is een fout opgetreden bij het genereren van een reactie voor {persona_name.replace('_', ' ').title()}. Probeer het opnieuw."
        }
    
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
    
    # Invoke LLM with error handling
    try:
        chain = prompt_template | llm
        result = await chain.ainvoke({"conversation_status": conversation_status})
    except Exception as e:
        print(f"Error invoking orchestrator: {str(e)}")
        import traceback
        traceback.print_exc()
        # Return a fallback message
        return {
            'speaker': 'Moderator',
            'message': "Er is een fout opgetreden bij het begeleiden van het debat. Probeer het opnieuw."
        }
    
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
    
    # Invoke LLM with error handling
    try:
        chain = prompt_template | llm
        result = await chain.ainvoke({"conversation_status": conversation_status})
    except Exception as e:
        print(f"Error invoking orchestrator summary: {str(e)}")
        import traceback
        traceback.print_exc()
        # Return a fallback message
        return {
            'speaker': 'Moderator',
            'message': "Er is een fout opgetreden bij het genereren van de samenvatting. Probeer het opnieuw."
        }
    
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
    company_note: Optional[str] = None,
    track_timing: bool = True
) -> Tuple[str, Dict[str, Any]]:
    """
    Run a structured turn-based debate and return JSON format with timing data
    
    Args:
        persona_prompts: Dict mapping persona names to their system prompts
        candidate_info: Candidate CV and motivation letter
        job_info: Job posting details
        company_note: Optional company guidance
        track_timing: Whether to track timing for each step
    
    Returns:
        Tuple of (JSON string array, timing data dict)
    """
    
    openai_api_key = os.getenv("OPENAI_API_KEY")
    if not openai_api_key:
        raise ValueError("OPENAI_API_KEY not found in environment")
    
    persona_names = list(persona_prompts.keys())
    
    if len(persona_names) == 0:
        raise ValueError("No personas provided for debate")
    
    # Initialize conversation messages list
    conversation: List[Dict[str, str]] = []
    
    # Initialize timing tracking
    timing_data = {
        'start_time': time.time(),
        'steps': [],
        'total': 0
    }
    
    # IMPROVED conversation flow: Interactive discussion with moderator guiding
    # Flow: Moderator → Personas (parallel) → Moderator → Personas → ... → Moderator Conclusion
    # Target: ~10-14 messages with proper discussion
    
    print(f"\n=== DEBAT START ===\nPersonas: {', '.join(persona_names)}")
    print(f"Start time: {timing_data['start_time']}")
    
    # 1. Moderator opens the debate - Sets the topic and asks for perspectives
    print("  → Moderator opent debat...")
    step_start = time.time()
    entry = await invoke_orchestrator(persona_names, candidate_info, job_info, conversation, company_note)
    step_time = time.time() - step_start
    conversation.append({"role": "Moderator", "content": entry['message']})
    if track_timing:
        timing_data['steps'].append({
            'step': 'moderator_opening',
            'agent': 'Moderator',
            'duration': round(step_time, 2),
            'timestamp': step_start
        })
        print(f"  ✓ Moderator opening ({step_time:.2f}s)")
    
    # 2. Round 1: Personas respond to moderator's opening - PARALLELIZED
    # Each persona shares their perspective (NOT initial impressions - they already evaluated)
    print(f"  → Round 1: {len(persona_names)} personas reageren vanuit hun perspectief (parallel)...")
    step_start = time.time()
    async def get_persona_response(persona_name):
        entry = await invoke_persona(
            persona_name,
            persona_prompts[persona_name],
            candidate_info,
            job_info,
            conversation.copy(),
            company_note
        )
        display_name = persona_name.replace('_', ' ').title()
        return {"role": display_name, "content": entry['message']}
    
    round1_responses = await asyncio.gather(*[get_persona_response(pn) for pn in persona_names])
    step_time = time.time() - step_start
    conversation.extend(round1_responses)
    if track_timing:
        timing_data['steps'].append({
            'step': 'personas_round1',
            'agents': persona_names,
            'duration': round(step_time, 2),
            'timestamp': step_start,
            'parallel': True
        })
        print(f"  ✓ Round 1 complete ({step_time:.2f}s)")
    
    # 3. Moderator responds and guides discussion deeper
    print("  → Moderator begeleidt discussie...")
    step_start = time.time()
    entry = await invoke_orchestrator(persona_names, candidate_info, job_info, conversation, company_note)
    step_time = time.time() - step_start
    conversation.append({"role": "Moderator", "content": entry['message']})
    if track_timing:
        timing_data['steps'].append({
            'step': 'moderator_guidance',
            'agent': 'Moderator',
            'duration': round(step_time, 2),
            'timestamp': step_start
        })
        print(f"  ✓ Moderator guidance ({step_time:.2f}s)")
    
    # 4. Round 2: Personas discuss and respond to each other - PARALLELIZED
    print(f"  → Round 2: {len(persona_names)} personas discussiëren (parallel)...")
    step_start = time.time()
    round2_responses = await asyncio.gather(*[get_persona_response(pn) for pn in persona_names])
    step_time = time.time() - step_start
    conversation.extend(round2_responses)
    if track_timing:
        timing_data['steps'].append({
            'step': 'personas_round2',
            'agents': persona_names,
            'duration': round(step_time, 2),
            'timestamp': step_start,
            'parallel': True
        })
        print(f"  ✓ Round 2 complete ({step_time:.2f}s)")
    
    # 5. Moderator deepens discussion or asks for specific aspects
    print("  → Moderator verdiept discussie...")
    step_start = time.time()
    entry = await invoke_orchestrator(persona_names, candidate_info, job_info, conversation, company_note)
    step_time = time.time() - step_start
    conversation.append({"role": "Moderator", "content": entry['message']})
    if track_timing:
        timing_data['steps'].append({
            'step': 'moderator_deepening',
            'agent': 'Moderator',
            'duration': round(step_time, 2),
            'timestamp': step_start
        })
        print(f"  ✓ Moderator deepening ({step_time:.2f}s)")
    
    # 6. Round 3: Personas give final reasoning - PARALLELIZED
    print(f"  → Round 3: {len(persona_names)} personas geven laatste redenering (parallel)...")
    step_start = time.time()
    round3_responses = await asyncio.gather(*[get_persona_response(pn) for pn in persona_names])
    step_time = time.time() - step_start
    conversation.extend(round3_responses)
    if track_timing:
        timing_data['steps'].append({
            'step': 'personas_round3',
            'agents': persona_names,
            'duration': round(step_time, 2),
            'timestamp': step_start,
            'parallel': True
        })
        print(f"  ✓ Round 3 complete ({step_time:.2f}s)")
    
    # Final: Moderator provides final summary and conclusion
    print("  → Moderator geeft samenvatting en conclusie...")
    step_start = time.time()
    entry = await invoke_orchestrator_summary(persona_names, candidate_info, job_info, conversation, company_note)
    step_time = time.time() - step_start
    conversation.append({"role": "Moderator", "content": entry['message']})
    if track_timing:
        timing_data['steps'].append({
            'step': 'moderator_final_summary',
            'agent': 'Moderator',
            'duration': round(step_time, 2),
            'timestamp': step_start
        })
        print(f"  ✓ Moderator final summary ({step_time:.2f}s)")
    
    # Calculate total time
    timing_data['total'] = round(time.time() - timing_data['start_time'], 2)
    timing_data['end_time'] = time.time()
    
    # Return as JSON string
    json_output = json.dumps(conversation, ensure_ascii=False, indent=2)
    
    print(f"\n=== DEBAT VOLTOOID ===")
    print(f"Totaal aantal berichten: {len(conversation)}")
    print(f"Totale tijd: {timing_data['total']}s")
    print(f"Aantal stappen: {len(timing_data.get('steps', []))}")
    print(f"Timing data keys: {list(timing_data.keys())}")
    print(f"First step: {timing_data.get('steps', [{}])[0] if timing_data.get('steps') else 'None'}")
    
    return json_output, timing_data

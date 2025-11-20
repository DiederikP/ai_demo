'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import ProtectedRoute from '../../../../components/ProtectedRoute';
import CompanyNavigation from '../../../../components/CompanyNavigation';
import LLMJudge from '../../../../components/LLMJudge';

interface EvaluationResult {
  id: string;
  candidate_id: string;
  job_id: string;
  result_type: 'evaluation' | 'debate';
  selected_personas: string[];
  company_note?: string;
  created_at: string;
  updated_at?: string;
  result_data: any;
  candidate_name?: string;
  job_title?: string;
}

interface Persona {
  id: string;
  name: string;
  display_name: string;
  system_prompt: string;
}

export default function ResultDetailPage() {
  const params = useParams();
  const router = useRouter();
  const resultId = params.resultId as string;
  
  const [result, setResult] = useState<EvaluationResult | null>(null);
  const [relatedResults, setRelatedResults] = useState<EvaluationResult[]>([]);
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'evaluation' | 'debate' | 'judge'>('evaluation');

  useEffect(() => {
    loadResult();
    loadPersonas();
  }, [resultId]);

  useEffect(() => {
    if (result) {
      loadRelatedResults();
    }
  }, [result]);

  const loadResult = async () => {
    try {
      const response = await fetch(`/api/evaluation-results/${resultId}`);
      if (response.ok) {
        const data = await response.json();
        let payload = data.result || data;
        if (payload?.result_data && typeof payload.result_data === 'string') {
          try {
            payload.result_data = JSON.parse(payload.result_data);
          } catch {
            // leave as string
          }
        }
        if (payload?.selected_personas && typeof payload.selected_personas === 'string') {
          try {
            payload.selected_personas = JSON.parse(payload.selected_personas);
          } catch {
            payload.selected_personas = [];
          }
        }
        setResult(payload);
        
        // Load candidate and job names
        if (data.result?.candidate_id) {
          const candidateRes = await fetch(`/api/candidates?job_id=${data.result.job_id}`);
          if (candidateRes.ok) {
            const candidateData = await candidateRes.json();
            const candidate = candidateData.candidates?.find((c: any) => c.id === data.result.candidate_id);
            if (candidate) {
              setResult(prev => prev ? { ...prev, candidate_name: candidate.name } : null);
            }
          }
        }
      }
    } catch (error) {
      console.error('Error loading result:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadPersonas = async () => {
    try {
      const response = await fetch('/api/personas');
      if (response.ok) {
        const data = await response.json();
        setPersonas(data.personas || []);
      }
    } catch (error) {
      console.error('Error loading personas:', error);
    }
  };

  const loadRelatedResults = async () => {
    if (!result) return;
    try {
      // Load all results for this candidate and job
      const response = await fetch(`/api/evaluation-results?candidate_id=${result.candidate_id}&job_id=${result.job_id}`);
      if (response.ok) {
        const data = await response.json();
        const allResults = (data.results || []).filter((r: EvaluationResult) => r.id !== result.id);
        setRelatedResults(allResults);
        
        // Always default to evaluation tab if available, otherwise debate
        const hasEvaluation = result.result_type === 'evaluation' || allResults.some((r: EvaluationResult) => r.result_type === 'evaluation');
        if (hasEvaluation) {
          setActiveTab('evaluation');
        } else {
          setActiveTab('debate');
        }
      }
    } catch (error) {
      console.error('Error loading related results:', error);
    }
  };

  if (isLoading) {
    return <div className="text-center py-12">Laden...</div>;
  }

  if (!result) {
    return (
      <div className="text-center py-12">
        <p className="text-barnes-dark-gray mb-4">Resultaat niet gevonden</p>
        <Link href="/company/dashboard" className="btn-primary">
          Terug naar Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-barnes-light-gray">
      <CompanyNavigation activeModule="resultaten" onModuleChange={(module) => {
        if (module === 'resultaten') {
          router.push('/company/dashboard?module=resultaten');
        } else {
          router.push(`/company/dashboard?module=${module}`);
        }
      }} />
      <div className="p-4 md:p-8 transition-all duration-300" style={{ marginLeft: 'var(--nav-width, 16rem)' }}>
        <div className="max-w-7xl mx-auto">
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <button
                onClick={() => router.push('/company/dashboard?module=resultaten')}
                className="text-barnes-violet hover:text-barnes-dark-violet flex items-center gap-2"
              >
                <span>←</span>
                <span>Terug naar Resultaten</span>
              </button>
              <button
                onClick={async () => {
                  if (confirm('Weet u zeker dat u dit resultaat wilt verwijderen?')) {
                    try {
                      const response = await fetch(`/api/evaluation-results/${resultId}`, {
                        method: 'DELETE'
                      });
                      
                      if (response.ok) {
                        const result = await response.json();
                        if (result.success) {
                          router.push('/company/dashboard?module=resultaten');
                        } else {
                          alert(`Fout bij verwijderen: ${result.error || result.message || 'Onbekende fout'}`);
                        }
                      } else {
                        let errorMessage = 'Onbekende fout';
                        try {
                          const error = await response.json();
                          errorMessage = error.error || error.detail || error.message || JSON.stringify(error);
                        } catch (e) {
                          const errorText = await response.text();
                          errorMessage = errorText || `HTTP ${response.status}: ${response.statusText}`;
                        }
                        console.error('Delete error response:', response.status, errorMessage);
                        alert(`Fout bij verwijderen: ${errorMessage}`);
                      }
                    } catch (error: any) {
                      console.error('Error deleting result:', error);
                      alert(`Fout bij verwijderen: ${error.message || 'Onbekende fout'}`);
                    }
                  }
                }}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Verwijderen
              </button>
            </div>
            <h1 className="text-3xl font-bold text-barnes-dark-violet mb-2">
              {result.result_type === 'evaluation' ? 'Evaluatie Resultaat' : 'Expert Debat Resultaat'}
            </h1>
            
            {/* Tabs - Evaluation, Debate, and LLM Judge */}
            {(() => {
              const hasEvaluation = result.result_type === 'evaluation' || relatedResults.some(r => r.result_type === 'evaluation');
              const hasDebate = result.result_type === 'debate' || relatedResults.some(r => r.result_type === 'debate');
              
              // Always show tabs if we have evaluation or debate (judge is always available)
              if (hasEvaluation || hasDebate) {
                return (
                  <div className="flex gap-2 mt-4 border-b border-gray-200">
                    {hasEvaluation && (
                      <button
                        onClick={() => setActiveTab('evaluation')}
                        className={`px-4 py-2 font-medium transition-colors ${
                          activeTab === 'evaluation'
                            ? 'text-barnes-violet border-b-2 border-barnes-violet'
                            : 'text-barnes-dark-gray hover:text-barnes-violet'
                        }`}
                      >
                        Evaluatie
                      </button>
                    )}
                    {hasDebate && (
                      <button
                        onClick={() => setActiveTab('debate')}
                        className={`px-4 py-2 font-medium transition-colors ${
                          activeTab === 'debate'
                            ? 'text-barnes-violet border-b-2 border-barnes-violet'
                            : 'text-barnes-dark-gray hover:text-barnes-violet'
                        }`}
                      >
                        Debat
                      </button>
                    )}
                    <button
                      onClick={() => setActiveTab('judge')}
                      className={`px-4 py-2 font-medium transition-colors ${
                        activeTab === 'judge'
                          ? 'text-barnes-violet border-b-2 border-barnes-violet'
                          : 'text-barnes-dark-gray hover:text-barnes-violet'
                      }`}
                    >
                      LLM Judge
                    </button>
                  </div>
                );
              }
              return null;
            })()}
            <p className="text-barnes-dark-gray text-lg">
              {result.candidate_name || 'Kandidaat'} - {result.job_title || 'Vacature'}
            </p>
            <p className="text-sm text-barnes-dark-gray mt-1">
              {new Date(result.created_at).toLocaleDateString('nl-NL', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </p>
          </div>

      {/* Show current result or switch based on tab - Evaluation is main view, Debate is tab inside */}
      {(() => {
        let displayResult = result;
        if (activeTab === 'evaluation') {
          // Show evaluation result (current if evaluation, or find related evaluation)
          if (result.result_type === 'evaluation') {
            displayResult = result;
          } else {
            const evalResult = relatedResults.find(r => r.result_type === 'evaluation');
            if (evalResult) displayResult = evalResult;
          }
        } else if (activeTab === 'debate') {
          // Show debate result (current if debate, or find related debate)
          if (result.result_type === 'debate') {
            displayResult = result;
          } else {
            const debateResult = relatedResults.find(r => r.result_type === 'debate');
            if (debateResult) displayResult = debateResult;
          }
        } else if (activeTab === 'judge') {
          // Show LLM Judge - use current result (either evaluation or debate)
          displayResult = result;
        }
        
        if (displayResult?.result_type === 'evaluation' && displayResult.result_data?.evaluations) {
          return (
            <div className="space-y-8">
          {/* Combined Analysis - Enhanced Visual */}
          {displayResult.result_data.combined_analysis && (
            <div className="bg-gradient-to-br from-barnes-violet/5 to-barnes-orange/5 rounded-2xl shadow-lg border-2 border-barnes-violet/20 p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-full bg-barnes-violet flex items-center justify-center">
                  <span className="text-white font-bold text-xl">📊</span>
                </div>
                <h2 className="text-3xl font-bold text-barnes-dark-violet">Totaalanalyse</h2>
              </div>
              
              {displayResult.result_data.combined_score && (
                <div className="mb-6">
                  <div className="inline-flex items-center gap-4 px-6 py-4 bg-white rounded-xl shadow-md">
                    <div className="text-center">
                      <div className="text-4xl font-bold text-barnes-violet">
                        {displayResult.result_data.combined_score.toFixed(1)}
                      </div>
                      <div className="text-sm text-barnes-dark-gray">/ 10</div>
                    </div>
                    <div className="h-16 w-1 bg-gray-200"></div>
                    <div className="flex-1">
                      <div className="text-sm text-barnes-dark-gray mb-1">Eindadvies</div>
                      <div className="text-lg font-semibold text-barnes-dark-violet">
                        {displayResult.result_data.combined_recommendation || 'Geen advies beschikbaar'}
                      </div>
                    </div>
                  </div>
                </div>
              )}
              
              <div className="bg-white/80 rounded-xl p-6 backdrop-blur-sm">
                <p className="text-barnes-dark-gray text-lg leading-relaxed whitespace-pre-wrap">
                  {displayResult.result_data.combined_analysis}
                </p>
              </div>
            </div>
          )}

          {/* Individual Evaluations - Enhanced Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {Object.entries(displayResult.result_data.evaluations).map(([personaName, evaluation]: [string, any]) => {
              const persona = personas.find(p => p.name === personaName);
              const displayName = persona?.display_name || personaName.replace('_', ' ').replace(/\b\w/g, (l: string) => l.toUpperCase());
              
              // Determine recommendation color
              const recColor = evaluation.recommendation?.includes('Sterk') || evaluation.recommendation?.includes('uitnodigen')
                ? 'text-green-700 bg-green-50 border-green-200'
                : evaluation.recommendation?.includes('Twijfel')
                ? 'text-yellow-700 bg-yellow-50 border-yellow-200'
                : 'text-red-700 bg-red-50 border-red-200';
              
              return (
                <div key={personaName} className="bg-white rounded-2xl shadow-md border border-gray-200 p-6 hover:shadow-lg transition-shadow">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-14 h-14 rounded-full bg-barnes-violet/10 flex items-center justify-center">
                      <span className="text-2xl font-bold text-barnes-violet">
                        {displayName[0]}
                      </span>
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-barnes-dark-violet">{displayName}</h3>
                      <p className="text-sm text-barnes-dark-gray">Expert Evaluatie</p>
                    </div>
                  </div>
                  
                  {evaluation.score && (
                    <div className="mb-6">
                      <div className="flex items-baseline gap-2 mb-2">
                        <span className="text-3xl font-bold text-barnes-violet">
                          {evaluation.score}
                        </span>
                        <span className="text-lg text-barnes-dark-gray">/ 10</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-3">
                        <div 
                          className="bg-barnes-violet h-3 rounded-full transition-all duration-500"
                          style={{ width: `${(evaluation.score / 10) * 100}%` }}
                        ></div>
                      </div>
                    </div>
                  )}
                  
                  {evaluation.analysis && (
                    <div className="mb-6">
                      <h4 className="text-sm font-semibold text-barnes-dark-violet mb-3">Analyse</h4>
                      <p className="text-barnes-dark-gray leading-relaxed whitespace-pre-wrap">
                        {evaluation.analysis}
                      </p>
                    </div>
                  )}
                  
                  {evaluation.recommendation && (
                    <div className={`p-4 rounded-xl border-2 ${recColor}`}>
                      <div className="text-sm font-semibold mb-1">Advies</div>
                      <div className="text-base font-medium">{evaluation.recommendation}</div>
                    </div>
                  )}
                  
                  {evaluation.big_hits && (
                    <div className="mt-4 p-4 bg-green-50 rounded-xl border border-green-200">
                      <h4 className="text-sm font-semibold text-green-700 mb-2 flex items-center gap-2">
                        <span>✅</span> Grote Matches
                      </h4>
                      <p className="text-sm text-green-800">{evaluation.big_hits}</p>
                    </div>
                  )}
                  
                  {evaluation.big_misses && (
                    <div className="mt-4 p-4 bg-red-50 rounded-xl border border-red-200">
                      <h4 className="text-sm font-semibold text-red-700 mb-2 flex items-center gap-2">
                        <span>⚠️</span> Aandachtspunten
                      </h4>
                      <p className="text-sm text-red-800">{evaluation.big_misses}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
            </div>
          );
        }
        
        // Show debate if activeTab is debate
        if (activeTab === 'debate') {
          if (displayResult?.result_type === 'debate' && displayResult.result_data?.debate) {
            return (
              <DebateView 
                resultId={displayResult.id}
                debate={displayResult.result_data.debate} 
                fullPrompt={displayResult.result_data.full_prompt}
                companyNote={displayResult.company_note}
                selectedPersonas={Array.isArray(displayResult.selected_personas) ? displayResult.selected_personas : []}
                personas={personas}
              />
            );
          }
          // Also check related results for debate
          const debateResult = relatedResults.find(r => r.result_type === 'debate');
          if (debateResult?.result_data?.debate) {
            return (
              <DebateView 
                resultId={debateResult.id}
                debate={debateResult.result_data.debate} 
                fullPrompt={debateResult.result_data.full_prompt}
                companyNote={debateResult.company_note}
                selectedPersonas={Array.isArray(debateResult.selected_personas) ? debateResult.selected_personas : []}
                personas={personas}
              />
            );
          }
        }
        
        return null;
      })()}

      {/* Render content based on active tab */}
      {(() => {
        // LLM Judge Tab
        if (activeTab === 'judge') {
          return (
            <div className="space-y-8">
              <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
                <h2 className="text-2xl font-semibold text-barnes-dark-violet mb-4">LLM Judge</h2>
                <p className="text-barnes-dark-gray mb-6">
                  Beoordeelt de performance van de digitale werknemers (agents), niet de kandidaat evaluatie. De judge analyseert hoe goed de agents hebben gefunctioneerd, toont hoe vergelijkbare inputs vergelijkbare outputs geven, en geeft aanbevelingen voor verbetering van de agent performance.
                </p>
                <LLMJudge resultId={resultId} />
              </div>
            </div>
          );
        }
        
        // Evaluation and Debate Tabs
        let displayResult = result;
        if (activeTab === 'evaluation') {
          if (result.result_type === 'evaluation') {
            displayResult = result;
          } else {
            const evalResult = relatedResults.find(r => r.result_type === 'evaluation');
            if (evalResult) displayResult = evalResult;
          }
        } else if (activeTab === 'debate') {
          if (result.result_type === 'debate') {
            displayResult = result;
          } else {
            const debateResult = relatedResults.find(r => r.result_type === 'debate');
            if (debateResult) displayResult = debateResult;
          }
        }
        
        if (displayResult?.result_type === 'debate' && displayResult.result_data?.debate) {
          return (
            <DebateView 
              resultId={displayResult.id}
              debate={displayResult.result_data.debate} 
              fullPrompt={displayResult.result_data.full_prompt}
              companyNote={displayResult.company_note}
              selectedPersonas={Array.isArray(displayResult.selected_personas) ? displayResult.selected_personas : []}
              personas={personas}
            />
          );
        }
        
        // Evaluation view (already handled above in the first block)
        return null;
      })()}
        </div>
      </div>
    </div>
  );
}

function DebateView({ 
  resultId,
  debate, 
  fullPrompt, 
  companyNote, 
  selectedPersonas, 
  personas 
}: { 
  resultId: string;
  debate: any; 
  fullPrompt?: string; 
  companyNote?: string; 
  selectedPersonas: string[];
  personas: Persona[];
}) {
  // Parse debate transcript - handle both JSON array and plain text string
  let conversation: Array<{ role: string; content: string }> = [];
  let debateText: string = '';
  
  try {
    if (typeof debate === 'string') {
      // Try to parse as JSON first (for LangChain format)
      try {
        const parsed = JSON.parse(debate);
        if (Array.isArray(parsed)) {
          conversation = parsed;
        } else {
          // If it's a JSON object, extract the debate text
          debateText = typeof parsed === 'string' ? parsed : debate;
        }
      } catch {
        // If JSON parsing fails, treat as plain text (markdown format)
        debateText = debate;
      }
    } else if (Array.isArray(debate)) {
      conversation = debate;
    } else if (debate && typeof debate === 'object') {
      // If debate is an object, try to extract text
      debateText = debate.toString();
    }
  } catch (e) {
    console.warn('Debate transcript parsing error:', e);
    debateText = typeof debate === 'string' ? debate : String(debate || '');
  }

  // Convert to messages format - match marketing page logic
  const messages: Array<{ speaker: string; text: string; isOrchestrator: boolean; personaName: string }> = [];
  
  // If we have a conversation array, process it
  if (conversation.length > 0) {
    conversation.forEach((msg) => {
      const role = msg.role || 'Unknown';
      let content = msg.content || '';
      if (!content || !content.trim()) return;
      
      const isOrchestrator = role.toLowerCase() === 'moderator';
      messages.push({
        speaker: role,
        text: content.trim(),
        isOrchestrator,
        personaName: role
      });
    });
  } else if (debateText) {
    // If we have plain text, parse it into messages by looking for persona markers
    // Format: **Persona Name:** content
    const lines = debateText.split('\n');
    let currentSpeaker = 'Moderator';
    let currentContent: string[] = [];
    
    lines.forEach((line) => {
      const trimmedLine = line.trim();
      // Match patterns like: **Jan (Hiring Manager):** or **Persona Name:**
      // Try multiple patterns to catch different formats
      let personaMatch = trimmedLine.match(/^\*\*([^*]+?)\*\*:?\s*(.*)$/);
      if (!personaMatch) {
        // Try without colon
        personaMatch = trimmedLine.match(/^\*\*([^*]+?)\*\*$/);
      }
      
      if (personaMatch) {
        // Save previous message
        if (currentContent.length > 0 || currentSpeaker !== 'Moderator') {
          const text = currentContent.join('\n').trim();
          if (text) {
            messages.push({
              speaker: currentSpeaker,
              text: text,
              isOrchestrator: currentSpeaker.toLowerCase().includes('moderator'),
              personaName: currentSpeaker
            });
          }
        }
        // Start new message
        currentSpeaker = personaMatch[1].trim().replace(/:\s*$/, '');
        // Get content after the colon if present
        const immediateContent = personaMatch[2] ? personaMatch[2].trim() : '';
        currentContent = immediateContent ? [immediateContent] : [];
      } else if (trimmedLine) {
        // Continue current message
        currentContent.push(trimmedLine);
      }
    });
    
    // Add last message
    if (currentContent.length > 0) {
      const text = currentContent.join('\n').trim();
      if (text) {
        messages.push({
          speaker: currentSpeaker,
          text: text,
          isOrchestrator: currentSpeaker.toLowerCase().includes('moderator'),
          personaName: currentSpeaker
        });
      }
    }
    
    // If parsing didn't work, try splitting by double newlines or other patterns
    if (messages.length === 0 && debateText.trim()) {
      // Fallback: split by double newlines or try to find any structure
      const sections = debateText.split(/\n\n+/);
      sections.forEach((section, idx) => {
        const trimmed = section.trim();
        if (trimmed) {
          // Try to extract speaker from first line
          const firstLineMatch = trimmed.match(/^\*\*([^*]+?)\*\*:?\s*(.*)$/m);
          if (firstLineMatch) {
            const speaker = firstLineMatch[1].trim();
            const content = trimmed.replace(/^\*\*[^*]+\*\*:?\s*/, '').trim();
            if (content) {
              messages.push({
                speaker: speaker,
                text: content,
                isOrchestrator: speaker.toLowerCase().includes('moderator'),
                personaName: speaker
              });
            }
          } else {
            // No clear speaker, add as generic message
            messages.push({
              speaker: `Bericht ${idx + 1}`,
              text: trimmed,
              isOrchestrator: false,
              personaName: `Bericht ${idx + 1}`
            });
          }
        }
      });
    }
    
    // Final fallback: show raw text if still no messages
    if (messages.length === 0) {
      messages.push({
        speaker: 'Debate',
        text: debateText,
        isOrchestrator: false,
        personaName: 'Debate'
      });
    }
  }

  // Get persona colors - match marketing page
  const getPersonaColor = (personaName: string, isModerator: boolean) => {
    if (isModerator) return 'violet';
    const lowerName = personaName.toLowerCase();
    if (lowerName.includes('hiring') || lowerName.includes('manager')) return 'blue';
    if (lowerName.includes('bureau') || (lowerName.includes('recruiter') && !lowerName.includes('hr'))) return 'green';
    if (lowerName.includes('hr') || lowerName.includes('inhouse')) return 'gray';
    return 'orange';
  };

  const [chatMessages, setChatMessages] = useState<
    Array<{ role: 'user' | 'assistant'; content: string; persona?: string }>
  >([]);
  const [chatInput, setChatInput] = useState('');
  const [chatPersona, setChatPersona] = useState<string>('all');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);

  const personaOptions = selectedPersonas
    .map(name => {
      const persona = personas.find(p => p.name === name);
      return { id: name, label: persona?.display_name || name };
    });

  const handleSendChat = async () => {
    if (!chatInput.trim()) return;
    const question = chatInput.trim();
    setChatInput('');
    setChatError(null);

    setChatMessages(prev => [
      ...prev,
      { role: 'user', content: question, persona: chatPersona === 'all' ? undefined : chatPersona },
    ]);

    setIsChatLoading(true);
    try {
      const response = await fetch('/api/debate-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resultId,
          question,
          personaName: chatPersona === 'all' ? null : chatPersona,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Onbekende fout' }));
        throw new Error(errorData.error || 'Kon geen antwoord ophalen');
      }

      const data = await response.json();
      setChatMessages(prev => [
        ...prev,
        { role: 'assistant', content: data.answer || '—', persona: data.persona },
      ]);
    } catch (error: any) {
      setChatError(error.message || 'Kon geen antwoord ophalen');
    } finally {
      setIsChatLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Debate Conversation */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-2xl font-semibold text-barnes-dark-violet mb-4">💬 Gesprek</h2>
        <div className="bg-gray-50 rounded-lg p-4 max-h-[600px] overflow-y-auto">
          <div className="space-y-3">
            {messages.map((msg, idx) => {
              // Improved persona matching - handle formats like "Jan (Hiring Manager)" or just "Hiring Manager"
              const speakerLower = msg.speaker.toLowerCase();
              const persona = personas.find(p => {
                const nameLower = p.name.toLowerCase();
                const displayLower = p.display_name.toLowerCase();
                // Direct matches
                if (speakerLower.includes(nameLower) || speakerLower.includes(displayLower)) return true;
                // Extract name from "Jan (Hiring Manager)" format
                const nameMatch = speakerLower.match(/^([^(]+)/);
                if (nameMatch && (nameMatch[1].trim() === nameLower || nameMatch[1].trim() === displayLower)) return true;
                // Extract display name from parentheses
                const displayMatch = speakerLower.match(/\(([^)]+)\)/);
                if (displayMatch && (displayMatch[1].trim() === displayLower || displayMatch[1].trim() === nameLower)) return true;
                // Check if first word matches
                const firstWord = speakerLower.split(' ')[0];
                if (firstWord === nameLower || firstWord === displayLower) return true;
                // Check if display name contains first word of speaker
                if (displayLower.includes(firstWord) || nameLower.includes(firstWord)) return true;
                return false;
              });
              
              const isModerator = msg.isOrchestrator;
              
              // Moderator always left, personas alternate left/right
              let isRight = false;
              if (!isModerator) {
                const nonModeratorCount = messages.slice(0, idx).filter(m => !m.isOrchestrator).length;
                isRight = nonModeratorCount % 2 === 1;
              }
              
              const personaColor = getPersonaColor(msg.personaName, isModerator);
              
              // Color scheme based on persona type - match marketing page
              let bgColor = '';
              let iconBg = '';
              let textColor = '';
              
              if (isModerator) {
                bgColor = 'bg-barnes-dark-violet';
                iconBg = 'bg-barnes-dark-violet';
                textColor = 'text-white';
              } else if (personaColor === 'blue') {
                bgColor = isRight ? 'bg-blue-500' : 'bg-blue-100';
                iconBg = 'bg-blue-500';
                textColor = isRight ? 'text-white' : 'text-blue-900';
              } else if (personaColor === 'green') {
                bgColor = isRight ? 'bg-green-500' : 'bg-green-100';
                iconBg = 'bg-green-500';
                textColor = isRight ? 'text-white' : 'text-green-900';
              } else if (personaColor === 'gray') {
                bgColor = isRight ? 'bg-gray-600' : 'bg-gray-100';
                iconBg = 'bg-gray-600';
                textColor = isRight ? 'text-white' : 'text-gray-900';
              } else {
                bgColor = isRight ? 'bg-barnes-orange' : 'bg-orange-100';
                iconBg = 'bg-barnes-orange';
                textColor = isRight ? 'text-white' : 'text-orange-900';
              }
              
              const displayName = persona ? persona.display_name : msg.speaker.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase());
              
              return (
                <div
                  key={idx}
                  className={`flex ${isRight ? 'justify-end' : 'justify-start'} animate-fade-in mb-2`}
                  style={{ animationDelay: `${idx * 0.05}s` }}
                >
                  <div className={`flex items-start gap-2 max-w-[75%] ${isRight ? 'flex-row-reverse' : 'flex-row'}`}>
                    {/* Avatar */}
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${iconBg} ${textColor}`}>
                      {displayName[0].toUpperCase()}
                    </div>
                    
                    {/* Message Bubble */}
                    <div className={`rounded-2xl px-4 py-2.5 shadow-md ${bgColor} ${textColor}`}>
                      {/* Speaker Name - no timestamp */}
                      <div className={`flex items-center mb-1 ${textColor} opacity-90`}>
                        <span className="text-xs font-semibold">{displayName}</span>
                      </div>
                      {/* Message Text */}
                      <div className={`text-sm leading-relaxed whitespace-pre-wrap ${textColor}`}>
                        {msg.text}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Collapsible Sections - Less Visible, Collapsed by Default */}
      <details className="mt-4">
        <summary className="text-sm text-barnes-dark-gray cursor-pointer hover:text-barnes-dark-violet">
          📋 Technische Details (klik om te tonen)
        </summary>
        <div className="space-y-3 mt-3">
          {companyNote && (
            <div className="p-3 rounded-lg border border-barnes-violet/20 bg-barnes-violet/5">
              <details className="cursor-pointer">
                <summary className="text-xs font-medium text-barnes-dark-violet">📝 Bedrijfsnotitie</summary>
                <div className="text-xs text-barnes-dark-gray mt-2 pl-4">{companyNote}</div>
              </details>
            </div>
          )}
          
          <div className="p-3 rounded-lg border border-barnes-orange/20 bg-barnes-orange/5">
            <details className="cursor-pointer">
              <summary className="text-xs font-medium text-barnes-dark-violet">⚙️ Gebruikte Prompts</summary>
              <div className="text-xs text-barnes-dark-gray space-y-3 mt-2 pl-4">
                {selectedPersonas.map(name => {
                  const p = personas.find(pp => pp.name === name);
                  return (
                    <div key={name} className="border-l-2 border-barnes-orange pl-3">
                      <div className="font-medium text-barnes-dark-violet mb-1">{p?.display_name || name}</div>
                      <div className="text-xs">{p?.system_prompt}</div>
                    </div>
                  );
                })}
              </div>
            </details>
          </div>
          
          {fullPrompt && (
            <div className="p-3 rounded-lg border border-barnes-orange/20 bg-barnes-orange/5">
              <details className="cursor-pointer">
                <summary className="text-xs font-medium text-barnes-dark-violet">📤 Volledige Prompt Verzonden naar GPT</summary>
                <pre className="text-xs text-barnes-dark-gray whitespace-pre-wrap mt-2 p-3 bg-white rounded border overflow-auto max-h-96 pl-4">
                  {fullPrompt}
                </pre>
              </details>
            </div>
          )}
        </div>
      </details>

        {/* Chat with Personas */}
        <div className="p-4 rounded-lg border border-barnes-violet/20 bg-white shadow-sm">
          <h3 className="text-lg font-semibold text-barnes-dark-violet mb-3">
            🤝 Chat met Digitale Werknemers
          </h3>
          <div className="space-y-4">
            <div className="bg-gray-50 rounded-lg p-4 max-h-64 overflow-y-auto border border-gray-200">
              {chatMessages.length === 0 ? (
                <p className="text-sm text-barnes-dark-gray">
                  Stel een vervolgvraag aan de digitale werknemers na het debat.
                </p>
              ) : (
                <div className="space-y-3">
                  {chatMessages.map((message, idx) => (
                    <div
                      key={idx}
                      className={`p-3 rounded-xl ${message.role === 'user' ? 'bg-barnes-violet/10 text-barnes-dark-violet self-end' : 'bg-white border'} `}
                    >
                      <p className="text-xs font-semibold text-barnes-dark-gray mb-1">
                        {message.role === 'user'
                          ? 'Jij'
                          : message.persona || 'Digitale werknemer'}
                      </p>
                      <p className="text-sm text-barnes-dark-gray whitespace-pre-wrap">
                        {message.content}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex flex-col md:flex-row gap-3">
              <select
                value={chatPersona}
                onChange={(e) => setChatPersona(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-barnes-violet focus:border-transparent"
              >
                <option value="all">Alle digitale werknemers</option>
                {personaOptions.map(option => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Stel een vraag over deze kandidaat..."
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-barnes-violet focus:border-transparent"
              />
              <button
                onClick={handleSendChat}
                disabled={isChatLoading || !chatInput.trim()}
                className="btn-primary whitespace-nowrap disabled:opacity-50"
              >
                {isChatLoading ? 'Versturen...' : 'Stuur vraag'}
              </button>
            </div>
            {chatError && (
              <p className="text-sm text-red-600">{chatError}</p>
            )}
          </div>
        </div>
    </div>
  );
}


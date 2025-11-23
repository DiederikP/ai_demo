'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import ReasoningPanel from './ReasoningPanel';
import WorkflowVisualizationPopup from './WorkflowVisualizationPopup';
import { useCompany } from '../contexts/CompanyContext';
import { getAuthHeaders } from '../lib/auth';

interface JobDescription {
  id: string;
  title: string;
  company: string;
  description: string;
  requirements: string;
  location: string;
  salary_range: string;
  created_at?: string;
  is_active?: boolean;
  assigned_agency_id?: string | null;
}

interface Persona {
  id: string;
  name: string;
  display_name: string;
  system_prompt: string;
  is_active: boolean;
}

interface Candidate {
  id: string;
  name: string;
  email: string;
  job_id: string;
  created_at: string;
  conversation_count?: number;
  preferential_job_ids?: string | null;
  company_note?: string | null;
  evaluation_count?: number;
  pipeline_stage?: string;
  pipeline_status?: string;
}

export default function CompanyDashboard() {
  const [selectedJob, setSelectedJob] = useState<JobDescription | null>(null);
  const [selectedPersonas, setSelectedPersonas] = useState<string[]>([]);
  const [selectedCandidates, setSelectedCandidates] = useState<string[]>([]);
  const [selectedActions, setSelectedActions] = useState<string[]>([]); // Changed to array for multiple actions
  const [companyNote, setCompanyNote] = useState('');
  const [companyNoteFile, setCompanyNoteFile] = useState<File | null>(null);
  const [useCandidateCompanyNote, setUseCandidateCompanyNote] = useState(false);
  const [candidateSearchTerm, setCandidateSearchTerm] = useState('');
  const router = useRouter();
  
  const [jobs, setJobs] = useState<JobDescription[]>([]);
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [allCandidates, setAllCandidates] = useState<Candidate[]>([]);
  const [jobCandidates, setJobCandidates] = useState<Candidate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [conversationInsights, setConversationInsights] = useState<Record<string, { summaries: string[]; personaGuidance: Record<string, string[]> }>>({});
  const [conversationInsightsLoading, setConversationInsightsLoading] = useState<Record<string, boolean>>({});
  const [isProcessing, setIsProcessing] = useState(false);
  const [reasoningSteps, setReasoningSteps] = useState<any[]>([]);
  const [showReasoningPanel, setShowReasoningPanel] = useState(false);
  const [templates, setTemplates] = useState<any[]>([]);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [templateDescription, setTemplateDescription] = useState('');
  const [showWorkflowPopup, setShowWorkflowPopup] = useState(false);
  const [workflowTimingData, setWorkflowTimingData] = useState<any>(null);
  const [workflowDebateData, setWorkflowDebateData] = useState<any>(null);
  const [currentWorkflowStep, setCurrentWorkflowStep] = useState<string>('');

  const doesCandidateMatchJob = (candidate: Candidate, jobId?: string | null) => {
    if (!jobId) return false;
    if (candidate.job_id === jobId) return true;
    if (candidate.preferential_job_ids) {
      return candidate.preferential_job_ids
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean)
        .includes(jobId);
    }
    return false;
  };

  // Wake up backend on initial load to prevent cold start delays
  const wakeUpBackend = () => {
    try {
      // Use Next.js API route instead of direct backend call to avoid CORS issues
      // The API route will handle the backend wake-up
      fetch('/api/config', {
        method: 'GET',
        // Fire and forget - don't wait for response
      }).catch(() => {
        // Silently ignore all errors - this is just a wake-up call
      });
    } catch (error) {
      // Silently ignore - this should never block page load
    }
  };

  useEffect(() => {
    // Wake up backend first (fire and forget)
    wakeUpBackend();
    // Then load data - wrap in error handling to prevent unhandled rejections
    loadData().catch((error) => {
      console.error('Unhandled error in loadData:', error);
    });
  }, []);

  // Refresh when component becomes visible or URL changes
  useEffect(() => {
    const handleFocus = () => {
      loadData();
    };
    const handleLocationChange = () => {
      loadData();
    };
    window.addEventListener('focus', handleFocus);
    window.addEventListener('popstate', handleLocationChange);
    return () => {
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('popstate', handleLocationChange);
    };
  }, []);

  // Auto-select both actions and all personas when they become available (make evaluation more intuitive)
  useEffect(() => {
    if (personas.length > 0 && selectedPersonas.length === 0) {
      // Auto-select all active personas
      setSelectedPersonas(personas.filter(p => p.is_active).map(p => p.id));
    }
    if (selectedActions.length === 0) {
      // Auto-select both evaluate and debate actions
      setSelectedActions(['evaluate', 'debate']);
    }
  }, [personas, selectedPersonas.length, selectedActions.length]);

  useEffect(() => {
    if (!selectedJob) {
      setJobCandidates([]);
      return;
    }
    const filtered = allCandidates.filter(candidate => doesCandidateMatchJob(candidate, selectedJob.id));
    setJobCandidates(filtered);
  }, [selectedJob, allCandidates]);

  const visibleCandidates = useMemo(() => {
    if (!selectedJob) return [];
    const term = candidateSearchTerm.trim().toLowerCase();
    // Always show all candidates, but prioritize those matching the job
    // When searching, filter by search term
    // When not searching, show all candidates (not just job-matched ones)
    if (term) {
      return allCandidates.filter(candidate => {
        const nameMatch = candidate.name.toLowerCase().includes(term);
        const emailMatch = candidate.email?.toLowerCase().includes(term);
        return nameMatch || emailMatch;
      });
    }
    // When not searching, show all candidates
    return allCandidates;
  }, [candidateSearchTerm, allCandidates, selectedJob]);

  // Validation summary - must be before early return
  const validationSummary = useMemo(() => {
    const issues: string[] = [];
    const warnings: string[] = [];
    
    if (!selectedJob) issues.push('Geen vacature geselecteerd');
    if (selectedPersonas.length === 0) issues.push('Geen Digitale Werknemer(s) geselecteerd');
    if (selectedCandidates.length === 0) issues.push('Geen kandidaat(en) geselecteerd');
    if (selectedActions.length === 0) issues.push('Geen actie geselecteerd');
    
    if (selectedActions.includes('compare') && selectedCandidates.length < 2) {
      issues.push('Vergelijking vereist minimaal 2 kandidaten');
    }
    
    if (!selectedActions.includes('compare') && selectedCandidates.length > 1) {
      warnings.push('Evaluatie/debat ondersteunt slechts 1 kandidaat per keer');
    }
    
    if (selectedJob && selectedPersonas.length > 0 && selectedCandidates.length > 0 && selectedActions.length > 0) {
      const actionNames = selectedActions.map(a => {
        if (a === 'evaluate') return 'Evaluatie';
        if (a === 'debate') return 'Debat';
        if (a === 'compare') return 'Vergelijking';
        return a;
      }).join(', ');
      
      return {
        ready: true,
        summary: `${selectedCandidates.length} kandidaat(en) • ${selectedPersonas.length} Digitale Werknemer(s) • ${actionNames}`,
        issues,
        warnings
      };
    }
    
    return { ready: false, summary: '', issues, warnings };
  }, [selectedJob, selectedPersonas, selectedCandidates, selectedActions]);

  const { selectedCompany } = useCompany();
  
  const loadData = async () => {
    try {
      // Add company_id to all API calls for multi-portal filtering
      const companyParam = selectedCompany?.id ? `?company_id=${selectedCompany.id}` : '';
      
      // Get auth headers for authenticated requests
      const headers = getAuthHeaders();
      
      const [jobsRes, personasRes, candidatesRes, templatesRes] = await Promise.all([
        fetch(`/api/job-descriptions${companyParam}`, { headers }),
        fetch(`/api/personas${companyParam}`, { headers }),
        fetch(`/api/candidates${companyParam}`, { headers }),
        fetch('/api/evaluation-templates', { headers })
      ]);

      if (jobsRes.ok) {
        const jobsData = await jobsRes.json();
        console.log('[CompanyDashboard] Loaded jobs:', jobsData.jobs?.length || 0, jobsData.jobs);
        setJobs(jobsData.jobs || []);
      } else {
        console.error('[CompanyDashboard] Failed to load jobs:', jobsRes.status, jobsRes.statusText);
      }

      if (personasRes.ok) {
        const personasData = await personasRes.json();
        setPersonas(personasData.personas?.filter((p: Persona) => p.is_active) || []);
      }

      if (candidatesRes.ok) {
        const candidateData = await candidatesRes.json();
        const fetchedCandidates = candidateData.candidates || [];
        // Filter to show only recruiter-submitted candidates (have submitted_by_company_id)
        // This ensures company only sees candidates proposed by recruiters
        const recruiterCandidates = fetchedCandidates.filter((c: Candidate) => 
          (c as any).submitted_by_company_id != null
        );
        setAllCandidates(recruiterCandidates);
        if (selectedJob) {
          setJobCandidates(
            recruiterCandidates.filter((candidate: Candidate) =>
              doesCandidateMatchJob(candidate, selectedJob.id)
            )
          );
        } else {
          setJobCandidates([]);
        }
      }

      if (templatesRes.ok) {
        const templatesData = await templatesRes.json();
        setTemplates(templatesData.templates || []);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Reload data when company changes
  useEffect(() => {
    if (selectedCompany) {
      loadData();
    }
  }, [selectedCompany?.id]);

  const fetchConversationInsights = async (candidateId: string, force = false) => {
    if (!force && conversationInsights[candidateId]) return;
    if (conversationInsightsLoading[candidateId]) return;
    setConversationInsightsLoading((prev) => ({ ...prev, [candidateId]: true }));
    try {
      const jobQuery = selectedJob?.id ? `&job_id=${selectedJob.id}` : '';
      const response = await fetch(`/api/candidate-conversations?candidate_id=${candidateId}${jobQuery}`);
      if (response.ok) {
        const data = await response.json();
        const conversations = data.conversations || [];
        const summaries = conversations
          .map((conv: any) => conv.summary)
          .filter(Boolean)
          .slice(0, 3);
        const personaGuidance: Record<string, string[]> = {};
        conversations.forEach((conv: any) => {
          if (conv.persona_guidance) {
            let guidance: Record<string, string> = {};
            if (typeof conv.persona_guidance === 'string') {
              try {
                guidance = JSON.parse(conv.persona_guidance);
              } catch {
                guidance = { all: conv.persona_guidance };
              }
            } else {
              guidance = conv.persona_guidance;
            }
            Object.entries(guidance).forEach(([key, value]) => {
              if (!personaGuidance[key]) personaGuidance[key] = [];
              personaGuidance[key].push(value);
            });
          }
        });
        setConversationInsights((prev) => ({
          ...prev,
          [candidateId]: { summaries, personaGuidance },
        }));
      }
    } catch (error) {
      console.error('Error fetching conversation insights:', error);
    } finally {
      setConversationInsightsLoading((prev) => ({ ...prev, [candidateId]: false }));
    }
  };

  const loadTemplate = (templateId: string) => {
    const template = templates.find(t => t.id === templateId);
    if (!template) return;

    if (template.job_id) {
      const job = jobs.find(j => j.id === template.job_id);
      if (job) {
        setSelectedJob(job);
      }
    }

    if (Array.isArray(template.persona_ids)) {
      setSelectedPersonas(template.persona_ids.filter(Boolean));
    }

    if (Array.isArray(template.candidate_ids)) {
      setSelectedCandidates(template.candidate_ids.filter(Boolean));
    }

    if (Array.isArray(template.actions)) {
      setSelectedActions(template.actions.filter(Boolean));
    }

    if (template.company_note) {
      setCompanyNote(template.company_note);
      setUseCandidateCompanyNote(false);
      setCompanyNoteFile(null);
    }

    if (template.use_candidate_company_note) {
      setUseCandidateCompanyNote(true);
    }
  };

  const handleSaveTemplate = async () => {
    if (!templateName.trim()) {
      alert('Voer een naam in voor het template');
      return;
    }

    if (!selectedJob) {
      alert('Selecteer een vacature om als template op te slaan');
      return;
    }

    if (selectedPersonas.length === 0) {
      alert('Selecteer minimaal één Digitale Werknemer voor het template');
      return;
    }

    const formData = new FormData();
    formData.append('name', templateName.trim());
    if (templateDescription.trim()) {
      formData.append('description', templateDescription.trim());
    }
    formData.append('job_id', selectedJob.id);
    formData.append('persona_ids', JSON.stringify(selectedPersonas));
    formData.append('actions', JSON.stringify(selectedActions));
    formData.append('candidate_ids', JSON.stringify(selectedCandidates));
    formData.append('use_candidate_company_note', JSON.stringify(useCandidateCompanyNote));

    if (companyNote && !useCandidateCompanyNote) {
      formData.append('company_note', companyNote);
    }

    if (companyNoteFile && !useCandidateCompanyNote) {
      formData.append('company_note_file', companyNoteFile);
    }

    try {
      const response = await fetch('/api/evaluation-templates', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Template opslaan mislukt');
      }

      setTemplateName('');
      setTemplateDescription('');
      setShowTemplateModal(false);
      await loadData();
      alert('Template opgeslagen');
    } catch (error: any) {
      console.error('Error saving template:', error);
      alert(error.message || 'Template opslaan mislukt');
    }
  };

  const handleStartEvaluation = async () => {
    if (!selectedJob || selectedPersonas.length === 0 || selectedCandidates.length === 0 || selectedActions.length === 0) {
      alert('Selecteer een vacature, minimaal één persona, minimaal één kandidaat, en minimaal één actie');
      return;
    }

    // Check candidate selection based on action
    const isCompareSelected = selectedActions.includes('compare');
    if (isCompareSelected && selectedCandidates.length < 2) {
      alert('Voor kandidaat vergelijking moet u minimaal 2 kandidaten selecteren');
      return;
    }
    if (!isCompareSelected && selectedCandidates.length > 1) {
      alert('Voor evaluatie of debat kunt u slechts 1 kandidaat selecteren');
      return;
    }

    // Fetch conversation insights and update step
    setReasoningSteps(prev => prev.map(step => 
      step.title === 'Gespreksinzichten ophalen' 
        ? { ...step, status: 'processing' as const, content: `Ophalen van gespreksinzichten...` }
        : step
    ));
    
    await Promise.all(selectedCandidates.map((candidateId) => fetchConversationInsights(candidateId, true)));
    
    setReasoningSteps(prev => prev.map(step => 
      step.title === 'Gespreksinzichten ophalen' 
        ? { ...step, status: 'completed' as const, content: `Gespreksinzichten opgehaald voor ${selectedCandidates.length} kandidaat(en)` }
        : step
    ));

    setIsProcessing(true);
    setShowReasoningPanel(true);
    setShowWorkflowPopup(true); // Show workflow popup
    setWorkflowTimingData(null);
    setWorkflowDebateData(null);
    setCurrentWorkflowStep('Voorbereiden...');
    
    // Show detailed steps that need to be done
    const initialSteps: any[] = [
      {
        step: 1,
        title: 'Configuratie valideren',
        content: `Vacature: ${selectedJob?.title || 'Niet geselecteerd'}, ${selectedCandidates.length} kandidaat(en), ${selectedPersonas.length} digitale werknemer(s)`,
        timestamp: new Date().toLocaleTimeString('nl-NL'),
        status: 'completed' as const
      },
      {
        step: 2,
        title: 'Gespreksinzichten ophalen',
        content: `Ophalen van recente gespreksinzichten voor ${selectedCandidates.length} kandidaat(en)`,
        timestamp: new Date().toLocaleTimeString('nl-NL'),
        status: 'processing' as const
      }
    ];
    
    // Add steps for each action
    selectedActions.forEach((action, idx) => {
      initialSteps.push({
        step: initialSteps.length + 1,
        title: `${action === 'evaluate' ? 'Evaluatie' : 'Debat'} voorbereiden`,
        content: `${action === 'evaluate' ? 'Evaluatie' : 'Debat'} wordt voorbereid voor ${selectedCandidates.length} kandidaat(en)`,
        timestamp: new Date().toLocaleTimeString('nl-NL'),
        status: 'pending' as const
      });
    });
    
    setReasoningSteps(initialSteps);

    try {
      const resultIds: string[] = [];
      
      // Calculate total operations for progress tracking
      const totalOperations = selectedActions.length * selectedCandidates.length;
      let completedOperations = 0;
      
      // Process evaluation first (immediately), then debate in background (parallel)
      const hasEvaluate = selectedActions.includes('evaluate');
      const hasDebate = selectedActions.includes('debate');
      
      // Helper function to process a single action for a candidate
      const processAction = async (action: string, candidateId: string): Promise<string | null> => {
        const candidate = allCandidates.find(c => c.id === candidateId);
        if (!candidate) return null;

        const formData = new FormData();
        formData.append('candidate_id', candidateId);
        
        if (selectedJob) {
          formData.append('job_id', selectedJob.id);
        }
        
        // Add persona prompts (include conversation insights when available)
        selectedPersonas.forEach(personaId => {
          const persona = personas.find(p => p.id === personaId);
          if (persona) {
            let personaPrompt = persona.system_prompt;
            const insight = conversationInsights[candidateId];
            if (insight) {
              const lines: string[] = [];
              if (insight.summaries?.length) {
                lines.push(
                  ...insight.summaries
                    .map((summary) => summary.trim())
                    .filter(Boolean)
                    .slice(0, 3)
                );
              }
              const personaKeys = [
                persona.name,
                persona.display_name,
                persona.display_name?.toLowerCase(),
                'all',
              ].filter(Boolean) as string[];
              personaKeys.forEach((key) => {
                const notes = insight.personaGuidance[key];
                if (notes && notes.length) {
                  lines.push(...notes);
                }
              });
              if (lines.length) {
                personaPrompt += `\n\nGebruik de volgende inzichten uit recente gesprekken met de kandidaat:\n${lines
                  .map((line) => `- ${line}`)
                  .join('\n')}`;
              }
            }
            formData.append(`${persona.name}_prompt`, personaPrompt);
          }
        });

        // Use candidate's company note if checkbox is checked, otherwise use manual input
        if (useCandidateCompanyNote && candidate.company_note) {
          formData.append('company_note', candidate.company_note);
        } else if (companyNote) {
          formData.append('company_note', companyNote);
        }
        
        if (companyNoteFile && !useCandidateCompanyNote) {
          formData.append('company_note_file', companyNoteFile);
        }

        let response: Response | undefined;
        if (action === 'evaluate') {
          response = await fetch('/api/evaluate-candidate', {
            method: 'POST',
            body: formData,
          });
        } else if (action === 'debate') {
          response = await fetch('/api/debate-candidate', {
            method: 'POST',
            body: formData,
          });
        } else {
          return null;
        }

        if (!response || !response.ok) {
          let errorMessage = 'Request failed';
          try {
            const contentType = response?.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
              const errorData = await response.json();
              errorMessage = errorData.error || errorData.detail || errorMessage;
            } else {
              const errorText = await response?.text();
              errorMessage = errorText || errorMessage;
            }
          } catch (parseError) {
            console.error('Error parsing error response:', parseError);
            errorMessage = `Server error: ${response?.status} ${response?.statusText}`;
          }
          throw new Error(errorMessage);
        }

        const result = await response.json();
        
        // Extract timing data from result (for debate actions)
        if (action === 'debate' && result.timing_data) {
          const timingData = result.timing_data;
          if (timingData.steps && Array.isArray(timingData.steps) && timingData.steps.length > 0) {
            const processedTiming = {
              ...timingData,
              start_time: timingData.start_time 
                ? (typeof timingData.start_time === 'number' 
                    ? (timingData.start_time > 1000000000 ? timingData.start_time : timingData.start_time * 1000)
                    : timingData.start_time)
                : Date.now(),
              steps: timingData.steps.map((step: any) => ({
                ...step,
                timestamp: step.timestamp 
                  ? (typeof step.timestamp === 'number' 
                      ? (step.timestamp > 1000000000 ? step.timestamp : step.timestamp * 1000)
                      : step.timestamp)
                  : Date.now()
              }))
            };
            setWorkflowTimingData(processedTiming);
          }
          
          if (result.debate || result.transcript) {
            try {
              const debateContent = result.debate || result.transcript;
              const debateArray = typeof debateContent === 'string' ? JSON.parse(debateContent) : debateContent;
              setWorkflowDebateData(debateArray);
            } catch (e) {
              setWorkflowDebateData(result.debate || result.transcript);
            }
          }
        }
        
        // Get the saved result ID from the response
        if (result.success && result.result_id) {
          return result.result_id;
        } else if (result.success) {
          // Fallback: try to fetch if result_id not in response
          await new Promise(resolve => setTimeout(resolve, 1000));
          const resultsResponse = await fetch(`/api/evaluation-results?candidate_id=${candidateId}&result_type=${action === 'evaluate' ? 'evaluation' : 'debate'}&job_id=${selectedJob?.id || ''}`);
          if (resultsResponse.ok) {
            const resultsData = await resultsResponse.json();
            const savedResult = resultsData.results?.[0];
            if (savedResult) {
              return savedResult.id;
            }
          }
        }
        return null;
      };
      
      // Start evaluation immediately if selected
      if (hasEvaluate) {
        setReasoningSteps(prev => prev.map(step => 
          step.title.includes('Evaluatie voorbereiden')
            ? { ...step, status: 'processing' as const, content: `Evaluatie wordt gestart voor ${selectedCandidates.length} kandidaat(en)...` }
            : step
        ));
        setCurrentWorkflowStep('Evaluatie starten...');
        
        // Process all evaluations in parallel
        const evaluationPromises = selectedCandidates.map(candidateId => 
          processAction('evaluate', candidateId)
        );
        
        const evaluationResults = await Promise.all(evaluationPromises);
        evaluationResults.forEach((resultId, idx) => {
          if (resultId) resultIds.push(resultId);
          completedOperations++;
          setReasoningSteps(prev => prev.map(step => 
            step.title.includes('Evaluatie')
              ? { ...step, status: 'completed' as const, content: `Evaluatie voltooid voor ${allCandidates.find(c => selectedCandidates.includes(c.id))?.name || 'kandidaat'} (${completedOperations}/${totalOperations})` }
              : step
          ));
        });
        
        setCurrentWorkflowStep('Evaluatie voltooid');
      }
      
      // Start debate in background (parallel, non-blocking)
      if (hasDebate) {
        setReasoningSteps(prev => prev.map(step => 
          step.title.includes('Debat voorbereiden')
            ? { ...step, status: 'processing' as const, content: `Debat wordt voorbereid (draait op achtergrond)...` }
            : step
        ));
        setCurrentWorkflowStep('Debat starten (achtergrond)...');
        
        // Process debates in background (don't await, but track)
        const debatePromises = selectedCandidates.map(async (candidateId) => {
          try {
            const resultId = await processAction('debate', candidateId);
            if (resultId) resultIds.push(resultId);
            completedOperations++;
            setReasoningSteps(prev => prev.map(step => 
              step.title.includes('Debat')
                ? { ...step, status: 'completed' as const, content: `Debat voltooid voor ${allCandidates.find(c => c.id === candidateId)?.name || 'kandidaat'} (${completedOperations}/${totalOperations})` }
                : step
            ));
            setCurrentWorkflowStep('Debat voltooid');
            return resultId;
          } catch (error: any) {
            console.error('Debate error:', error);
            setReasoningSteps(prev => [...prev, {
              step: prev.length + 1,
              title: 'Debat fout',
              content: `Fout bij debat: ${error.message || 'Onbekende fout'}`,
              timestamp: new Date().toLocaleTimeString('nl-NL'),
              status: 'error' as const
            }]);
            return null;
          }
        });
        
        // Wait for all debates to complete before checking results
        const debateResults = await Promise.allSettled(debatePromises);
        const debateResultIds = debateResults
          .filter((r): r is PromiseFulfilledResult<string | null> => r.status === 'fulfilled')
          .map(r => r.value)
          .filter((id): id is string => id !== null);
        
        // Add debate result IDs to resultIds array
        debateResultIds.forEach(id => {
          if (!resultIds.includes(id)) {
            resultIds.push(id);
          }
        });
        
        setCurrentWorkflowStep('Alle taken voltooid');
      }
      
      // Update final reasoning step after all operations
      setReasoningSteps(prev => [...prev, {
        step: prev.length + 1,
        title: 'Voltooid',
        content: `${resultIds.length} resultaat${resultIds.length !== 1 ? 'en' : ''} opgeslagen`,
        timestamp: new Date().toLocaleTimeString('nl-NL'),
        status: 'completed' as const
      }]);
      
      setCurrentWorkflowStep('Voltooid!');
      setIsProcessing(false);
      
      // Navigate directly to the result detail page (or first result if multiple)
      if (resultIds.length > 0) {
        // Keep popup open for a bit, then navigate
        setTimeout(() => {
          setShowWorkflowPopup(false);
          router.push(`/company/results/${resultIds[0]}`);
        }, 2000);
      } else {
        // If no results were saved, show error and reload data
        setShowWorkflowPopup(false);
        alert('Waarschuwing: Resultaten konden niet worden opgeslagen. Probeer het opnieuw.');
        await loadData();
      }
    } catch (error: any) {
      console.error('Error processing evaluation:', error);
      setShowWorkflowPopup(false);
      setCurrentWorkflowStep('');
      setReasoningSteps(prev => [...prev, {
        step: prev.length + 1,
        title: 'Fout opgetreden',
        content: error.message || 'Onbekende fout',
        timestamp: new Date().toLocaleTimeString('nl-NL'),
        status: 'error' as const
      }]);
      alert(`Fout: ${error.message || 'Onbekende fout'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  if (isLoading) {
    return <div className="text-center py-12">Laden...</div>;
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-barnes-dark-violet mb-2">Nieuwe Evaluatie Configureren</h1>
        <p className="text-barnes-dark-gray">
          Bekijk vacatures met kandidaten aangeboden door recruiters en start een evaluatie
        </p>
      </div>

      {/* New Vacancies Offered to Recruiters Section */}
      {(() => {
        const newVacancies = jobs.filter(job => {
          const isActive = job.is_active !== false; // Default to true if not set
          const notAssigned = !job.assigned_agency_id;
          // Exclude jobs that have recruiter candidates (they should be in "Vacatures met Kandidaten")
          const hasRecruiterCandidates = allCandidates.some(c => 
            doesCandidateMatchJob(c, job.id) && (c as any).submitted_by_company_id != null
          );
          return isActive && notAssigned && !hasRecruiterCandidates;
        });
        
        if (newVacancies.length === 0) return null;
        
        return (
          <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-barnes-dark-violet">
                Nieuwe Vacatures Aangeboden aan Recruiters
              </h2>
              <span className="px-3 py-1 bg-blue-200 text-blue-800 text-sm font-medium rounded-full">
                {newVacancies.length} nieuw
              </span>
            </div>
            <div className="space-y-3">
              {newVacancies.slice(0, 5).map(job => (
                <div
                  key={job.id}
                  className="flex items-center justify-between p-4 bg-white rounded-lg border border-blue-200 hover:border-blue-400 transition-colors"
                >
                  <div>
                    <div className="font-medium text-barnes-dark-violet">{job.title}</div>
                    <div className="text-sm text-barnes-dark-gray">{job.company}</div>
                    <div className="text-xs text-gray-500 mt-1">
                      Aangemaakt: {job.created_at ? new Date(job.created_at).toLocaleDateString('nl-NL') : 'Onbekend'}
                    </div>
                  </div>
                  <button
                    onClick={() => router.push(`/company/vacatures/${job.id}`)}
                    className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Bekijk
                  </button>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* Vacancies with Recruiter Candidates Section */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-barnes-dark-violet">
            Vacatures met Kandidaten van Recruiters
          </h2>
          <button
            onClick={loadData}
            className="px-4 py-2 text-sm bg-gray-100 text-barnes-dark-gray rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Verversen
          </button>
        </div>
        {jobs.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-barnes-dark-gray text-sm mb-2">Geen vacatures beschikbaar</p>
            <p className="text-xs text-gray-500">Wacht op vacatures van recruiters of maak een nieuwe vacature aan</p>
          </div>
        ) : (
          <div className="space-y-4">
            {(() => {
              const jobsWithCandidates = jobs.filter(job => {
                const jobCandidatesForJob = allCandidates.filter(c => doesCandidateMatchJob(c, job.id));
                return jobCandidatesForJob.length > 0;
              });
              
              if (jobsWithCandidates.length === 0) {
                return (
                  <div className="text-center py-8">
                    <p className="text-barnes-dark-gray text-sm mb-2">Geen vacatures met kandidaten van recruiters</p>
                    <p className="text-xs text-gray-500">Recruiters hebben nog geen kandidaten toegevoegd aan deze vacatures</p>
                  </div>
                );
              }
              
              return jobsWithCandidates.map(job => {
                const jobCandidatesForJob = allCandidates.filter(c => doesCandidateMatchJob(c, job.id));
                const recruiterCandidatesCount = jobCandidatesForJob.length;
              
              return (
                <div
                  key={job.id}
                  className={`p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                    selectedJob?.id === job.id
                      ? 'border-barnes-violet bg-barnes-violet/5'
                      : 'border-gray-200 hover:border-barnes-violet/50'
                  }`}
                  onClick={() => {
                    setSelectedJob(job);
                    // Auto-select first candidate when clicking on vacancy with candidates
                    const firstCandidate = jobCandidatesForJob[0];
                    if (firstCandidate) {
                      setSelectedCandidates([firstCandidate.id]);
                    } else {
                      setSelectedCandidates([]);
                    }
                    setCandidateSearchTerm('');
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-semibold text-barnes-dark-violet">{job.title}</h3>
                        <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                          {recruiterCandidatesCount} kandidaat{recruiterCandidatesCount !== 1 ? 'en' : ''} van recruiter{recruiterCandidatesCount !== 1 ? 's' : ''}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mb-2">{job.company}</p>
                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        {job.location && <span>📍 {job.location}</span>}
                        {job.salary_range && <span>💰 {job.salary_range}</span>}
                      </div>
                    </div>
                    <div className="text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedJob(job);
                          // Auto-select first candidate when clicking on vacancy with candidates
                          const firstCandidate = jobCandidatesForJob[0];
                          if (firstCandidate) {
                            setSelectedCandidates([firstCandidate.id]);
                          } else {
                            setSelectedCandidates([]);
                          }
                          setCandidateSearchTerm('');
                        }}
                        className="px-4 py-2 bg-barnes-violet text-white rounded-lg hover:bg-barnes-dark-violet transition-colors text-sm"
                      >
                        {selectedJob?.id === job.id ? 'Geselecteerd' : 'Selecteer'}
                      </button>
                    </div>
                  </div>
                  
                  {/* Show candidate preview */}
                  {jobCandidatesForJob.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-gray-200">
                      <p className="text-xs text-gray-500 mb-2">Kandidaten van recruiter:</p>
                      <div className="flex flex-wrap gap-2">
                        {jobCandidatesForJob.slice(0, 5).map(candidate => (
                          <span
                            key={candidate.id}
                            className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded"
                          >
                            {candidate.name}
                          </span>
                        ))}
                        {jobCandidatesForJob.length > 5 && (
                          <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">
                            +{jobCandidatesForJob.length - 5} meer
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
              });
            })()}
          </div>
        )}
      </div>

      {/* Validation Summary Card - Removed red box per user request */}

      {/* Recent Candidates Section */}
      {allCandidates.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-barnes-dark-violet">Recente Kandidaten</h2>
            <button
              onClick={loadData}
              className="px-4 py-2 text-sm bg-gray-100 text-barnes-dark-gray rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Verversen
            </button>
          </div>
          <div className="space-y-3">
            {allCandidates.slice(0, 5).map((candidate) => (
              <div
                key={candidate.id}
                className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:border-barnes-violet transition-colors"
              >
                <div>
                  <div className="font-medium text-barnes-dark-violet">{candidate.name}</div>
                  <div className="text-sm text-gray-500">{candidate.email}</div>
                  {candidate.job_id && (
                    <div className="text-xs text-gray-400 mt-1">
                      {jobs.find(j => j.id === candidate.job_id)?.title || 'Onbekende vacature'}
                    </div>
                  )}
                </div>
                <div className="text-right">
                  <div className="text-sm text-gray-500">{candidate.pipeline_stage || 'Niet toegewezen'}</div>
                  <div className="text-xs text-gray-400">{candidate.pipeline_status || 'Actief'}</div>
                </div>
              </div>
            ))}
            {allCandidates.length > 5 && (
              <div className="text-center pt-2">
                <button
                  onClick={() => router.push('/company/dashboard?module=kandidaten')}
                  className="text-sm text-barnes-violet hover:underline"
                >
                  Bekijk alle {allCandidates.length} kandidaten →
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Main Focus: Handle Recruiter Vacancies */}
      <div className="mb-6 p-6 bg-gradient-to-r from-barnes-violet/5 to-barnes-dark-violet/5 rounded-xl border-2 border-barnes-violet/20">
        <h2 className="text-2xl font-bold text-barnes-dark-violet mb-2">Behandel Vacatures van Recruiters</h2>
        <p className="text-barnes-dark-gray">
          Selecteer een vacature met kandidaten van recruiters hierboven, kies je acties en start de evaluatie
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Step 1: Select Vacature - Simplified for Recruiter Workflow */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 md:p-6">
          <h2 className="text-xl font-semibold text-barnes-dark-violet mb-4">1. Selecteer Vacature</h2>
          <p className="text-sm text-barnes-dark-gray mb-4">
            Kies een vacature met kandidaten van recruiters (zie boven)
          </p>
          <select
            value={selectedJob?.id || ''}
            onChange={(e) => {
              const job = jobs.find(j => j.id === e.target.value);
              setSelectedJob(job || null);
              setSelectedActions([]);
              setSelectedCandidates([]);
              setSelectedPersonas([]);
              setCandidateSearchTerm('');
            }}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-barnes-violet focus:border-transparent"
          >
            <option value="">-- Selecteer een vacature --</option>
            {jobs.map(job => (
              <option key={job.id} value={job.id}>
                {job.title} - {job.company}
              </option>
            ))}
          </select>
          {selectedJob && (
            <div className="mt-4 p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-barnes-dark-gray"><strong>Locatie:</strong> {selectedJob.location || 'Niet opgegeven'}</p>
              <p className="text-sm text-barnes-dark-gray"><strong>Salaris:</strong> {selectedJob.salary_range || 'Niet opgegeven'}</p>
            </div>
          )}
        </div>

        {/* Step 2: Select Action - Focused on Recruiter Candidate Evaluation */}
        <div className={`bg-white rounded-xl shadow-sm border-2 p-4 md:p-6 ${
          selectedActions.length > 0 ? 'border-barnes-violet' : 'border-gray-200'
        }`}>
          <h2 className="text-xl font-semibold text-barnes-dark-violet mb-4">
            2. Selecteer Actie voor Recruiter Kandidaten
            {selectedActions.length > 0 && <span className="ml-2 text-sm text-green-600">✓</span>}
          </h2>
          <p className="text-sm text-barnes-dark-gray mb-4">
            Kies hoe je de kandidaten van recruiters wilt beoordelen
          </p>
          <div className="space-y-3">
            <label className="flex items-center gap-3 p-4 border-2 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
              <input
                type="checkbox"
                checked={selectedActions.includes('evaluate')}
                onChange={(e) => {
                  if (e.target.checked) {
                    setSelectedActions([...selectedActions, 'evaluate']);
                  } else {
                    setSelectedActions(selectedActions.filter(a => a !== 'evaluate'));
                  }
                }}
                className="w-5 h-5 text-barnes-violet focus:ring-barnes-violet rounded"
              />
              <div>
                <span className="font-medium text-barnes-dark-violet">Evalueer Kandidaat</span>
                <p className="text-sm text-barnes-dark-gray">Beoordeel kandidaat op basis van vacature en persona's</p>
              </div>
            </label>
            <label className="flex items-center gap-3 p-4 border-2 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
              <input
                type="checkbox"
                checked={selectedActions.includes('debate')}
                onChange={(e) => {
                  if (e.target.checked) {
                    setSelectedActions([...selectedActions, 'debate']);
                  } else {
                    setSelectedActions(selectedActions.filter(a => a !== 'debate'));
                  }
                }}
                className="w-5 h-5 text-barnes-violet focus:ring-barnes-violet rounded"
              />
              <div>
                <span className="font-medium text-barnes-dark-violet">Expert Debat</span>
                <p className="text-sm text-barnes-dark-gray">Laat expert persona's met elkaar debatteren over de kandidaat</p>
              </div>
            </label>
            <label className="flex items-center gap-3 p-4 border-2 rounded-lg cursor-not-allowed opacity-50 transition-colors">
              <input
                type="checkbox"
                checked={false}
                disabled
                className="w-5 h-5 text-barnes-violet focus:ring-barnes-violet rounded"
              />
              <div>
                <span className="font-medium text-barnes-dark-violet">Kandidaat Vergelijking</span>
                <p className="text-sm text-barnes-dark-gray">Vergelijk meerdere kandidaten (binnenkort beschikbaar)</p>
              </div>
            </label>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6 mb-4 md:mb-6">
        {/* Step 3: Select Candidates */}
        <div className={`bg-white rounded-xl shadow-sm border-2 p-4 md:p-6 ${
          selectedCandidates.length > 0 ? 'border-barnes-violet' : 'border-gray-200'
        }`}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-barnes-dark-violet">
              3. Selecteer Kandidaten
              {selectedCandidates.length > 0 && <span className="ml-2 text-sm text-green-600">✓ {selectedCandidates.length}</span>}
            </h2>
            {selectedJob && (
              <span className="text-xs text-barnes-dark-gray">
                {candidateSearchTerm ? visibleCandidates.length : jobCandidates.length} gevonden
              </span>
            )}
          </div>
          {!selectedJob ? (
            <p className="text-barnes-dark-gray text-sm">Selecteer eerst een vacature</p>
          ) : (
            <>
              <div className="mb-3">
                <input
                  type="text"
                  value={candidateSearchTerm}
                  onChange={(e) => setCandidateSearchTerm(e.target.value)}
                  placeholder="Zoek op naam of e-mail..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-barnes-violet focus:border-transparent text-sm"
                />
                {candidateSearchTerm && (
                  <p className="text-[11px] text-barnes-dark-gray mt-1">
                    Resultaten tonen alle kandidaten in deze omgeving, ongeacht gekoppelde vacature.
                  </p>
                )}
              </div>
              {(!candidateSearchTerm && jobCandidates.length === 0) ? (
                <p className="text-barnes-dark-gray text-sm">Geen kandidaten gekoppeld aan deze vacature</p>
              ) : visibleCandidates.length === 0 ? (
                <p className="text-barnes-dark-gray text-sm">Geen kandidaten gevonden voor deze zoekterm</p>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {visibleCandidates.map(candidate => {
                    const belongsToSelectedJob = selectedJob ? doesCandidateMatchJob(candidate, selectedJob.id) : false;
                    const isCompareMode = selectedActions.includes('compare');
                    const isSingleMode = selectedActions.some(a => a === 'evaluate' || a === 'debate');
                    const maxSelection = isCompareMode ? undefined : (isSingleMode ? 1 : undefined);
                    const isSelected = selectedCandidates.includes(candidate.id);
                    const canSelect = maxSelection ? selectedCandidates.length < maxSelection || isSelected : true;
                    
                    return (
                      <label 
                        key={candidate.id} 
                        className={`flex items-center justify-between gap-3 p-3 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors ${!canSelect ? 'opacity-50 cursor-not-allowed' : ''} ${isSelected ? 'bg-barnes-violet/5 border border-barnes-violet/30' : ''}`}
                      >
                        <div className="flex items-center gap-3 flex-1">
                          <input
                            type={isCompareMode ? 'checkbox' : 'radio'}
                            name={isCompareMode ? 'candidates' : 'candidate'}
                            checked={isSelected}
                            onChange={async (e) => {
                              if (isCompareMode) {
                                // Checkbox mode for comparison - toggle selection
                                if (e.target.checked) {
                                  if (!isSelected) {
                                    setSelectedCandidates([...selectedCandidates, candidate.id]);
                                    await fetchConversationInsights(candidate.id);
                                  }
                                } else {
                                  setSelectedCandidates(selectedCandidates.filter(id => id !== candidate.id));
                                }
                              } else {
                                // Radio mode for single selection - toggle if already selected
                                if (isSelected) {
                                  // Deselect if clicking the same candidate
                                  setSelectedCandidates([]);
                                } else {
                                  // Select this candidate (deselect others)
                                  setSelectedCandidates([candidate.id]);
                                  await fetchConversationInsights(candidate.id);
                                }
                              }
                            }}
                            className="w-5 h-5 text-barnes-violet focus:ring-barnes-violet rounded cursor-pointer"
                            disabled={!canSelect}
                          />
                          <div>
                            <span className="text-barnes-dark-gray font-medium">{candidate.name}</span>
                            {candidate.email && (
                              <p className="text-xs text-barnes-dark-gray">{candidate.email}</p>
                            )}
                            {!belongsToSelectedJob && candidateSearchTerm && (
                              <p className="text-[11px] text-amber-700 mt-1">
                                Niet gekoppeld aan {selectedJob?.title}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {(candidate.conversation_count ?? 0) > 0 && (
                            <span className="text-xs text-barnes-violet bg-barnes-violet/10 px-2 py-1 rounded-full">
                              {candidate.conversation_count} gesprek{(candidate.conversation_count ?? 0) !== 1 ? 'ken' : ''}
                            </span>
                          )}
                          {(candidate.evaluation_count ?? 0) > 0 && (
                            <span className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded-full">
                              ✓ Geëvalueerd
                            </span>
                          )}
                          {(candidate.evaluation_count ?? 0) === 0 && selectedCandidates.includes(candidate.id) && (
                            <span className="text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded-full">
                              Nog niet geëvalueerd
                            </span>
                          )}
                        </div>
                      </label>
                    );
                  })}
                </div>
              )}
            </>
          )}
          
          {/* Other Candidates Status Section - Show when a candidate is selected */}
          {selectedCandidates.length > 0 && selectedJob && (
            <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h3 className="text-sm font-semibold text-barnes-dark-violet mb-3">
                Andere kandidaten voor {selectedJob.title}:
              </h3>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {jobCandidates
                  .filter(c => !selectedCandidates.includes(c.id))
                  .slice(0, 10)
                  .map(candidate => {
                    const hasEvaluation = (candidate.evaluation_count ?? 0) > 0;
                    const status = hasEvaluation ? 'Geëvalueerd' : 'Nog niet geëvalueerd';
                    const statusColor = hasEvaluation ? 'text-green-600' : 'text-amber-600';
                    
                    return (
                      <div
                        key={candidate.id}
                        className="flex items-center justify-between p-2 bg-white rounded border border-gray-200 hover:border-blue-300 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-barnes-dark-gray">{candidate.name}</span>
                          <span className={`text-xs ${statusColor}`}>— {status}</span>
                        </div>
                        <button
                          onClick={() => {
                            const isCompareMode = selectedActions.includes('compare');
                            const isSingleMode = selectedActions.some(a => a === 'evaluate' || a === 'debate');
                            
                            if (isCompareMode) {
                              if (!selectedCandidates.includes(candidate.id)) {
                                setSelectedCandidates([...selectedCandidates, candidate.id]);
                                fetchConversationInsights(candidate.id);
                              }
                            } else if (isSingleMode) {
                              setSelectedCandidates([candidate.id]);
                              fetchConversationInsights(candidate.id);
                            }
                          }}
                          className="text-xs text-barnes-violet hover:text-barnes-dark-violet hover:underline"
                        >
                          Selecteren
                        </button>
                      </div>
                    );
                  })}
                {jobCandidates.filter(c => !selectedCandidates.includes(c.id)).length === 0 && (
                  <p className="text-xs text-barnes-dark-gray">Geen andere kandidaten voor deze vacature</p>
                )}
              </div>
            </div>
          )}
          
          {selectedActions.includes('compare') && (
            <p className="text-xs text-barnes-dark-gray mt-2">Selecteer minimaal 2 kandidaten voor vergelijking</p>
          )}
          {selectedActions.some(a => a === 'evaluate' || a === 'debate') && !selectedActions.includes('compare') && (
            <p className="text-xs text-barnes-dark-gray mt-2">Selecteer 1 kandidaat voor evaluatie/debat</p>
          )}
        </div>

        {/* Step 4: Select Digitale Werknemers */}
        <div className={`bg-white rounded-xl shadow-sm border-2 p-4 md:p-6 ${
          selectedPersonas.length > 0 ? 'border-barnes-violet' : 'border-gray-200'
        }`}>
          <h2 className="text-xl font-semibold text-barnes-dark-violet mb-4">
            4. Selecteer Digitale Werknemer(s)
            {selectedPersonas.length > 0 && <span className="ml-2 text-sm text-green-600">✓ {selectedPersonas.length}</span>}
          </h2>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {personas.map(persona => (
              <div key={persona.id} className="flex items-center gap-3 p-3 hover:bg-gray-50 rounded-lg">
                <label className="flex items-center gap-3 flex-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedPersonas.includes(persona.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedPersonas([...selectedPersonas, persona.id]);
                      } else {
                        setSelectedPersonas(selectedPersonas.filter(id => id !== persona.id));
                      }
                    }}
                    className="w-5 h-5 text-barnes-violet focus:ring-barnes-violet rounded"
                  />
                  <span className="text-barnes-dark-gray">{persona.display_name}</span>
                </label>
                <button
                  onClick={() => router.push('/company/dashboard?module=personas')}
                  className="px-3 py-1 text-xs text-barnes-violet hover:text-barnes-dark-violet hover:underline"
                  title="Beheer digitale werknemer"
                >
                  Beheer →
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Company Note removed per user request */}

      {/* Templates & Start Button */}
      <div className="flex justify-between items-center gap-4">
        <div className="flex gap-3">
          {/* Load Template */}
          {templates.length > 0 && (
            <select
              onChange={(e) => {
                if (e.target.value) {
                  loadTemplate(e.target.value);
                  e.target.value = ''; // Reset dropdown
                }
              }}
              value=""
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-barnes-violet text-sm"
            >
              <option value="">📋 Laad template...</option>
              {templates.map(template => (
                <option key={template.id} value={template.id}>
                  {template.name}
                </option>
              ))}
            </select>
          )}
          
          {/* Save Template */}
          <button
            onClick={() => setShowTemplateModal(true)}
            disabled={!selectedJob || selectedPersonas.length === 0 || selectedActions.length === 0}
            className="btn-secondary px-4 py-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            💾 Opslaan als template
          </button>
        </div>
        
        <div className="flex gap-4 items-center">
          {isProcessing && selectedCandidates.length > 1 && (
            <div className="text-sm text-barnes-dark-gray">
              Verwerken {selectedCandidates.length} kandidaten...
            </div>
          )}
          <button
            onClick={handleStartEvaluation}
            disabled={!selectedJob || selectedPersonas.length === 0 || selectedCandidates.length === 0 || selectedActions.length === 0 || isProcessing}
            className="btn-primary px-8 py-3 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isProcessing 
              ? (selectedCandidates.length > 1 ? `Verwerken... (${selectedCandidates.length} kandidaten)` : 'Verwerken...')
              : selectedCandidates.length > 1 
              ? `Start Evaluatie (${selectedCandidates.length} kandidaten)`
              : 'Start Evaluatie'}
          </button>
        </div>
      </div>

      {/* Template Save Modal */}
      {showTemplateModal && (
        <div
          className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowTemplateModal(false);
          }}
        >
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-semibold text-barnes-dark-violet">Template Opslaan</h3>
              <button onClick={() => setShowTemplateModal(false)} className="text-gray-500 hover:text-gray-700">
                ✕
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-barnes-dark-gray mb-1">Naam *</label>
                <input
                  type="text"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  placeholder="Bijv. Standaard evaluatie voor IT vacatures"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-barnes-violet"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-barnes-dark-gray mb-1">Beschrijving</label>
                <textarea
                  value={templateDescription}
                  onChange={(e) => setTemplateDescription(e.target.value)}
                  placeholder="Optionele beschrijving van dit template"
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-barnes-violet"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleSaveTemplate}
                  disabled={!templateName.trim()}
                  className="btn-primary flex-1 disabled:opacity-50"
                >
                  Opslaan
                </button>
                <button
                  onClick={() => setShowTemplateModal(false)}
                  className="btn-secondary flex-1"
                >
                  Annuleren
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reasoning Panel - Smaller, less invasive */}
      <ReasoningPanel 
        steps={reasoningSteps}
        isVisible={showReasoningPanel}
        onClose={() => setShowReasoningPanel(false)}
      />

      {/* Workflow Visualization Popup */}
      <WorkflowVisualizationPopup
        isOpen={showWorkflowPopup}
        onClose={() => setShowWorkflowPopup(false)}
        timingData={workflowTimingData}
        debateData={workflowDebateData}
        isProcessing={isProcessing}
        currentStep={currentWorkflowStep}
        personas={personas}
        selectedPersonas={selectedPersonas}
      />
    </div>
  );
}


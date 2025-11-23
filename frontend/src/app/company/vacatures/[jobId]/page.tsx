'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import ProtectedRoute from '../../../../components/ProtectedRoute';
import CompanyNavigation from '../../../../components/CompanyNavigation';
import { buildAnalysisSections, buildExtensionBlock, AnalysisSection, ExtensionBlock } from '../../../../utils/analysis';
import VacancyWorkflowVisualization from '../../../../components/VacancyWorkflowVisualization';

interface JobDescription {
  id: string;
  title: string;
  company: string;
  description: string;
  requirements: string;
  location: string;
  salary_range: string;
  created_at: string;
  ai_analysis?: any;
}

interface Candidate {
  id: string;
  name: string;
  email: string;
  motivational_letter?: string;
  created_at: string;
  conversation_count?: number;
  job_id?: string;
  preferential_job_ids?: string;
  pipeline_stage?: string;  // 'introduced', 'review', 'first_interview', 'second_interview', 'offer', 'complete'
  pipeline_status?: string;  // 'active', 'on_hold', 'rejected', 'accepted'
}

type TabType = 'overview' | 'analysis' | 'candidates' | 'results' | 'compare';

export default function JobDetailPage() {
  const params = useParams();
  const router = useRouter();
  const jobId = params.jobId as string;

  const [job, setJob] = useState<JobDescription | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [results, setResults] = useState<any[]>([]);
  const [conversations, setConversations] = useState<any[]>([]);
  const [aiAnalysis, setAiAnalysis] = useState<any>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [conversationModal, setConversationModal] = useState<{ open: boolean; candidate: Candidate | null }>({ open: false, candidate: null });
  const [draggedCandidateId, setDraggedCandidateId] = useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = useState<string | null>(null);
  const [conversationForm, setConversationForm] = useState({
    title: '',
    summary: '',
    pros: '',
    cons: '',
    channel: 'Telefonisch',
  });
  const [isSavingConversation, setIsSavingConversation] = useState(false);
  const [aiMatches, setAiMatches] = useState<any[]>([]);
  const [isMatching, setIsMatching] = useState(false);
  const [showMatches, setShowMatches] = useState(false);
  const [selectedCandidatesForCompare, setSelectedCandidatesForCompare] = useState<string[]>([]);
  const [includePastCandidates, setIncludePastCandidates] = useState(false);
  const [allCandidates, setAllCandidates] = useState<Candidate[]>([]);
  const [allJobs, setAllJobs] = useState<JobDescription[]>([]);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [scheduledConversationId, setScheduledConversationId] = useState<string | null>(null);
  const [scheduleForm, setScheduleForm] = useState({
    date: '',
    time: '',
    type: 'Eerste Interview',
    location: 'Teams/Zoom',
    notes: '',
  });
  const [isSavingSchedule, setIsSavingSchedule] = useState(false);

  useEffect(() => {
    loadData();
    // Auto-refresh pipeline every 15 seconds
    const interval = setInterval(() => {
      loadData();
    }, 15000);
    return () => clearInterval(interval);
  }, [jobId]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const { getAuthHeaders } = await import('../../../../lib/auth');
      const headers = getAuthHeaders();
      
      const [jobsRes, candidatesRes, resultsRes, conversationsRes] = await Promise.all([
        fetch('/api/job-descriptions', { headers }),
        fetch(`/api/candidates?job_id=${jobId}`, { headers }),
        fetch(`/api/evaluation-results?job_id=${jobId}`, { headers }),
        fetch(`/api/candidate-conversations?job_id=${jobId}`, { headers })
      ]);

      // Also load all candidates and jobs for comparison feature
      const [allCandidatesRes, allJobsRes] = await Promise.all([
        fetch('/api/candidates', { headers }),
        fetch('/api/job-descriptions', { headers })
      ]);
      
      if (allCandidatesRes.ok) {
        const allCandData = await allCandidatesRes.json();
        setAllCandidates(allCandData.candidates || []);
      }
      
      if (allJobsRes.ok) {
        const allJobsData = await allJobsRes.json();
        setAllJobs(allJobsData.jobs || []);
      }

      if (!jobsRes.ok) {
        throw new Error('Kon vacature niet laden');
      }

      const jobsData = await jobsRes.json();
      const jobRecord = (jobsData.jobs || []).find((j: JobDescription) => j.id === jobId);
      if (!jobRecord) {
        throw new Error('Vacature niet gevonden');
      }

      setJob(jobRecord);

      if (jobRecord.ai_analysis) {
        try {
          setAiAnalysis(
            typeof jobRecord.ai_analysis === 'string'
              ? JSON.parse(jobRecord.ai_analysis)
              : jobRecord.ai_analysis
          );
        } catch {
          setAiAnalysis(null);
        }
      } else {
        setAiAnalysis(null);
      }

      if (candidatesRes.ok) {
        const candData = await candidatesRes.json();
        setCandidates(candData.candidates || []);
      }

      if (resultsRes.ok) {
        const resData = await resultsRes.json();
        setResults(resData.results || []);
      }

      if (conversationsRes.ok) {
        const convData = await conversationsRes.json();
        setConversations(convData.conversations || []);
      }
    } catch (err: any) {
      setError(err.message || 'Kon vacaturegegevens niet laden');
    } finally {
      setLoading(false);
    }
  };

  const handleAiMatching = async () => {
    setIsMatching(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('job_id', jobId);
      formData.append('limit', '20');

      const response = await fetch('/api/match-candidates', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({ error: 'Matching mislukt' }));
        throw new Error(data.error || data.detail || 'Matching mislukt');
      }

      const data = await response.json();
      if (data.success && data.matches) {
        setAiMatches(data.matches);
        setShowMatches(true);
      } else {
        throw new Error(data.message || 'Geen matches gevonden');
      }
    } catch (err: any) {
      setError(err.message || 'Kon AI matching niet uitvoeren');
      console.error('AI matching error:', err);
    } finally {
      setIsMatching(false);
    }
  };

  const handleRunAnalysis = async () => {
    setIsAnalyzing(true);
    try {
      const response = await fetch('/api/analyze-job', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ job_id: jobId })
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({ error: 'Analyse mislukt' }));
        throw new Error(data.error || data.detail || 'Analyse mislukt');
      }
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Analyse mislukt');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const openConversationModal = (candidate: Candidate) => {
    setConversationForm({
      title: '',
      summary: '',
      pros: '',
      cons: '',
      channel: 'Telefonisch',
    });
    setConversationModal({ open: true, candidate });
  };

  const closeConversationModal = () => {
    setConversationModal({ open: false, candidate: null });
  };

  const handleSaveConversation = async () => {
    if (!conversationModal.candidate || !job) return;
    if (!conversationForm.title || !conversationForm.summary) {
      alert('Titel en samenvatting zijn verplicht');
      return;
    }
    setIsSavingConversation(true);
    try {
      const payload = {
        candidate_id: conversationModal.candidate.id,
        job_id: job.id,
        title: conversationForm.title,
        summary: conversationForm.summary,
        pros: conversationForm.pros || undefined,
        cons: conversationForm.cons || undefined,
        conversation_channel: conversationForm.channel,
        created_by: 'Recruitment Team',
      };
      const response = await fetch('/api/candidate-conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Onbekende fout' }));
        throw new Error(error.error || error.detail || 'Opslaan mislukt');
      }
      const result = await response.json();
      
      // After saving, show schedule modal
      setScheduledConversationId(result.conversation?.id || null);
      closeConversationModal();
      setShowScheduleModal(true);
      
      // Pre-fill date with tomorrow
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      setScheduleForm({
        ...scheduleForm,
        date: tomorrow.toISOString().split('T')[0],
      });
      
      await loadData();
    } catch (error: any) {
      alert(error.message || 'Opslaan mislukt');
    } finally {
      setIsSavingConversation(false);
    }
  };


  const handleSaveSchedule = async () => {
    if (!scheduleForm.date || !scheduleForm.time || !conversationModal.candidate) {
      alert('Datum en tijd zijn verplicht');
      return;
    }
    
    setIsSavingSchedule(true);
    try {
      const scheduledDateTime = new Date(`${scheduleForm.date}T${scheduleForm.time}`);
      const isoDateTime = scheduledDateTime.toISOString();
      
      // Save appointment to database
      const response = await fetch('/api/scheduled-appointments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          candidate_id: conversationModal.candidate.id,
          job_id: jobId,
          scheduled_at: isoDateTime,
          type: scheduleForm.type,
          location: scheduleForm.location || 'Teams/Zoom',
          notes: scheduleForm.notes || '',
          conversation_id: scheduledConversationId,
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || errorData.detail || 'Fout bij opslaan afspraak');
      }
      
      // TODO: Future calendar integration
      // - Integreer met Google Calendar API om automatisch afspraken te creëren en uitnodigingen te versturen
      // - Integreer met Microsoft Outlook/Exchange om afspraken in Outlook agenda te plaatsen
      // - Stuur automatisch calendar invites (ICS-bestanden) naar kandidaat en relevante teamleden
      // - Synchroniseer met bestaande beschikbaarheid van interviewers
      
      alert(`Afspraak opgeslagen voor ${conversationModal.candidate.name}:\n${scheduledDateTime.toLocaleString('nl-NL')}\n\nType: ${scheduleForm.type}\nLocatie: ${scheduleForm.location}\n\n(Toekomst: Dit zal automatisch worden toegevoegd aan agenda's en uitnodigingen worden verstuurd)`);
      
      setShowScheduleModal(false);
      setScheduledConversationId(null);
      setScheduleForm({
        date: '',
        time: '',
        type: 'Eerste Interview',
        location: 'Teams/Zoom',
        notes: '',
      });
      
      // Reload data to show the new appointment
      await loadData();
    } catch (error: any) {
      alert(`Fout bij plannen: ${error.message || 'Onbekende fout'}`);
    } finally {
      setIsSavingSchedule(false);
    }
  };

  const generateTimeSlots = () => {
    const slots = [];
    for (let hour = 9; hour < 17; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        const timeStr = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        slots.push(timeStr);
      }
    }
    return slots;
  };

  const evaluations = useMemo(
    () => results.filter(r => r.result_type === 'evaluation'),
    [results]
  );
  const debates = useMemo(
    () => results.filter(r => r.result_type === 'debate'),
    [results]
  );

  const analysisSections = buildAnalysisSections(aiAnalysis);
  const extensionBlock = buildExtensionBlock(aiAnalysis);

  const getCandidateStage = (candidate: Candidate): string => {
    // Use pipeline_stage from backend if available, otherwise compute from activity
    if (candidate.pipeline_stage) {
      // Map old stages to new stages if needed
      const stageMapping: Record<string, string> = {
        'introduced': 'introduced', // Vacature naar Recruiter
        'review': 'review', // Kandidaat Toegevoegd
        'first_interview': 'first_interview', // AI Analyse
        'second_interview': 'second_interview', // Eerste Interview
        'offer': 'offer', // Tweede Interview
        'complete': 'complete', // Aanbod & Voltooid
      };
      return stageMapping[candidate.pipeline_stage] || candidate.pipeline_stage;
    }
    
    // Fallback: compute stage based on activity
    const candidateResults = results.filter(r => r.candidate_id === candidate.id);
    const candidateConversations = conversations.filter(c => c.candidate_id === candidate.id);
    const hasEvaluations = candidateResults.some(r => r.result_type === 'evaluation');
    const hasDebates = candidateResults.some(r => r.result_type === 'debate');
    const conversationCount = candidateConversations.length;

    // New logic: 
    // - introduced: Vacature sent to recruiter (candidate exists but no activity)
    // - review: Candidate added (candidate exists)
    // - first_interview: AI Analysis done (has evaluations/debates)
    // - second_interview: First interview done (1 conversation)
    // - offer: Second interview done (2+ conversations)
    // - complete: Process complete (accepted/rejected or many conversations)
    
    if (!hasEvaluations && !hasDebates && conversationCount === 0) return 'introduced';
    if (hasEvaluations || hasDebates) {
      if (conversationCount === 0) return 'first_interview'; // AI Analysis done
      if (conversationCount === 1) return 'second_interview'; // First interview
      if (conversationCount >= 2) return 'offer'; // Second interview
    }
    if (candidate.pipeline_status === 'accepted' || candidate.pipeline_status === 'rejected') return 'complete';
    return 'review'; // Default: candidate added
  };

  const handleCandidateDragStart = (e: React.DragEvent, candidateId: string) => {
    setDraggedCandidateId(candidateId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleCandidateDragOver = (e: React.DragEvent, stageKey: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverStage(stageKey);
  };

  const handleCandidateDragLeave = () => {
    setDragOverStage(null);
  };

  const handleCandidateDrop = async (e: React.DragEvent, targetStage: string) => {
    e.preventDefault();
    setDragOverStage(null);
    
    if (!draggedCandidateId) return;
    
    const candidate = candidates.find(c => c.id === draggedCandidateId);
    if (!candidate) return;
    
    const currentStage = getCandidateStage(candidate);
    if (currentStage === targetStage) {
      setDraggedCandidateId(null);
      return;
    }
    
    try {
      // Update candidate pipeline stage in backend
      const response = await fetch(`/api/candidates/${candidate.id}/pipeline`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pipeline_stage: targetStage })
      });
      
      if (!response.ok) {
        throw new Error('Failed to update candidate pipeline stage');
      }
      
      // Update local state
      setCandidates(prev => prev.map(c => 
        c.id === candidate.id ? { ...c, pipeline_stage: targetStage } : c
      ));
    } catch (error) {
      console.error('Error updating candidate pipeline:', error);
      alert('Kon kandidaat pipeline stage niet bijwerken. Probeer het opnieuw.');
    } finally {
      setDraggedCandidateId(null);
    }
  };

  const handleCandidateDragEnd = () => {
    setDraggedCandidateId(null);
    setDragOverStage(null);
  };

  // Pipeline stages configuration - Updated per user requirements
  const pipelineStages = {
    introduced: { 
      title: 'Vacature naar Recruiter', 
      description: 'Vacature is verstuurd naar recruitment bedrijf',
      color: 'bg-blue-50 border-blue-300 text-blue-700'
    },
    review: { 
      title: 'Kandidaat Toegevoegd', 
      description: 'Recruiter heeft kandidaat toegevoegd',
      color: 'bg-green-50 border-green-300 text-green-700'
    },
    first_interview: { 
      title: 'AI Analyse', 
      description: 'AI analyse heeft plaatsgevonden',
      color: 'bg-purple-50 border-purple-300 text-purple-700'
    },
    second_interview: { 
      title: 'Eerste Interview', 
      description: 'Eerste gesprek + evaluatie',
      color: 'bg-yellow-50 border-yellow-300 text-yellow-700'
    },
    offer: { 
      title: 'Tweede Interview', 
      description: 'Tweede gesprek/technische test + evaluatie',
      color: 'bg-orange-50 border-orange-300 text-orange-700'
    },
    complete: { 
      title: 'Aanbod & Voltooid', 
      description: 'Aanbod gedaan en proces voltooid',
      color: 'bg-green-50 border-green-300 text-green-700'
    },
  };

  const candidateStages = {
    introduced: candidates.filter(c => getCandidateStage(c) === 'introduced'),
    review: candidates.filter(c => getCandidateStage(c) === 'review'),
    first_interview: candidates.filter(c => getCandidateStage(c) === 'first_interview'),
    second_interview: candidates.filter(c => getCandidateStage(c) === 'second_interview'),
    offer: candidates.filter(c => getCandidateStage(c) === 'offer'),
    complete: candidates.filter(c => getCandidateStage(c) === 'complete'),
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Laden...</div>;
  }

  if (error || !job) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <p className="text-barnes-dark-gray">{error || 'Vacature niet gevonden'}</p>
        <button
          onClick={() => router.push('/company/dashboard?module=vacatures')}
          className="btn-primary"
        >
          Terug naar vacatures
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-barnes-light-gray">
      <CompanyNavigation
        activeModule="vacatures"
        onModuleChange={(module) => {
          if (module === 'vacatures') {
            router.push('/company/dashboard?module=vacatures');
          } else {
            router.push(`/company/dashboard?module=${module}`);
          }
        }}
      />
      <div className="p-4 md:p-8 transition-all duration-300" style={{ marginLeft: 'var(--nav-width, 16rem)' }}>
        <div className="max-w-7xl mx-auto">
          <div className="mb-6">
            <button
              onClick={() => router.push('/company/dashboard?module=vacatures')}
              className="text-barnes-violet hover:text-barnes-dark-violet flex items-center gap-2 mb-2 text-sm"
            >
              <span>←</span>
              <span>Terug naar vacatures</span>
            </button>
            <h1 className="text-3xl font-bold text-barnes-dark-violet">{job.title}</h1>
            <p className="text-sm text-barnes-dark-gray">
              {job.company} • {job.location || 'Locatie onbekend'}
            </p>
          </div>

          {/* Navigation Tabs */}
          <div className="bg-white rounded-xl border border-gray-200 mb-6">
            <div className="flex border-b border-gray-200">
              <button
                onClick={() => setActiveTab('overview')}
                className={`px-6 py-3 text-sm font-medium transition-colors ${
                  activeTab === 'overview'
                    ? 'text-barnes-violet border-b-2 border-barnes-violet'
                    : 'text-barnes-dark-gray hover:text-barnes-violet'
                }`}
              >
                Overzicht
              </button>
              <button
                onClick={() => setActiveTab('analysis')}
                className={`px-6 py-3 text-sm font-medium transition-colors ${
                  activeTab === 'analysis'
                    ? 'text-barnes-violet border-b-2 border-barnes-violet'
                    : 'text-barnes-dark-gray hover:text-barnes-violet'
                }`}
              >
                AI Vacature Analyse
              </button>
              <button
                onClick={() => setActiveTab('candidates')}
                className={`px-6 py-3 text-sm font-medium transition-colors ${
                  activeTab === 'candidates'
                    ? 'text-barnes-violet border-b-2 border-barnes-violet'
                    : 'text-barnes-dark-gray hover:text-barnes-violet'
                }`}
              >
                Kandidaten ({candidates.length})
              </button>
              <button
                onClick={() => setActiveTab('results')}
                className={`px-6 py-3 text-sm font-medium transition-colors ${
                  activeTab === 'results'
                    ? 'text-barnes-violet border-b-2 border-barnes-violet'
                    : 'text-barnes-dark-gray hover:text-barnes-violet'
                }`}
              >
                Resultaten ({results.length})
              </button>
              <button
                onClick={() => {
                  setActiveTab('compare');
                  setSelectedCandidatesForCompare([]);
                }}
                className={`px-6 py-3 text-sm font-medium transition-colors ${
                  activeTab === 'compare'
                    ? 'text-barnes-violet border-b-2 border-barnes-violet'
                    : 'text-barnes-dark-gray hover:text-barnes-violet'
                }`}
              >
                Vergelijk Kandidaten
              </button>
            </div>
          </div>

          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Candidate Pipeline - Made More Prominent */}
              <div className="bg-gradient-to-br from-barnes-violet/10 to-barnes-dark-violet/10 rounded-2xl border-2 border-barnes-violet/30 p-8 shadow-lg">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-2xl font-bold text-barnes-dark-violet mb-2">Kandidaat Pipeline</h2>
                    <p className="text-sm text-barnes-dark-gray">
                      Volg de voortgang van kandidaten door het recruitment proces
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-3xl font-bold text-barnes-dark-violet">{candidates.length}</div>
                    <div className="text-sm text-barnes-dark-gray">
                      totaal kandidaat{candidates.length !== 1 ? 'en' : ''}
                    </div>
                  </div>
                </div>
                
                {/* Progress Bar - More Prominent */}
                <div className="mb-8 bg-white/50 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-base font-semibold text-barnes-dark-violet">Pipeline Voortgang</span>
                    <span className="text-lg font-bold text-barnes-dark-violet">
                      {Object.values(candidateStages).reduce((sum, stage) => sum + stage.length, 0)} / {candidates.length}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden shadow-inner">
                    <div 
                      className="bg-gradient-to-r from-barnes-violet via-purple-500 to-purple-600 h-4 rounded-full transition-all duration-500 shadow-md"
                      style={{ 
                        width: `${(candidates.length > 0 ? (candidateStages.complete.length / candidates.length) * 100 : 0)}%` 
                      }}
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
                  {Object.entries(pipelineStages).map(([key, stageConfig]) => {
                    const stageCandidates = candidateStages[key as keyof typeof candidateStages];
                    return (
                      <div
                        key={key}
                        onDragOver={(e) => handleCandidateDragOver(e, key)}
                        onDragLeave={handleCandidateDragLeave}
                        onDrop={(e) => handleCandidateDrop(e, key)}
                        className={`rounded-xl border-2 p-5 transition-all bg-white shadow-md ${
                          dragOverStage === key
                            ? 'border-barnes-violet bg-barnes-violet/10 scale-105 shadow-xl'
                            : stageConfig.color
                        }`}
                      >
                        <h3 className="text-base font-bold mb-2">{stageConfig.title}</h3>
                        <p className="text-xs opacity-80 mb-3">{stageConfig.description}</p>
                        <div className="flex items-center justify-between mb-3">
                          <p className="text-sm font-semibold">{stageCandidates.length} kandidaat{stageCandidates.length !== 1 ? 'en' : ''}</p>
                          {stageCandidates.length > 0 && (
                            <span className="w-2 h-2 rounded-full bg-green-500"></span>
                          )}
                        </div>
                        <div className="space-y-2 max-h-64 overflow-y-auto">
                          {stageCandidates.map(candidate => (
                            <div
                              key={candidate.id}
                              draggable
                              onDragStart={(e) => handleCandidateDragStart(e, candidate.id)}
                              onDragEnd={handleCandidateDragEnd}
                              className={`p-2 bg-white rounded border border-gray-200 hover:border-barnes-violet transition-colors cursor-move ${
                                draggedCandidateId === candidate.id ? 'opacity-50 scale-95' : ''
                              }`}
                            >
                              <div
                                className="cursor-pointer mb-1.5"
                                onClick={() => router.push(`/company/kandidaten/${candidate.id}`)}
                              >
                                <p className="text-xs font-medium text-barnes-dark-violet truncate">{candidate.name}</p>
                                <p className="text-[10px] text-barnes-dark-gray truncate">{candidate.email}</p>
                              </div>
                              <div className="flex gap-1 mt-1.5">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openConversationModal(candidate);
                                  }}
                                  className="flex-1 px-1.5 py-0.5 text-[10px] border border-barnes-violet text-barnes-violet rounded hover:bg-barnes-violet hover:text-white transition-colors"
                                >
                                  Gesprek
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    router.push(`/company/dashboard?module=dashboard&candidateId=${candidate.id}&jobId=${jobId}`);
                                  }}
                                  className="flex-1 px-1.5 py-0.5 text-[10px] border border-barnes-orange text-barnes-orange rounded hover:bg-barnes-orange hover:text-white transition-colors"
                                >
                                  Eval.
                                </button>
                              </div>
                            </div>
                          ))}
                          {stageCandidates.length === 0 && dragOverStage === key && (
                            <div className="p-4 border-2 border-dashed border-barnes-violet rounded text-center text-xs text-barnes-dark-gray">
                              Laat hier los
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Workflow Visualization - Made Less Visible (Collapsible) */}
              <details className="bg-white/50 rounded-xl border border-gray-200 p-4">
                <summary className="cursor-pointer text-sm font-medium text-barnes-dark-gray hover:text-barnes-violet list-none">
                  <div className="flex items-center justify-between">
                    <span>Uitgebreide Voortgang (klik om uit te klappen)</span>
                    <span className="text-xs">▼</span>
                  </div>
                </summary>
                <div className="mt-4">
                  <VacancyWorkflowVisualization
                    vacancyId={jobId}
                    vacancyCreatedAt={job.created_at}
                    recruiterNotified={true}
                    candidatesAdded={candidates.length}
                    candidatesProposed={candidates.some(c => (c as any).submitted_by_company_id != null)}
                    evaluationStarted={evaluations.length > 0}
                    debateCompleted={debates.length > 0}
                    decisionMade={candidates.some(c => c.pipeline_status === 'accepted' || c.pipeline_status === 'rejected')}
                  />
                </div>
              </details>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white rounded-xl border border-gray-200 p-4">
                  <p className="text-sm text-barnes-dark-gray mb-1">Totaal kandidaten</p>
                  <p className="text-2xl font-bold text-barnes-dark-violet">{candidates.length}</p>
                </div>
                <div className="bg-white rounded-xl border border-gray-200 p-4">
                  <p className="text-sm text-barnes-dark-gray mb-1">Evaluaties</p>
                  <p className="text-2xl font-bold text-barnes-violet">{evaluations.length}</p>
                </div>
                <div className="bg-white rounded-xl border border-gray-200 p-4">
                  <p className="text-sm text-barnes-dark-gray mb-1">Debatten</p>
                  <p className="text-2xl font-bold text-barnes-orange">{debates.length}</p>
                </div>
                <div className="bg-white rounded-xl border border-gray-200 p-4">
                  <p className="text-sm text-barnes-dark-gray mb-1">Gesprekken</p>
                  <p className="text-2xl font-bold text-barnes-dark-violet">{conversations.length}</p>
                </div>
              </div>
            </div>
          )}

          {/* AI Analysis Tab */}
          {activeTab === 'analysis' && (
            <div className="space-y-6">
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold text-barnes-dark-violet">🤖 AI Vacature Analyse</h2>
                  <button
                    onClick={handleRunAnalysis}
                    className="btn-secondary text-sm"
                    disabled={isAnalyzing}
                  >
                    {isAnalyzing ? 'Analyseren...' : 'Opnieuw analyseren'}
                  </button>
                </div>
                {analysisSections.length > 0 ? (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                      {analysisSections.map((section) => (
                        <AnalysisCard key={section.label} section={section} />
                      ))}
                    </div>
                    {extensionBlock && (
                      <ExtensionPanel block={extensionBlock} />
                    )}
                  </>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-sm text-barnes-dark-gray mb-3">
                      Nog geen AI analyse uitgevoerd voor deze vacature.
                    </p>
                    <button
                      onClick={handleRunAnalysis}
                      className="btn-primary"
                      disabled={isAnalyzing}
                    >
                      {isAnalyzing ? 'Analyseren...' : 'Voer AI Analyse uit'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Candidates Tab */}
          {activeTab === 'candidates' && (
            <div className="space-y-6">
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold text-barnes-dark-violet">Kandidaten</h2>
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-barnes-dark-gray">
                      {candidates.length} kandidaat{candidates.length === 1 ? '' : 'en'} (ingediend door recruiters)
                    </span>
                    <button
                      onClick={handleAiMatching}
                      disabled={isMatching || candidates.length === 0}
                      className="px-4 py-2 bg-barnes-violet text-white rounded-lg hover:bg-barnes-dark-violet transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                    >
                      {isMatching ? 'Matching...' : '🤖 AI Matching'}
                    </button>
                  </div>
                </div>
                
                {/* AI Matches Section - Simplified */}
                {showMatches && aiMatches.length > 0 && (
                  <div className="mb-6 p-4 bg-gradient-to-r from-green-50 to-blue-50 border border-green-200 rounded-lg">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-lg font-semibold text-barnes-dark-violet">🤖 AI Matches</h3>
                      <button
                        onClick={() => setShowMatches(false)}
                        className="text-sm text-barnes-dark-gray hover:text-barnes-violet"
                      >
                        Verberg
                      </button>
                    </div>
                    <p className="text-sm text-barnes-dark-gray mb-4">
                      Kandidaten in database die mogelijk geschikt zijn voor deze rol
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {aiMatches.map((match, idx) => (
                        <button
                          key={match.candidate_id}
                          onClick={() => router.push(`/company/kandidaten/${match.candidate_id}`)}
                          className="bg-white border-2 rounded-lg p-3 hover:border-barnes-violet transition-colors text-left"
                          style={{
                            borderColor: match.match_score >= 8 ? '#10b981' : match.match_score >= 6 ? '#f59e0b' : '#ef4444'
                          }}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-lg font-bold text-barnes-violet">
                              {match.match_score.toFixed(1)}
                            </span>
                            {idx === 0 && (
                              <span className="px-2 py-0.5 bg-green-100 text-green-800 text-xs font-semibold rounded">
                                Beste
                              </span>
                            )}
                          </div>
                          <p className="font-semibold text-barnes-dark-violet text-sm">{match.candidate_name}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {candidates.length === 0 ? (
                  <p className="text-sm text-barnes-dark-gray">
                    Nog geen kandidaten gekoppeld aan deze vacature.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {candidates.map(candidate => {
                      const candidateResults = results.filter(r => r.candidate_id === candidate.id);
                      const candidateConversations = conversations.filter(c => c.candidate_id === candidate.id);
                      return (
                        <div key={candidate.id} className="border border-gray-200 rounded-lg p-4 hover:border-barnes-violet transition-colors">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex-1">
                              <p className="font-semibold text-barnes-dark-violet">{candidate.name}</p>
                              <p className="text-sm text-barnes-dark-gray">{candidate.email || '—'}</p>
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={() => openConversationModal(candidate)}
                                className="px-3 py-1.5 text-xs border border-barnes-violet text-barnes-violet rounded-lg hover:bg-barnes-violet hover:text-white transition-colors"
                              >
                                + Feedbackronde
                              </button>
                              <button
                                onClick={() => router.push(`/company/kandidaten/${candidate.id}`)}
                                className="px-3 py-1.5 text-xs text-barnes-dark-gray hover:text-barnes-violet"
                              >
                                Details →
                              </button>
                            </div>
                          </div>
                          <div className="flex gap-4 text-xs text-barnes-dark-gray">
                            <span>{candidateResults.filter(r => r.result_type === 'evaluation').length} evaluaties</span>
                            <span>{candidateResults.filter(r => r.result_type === 'debate').length} debatten</span>
                            <span>{candidateConversations.length} gesprekken</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Results Tab */}
          {activeTab === 'results' && (
            <div className="space-y-6">
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h2 className="text-xl font-semibold text-barnes-dark-violet mb-4">Evaluaties & Debatten</h2>
                {results.length === 0 ? (
                  <p className="text-sm text-barnes-dark-gray">
                    Nog geen evaluaties of debatten voor deze vacature.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <h3 className="text-lg font-semibold text-barnes-dark-violet mb-2">Evaluaties</h3>
                      {evaluations.length === 0 ? (
                        <p className="text-sm text-barnes-dark-gray">Geen evaluaties beschikbaar</p>
                      ) : (
                        <div className="space-y-3">
                          {evaluations.map(result => {
                            let score = null;
                            try {
                              const data =
                                typeof result.result_data === 'string'
                                  ? JSON.parse(result.result_data)
                                  : result.result_data;
                              score = data.combined_score;
                            } catch {
                              score = null;
                            }
                            return (
                              <button
                                key={result.id}
                                onClick={() => router.push(`/company/results/${result.id}`)}
                                className="w-full text-left border border-gray-200 rounded-lg p-4 hover:border-barnes-violet transition-colors"
                              >
                                <p className="font-semibold text-barnes-dark-violet">
                                  {result.candidate_name || 'Kandidaat'}
                                </p>
                                <p className="text-xs text-barnes-dark-gray">
                                  {new Date(result.created_at).toLocaleDateString('nl-NL')}
                                </p>
                                {score !== null && (
                                  <p className="text-sm text-barnes-violet mt-2">
                                    Score: {Number(score).toFixed(1)} / 10
                                  </p>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-barnes-dark-violet mb-2">Debatten</h3>
                      {debates.length === 0 ? (
                        <p className="text-sm text-barnes-dark-gray">Geen debatten beschikbaar</p>
                      ) : (
                        <div className="space-y-3">
                          {debates.map(result => (
                            <button
                              key={result.id}
                              onClick={() => router.push(`/company/results/${result.id}`)}
                              className="w-full text-left border border-gray-200 rounded-lg p-4 hover:border-barnes-orange transition-colors"
                            >
                              <p className="font-semibold text-barnes-dark-violet">
                                {result.candidate_name || 'Kandidaat'}
                              </p>
                              <p className="text-xs text-barnes-dark-gray">
                                {new Date(result.created_at).toLocaleDateString('nl-NL')}
                              </p>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Compare Tab */}
          {activeTab === 'compare' && (
            <div className="space-y-6">
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold text-barnes-dark-violet">Vergelijk Kandidaten</h2>
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 text-sm text-barnes-dark-gray">
                      <input
                        type="checkbox"
                        checked={includePastCandidates}
                        onChange={(e) => setIncludePastCandidates(e.target.checked)}
                        className="w-4 h-4 text-barnes-violet focus:ring-barnes-violet border-gray-300 rounded"
                      />
                      Inclusief kandidaten van andere vacatures
                    </label>
                    <div className="text-sm text-barnes-dark-gray">
                      Selecteer 2-5 kandidaten om te vergelijken
                    </div>
                  </div>
                </div>
                
                {(includePastCandidates ? allCandidates : candidates).length === 0 ? (
                  <p className="text-sm text-barnes-dark-gray">
                    Nog geen kandidaten beschikbaar.
                  </p>
                ) : (
                  <>
                    {/* Candidate Selection */}
                    <div className="mb-6 p-4 bg-barnes-light-gray rounded-lg">
                      <p className="text-sm font-medium text-barnes-dark-violet mb-3">Selecteer kandidaten om te vergelijken:</p>
                      <div className="flex flex-wrap gap-2">
                        {(includePastCandidates ? allCandidates : candidates).map(candidate => {
                          const candidateJob = candidate.job_id ? allJobs.find(j => j.id === candidate.job_id) : null;
                          const jobTitle = candidateJob ? candidateJob.title : (candidate.job_id === jobId ? job?.title : 'Onbekende vacature');
                          const isSelected = selectedCandidatesForCompare.includes(candidate.id);
                          return (
                            <button
                              key={candidate.id}
                              onClick={() => {
                                if (isSelected) {
                                  setSelectedCandidatesForCompare(prev => prev.filter(id => id !== candidate.id));
                                } else {
                                  if (selectedCandidatesForCompare.length < 5) {
                                    setSelectedCandidatesForCompare(prev => [...prev, candidate.id]);
                                  } else {
                                    alert('Maximaal 5 kandidaten kunnen worden vergeleken');
                                  }
                                }
                              }}
                              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                                isSelected
                                  ? 'bg-barnes-violet text-white border-2 border-barnes-violet'
                                  : 'bg-white text-barnes-dark-violet border-2 border-gray-300 hover:border-barnes-violet'
                              }`}
                              disabled={!isSelected && selectedCandidatesForCompare.length >= 5}
                            >
                              {candidate.name} {isSelected && '✓'}
                              {includePastCandidates && candidate.job_id !== jobId && (
                                <span className="ml-2 text-xs text-barnes-dark-gray">({jobTitle})</span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                      {selectedCandidatesForCompare.length > 0 && (
                        <button
                          onClick={() => setSelectedCandidatesForCompare([])}
                          className="mt-3 text-sm text-barnes-violet hover:text-barnes-dark-violet"
                        >
                          Selectie wissen
                        </button>
                      )}
                    </div>

                    {/* Comparison Table */}
                    {selectedCandidatesForCompare.length >= 2 ? (
                      <div className="overflow-x-auto">
                        <table className="w-full border-collapse">
                          <thead>
                            <tr className="border-b-2 border-gray-300">
                              <th className="p-3 text-left text-sm font-semibold text-barnes-dark-violet bg-barnes-light-gray sticky left-0 z-10">Meting</th>
                              {selectedCandidatesForCompare.map(candidateId => {
                                const candidate = (includePastCandidates ? allCandidates : candidates).find(c => c.id === candidateId);
                                const candidateJob = candidate?.job_id ? allJobs.find(j => j.id === candidate.job_id) : null;
                                const jobTitle = candidateJob ? candidateJob.title : (candidate?.job_id === jobId ? job?.title : 'Onbekende vacature');
                                return (
                                  <th key={candidateId} className="p-3 text-center text-sm font-semibold text-barnes-dark-violet bg-barnes-light-gray min-w-[200px]">
                                    <div>
                                      <p className="font-semibold">{candidate?.name || 'Onbekend'}</p>
                                      <p className="text-xs text-barnes-dark-gray font-normal">{candidate?.email || ''}</p>
                                      {includePastCandidates && candidate?.job_id !== jobId && (
                                        <p className="text-xs text-barnes-violet font-normal mt-1">({jobTitle})</p>
                                      )}
                                    </div>
                                  </th>
                                );
                              })}
                            </tr>
                          </thead>
                          <tbody>
                            {/* Pipeline Stage */}
                            <tr className="border-b border-gray-200 hover:bg-gray-50">
                              <td className="p-3 text-sm font-medium text-barnes-dark-gray bg-barnes-light-gray sticky left-0 z-10">Pipeline Status</td>
                              {selectedCandidatesForCompare.map(candidateId => {
                                const candidate = (includePastCandidates ? allCandidates : candidates).find(c => c.id === candidateId);
                                const stage = getCandidateStage(candidate!);
                                const stageConfig = pipelineStages[stage as keyof typeof pipelineStages];
                                return (
                                  <td key={candidateId} className="p-3 text-center">
                                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${stageConfig?.color || 'bg-gray-100'}`}>
                                      {stageConfig?.title || stage}
                                    </span>
                                  </td>
                                );
                              })}
                            </tr>
                            
                            {/* Latest Evaluation Score */}
                            <tr className="border-b border-gray-200 hover:bg-gray-50">
                              <td className="p-3 text-sm font-medium text-barnes-dark-gray bg-barnes-light-gray sticky left-0 z-10">Laatste Evaluatie Score</td>
                              {selectedCandidatesForCompare.map(candidateId => {
                                const candidateResults = results.filter(r => r.candidate_id === candidateId && r.result_type === 'evaluation');
                                const latestResult = candidateResults.sort((a, b) => 
                                  new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
                                )[0];
                                
                                let score = null;
                                if (latestResult) {
                                  try {
                                    const data = typeof latestResult.result_data === 'string' 
                                      ? JSON.parse(latestResult.result_data) 
                                      : latestResult.result_data;
                                    score = data.combined_score || data.total_score || null;
                                  } catch {
                                    score = null;
                                  }
                                }
                                
                                return (
                                  <td key={candidateId} className="p-3 text-center">
                                    {score !== null ? (
                                      <div>
                                        <span className={`text-lg font-bold ${
                                          score >= 8 ? 'text-green-600' : score >= 6 ? 'text-yellow-600' : 'text-red-600'
                                        }`}>
                                          {Number(score).toFixed(1)}
                                        </span>
                                        <span className="text-xs text-barnes-dark-gray block">/ 10</span>
                                      </div>
                                    ) : (
                                      <span className="text-xs text-barnes-dark-gray">Nog niet geëvalueerd</span>
                                    )}
                                  </td>
                                );
                              })}
                            </tr>
                            
                            {/* Evaluation Count */}
                            <tr className="border-b border-gray-200 hover:bg-gray-50">
                              <td className="p-3 text-sm font-medium text-barnes-dark-gray bg-barnes-light-gray sticky left-0 z-10">Aantal Evaluaties</td>
                              {selectedCandidatesForCompare.map(candidateId => {
                                const candidateResults = results.filter(r => r.candidate_id === candidateId && r.result_type === 'evaluation');
                                return (
                                  <td key={candidateId} className="p-3 text-center text-sm">
                                    {candidateResults.length}
                                  </td>
                                );
                              })}
                            </tr>
                            
                            {/* Debate Count */}
                            <tr className="border-b border-gray-200 hover:bg-gray-50">
                              <td className="p-3 text-sm font-medium text-barnes-dark-gray bg-barnes-light-gray sticky left-0 z-10">Aantal Debatten</td>
                              {selectedCandidatesForCompare.map(candidateId => {
                                const candidateResults = results.filter(r => r.candidate_id === candidateId && r.result_type === 'debate');
                                return (
                                  <td key={candidateId} className="p-3 text-center text-sm">
                                    {candidateResults.length}
                                  </td>
                                );
                              })}
                            </tr>
                            
                            {/* Conversation Count */}
                            <tr className="border-b border-gray-200 hover:bg-gray-50">
                              <td className="p-3 text-sm font-medium text-barnes-dark-gray bg-barnes-light-gray sticky left-0 z-10">Aantal Gesprekken</td>
                              {selectedCandidatesForCompare.map(candidateId => {
                                const candidateConversations = conversations.filter(c => c.candidate_id === candidateId);
                                return (
                                  <td key={candidateId} className="p-3 text-center text-sm">
                                    {candidateConversations.length}
                                  </td>
                                );
                              })}
                            </tr>
                            
                            {/* Days in Process */}
                            <tr className="border-b border-gray-200 hover:bg-gray-50">
                              <td className="p-3 text-sm font-medium text-barnes-dark-gray bg-barnes-light-gray sticky left-0 z-10">Dagen in Proces</td>
                              {selectedCandidatesForCompare.map(candidateId => {
                                const candidate = (includePastCandidates ? allCandidates : candidates).find(c => c.id === candidateId);
                                if (!candidate) return <td key={candidateId} className="p-3 text-center text-sm">—</td>;
                                
                                const createdDate = new Date(candidate.created_at);
                                const now = new Date();
                                const daysInProcess = Math.floor((now.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24));
                                
                                return (
                                  <td key={candidateId} className="p-3 text-center text-sm">
                                    {daysInProcess} dag{daysInProcess !== 1 ? 'en' : ''}
                                  </td>
                                );
                              })}
                            </tr>
                            
                            {/* Actions */}
                            <tr className="border-b border-gray-200">
                              <td className="p-3 text-sm font-medium text-barnes-dark-gray bg-barnes-light-gray sticky left-0 z-10">Acties</td>
                              {selectedCandidatesForCompare.map(candidateId => {
                                const candidate = (includePastCandidates ? allCandidates : candidates).find(c => c.id === candidateId);
                                return (
                                  <td key={candidateId} className="p-3 text-center">
                                    <div className="flex flex-col gap-2 items-center">
                                      <button
                                        onClick={() => router.push(`/company/kandidaten/${candidateId}`)}
                                        className="px-3 py-1 text-xs border border-barnes-violet text-barnes-violet rounded hover:bg-barnes-violet hover:text-white transition-colors"
                                      >
                                        Bekijk Details
                                      </button>
                                      <button
                                        onClick={() => router.push(`/company/dashboard?module=dashboard&candidateId=${candidateId}&jobId=${jobId}`)}
                                        className="px-3 py-1 text-xs border border-barnes-orange text-barnes-orange rounded hover:bg-barnes-orange hover:text-white transition-colors"
                                      >
                                        Evalueer
                                      </button>
                                    </div>
                                  </td>
                                );
                              })}
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="text-center py-12 text-barnes-dark-gray">
                        <p className="mb-2">Selecteer minimaal 2 kandidaten om te vergelijken</p>
                        <p className="text-sm">Klik op de namen hierboven om kandidaten te selecteren</p>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          {/* Schedule Modal */}
          {showScheduleModal && conversationModal.candidate && (
            <div
              className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
              onClick={(e) => {
                if (e.target === e.currentTarget) {
                  setShowScheduleModal(false);
                  setScheduledConversationId(null);
                }
              }}
            >
              <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-semibold text-barnes-dark-violet">Plan volgende stap</h3>
                    <p className="text-sm text-barnes-dark-gray">{conversationModal.candidate.name}</p>
                  </div>
                  <button 
                    onClick={() => {
                      setShowScheduleModal(false);
                      setScheduledConversationId(null);
                    }} 
                    className="text-gray-500 hover:text-gray-700"
                  >
                    ✕
                  </button>
                </div>
                
                <div className="space-y-4">
                  <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                    <p className="text-sm text-green-800 font-medium">✓ Feedbackronde opgeslagen</p>
                    <p className="text-xs text-green-700 mt-1">Plan nu de volgende stap in het proces</p>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium text-barnes-dark-gray">Type volgende stap</label>
                    <select
                      value={scheduleForm.type}
                      onChange={(e) => setScheduleForm({ ...scheduleForm, type: e.target.value })}
                      className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-barnes-violet"
                    >
                      <option>Eerste Interview</option>
                      <option>Tweede Interview</option>
                      <option>Technische Test</option>
                      <option>Vervolg Gesprek</option>
                      <option>Nazorg Gesprek</option>
                    </select>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="text-sm font-medium text-barnes-dark-gray">Datum</label>
                      <input
                        type="date"
                        value={scheduleForm.date}
                        onChange={(e) => setScheduleForm({ ...scheduleForm, date: e.target.value })}
                        min={new Date().toISOString().split('T')[0]}
                        className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-barnes-violet"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-barnes-dark-gray">Tijd</label>
                      <select
                        value={scheduleForm.time}
                        onChange={(e) => setScheduleForm({ ...scheduleForm, time: e.target.value })}
                        className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-barnes-violet"
                      >
                        <option value="">Selecteer tijd</option>
                        {generateTimeSlots().map(slot => (
                          <option key={slot} value={slot}>{slot}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium text-barnes-dark-gray">Locatie/Platform</label>
                    <select
                      value={scheduleForm.location}
                      onChange={(e) => setScheduleForm({ ...scheduleForm, location: e.target.value })}
                      className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-barnes-violet"
                    >
                      <option>Teams/Zoom</option>
                      <option>Live op kantoor</option>
                      <option>Telefonisch</option>
                      <option>E-mail</option>
                      <option>Anders</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium text-barnes-dark-gray">Notities (optioneel)</label>
                    <textarea
                      rows={3}
                      value={scheduleForm.notes}
                      onChange={(e) => setScheduleForm({ ...scheduleForm, notes: e.target.value })}
                      placeholder="Extra informatie over de geplande afspraak..."
                      className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-barnes-violet"
                    />
                  </div>
                  
                  {scheduleForm.date && scheduleForm.time && (
                    <div className="p-3 bg-barnes-light-gray rounded-lg">
                      <p className="text-sm font-medium text-barnes-dark-violet">Geplande afspraak:</p>
                      <p className="text-sm text-barnes-dark-gray mt-1">
                        {new Date(`${scheduleForm.date}T${scheduleForm.time}`).toLocaleString('nl-NL', {
                          weekday: 'long',
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                      <p className="text-xs text-barnes-dark-gray mt-1">
                        {scheduleForm.type} • {scheduleForm.location}
                      </p>
                    </div>
                  )}
                </div>
                
                <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                  <button 
                    className="btn-secondary" 
                    onClick={() => {
                      setShowScheduleModal(false);
                      setScheduledConversationId(null);
                    }}
                  >
                    Overslaan
                  </button>
                  <button
                    className="btn-primary"
                    onClick={handleSaveSchedule}
                    disabled={isSavingSchedule || !scheduleForm.date || !scheduleForm.time}
                  >
                    {isSavingSchedule ? 'Plannen...' : 'Plan afspraak'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Conversation Modal */}
          {conversationModal.open && conversationModal.candidate && (
            <div
              className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
              onClick={(e) => {
                if (e.target === e.currentTarget) closeConversationModal();
              }}
            >
              <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-semibold text-barnes-dark-violet">Nieuwe feedbackronde</h3>
                    <p className="text-sm text-barnes-dark-gray">{conversationModal.candidate.name}</p>
                  </div>
                  <button onClick={closeConversationModal} className="text-gray-500 hover:text-gray-700">
                    ✕
                  </button>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-medium text-barnes-dark-gray">Titel</label>
                    <input
                      type="text"
                      value={conversationForm.title}
                      onChange={(e) => setConversationForm({ ...conversationForm, title: e.target.value })}
                      className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-barnes-violet"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-barnes-dark-gray">Kanaal</label>
                    <select
                      value={conversationForm.channel}
                      onChange={(e) => setConversationForm({ ...conversationForm, channel: e.target.value })}
                      className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-barnes-violet"
                    >
                      <option>Telefonisch</option>
                      <option>Teams/Zoom</option>
                      <option>Live gesprek</option>
                      <option>E-mail</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-barnes-dark-gray">Samenvatting</label>
                    <textarea
                      rows={4}
                      value={conversationForm.summary}
                      onChange={(e) => setConversationForm({ ...conversationForm, summary: e.target.value })}
                      className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-barnes-violet"
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="text-sm font-medium text-barnes-dark-gray">Pluspunten</label>
                      <textarea
                        rows={3}
                        value={conversationForm.pros}
                        onChange={(e) => setConversationForm({ ...conversationForm, pros: e.target.value })}
                        className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-barnes-violet"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-barnes-dark-gray">Aandachtspunten</label>
                      <textarea
                        rows={3}
                        value={conversationForm.cons}
                        onChange={(e) => setConversationForm({ ...conversationForm, cons: e.target.value })}
                        className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-barnes-violet"
                      />
                    </div>
                  </div>
                </div>
                <div className="flex justify-end gap-3">
                  <button className="btn-secondary" onClick={closeConversationModal}>
                    Annuleren
                  </button>
                  <button
                    className="btn-primary"
                    onClick={handleSaveConversation}
                    disabled={isSavingConversation}
                  >
                    {isSavingConversation ? 'Opslaan...' : 'Opslaan'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

    </div>
  );
}

function AnalysisCard({ section }: { section: AnalysisSection }) {
  if (!section) return null;
  return (
    <div className="p-4 border border-gray-200 rounded-xl bg-gray-50">
      <div className="flex items-start justify-between gap-3 mb-2">
        <h4 className="text-sm font-semibold text-barnes-dark-violet">{section.label}</h4>
        {section.rating !== null && (
          <div className="text-right">
            <div className="text-2xl font-bold text-barnes-violet leading-none">
              {section.rating.toFixed(1)}
            </div>
            <div className="text-[10px] uppercase tracking-wide text-barnes-dark-gray">score / 10</div>
          </div>
        )}
      </div>
      <p className="text-sm text-barnes-dark-gray leading-relaxed">{section.summary}</p>
    </div>
  );
}

function ExtensionPanel({ block }: { block: ExtensionBlock }) {
  if (!block) return null;
  return (
    <div className="mt-4 p-4 border border-dashed border-barnes-dark-gray/30 rounded-xl bg-white/70">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 mb-2">
        <h4 className="text-sm font-semibold text-barnes-dark-violet">Roluitbreiding & vervolgstappen</h4>
        {block.advice && (
          <span className="text-[11px] uppercase font-semibold px-3 py-1 rounded-full bg-barnes-violet/10 text-barnes-violet tracking-wide">
            Advies: {block.advice}
          </span>
        )}
      </div>
      <p className="text-sm text-barnes-dark-gray leading-relaxed">{block.overview}</p>
      {block.recommended_actions.length > 0 && (
        <div className="mt-4 space-y-3">
          {block.recommended_actions.map((action, idx) => (
            <div
              key={`${action.title}-${idx}`}
              className="p-3 rounded-lg border border-gray-200 bg-barnes-light-gray/40"
            >
              <div className="flex items-center justify-between gap-3 mb-1">
                <p className="text-sm font-semibold text-barnes-dark-violet">{action.title}</p>
                {action.priority && (
                  <span className="text-[10px] uppercase tracking-wide text-barnes-dark-gray bg-white px-2 py-0.5 rounded-full border">
                    Prioriteit: {action.priority}
                  </span>
                )}
              </div>
              {action.impact && (
                <p className="text-xs text-barnes-dark-gray">{action.impact}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

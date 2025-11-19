'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import CompanyNavigation from '../../../../components/CompanyNavigation';
import { buildAnalysisSections, buildExtensionBlock, AnalysisSection, ExtensionBlock } from '../../../../utils/analysis';

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
}

type TabType = 'overview' | 'analysis' | 'candidates' | 'results';

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

  useEffect(() => {
    loadData();
  }, [jobId]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [jobsRes, candidatesRes, resultsRes, conversationsRes] = await Promise.all([
        fetch('/api/job-descriptions'),
        fetch(`/api/candidates?job_id=${jobId}`),
        fetch(`/api/evaluation-results?job_id=${jobId}`),
        fetch(`/api/candidate-conversations?job_id=${jobId}`)
      ]);

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
      closeConversationModal();
      await loadData();
    } catch (error: any) {
      alert(error.message || 'Opslaan mislukt');
    } finally {
      setIsSavingConversation(false);
    }
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
    const candidateResults = results.filter(r => r.candidate_id === candidate.id);
    const candidateConversations = conversations.filter(c => c.candidate_id === candidate.id);
    const hasEvaluations = candidateResults.some(r => r.result_type === 'evaluation');
    const hasDebates = candidateResults.some(r => r.result_type === 'debate');
    const conversationCount = candidateConversations.length;

    if (!hasEvaluations && !hasDebates && conversationCount === 0) return 'wachtend';
    if (conversationCount === 0) return 'in_behandeling';
    if (conversationCount === 1) return 'na_1e_gesprek';
    if (conversationCount >= 2 && conversationCount < 4) return 'multi_round';
    return 'afgerond';
  };

  const candidateStages = {
    wachtend: candidates.filter(c => getCandidateStage(c) === 'wachtend'),
    in_behandeling: candidates.filter(c => getCandidateStage(c) === 'in_behandeling'),
    na_1e_gesprek: candidates.filter(c => getCandidateStage(c) === 'na_1e_gesprek'),
    multi_round: candidates.filter(c => getCandidateStage(c) === 'multi_round'),
    afgerond: candidates.filter(c => getCandidateStage(c) === 'afgerond'),
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
      <div className="md:ml-64 p-4 md:p-8">
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
            </div>
          </div>

          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
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

              {/* Candidate Pipeline */}
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h2 className="text-xl font-semibold text-barnes-dark-violet mb-4">Kandidaat Pipeline</h2>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                  {Object.entries({
                    wachtend: { title: 'Wachtend op actie', candidates: candidateStages.wachtend },
                    in_behandeling: { title: 'In behandeling', candidates: candidateStages.in_behandeling },
                    na_1e_gesprek: { title: 'Na 1e gesprek', candidates: candidateStages.na_1e_gesprek },
                    multi_round: { title: '2e/3e gesprek', candidates: candidateStages.multi_round },
                    afgerond: { title: 'Afgerond', candidates: candidateStages.afgerond },
                  }).map(([key, { title, candidates: stageCandidates }]) => (
                    <div key={key} className="bg-gray-50 rounded-lg border border-gray-200 p-4">
                      <h3 className="text-sm font-semibold text-barnes-dark-violet mb-2">{title}</h3>
                      <p className="text-xs text-barnes-dark-gray mb-3">{stageCandidates.length} kandidaat{stageCandidates.length !== 1 ? 'en' : ''}</p>
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {stageCandidates.map(candidate => (
                          <div
                            key={candidate.id}
                            className="p-2 bg-white rounded border border-gray-200 hover:border-barnes-violet transition-colors"
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
                      </div>
                    </div>
                  ))}
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
                      {candidates.length} kandidaat{candidates.length === 1 ? '' : 'en'}
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
                
                {/* AI Matches Section */}
                {showMatches && aiMatches.length > 0 && (
                  <div className="mb-6 p-4 bg-gradient-to-r from-green-50 to-blue-50 border border-green-200 rounded-lg">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-lg font-semibold text-barnes-dark-violet">🤖 AI Match Resultaten</h3>
                      <button
                        onClick={() => setShowMatches(false)}
                        className="text-sm text-barnes-dark-gray hover:text-barnes-violet"
                      >
                        Verberg
                      </button>
                    </div>
                    <p className="text-sm text-barnes-dark-gray mb-4">
                      Kandidaten gesorteerd op match score (hoogste eerst)
                    </p>
                    <div className="space-y-3">
                      {aiMatches.map((match, idx) => (
                        <div
                          key={match.candidate_id}
                          className="bg-white border-2 rounded-lg p-4"
                          style={{
                            borderColor: match.match_score >= 8 ? '#10b981' : match.match_score >= 6 ? '#f59e0b' : '#ef4444',
                            borderWidth: idx === 0 ? '3px' : '2px'
                          }}
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                <span className="text-2xl font-bold text-barnes-violet">
                                  {match.match_score.toFixed(1)}
                                </span>
                                <span className="text-sm text-barnes-dark-gray">/ 10</span>
                                {idx === 0 && (
                                  <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-semibold rounded">
                                    Beste Match
                                  </span>
                                )}
                              </div>
                              <p className="font-semibold text-barnes-dark-violet">{match.candidate_name}</p>
                            </div>
                            <button
                              onClick={() => router.push(`/company/kandidaten/${match.candidate_id}`)}
                              className="px-3 py-1.5 text-xs border border-barnes-violet text-barnes-violet rounded-lg hover:bg-barnes-violet hover:text-white transition-colors"
                            >
                              Bekijk →
                            </button>
                          </div>
                          <p className="text-sm text-barnes-dark-gray mb-3">{match.reasoning}</p>
                          {match.strengths && match.strengths.length > 0 && (
                            <div className="mb-2">
                              <p className="text-xs font-semibold text-green-700 mb-1">Sterke punten:</p>
                              <ul className="text-xs text-barnes-dark-gray list-disc list-inside">
                                {match.strengths.map((strength: string, i: number) => (
                                  <li key={i}>{strength}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {match.concerns && match.concerns.length > 0 && (
                            <div>
                              <p className="text-xs font-semibold text-orange-700 mb-1">Aandachtspunten:</p>
                              <ul className="text-xs text-barnes-dark-gray list-disc list-inside">
                                {match.concerns.map((concern: string, i: number) => (
                                  <li key={i}>{concern}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {match.evaluation_score && (
                            <p className="text-xs text-barnes-dark-gray mt-2">
                              Eerdere evaluatie score: {match.evaluation_score.toFixed(1)}/10
                            </p>
                          )}
                        </div>
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

'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';

interface JobDescription {
  id: string;
  title: string;
  company: string;
  description: string;
  requirements: string;
  location: string;
  salary_range: string;
  created_at: string;
  timeline_stage?: string | null;
}

interface JobStats {
  job_id: string;
  total_candidates: number;
  unique_candidates: number;
  evaluations_count: number;
  debates_count: number;
  days_posted: number;
  conversation_rounds: number;
  status: 'in_progress' | 'waiting';
}

interface Candidate {
  id: string;
  name: string;
  email?: string;
  conversation_count?: number;
}

export default function CompanyVacatures() {
  const [jobs, setJobs] = useState<JobDescription[]>([]);
  const [jobStats, setJobStats] = useState<Record<string, JobStats>>({});
  const [jobCandidateMap, setJobCandidateMap] = useState<Record<string, Candidate[]>>({});
  const [conversationModal, setConversationModal] = useState<{ open: boolean; job: JobDescription | null }>({ open: false, job: null });
  const [conversationForm, setConversationForm] = useState({
    candidateId: '',
    title: '',
    summary: '',
    pros: '',
    cons: '',
    channel: 'Telefonisch',
  });
  const [isSavingConversation, setIsSavingConversation] = useState(false);
  const [draggedJobId, setDraggedJobId] = useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = useState<TimelineStageKey | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const router = useRouter();

  useEffect(() => {
    loadJobs();
  }, []);

  useEffect(() => {
    if (jobs.length > 0) {
      loadJobStats();
    }
  }, [jobs]);

  const loadJobs = async () => {
    try {
      const response = await fetch('/api/job-descriptions');
      if (response.ok) {
        const data = await response.json();
        setJobs(data.jobs || []);
      }
    } catch (error) {
      console.error('Error loading jobs:', error);
    }
  };

  const loadJobStats = async () => {
    try {
      const stats: Record<string, JobStats> = {};
      const candidateMap: Record<string, Candidate[]> = {};
      
      // Parallelize all API calls for better performance
      const statsPromises = jobs.map(async (job) => {
        const [candidatesRes, resultsRes] = await Promise.all([
          fetch(`/api/candidates?job_id=${job.id}`),
          fetch(`/api/evaluation-results?job_id=${job.id}`)
        ]);
        
        const candidatesData = candidatesRes.ok ? await candidatesRes.json() : { candidates: [] };
        const candidates = candidatesData.candidates || [];
        candidateMap[job.id] = candidates;
        
        const resultsData = resultsRes.ok ? await resultsRes.json() : { results: [] };
        const results = resultsData.results || [];
        
        const evaluations = results.filter((r: any) => r.result_type === 'evaluation');
        const debates = results.filter((r: any) => r.result_type === 'debate');
        const uniqueCandidateIds = new Set(candidates.map((c: any) => c.id));
        
        const createdDate = new Date(job.created_at);
        const now = new Date();
        const daysPosted = Math.floor((now.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24));
        
        const conversationRounds = candidates.reduce((sum: number, candidate: Candidate) => {
          return sum + (candidate.conversation_count || 0);
        }, 0);
        
        // Determine status: in_progress if there are evaluations/debates, waiting otherwise
        const status: JobStats['status'] = (evaluations.length > 0 || debates.length > 0)
          ? 'in_progress'
          : 'waiting';
        
        return {
          jobId: job.id,
          stats: {
            job_id: job.id,
            total_candidates: candidates.length,
            unique_candidates: uniqueCandidateIds.size,
            evaluations_count: evaluations.length,
            debates_count: debates.length,
            days_posted: daysPosted,
            conversation_rounds: conversationRounds,
            status
          }
        };
      });
      
      const results = await Promise.all(statsPromises);
      results.forEach(({ jobId, stats: jobStats }) => {
        stats[jobId] = jobStats;
      });
      
      setJobStats(stats);
      setJobCandidateMap(candidateMap);
    } catch (error) {
      console.error('Error loading job stats:', error);
    }
  };

  const formatDays = (days: number) => {
    if (days === 0) return 'Vandaag';
    if (days === 1) return '1 dag';
    return `${days} dagen`;
  };

  const openConversationModal = (job: JobDescription) => {
    const candidates = jobCandidateMap[job.id] || [];
    setConversationForm({
      candidateId: candidates[0]?.id || '',
      title: '',
      summary: '',
      pros: '',
      cons: '',
      channel: 'Telefonisch',
    });
    setConversationModal({ open: true, job });
  };

  const closeConversationModal = () => {
    setConversationModal({ open: false, job: null });
  };

  const handleSaveConversation = async () => {
    if (!conversationModal.job) return;
    if (!conversationForm.candidateId || !conversationForm.title || !conversationForm.summary) {
      alert('Selecteer een kandidaat en vul een titel en samenvatting in.');
      return;
    }
    setIsSavingConversation(true);
    try {
      const payload = {
        candidate_id: conversationForm.candidateId,
        job_id: conversationModal.job.id,
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
      await loadJobStats();
    } catch (error: any) {
      alert(error.message || 'Opslaan mislukt');
    } finally {
      setIsSavingConversation(false);
    }
  };

  type TimelineStageKey = 'waiting' | 'inProgress' | 'afterFirst' | 'multiRound' | 'completed';

  const timelineStages: { key: TimelineStageKey; title: string; description: string }[] = [
    { key: 'waiting', title: 'Vacatures wachtend op 1e actie', description: 'Nog geen evaluaties of gesprekken gestart.' },
    { key: 'inProgress', title: 'Vacatures in behandeling', description: 'Evaluaties of debatten zijn gestart.' },
    { key: 'afterFirst', title: 'Vacatures na 1e gesprek', description: 'Minimaal één gesprek vastgelegd.' },
    { key: 'multiRound', title: 'Potentieel 2e en 3e gesprek', description: 'Meerdere feedbackmomenten ingepland.' },
    { key: 'completed', title: 'Gesprekken afgerond / aanbieding', description: 'Volledige gesprekscyclus afgerond.' },
  ];

  const getStageForJob = (job: JobDescription, stats?: JobStats): TimelineStageKey => {
    // If job has a manual timeline_stage override, use that
    if (job.timeline_stage && ['waiting', 'inProgress', 'afterFirst', 'multiRound', 'completed'].includes(job.timeline_stage)) {
      return job.timeline_stage as TimelineStageKey;
    }
    // Otherwise, calculate from stats
    if (!stats) return 'waiting';
    if (stats.evaluations_count === 0 && stats.debates_count === 0 && stats.conversation_rounds === 0) return 'waiting';
    if (stats.conversation_rounds === 0) return 'inProgress';
    if (stats.conversation_rounds === 1) return 'afterFirst';
    if (stats.conversation_rounds >= 2 && stats.conversation_rounds < 4) return 'multiRound';
    return 'completed';
  };

  // Removed categorizeJobs - now using direct filtering in render

  const filteredJobs = useMemo(() => {
    if (!searchTerm.trim()) return jobs;
    const term = searchTerm.toLowerCase();
    return jobs.filter(job => 
      job.title.toLowerCase().includes(term) ||
      job.company.toLowerCase().includes(term) ||
      (job.description && job.description.toLowerCase().includes(term))
    );
  }, [jobs, searchTerm]);

  const handleDragStart = (e: React.DragEvent, jobId: string) => {
    setDraggedJobId(jobId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', jobId);
  };

  const handleDragOver = (e: React.DragEvent, stageKey: TimelineStageKey) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverStage(stageKey);
  };

  const handleDragLeave = () => {
    setDragOverStage(null);
  };

  const handleDrop = async (e: React.DragEvent, targetStage: TimelineStageKey) => {
    e.preventDefault();
    setDragOverStage(null);
    
    if (!draggedJobId) return;
    
    const job = jobs.find(j => j.id === draggedJobId);
    if (!job) return;
    
    // Don't update if already in the same stage
    const currentStage = getStageForJob(job, jobStats[job.id]);
    if (currentStage === targetStage) {
      setDraggedJobId(null);
      return;
    }
    
    try {
      // Update job timeline_stage via API
      const formData = new FormData();
      formData.append('timeline_stage', targetStage);
      
      const response = await fetch(`/api/job-descriptions/${draggedJobId}`, {
        method: 'PUT',
        body: formData
      });
      
      if (!response.ok) {
        throw new Error('Failed to update job stage');
      }
      
      // Update local state
      const updatedJobs = jobs.map(j => 
        j.id === draggedJobId ? { ...j, timeline_stage: targetStage } : j
      );
      setJobs(updatedJobs);
      
      // Reload stats to reflect changes
      await loadJobStats();
    } catch (error) {
      console.error('Error updating job stage:', error);
      alert('Kon vacature stage niet bijwerken. Probeer het opnieuw.');
    } finally {
      setDraggedJobId(null);
    }
  };

  const handleDragEnd = () => {
    setDraggedJobId(null);
    setDragOverStage(null);
  };

  const renderJobCard = (job: JobDescription, stageKey: TimelineStageKey) => {
    const stats = jobStats[job.id];
    if (!stats) return null;
    const jobCandidates = jobCandidateMap[job.id] || [];
    const canAddConversation = jobCandidates.length > 0;

    const statusBadge =
      stageKey !== 'waiting'
        ? 'bg-gradient-to-r from-barnes-violet/20 to-barnes-violet/5 border border-barnes-violet/30 shadow-sm'
        : 'bg-white border border-dashed border-gray-300';

    return (
      <div
        key={job.id}
        draggable
        onDragStart={(e) => handleDragStart(e, job.id)}
        onDragEnd={handleDragEnd}
        className={`rounded-2xl p-4 cursor-move transition-all duration-200 hover:shadow-md ${statusBadge} min-w-0 ${
          draggedJobId === job.id ? 'opacity-50 scale-95' : ''
        }`}
        onClick={() => router.push(`/company/vacatures/${job.id}`)}
      >
        <div className="flex justify-between items-start mb-3 gap-2">
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-semibold text-barnes-dark-violet truncate">{job.title}</h3>
            <p className="text-xs text-barnes-dark-gray truncate">{job.company}</p>
          </div>
          <span
            className={`px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap flex-shrink-0 ${
              stats.status === 'in_progress'
                ? 'bg-barnes-violet text-white'
                : 'bg-gray-100 text-gray-600 border border-gray-200'
            }`}
          >
            {stats.status === 'in_progress' ? 'Actief' : 'Wachtend'}
          </span>
        </div>
        <div className="space-y-1.5 text-xs">
          <div className="flex justify-between items-center">
            <span className="text-barnes-dark-gray truncate">Evaluaties:</span>
            <span className="font-medium text-barnes-dark-violet ml-2">{stats.evaluations_count}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-barnes-dark-gray truncate">Kandidaten:</span>
            <span className="font-medium text-barnes-dark-violet ml-2">{stats.unique_candidates}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-barnes-dark-gray truncate">Debatten:</span>
            <span className="font-medium text-barnes-dark-violet ml-2">{stats.debates_count}</span>
          </div>
          {stats.conversation_rounds > 0 && (
            <div className="flex justify-between items-center">
              <span className="text-barnes-dark-gray truncate">Gesprekken:</span>
              <span className="font-medium text-barnes-dark-violet ml-2">{stats.conversation_rounds}</span>
            </div>
          )}
        </div>
        <div className="mt-3 pt-3 border-t border-gray-200">
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (canAddConversation) {
                openConversationModal(job);
              }
            }}
            disabled={!canAddConversation}
            className={`w-full px-3 py-1.5 rounded-lg text-xs border ${
              canAddConversation
                ? 'border-barnes-violet text-barnes-violet hover:bg-barnes-violet hover:text-white transition-colors'
                : 'border-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            + Feedbackronde
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-barnes-dark-violet mb-2">Vacatures</h1>
          <p className="text-barnes-dark-gray">Overzicht van alle actieve vacatures</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={loadJobs}
            className="btn-secondary"
          >
            Vernieuwen
          </button>
          <button
            onClick={() => router.push('/company/vacatures/nieuw')}
            className="btn-primary"
          >
            + Nieuwe Vacature
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="mb-6">
        <div className="relative">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Zoek vacatures op titel, bedrijf of beschrijving..."
            className="w-full px-4 py-3 pl-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-barnes-violet focus:border-transparent"
          />
          <svg
            className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          )}
        </div>
        {searchTerm && (
          <p className="mt-2 text-sm text-barnes-dark-gray">
            {filteredJobs.length} vacature{filteredJobs.length !== 1 ? 's' : ''} gevonden
          </p>
        )}
      </div>

      {filteredJobs.length > 0 ? (
        <div className="space-y-6">
          {timelineStages.map(stage => {
            const stageJobs = filteredJobs.filter(job => getStageForJob(job, jobStats[job.id]) === stage.key);
            if (stageJobs.length === 0) return null;
            
            return (
              <section
                key={stage.key}
                onDragOver={(e) => handleDragOver(e, stage.key)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, stage.key)}
                className={`bg-white rounded-2xl border-2 p-6 shadow-sm transition-all ${
                  dragOverStage === stage.key
                    ? 'border-barnes-violet border-dashed bg-barnes-violet/5'
                    : 'border-gray-200'
                }`}
              >
                <div className="mb-4">
                  <h2 className="text-lg font-semibold text-barnes-dark-violet mb-1">{stage.title}</h2>
                  <p className="text-sm text-barnes-dark-gray">{stage.description}</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
                  {stageJobs.map(job => renderJobCard(job, stage.key as TimelineStageKey))}
                </div>
              </section>
            );
          })}
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
          <div className="text-6xl mb-4">🔍</div>
          <p className="text-barnes-dark-gray text-lg">
            {searchTerm ? 'Geen vacatures gevonden voor deze zoekterm' : 'Geen vacatures gevonden'}
          </p>
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="mt-4 text-barnes-violet hover:underline"
            >
              Wis zoekterm
            </button>
          )}
        </div>
      )}

      {conversationModal.open && conversationModal.job && (
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
                <p className="text-sm text-barnes-dark-gray">{conversationModal.job.title}</p>
              </div>
              <button onClick={closeConversationModal} className="text-gray-500 hover:text-gray-700">
                ✕
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-barnes-dark-gray">Kandidaat</label>
                <select
                  value={conversationForm.candidateId}
                  onChange={(e) => setConversationForm({ ...conversationForm, candidateId: e.target.value })}
                  className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-barnes-violet"
                >
                  {(jobCandidateMap[conversationModal.job.id] || []).map(candidate => (
                    <option key={candidate.id} value={candidate.id}>
                      {candidate.name}
                    </option>
                  ))}
                </select>
              </div>
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
  );
}


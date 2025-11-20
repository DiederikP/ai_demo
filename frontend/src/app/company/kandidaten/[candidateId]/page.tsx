'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import ProtectedRoute from '../../../../components/ProtectedRoute';
import CompanyNavigation from '../../../../components/CompanyNavigation';
import CandidateReviewInfographic from '../../../../components/CandidateReviewInfographic';
import CommentsSection from '../../../../components/CommentsSection';
import ApprovalSection from '../../../../components/ApprovalSection';

interface Candidate {
  id: string;
  name: string;
  email?: string;
  job_id?: string | null;
  job?: {
    id: string;
    title: string;
    company: string;
  };
  motivational_letter?: string | null;
  resume_text?: string | null;
  preferential_job_ids?: string | null;
  company_note?: string | null;
  created_at: string;
  conversation_count?: number;
}

interface Job {
  id: string;
  title: string;
  company: string;
}

interface Conversation {
  id: string;
  title: string;
  summary: string;
  pros?: string;
  cons?: string;
  persona_guidance?: Record<string, string> | null;
  created_at?: string;
  conversation_channel?: string;
}

export default function CandidateDetailPage() {
  const params = useParams();
  const router = useRouter();
  const candidateId = params.candidateId as string;

  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [preferentialJobs, setPreferentialJobs] = useState<Job[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [evaluationResults, setEvaluationResults] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploadingResume, setIsUploadingResume] = useState(false);
  const [isUploadingMotivation, setIsUploadingMotivation] = useState(false);
  const [isSavingConversation, setIsSavingConversation] = useState(false);
  const [conversationModalOpen, setConversationModalOpen] = useState(false);
  const [conversationForm, setConversationForm] = useState({
    title: '',
    summary: '',
    pros: '',
    cons: '',
    guidance: '',
    channel: 'Telefonisch',
  });

  useEffect(() => {
    // Get current user ID
    const userId = localStorage.getItem('current_user_id');
    if (userId) {
      setCurrentUserId(userId);
    } else {
      // Create default user if none exists
      fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          email: 'demo@barnes.nl',
          name: 'Demo User',
          role: 'admin'
        })
      })
        .then(res => res.json())
        .then(data => {
          if (data.success && data.user) {
            localStorage.setItem('current_user_id', data.user.id);
            setCurrentUserId(data.user.id);
          }
        });
    }
    
    loadJobs();
    loadCandidate();
    loadConversations();
    loadEvaluationResults();
  }, [candidateId]);

  const loadEvaluationResults = async () => {
    try {
      const response = await fetch(`/api/evaluation-results?candidate_id=${candidateId}`);
      if (response.ok) {
        const data = await response.json();
        setEvaluationResults(data.results || []);
      }
    } catch (error) {
      console.error('Error loading evaluation results:', error);
    }
  };

  useEffect(() => {
    if (candidate && jobs.length > 0) {
      if (candidate.preferential_job_ids) {
        const prefIds = candidate.preferential_job_ids
          .split(',')
          .map((id) => id.trim())
          .filter(Boolean);
        setPreferentialJobs(jobs.filter((job) => prefIds.includes(job.id)));
      } else {
        setPreferentialJobs([]);
      }
    }
  }, [candidate, jobs]);

  const loadCandidate = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/candidates/${candidateId}`);
      if (response.ok) {
        const data = await response.json();
        setCandidate(data.candidate || null);
      } else {
        setCandidate(null);
      }
    } catch (error) {
      console.error('Error loading candidate:', error);
      setCandidate(null);
    } finally {
      setIsLoading(false);
    }
  };

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

  const loadConversations = async () => {
    try {
      const response = await fetch(`/api/candidate-conversations?candidate_id=${candidateId}`);
      if (response.ok) {
        const data = await response.json();
        setConversations(data.conversations || []);
      }
    } catch (error) {
      console.error('Error loading conversations:', error);
    }
  };

  const handleResumeUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !candidate) return;
    setIsUploadingResume(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('candidate_id', candidate.id);
      formData.append('name', candidate.name);
      if (candidate.email) formData.append('email', candidate.email);
      if (candidate.job_id) formData.append('job_id', candidate.job_id);
      if (candidate.preferential_job_ids) formData.append('job_ids', candidate.preferential_job_ids);

      const response = await fetch('/api/upload-resume', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Onbekende fout' }));
        throw new Error(error.error || 'Upload mislukt');
      }

      await loadCandidate();
      alert('CV succesvol bijgewerkt');
    } catch (error: any) {
      alert(error.message || 'Upload mislukt');
    } finally {
      setIsUploadingResume(false);
    }
  };

  const handleMotivationUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingMotivation(true);
    try {
      const formData = new FormData();
      formData.append('candidate_id', candidateId);
      formData.append('motivation_file', file);
      const response = await fetch('/api/upload-motivation', {
        method: 'POST',
        body: formData,
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Onbekende fout' }));
        throw new Error(error.error || 'Upload mislukt');
      }
      await loadCandidate();
      alert('Motivatiebrief succesvol bijgewerkt');
    } catch (error: any) {
      alert(error.message || 'Upload mislukt');
    } finally {
      setIsUploadingMotivation(false);
    }
  };

  const handleDeleteResume = async () => {
    if (!confirm('Weet u zeker dat u het CV wilt verwijderen?')) return;
    try {
      const response = await fetch(`/api/candidates/${candidateId}/resume`, { method: 'DELETE' });
      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Onbekende fout' }));
        throw new Error(error.error || 'Verwijderen mislukt');
      }
      await loadCandidate();
    } catch (error: any) {
      alert(error.message || 'Verwijderen mislukt');
    }
  };

  const handleDeleteMotivation = async () => {
    if (!confirm('Weet u zeker dat u de motivatiebrief wilt verwijderen?')) return;
    try {
      const response = await fetch(`/api/candidates/${candidateId}/motivation`, { method: 'DELETE' });
      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Onbekende fout' }));
        throw new Error(error.error || 'Verwijderen mislukt');
      }
      await loadCandidate();
    } catch (error: any) {
      alert(error.message || 'Verwijderen mislukt');
    }
  };

  const handleAssignToJob = async (jobId: string, showWarning: boolean = true) => {
    if (!candidate || !jobId) return;
    
    // Show warning popup if requested (candidate-2 requirement)
    if (showWarning) {
      const confirmed = window.confirm(
        `⚠️ Waarschuwing: Deze kandidaat wordt toegewezen aan de vacature "${jobs.find(j => j.id === jobId)?.title || jobId}".\n\n` +
        `Dit betekent dat:\n` +
        `• De kandidaat is gekoppeld aan deze vacature\n` +
        `• Evaluaties en debatten worden gekoppeld aan deze vacature\n` +
        `• Andere gebruikers kunnen de kandidaat zien in de vacature\n\n` +
        `Doorgaan?`
      );
      if (!confirmed) return;
    }
    
    try {
      const response = await fetch(`/api/candidates/${candidateId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          job_id: jobId,
          name: candidate.name,
          email: candidate.email,
        })
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Onbekende fout' }));
        throw new Error(error.error || 'Toewijzen mislukt');
      }
      await loadCandidate();
      alert('Kandidaat succesvol toegewezen aan vacature');
    } catch (error: any) {
      alert(error.message || 'Toewijzen mislukt');
    }
  };

  const handleConversationSubmit = async () => {
    if (!conversationForm.title || !conversationForm.summary) {
      alert('Titel en samenvatting zijn verplicht');
      return;
    }
    setIsSavingConversation(true);
    try {
      const payload: any = {
        candidate_id: candidateId,
        job_id: candidate?.job_id,
        title: conversationForm.title,
        summary: conversationForm.summary,
        pros: conversationForm.pros || undefined,
        cons: conversationForm.cons || undefined,
        conversation_channel: conversationForm.channel || undefined,
      };
      if (conversationForm.guidance) {
        payload.persona_guidance = { all: conversationForm.guidance };
      }
      const response = await fetch('/api/candidate-conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Onbekende fout' }));
        throw new Error(error.error || 'Opslaan mislukt');
      }
      setConversationModalOpen(false);
      setConversationForm({
        title: '',
        summary: '',
        pros: '',
        cons: '',
        guidance: '',
        channel: 'Telefonisch',
      });
      await loadConversations();
    } catch (error: any) {
      alert(error.message || 'Opslaan mislukt');
    } finally {
      setIsSavingConversation(false);
    }
  };

  if (isLoading) {
    return <div className="flex min-h-screen items-center justify-center text-barnes-dark-gray">Laden...</div>;
  }

  if (!candidate) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <p className="text-barnes-dark-gray">Kandidaat niet gevonden</p>
          <Link href="/company/dashboard" className="mt-4 inline-block text-barnes-violet hover:underline">
            Terug naar dashboard
          </Link>
        </div>
      </div>
    );
  }

  const assignedJob = candidate.job_id ? jobs.find((j) => j.id === candidate.job_id) : null;

  return (
    <div className="flex">
      <CompanyNavigation
        activeModule="kandidaten"
        onModuleChange={(module) => {
          if (module === 'kandidaten') {
            router.push('/company/dashboard?module=kandidaten');
          } else if (module === 'dashboard') {
            router.push('/company/dashboard');
          } else {
            router.push(`/company/dashboard?module=${module}`);
          }
        }}
      />
      <div className="flex-1 bg-barnes-light-gray min-h-screen p-4 md:p-8 transition-all duration-300" style={{ marginLeft: 'var(--nav-width, 16rem)' }}>
        <div className="mb-6 flex items-center justify-between">
          <div>
            <button onClick={() => router.back()} className="text-barnes-violet hover:underline text-sm mb-1">
              ← Terug
            </button>
            <h1 className="text-3xl font-bold text-barnes-dark-violet">{candidate.name}</h1>
            <p className="text-sm text-barnes-dark-gray">{candidate.email || 'Geen email beschikbaar'}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-barnes-dark-gray">Toegevoegd op</p>
            <p className="text-sm font-medium text-barnes-dark-violet">
              {candidate.created_at ? new Date(candidate.created_at).toLocaleDateString('nl-NL') : '-'}
            </p>
          </div>
        </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-6">
              <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm xl:col-span-2">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold text-barnes-dark-violet">Vacatures & Toewijzing</h2>
                  <button
                    onClick={() => {
                      const selectJob = prompt('Selecteer een vacature ID of gebruik de dropdown hieronder');
                      if (selectJob) {
                        // In production, this would be a proper modal with job selection
                        handleAssignToJob(selectJob, true); // Show warning
                      }
                    }}
                    className="px-4 py-2 bg-barnes-violet text-white rounded-lg hover:bg-barnes-dark-violet transition-colors text-sm"
                  >
                    Toewijzen aan rol
                  </button>
                </div>
                {assignedJob && (
                  <div className="mb-4 p-4 rounded-xl border border-barnes-violet/20 bg-barnes-violet/5">
                    <p className="text-sm text-barnes-dark-gray">Huidige vacature</p>
                    <p className="text-lg font-semibold text-barnes-dark-violet">{assignedJob.title}</p>
                    <p className="text-sm text-barnes-dark-gray">{assignedJob.company}</p>
                  </div>
                )}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-barnes-dark-gray mb-2">Toewijzen aan nieuwe rol</label>
                  <select
                    onChange={(e) => {
                      if (e.target.value) {
                        handleAssignToJob(e.target.value, true); // Show warning
                        e.target.value = ''; // Reset dropdown
                      }
                    }}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-barnes-violet focus:border-transparent"
                    value=""
                  >
                    <option value="">Kies een vacature...</option>
                    {jobs.map((job) => (
                      <option key={job.id} value={job.id}>
                        {job.title} - {job.company}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <p className="text-sm font-medium text-barnes-dark-gray mb-2">Preferentiële vacatures</p>
                  {preferentialJobs.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {preferentialJobs.map((job) => (
                        <div key={job.id} className="p-3 rounded-xl border border-gray-200 bg-gray-50">
                          <p className="font-medium text-barnes-dark-violet">{job.title}</p>
                          <p className="text-sm text-barnes-dark-gray">{job.company}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">Geen voorkeuren opgeslagen</p>
                  )}
                </div>
              </div>

          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-barnes-dark-violet mb-4">Kandidaat info</h2>
            <dl className="text-sm space-y-3 text-barnes-dark-gray">
              <div className="flex justify-between">
                <dt>Naam</dt>
                <dd className="font-medium text-barnes-dark-violet">{candidate.name}</dd>
              </div>
              <div className="flex justify-between">
                <dt>Email</dt>
                <dd className="font-medium text-barnes-dark-violet">{candidate.email || '-'}</dd>
              </div>
              <div className="flex justify-between">
                <dt>Vacature</dt>
                <dd className="font-medium text-barnes-dark-violet">{assignedJob ? assignedJob.title : '-'}</dd>
              </div>
            </dl>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <section className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-barnes-dark-violet">CV</h2>
              <label className="btn-secondary text-xs cursor-pointer">
                {isUploadingResume ? 'Uploaden...' : 'CV vervangen'}
                <input
                  type="file"
                  onChange={handleResumeUpload}
                  disabled={isUploadingResume}
                  accept=".pdf,.doc,.docx,.txt"
                  className="hidden"
                />
              </label>
            </div>
            {candidate.resume_text ? (
              <>
                <div className="mb-3 flex items-center justify-between text-xs text-barnes-dark-gray">
                  <span>{candidate.resume_text.length} karakters</span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        const blob = new Blob([candidate.resume_text || ''], { type: 'text/plain' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `${candidate.name}_CV.txt`;
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        URL.revokeObjectURL(url);
                      }}
                      className="text-barnes-violet hover:text-barnes-dark-violet hover:underline"
                    >
                      📥 Download
                    </button>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(candidate.resume_text || '');
                        alert('CV gekopieerd naar klembord');
                      }}
                      className="text-barnes-violet hover:text-barnes-dark-violet hover:underline"
                    >
                      📋 Kopieer
                    </button>
                  </div>
                </div>
                <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 max-h-64 overflow-y-auto text-sm text-barnes-dark-gray whitespace-pre-wrap">
                  {candidate.resume_text}
                </div>
                <button
                  onClick={handleDeleteResume}
                  className="mt-3 text-sm text-red-600 hover:text-red-800"
                >
                  CV verwijderen
                </button>
              </>
            ) : (
              <p className="text-sm text-gray-500">Geen CV beschikbaar</p>
            )}
          </section>

          <section className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-barnes-dark-violet">Motivatiebrief</h2>
              <label className="btn-secondary text-xs cursor-pointer">
                {isUploadingMotivation ? 'Uploaden...' : 'Motivatie vervangen'}
                <input
                  type="file"
                  onChange={handleMotivationUpload}
                  disabled={isUploadingMotivation}
                  accept=".pdf,.doc,.docx,.txt"
                  className="hidden"
                />
              </label>
            </div>
            {candidate.motivational_letter ? (
              <>
                <div className="mb-3 flex items-center justify-between text-xs text-barnes-dark-gray">
                  <span>{candidate.motivational_letter.length} karakters</span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        const blob = new Blob([candidate.motivational_letter || ''], { type: 'text/plain' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `${candidate.name}_Motivatiebrief.txt`;
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        URL.revokeObjectURL(url);
                      }}
                      className="text-barnes-violet hover:text-barnes-dark-violet hover:underline"
                    >
                      📥 Download
                    </button>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(candidate.motivational_letter || '');
                        alert('Motivatiebrief gekopieerd naar klembord');
                      }}
                      className="text-barnes-violet hover:text-barnes-dark-violet hover:underline"
                    >
                      📋 Kopieer
                    </button>
                  </div>
                </div>
                <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 max-h-64 overflow-y-auto text-sm text-barnes-dark-gray whitespace-pre-wrap">
                  {candidate.motivational_letter}
                </div>
                <button
                  onClick={handleDeleteMotivation}
                  className="mt-3 text-sm text-red-600 hover:text-red-800"
                >
                  Motivatiebrief verwijderen
                </button>
              </>
            ) : (
              <p className="text-sm text-gray-500">Geen motivatiebrief beschikbaar</p>
            )}
          </section>
        </div>

        {/* Company Note Section */}
        {candidate.company_note && (
          <section className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-barnes-dark-violet">
                Bedrijfsnotitie (van leverancier)
              </h2>
              <div className="flex gap-2 text-xs">
                <button
                  onClick={() => {
                    const blob = new Blob([candidate.company_note || ''], { type: 'text/plain' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `${candidate.name}_Bedrijfsnotitie.txt`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                  }}
                  className="text-barnes-violet hover:text-barnes-dark-violet hover:underline"
                >
                  📥 Download
                </button>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(candidate.company_note || '');
                    alert('Bedrijfsnotitie gekopieerd naar klembord');
                  }}
                  className="text-barnes-violet hover:text-barnes-dark-violet hover:underline"
                >
                  📋 Kopieer
                </button>
              </div>
            </div>
            <div className="mb-3 text-xs text-barnes-dark-gray">
              {candidate.company_note.length} karakters
            </div>
            <div className="rounded-xl border border-barnes-orange/20 bg-barnes-orange/5 p-4 text-sm text-barnes-dark-gray whitespace-pre-wrap">
              {candidate.company_note}
            </div>
          </section>
        )}

        {/* Evaluation History - Removed 360 view per user request */}
        {evaluationResults.length > 0 && (
          <section className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm mb-6">
            <h2 className="text-xl font-semibold text-barnes-dark-violet mb-4">Evaluatie Geschiedenis</h2>
            <div className="space-y-3">
              {evaluationResults.map((result: any) => (
                <div key={result.id} className="p-4 border border-gray-200 rounded-xl">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-barnes-dark-violet">
                      {result.result_type === 'evaluation' ? '📊 Evaluatie' : '💬 Debat'}
                    </span>
                    <span className="text-xs text-barnes-dark-gray">
                      {new Date(result.created_at).toLocaleString('nl-NL')}
                    </span>
                  </div>
                  {result.job_id && (
                    <p className="text-sm text-barnes-dark-gray">
                      Vacature: {jobs.find(j => j.id === result.job_id)?.title || 'Onbekend'}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Comments Section */}
        {currentUserId && (
          <div className="mb-6">
            <CommentsSection
              candidateId={candidateId}
              currentUserId={currentUserId}
            />
          </div>
        )}

        {/* Approval Section */}
        {currentUserId && candidate && (
          <div className="mb-6">
            <ApprovalSection
              candidateId={candidateId}
              jobId={candidate.job_id || undefined}
              currentUserId={currentUserId}
              approvalType="candidate_hire"
            />
          </div>
        )}

        {/* Review Infographic */}
        <div className="mb-6">
          <CandidateReviewInfographic
            hasResume={!!candidate.resume_text}
            hasMotivationLetter={!!candidate.motivational_letter}
            hasCompanyNote={!!candidate.company_note}
            hasCompanyEvaluation={false}
            personas={Array.from(new Set(evaluationResults.flatMap((r: any) => r.selected_personas || [])))}
            companyNote={candidate.company_note || undefined}
          />
        </div>

        <section className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-semibold text-barnes-dark-violet">Gesprekken</h2>
              <p className="text-sm text-barnes-dark-gray">
                Gebruik gesprekken om pro&apos;s en contra&apos;s vast te leggen en Digitale werknemers bij te sturen.
              </p>
            </div>
            <button className="btn-primary text-sm" onClick={() => setConversationModalOpen(true)}>
              + Nieuw gesprek
            </button>
          </div>

          {conversations.length === 0 ? (
            <p className="text-sm text-gray-500">Nog geen gesprekken opgeslagen</p>
          ) : (
            <div className="space-y-4">
              {conversations.map((conversation) => (
                <div key={conversation.id} className="p-4 border border-gray-100 rounded-xl bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-barnes-dark-gray">
                        {conversation.conversation_channel || 'Onbekend kanaal'}
                      </p>
                      <h3 className="text-lg font-semibold text-barnes-dark-violet">{conversation.title}</h3>
                    </div>
                    <p className="text-xs text-barnes-dark-gray">
                      {conversation.created_at
                        ? new Date(conversation.created_at).toLocaleString('nl-NL')
                        : ''}
                    </p>
                  </div>
                  <p className="mt-2 text-sm text-barnes-dark-gray whitespace-pre-wrap">{conversation.summary}</p>
                  <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                    {conversation.pros && (
                      <div className="p-3 rounded-lg bg-green-50 border border-green-200">
                        <p className="font-semibold text-green-700 mb-1">Pluspunten</p>
                        <p className="text-green-800 whitespace-pre-wrap">{conversation.pros}</p>
                      </div>
                    )}
                    {conversation.cons && (
                      <div className="p-3 rounded-lg bg-red-50 border border-red-200">
                        <p className="font-semibold text-red-700 mb-1">Aandachtspunten</p>
                        <p className="text-red-800 whitespace-pre-wrap">{conversation.cons}</p>
                      </div>
                    )}
                  </div>
                  {conversation.persona_guidance && (() => {
                    let entries: [string, string][] = [];
                    if (typeof conversation.persona_guidance === 'string') {
                      try {
                        const parsed = JSON.parse(conversation.persona_guidance);
                        entries = Object.entries(parsed);
                      } catch {
                        entries = [['all', conversation.persona_guidance]];
                      }
                    } else {
                      entries = Object.entries(conversation.persona_guidance);
                    }
                    return (
                      <div className="mt-3 p-3 rounded-lg bg-barnes-orange/10 border border-barnes-orange/30 text-sm">
                        <p className="font-semibold text-barnes-dark-violet mb-1">Instructies voor Digitale werknemers</p>
                        <pre className="whitespace-pre-wrap text-barnes-dark-gray">
                          {entries.map(([key, value]) => `${key}: ${value}`).join('\n')}
                        </pre>
                      </div>
                    );
                  })()}
                </div>
              ))}
            </div>
          )}
        </section>

        {conversationModalOpen && (
          <div
            className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
            onClick={(e) => {
              if (e.target === e.currentTarget) setConversationModalOpen(false);
            }}
          >
            <div className="bg-white rounded-2xl max-w-2xl w-full p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold text-barnes-dark-violet">Nieuw gesprek vastleggen</h3>
                <button onClick={() => setConversationModalOpen(false)} className="text-gray-500 hover:text-gray-700">
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
                <div>
                  <label className="text-sm font-medium text-barnes-dark-gray">Digitale werknemers instructies</label>
                  <textarea
                    rows={3}
                    placeholder="Bijv. Focus op deze sterke punten en stel kritische vragen over salarisverwachting."
                    value={conversationForm.guidance}
                    onChange={(e) => setConversationForm({ ...conversationForm, guidance: e.target.value })}
                    className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-barnes-violet"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3">
                <button className="btn-secondary" onClick={() => setConversationModalOpen(false)}>
                  Annuleren
                </button>
                <button
                  className="btn-primary"
                  onClick={handleConversationSubmit}
                  disabled={isSavingConversation}
                >
                  {isSavingConversation ? 'Opslaan...' : 'Gesprek opslaan'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


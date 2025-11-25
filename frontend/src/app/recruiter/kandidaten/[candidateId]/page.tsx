'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import ProtectedRoute from '../../../../components/ProtectedRoute';
import { getAuthHeaders, getAuthHeadersForFormData } from '../../../../lib/auth';
import Link from 'next/link';

interface Candidate {
  id: string;
  name: string;
  email: string;
  job_id?: string;
  job_title?: string;
  company_note?: string;
  pipeline_stage?: string;
  pipeline_status?: string;
  submitted_by_company_id?: string;
  preferential_job_ids?: string | null;
  created_at: string;
  job?: {
    id: string;
    title: string;
    company: string;
    location?: string;
  };
  resume_text?: string | null;
  motivational_letter?: string | null;
  experience_years?: number | null;
  skills?: string | null;
  education?: string | null;
  location?: string | null;
  age?: number | null;
  availability_per_week?: number | null;
  notice_period?: string | null;
  salary_expectation?: number | null;
  source?: string | null;
  skill_tags?: string[] | string | null;
}

export default function RecruiterCandidateDetail() {
  const params = useParams();
  const router = useRouter();
  const candidateId = params?.candidateId as string;
  
  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditingNote, setIsEditingNote] = useState(false);
  const [companyNote, setCompanyNote] = useState('');
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [isUploadingResume, setIsUploadingResume] = useState(false);
  const [isUploadingMotivation, setIsUploadingMotivation] = useState(false);

  useEffect(() => {
    if (candidateId) {
      loadCandidate();
    }
  }, [candidateId]);

  const loadCandidate = async () => {
    try {
      console.log(`[RecruiterCandidateDetail] Loading candidate ${candidateId}`);
      const headers = getAuthHeaders();
      const response = await fetch(`/api/candidates/${candidateId}`, { headers });
      
      console.log(`[RecruiterCandidateDetail] Response status: ${response.status}`);
      
      if (response.ok) {
        const data = await response.json();
        console.log(`[RecruiterCandidateDetail] Candidate data:`, data);
        
        if (data.candidate) {
          setCandidate(data.candidate);
          setCompanyNote(data.candidate.company_note || '');
        } else if (data.success && data.candidate) {
          // Handle alternative response format
          setCandidate(data.candidate);
          setCompanyNote(data.candidate.company_note || '');
        } else {
          throw new Error('Invalid response format: candidate data not found');
        }
      } else {
        // Get error message from response
        const errorText = await response.text();
        let errorData: any = { error: errorText || 'Unknown error' };
        
        try {
          errorData = JSON.parse(errorText);
        } catch {
          // Not JSON, use text as error
          errorData = { error: errorText || `Server error: ${response.status} ${response.statusText}` };
        }
        
        console.error('[RecruiterCandidateDetail] Error loading candidate:', {
          status: response.status,
          statusText: response.statusText,
          errorData,
          errorText
        });
        
        const errorMessage = errorData.error || errorData.detail || errorData.message || `Fout bij laden kandidaat (${response.status})`;
        alert(`Fout bij laden kandidaat: ${errorMessage}`);
      }
    } catch (error: any) {
      console.error('[RecruiterCandidateDetail] Exception loading candidate:', error);
      console.error('[RecruiterCandidateDetail] Error stack:', error.stack);
      alert(`Fout bij laden kandidaat: ${error.message || 'Onbekende fout'}`);
    } finally {
      setIsLoading(false);
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
      if (candidate.submitted_by_company_id) {
        formData.append('submitted_by_company_id', candidate.submitted_by_company_id);
      }

      const headers = getAuthHeadersForFormData();

      const response = await fetch('/api/upload-resume', {
        method: 'POST',
        headers,
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Upload mislukt' }));
        throw new Error(errorData.error || 'Upload mislukt');
      }

      await loadCandidate();
      alert('CV succesvol bijgewerkt');
    } catch (error: any) {
      alert(error.message || 'Upload mislukt');
    } finally {
      setIsUploadingResume(false);
      e.target.value = '';
    }
  };

  const handleMotivationUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !candidate) return;
    setIsUploadingMotivation(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('candidate_id', candidate.id);
      formData.append('name', candidate.name);
      if (candidate.email) formData.append('email', candidate.email);
      if (candidate.job_id) formData.append('job_id', candidate.job_id);

      const headers = getAuthHeadersForFormData();

      const response = await fetch('/api/upload-motivation', {
        method: 'POST',
        headers,
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Upload mislukt' }));
        throw new Error(errorData.error || 'Upload mislukt');
      }

      await loadCandidate();
      alert('Motivatiebrief succesvol bijgewerkt');
    } catch (error: any) {
      alert(error.message || 'Upload mislukt');
    } finally {
      setIsUploadingMotivation(false);
      e.target.value = '';
    }
  };

  const handleDeleteResume = async () => {
    if (!candidate) return;
    if (!confirm('Weet je zeker dat je het CV wilt verwijderen?')) return;
    try {
      const headers = getAuthHeaders();
      const response = await fetch(`/api/candidates/${candidate.id}/resume`, {
        method: 'DELETE',
        headers,
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Verwijderen mislukt' }));
        throw new Error(errorData.error || 'Verwijderen mislukt');
      }
      await loadCandidate();
      alert('CV verwijderd');
    } catch (error: any) {
      alert(error.message || 'Verwijderen mislukt');
    }
  };

  const handleDeleteMotivation = async () => {
    if (!candidate) return;
    if (!confirm('Weet je zeker dat je de motivatiebrief wilt verwijderen?')) return;
    try {
      const headers = getAuthHeaders();
      const response = await fetch(`/api/candidates/${candidate.id}/motivation`, {
        method: 'DELETE',
        headers,
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Verwijderen mislukt' }));
        throw new Error(errorData.error || 'Verwijderen mislukt');
      }
      await loadCandidate();
      alert('Motivatiebrief verwijderd');
    } catch (error: any) {
      alert(error.message || 'Verwijderen mislukt');
    }
  };

  const downloadText = (text: string | null | undefined, filename: string) => {
    if (!text) return;
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleSaveNote = async () => {
    if (!candidate) return;
    
    setIsSavingNote(true);
    try {
      const headers = getAuthHeaders();
      const response = await fetch(`/api/candidates/${candidateId}`, {
        method: 'PUT',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          company_note: companyNote,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setCandidate(data.candidate);
        setIsEditingNote(false);
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        alert(`Fout bij opslaan bedrijfsnotitie: ${errorData.error || 'Onbekende fout'}`);
      }
    } catch (error: any) {
      console.error('Error saving note:', error);
      alert(`Fout bij opslaan bedrijfsnotitie: ${error.message || 'Onbekende fout'}`);
    } finally {
      setIsSavingNote(false);
    }
  };

  if (isLoading) {
    return (
      <ProtectedRoute>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-barnes-dark-gray">Laden...</div>
        </div>
      </ProtectedRoute>
    );
  }

  if (!candidate) {
    return (
      <ProtectedRoute>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-barnes-dark-gray">Kandidaat niet gevonden</div>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="mb-6">
            <Link
              href="/recruiter/dashboard"
              className="text-barnes-violet hover:underline text-sm mb-4 inline-block"
            >
              ← Terug naar dashboard
            </Link>
            <h1 className="text-3xl font-bold text-barnes-dark-violet">
              {candidate.name}
            </h1>
            <p className="text-barnes-dark-gray mt-2">{candidate.email}</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Content */}
            <div className="lg:col-span-2 space-y-6">
              {/* Pipeline Status */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h2 className="text-xl font-semibold text-barnes-dark-violet mb-4">
                  Proces Status
                </h2>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-barnes-dark-gray">Fase</label>
                    <div className="mt-1 font-medium">
                      {candidate.pipeline_stage || 'Niet toegewezen'}
                    </div>
                  </div>
                  <div>
                    <label className="text-sm text-barnes-dark-gray">Status</label>
                    <div className="mt-1">
                      <span className={`px-3 py-1 text-sm rounded-full ${
                        candidate.pipeline_status === 'active' ? 'bg-green-100 text-green-800' :
                        candidate.pipeline_status === 'on_hold' ? 'bg-yellow-100 text-yellow-800' :
                        candidate.pipeline_status === 'rejected' ? 'bg-red-100 text-red-800' :
                        candidate.pipeline_status === 'accepted' ? 'bg-blue-100 text-blue-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {candidate.pipeline_status || 'Actief'}
                      </span>
                    </div>
                  </div>
                </div>
                {candidate.job_title && (
                  <div className="mt-4">
                    <label className="text-sm text-barnes-dark-gray">Vacature</label>
                    <div className="mt-1 font-medium">{candidate.job_title}</div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 gap-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <section className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-xl font-semibold text-barnes-dark-violet">CV</h2>
                      <label className="btn-secondary text-xs cursor-pointer">
                        {isUploadingResume ? 'Uploaden...' : 'CV uploaden'}
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
                          <div className="flex gap-3">
                            <button
                              onClick={() => downloadText(candidate.resume_text, `${candidate.name}_CV.txt`)}
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
                          className="mt-3 text-sm text-red-600 hover:text-red-700"
                        >
                          CV verwijderen
                        </button>
                      </>
                    ) : (
                      <p className="text-sm text-gray-500">Nog geen CV opgeslagen</p>
                    )}
                  </section>

                  <section className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-xl font-semibold text-barnes-dark-violet">Motivatiebrief</h2>
                      <label className="btn-secondary text-xs cursor-pointer">
                        {isUploadingMotivation ? 'Uploaden...' : 'Motivatie uploaden'}
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
                          <div className="flex gap-3">
                            <button
                              onClick={() =>
                                downloadText(candidate.motivational_letter, `${candidate.name}_Motivatiebrief.txt`)
                              }
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
                          className="mt-3 text-sm text-red-600 hover:text-red-700"
                        >
                          Motivatiebrief verwijderen
                        </button>
                      </>
                    ) : (
                      <p className="text-sm text-gray-500">Nog geen motivatiebrief opgeslagen</p>
                    )}
                  </section>
                </div>
              </div>

              {/* Company Note */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold text-barnes-dark-violet">
                    Bedrijfsnotitie
                  </h2>
                  {!isEditingNote && (
                    <button
                      onClick={() => setIsEditingNote(true)}
                      className="px-4 py-2 bg-barnes-violet text-white rounded-lg hover:bg-barnes-dark-violet transition-colors text-sm"
                    >
                      Bewerken
                    </button>
                  )}
                </div>

                {isEditingNote ? (
                  <div className="space-y-4">
                    <textarea
                      value={companyNote}
                      onChange={(e) => setCompanyNote(e.target.value)}
                      className="w-full h-48 p-3 border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-barnes-violet"
                      placeholder="Voeg hier belangrijke informatie toe over de kandidaat (bijv. motivatie, salariswensen, beschikbaarheid, etc.)"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={handleSaveNote}
                        disabled={isSavingNote}
                        className="px-4 py-2 bg-barnes-violet text-white rounded-lg hover:bg-barnes-dark-violet transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isSavingNote ? 'Opslaan...' : 'Opslaan'}
                      </button>
                      <button
                        onClick={() => {
                          setCompanyNote(candidate.company_note || '');
                          setIsEditingNote(false);
                        }}
                        className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                      >
                        Annuleren
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="text-barnes-dark-gray whitespace-pre-wrap min-h-[100px]">
                    {candidate.company_note || 'Nog geen bedrijfsnotitie toegevoegd. Klik op "Bewerken" om er een toe te voegen.'}
                  </div>
                )}
              </div>
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Quick Actions */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-barnes-dark-violet mb-4">
                  Acties
                </h3>
                <div className="space-y-2">
                  {candidate.job_id && (
                    <Link
                      href={`/recruiter/vacatures/${candidate.job_id}`}
                      className="block w-full px-4 py-2 bg-gray-100 text-barnes-dark-violet rounded-lg hover:bg-gray-200 transition-colors text-center text-sm"
                    >
                      Bekijk Vacature
                    </Link>
                  )}
                </div>
              </div>

              {/* Info */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-barnes-dark-violet mb-4">
                  Informatie
                </h3>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-barnes-dark-gray">Toegevoegd</span>
                    <span className="font-medium text-barnes-dark-violet">
                      {new Date(candidate.created_at).toLocaleDateString('nl-NL')}
                    </span>
                  </div>
                  {candidate.location && (
                    <div className="flex justify-between">
                      <span className="text-barnes-dark-gray">Locatie</span>
                      <span className="font-medium text-barnes-dark-violet">
                        {candidate.location}
                      </span>
                    </div>
                  )}
                  {candidate.experience_years != null && (
                    <div className="flex justify-between">
                      <span className="text-barnes-dark-gray">Ervaring</span>
                      <span className="font-medium text-barnes-dark-violet">
                        {candidate.experience_years} jaar
                      </span>
                    </div>
                  )}
                  {candidate.salary_expectation != null && (
                    <div className="flex justify-between">
                      <span className="text-barnes-dark-gray">Salaris wens</span>
                      <span className="font-medium text-barnes-dark-violet">
                        €{candidate.salary_expectation} / 40u
                      </span>
                    </div>
                  )}
                  {candidate.availability_per_week != null && (
                    <div className="flex justify-between">
                      <span className="text-barnes-dark-gray">Beschikbaar (u/w)</span>
                      <span className="font-medium text-barnes-dark-violet">
                        {candidate.availability_per_week}
                      </span>
                    </div>
                  )}
                  {candidate.notice_period && (
                    <div className="flex justify-between">
                      <span className="text-barnes-dark-gray">Opzegtermijn</span>
                      <span className="font-medium text-barnes-dark-violet">
                        {candidate.notice_period}
                      </span>
                    </div>
                  )}
                  {candidate.source && (
                    <div className="flex justify-between">
                      <span className="text-barnes-dark-gray">Bron</span>
                      <span className="font-medium text-barnes-dark-violet">
                        {candidate.source}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {candidate.skills && (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  <h3 className="text-lg font-semibold text-barnes-dark-violet mb-4">
                    Vaardigheden
                  </h3>
                  <p className="text-sm text-barnes-dark-gray whitespace-pre-wrap">
                    {candidate.skills}
                  </p>
                </div>
              )}

              {candidate.skill_tags && (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  <h3 className="text-lg font-semibold text-barnes-dark-violet mb-4">
                    Skill Tags
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {(Array.isArray(candidate.skill_tags) ? candidate.skill_tags : [candidate.skill_tags])
                      .filter(Boolean)
                      .map((tag, index) => (
                        <span
                          key={`${tag}-${index}`}
                          className="px-3 py-1 rounded-full text-xs bg-barnes-violet/10 text-barnes-violet"
                        >
                          {tag}
                        </span>
                      ))}
                  </div>
                </div>
              )}

              {candidate.education && (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  <h3 className="text-lg font-semibold text-barnes-dark-violet mb-4">
                    Opleiding
                  </h3>
                  <p className="text-sm text-barnes-dark-gray whitespace-pre-wrap">
                    {candidate.education}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}


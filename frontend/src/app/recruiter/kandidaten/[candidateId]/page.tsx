'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import ProtectedRoute from '../../../../components/ProtectedRoute';
import { getAuthHeaders } from '../../../../lib/auth';
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
  created_at: string;
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
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="text-barnes-dark-gray">Toegevoegd:</span>
                    <div className="font-medium">
                      {new Date(candidate.created_at).toLocaleDateString('nl-NL')}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}


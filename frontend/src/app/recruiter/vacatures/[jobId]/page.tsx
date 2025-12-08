'use client';

import { useEffect, useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import ProtectedRoute from '../../../../components/ProtectedRoute';
import RecruiterNavigation from '../../../../components/RecruiterNavigation';
import { getAuthHeaders } from '../../../../lib/auth';

interface Vacancy {
  id: string;
  title: string;
  company: string;
  description: string;
  requirements: string;
  location: string;
  salary_range: string;
  created_at: string;
}

interface Candidate {
  id: string;
  name: string;
  email: string;
  resume_text?: string;
  created_at: string;
  job_id?: string;
  company_note?: string;
}

export default function RecruiterVacancyDetailPage() {
  const params = useParams();
  const router = useRouter();
  const jobId = params.jobId as string;

  const [vacancy, setVacancy] = useState<Vacancy | null>(null);
  const [allCandidates, setAllCandidates] = useState<Candidate[]>([]);
  const [assignedCandidates, setAssignedCandidates] = useState<Candidate[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCandidates, setSelectedCandidates] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isMatching, setIsMatching] = useState(false);
  const [aiMatches, setAiMatches] = useState<Array<{candidate_id: string; candidate_name: string; match_score: number; reasoning: string; strengths: string | string[]; concerns: string | string[]; evaluation_score?: number}>>([]);
  const [showAiMatches, setShowAiMatches] = useState(false);

  useEffect(() => {
    loadData();
  }, [jobId]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const headers = getAuthHeaders();
      
      // Load vacancy
      const vacancyRes = await fetch(`/api/recruiter/vacancies?include_new=true`, { headers });
      if (vacancyRes.ok) {
        const vacancyData = await vacancyRes.json();
        const foundVacancy = (vacancyData.vacancies || []).find((v: Vacancy) => v.id === jobId);
        if (foundVacancy) {
          setVacancy(foundVacancy);
        }
      }

      // Load all recruiter's candidates (for search)
      const candidatesRes = await fetch('/api/recruiter/candidates', { headers });
      if (candidatesRes.ok) {
        const candidatesData = await candidatesRes.json();
        setAllCandidates(candidatesData.candidates || []);
      }

      // Load candidates already assigned to this vacancy
      const assignedRes = await fetch(`/api/candidates?job_id=${jobId}`, { headers });
      if (assignedRes.ok) {
        const assignedData = await assignedRes.json();
        const recruiterAssigned = (assignedData.candidates || []).filter(
          (c: Candidate) => c.job_id === jobId
        );
        setAssignedCandidates(recruiterAssigned);
      }
    } catch (error: any) {
      console.error('Error loading data:', error);
      alert(`Fout bij laden: ${error.message || 'Onbekende fout'}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Filter candidates based on search term
  const filteredCandidates = useMemo(() => {
    if (!searchTerm.trim()) return [];
    
    const term = searchTerm.toLowerCase();
    return allCandidates.filter(candidate => {
      const nameMatch = candidate.name?.toLowerCase().includes(term);
      const emailMatch = candidate.email?.toLowerCase().includes(term);
      const resumeMatch = candidate.resume_text?.toLowerCase().includes(term);
      const alreadyAssigned = assignedCandidates.some(ac => ac.id === candidate.id);
      
      return (nameMatch || emailMatch || resumeMatch) && !alreadyAssigned;
    }).slice(0, 10); // Limit to 10 results for performance
  }, [searchTerm, allCandidates, assignedCandidates]);

  const handleToggleCandidate = (candidateId: string) => {
    setSelectedCandidates(prev => {
      const newSet = new Set(prev);
      if (newSet.has(candidateId)) {
        newSet.delete(candidateId);
      } else {
        newSet.add(candidateId);
      }
      return newSet;
    });
  };

  const handleAddSelectedCandidates = async () => {
    if (selectedCandidates.size === 0 || !jobId) {
      alert('Selecteer ten minste één kandidaat');
      return;
    }

    setIsSubmitting(true);
    try {
      const headers = getAuthHeaders();
      const candidateIds = Array.from(selectedCandidates);
      
      // Add all selected candidates to the vacancy
      const promises = candidateIds.map(candidateId =>
        fetch(`/api/candidates/${candidateId}`, {
          method: 'PUT',
          headers: {
            ...headers,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            job_id: jobId,
          }),
        })
      );

      const results = await Promise.all(promises);
      const failed = results.filter(r => !r.ok);
      
      if (failed.length > 0) {
        throw new Error(`${failed.length} kandidaat(en) konden niet worden toegevoegd`);
      }

      // Reload data
      await loadData();
      setSelectedCandidates(new Set());
      setSearchTerm('');
      
      alert(`${candidateIds.length} kandidaat(en) succesvol toegevoegd aan vacature!`);
    } catch (error: any) {
      alert(`Fout: ${error.message || 'Onbekende fout'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSendToCompany = async () => {
    if (assignedCandidates.length === 0) {
      alert('Geen kandidaten toegevoegd om te versturen');
      return;
    }

    if (!confirm(`Weet je zeker dat je ${assignedCandidates.length} kandidaat(en) naar het bedrijf wilt sturen?`)) {
      return;
    }

    try {
      const headers = getAuthHeaders();
      
      // Create notification for company about new candidates
      // This will be handled by the backend when candidates are assigned
      // For now, we'll just show a success message
      alert(`${assignedCandidates.length} kandidaat(en) zijn beschikbaar voor het bedrijf om te evalueren.`);
      
      // Optionally reload to refresh status
      await loadData();
    } catch (error: any) {
      alert(`Fout: ${error.message || 'Onbekende fout'}`);
    }
  };

  const handleAiMatch = async () => {
    if (!jobId) {
      alert('Geen vacature geselecteerd');
      return;
    }

    setIsMatching(true);
    setShowAiMatches(true);
    try {
      const { getAuthHeadersForFormData } = await import('../../../../lib/auth');
      const headers = getAuthHeadersForFormData();
      const formData = new FormData();
      formData.append('job_id', jobId);
      formData.append('limit', '10');

      const response = await fetch('/api/match-candidates', {
        method: 'POST',
        headers,
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || 'AI matching failed');
      }

      const data = await response.json();
      if (data.success && data.matches) {
        setAiMatches(data.matches);
      } else {
        setAiMatches([]);
        alert(data.message || 'Geen matches gevonden');
      }
    } catch (error: any) {
      console.error('Error matching candidates:', error);
      alert(`Fout bij AI matching: ${error.message || 'Onbekende fout'}`);
      setAiMatches([]);
    } finally {
      setIsMatching(false);
    }
  };

  if (isLoading) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen bg-barnes-light-gray flex items-center justify-center">
          <div className="text-barnes-dark-gray">Laden...</div>
        </div>
      </ProtectedRoute>
    );
  }

  if (!vacancy) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen bg-barnes-light-gray flex items-center justify-center">
          <div className="text-center">
            <div className="text-barnes-dark-gray mb-4">Vacature niet gevonden</div>
            <button
              onClick={() => router.push('/recruiter/dashboard?module=vacatures')}
              className="btn-primary"
            >
              Terug naar Vacatures
            </button>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-barnes-light-gray">
        <RecruiterNavigation
          activeModule="vacatures"
          onModuleChange={(module) => {
            router.push(`/recruiter/dashboard?module=${module}`);
          }}
        />
        <div className="p-4 md:p-8 transition-all duration-300" style={{ marginLeft: 'var(--nav-width, 16rem)' }}>
          <div className="max-w-7xl mx-auto">
            {/* Header */}
            <div className="mb-6">
              <button
                onClick={() => router.push('/recruiter/dashboard?module=vacatures')}
                className="text-barnes-violet hover:text-barnes-dark-violet flex items-center gap-2 mb-3"
              >
                <span>←</span>
                <span>Terug naar Vacatures</span>
              </button>
              <h1 className="text-3xl font-bold text-barnes-dark-violet mb-2">{vacancy.title}</h1>
              <p className="text-sm text-barnes-dark-gray">{vacancy.company}</p>
            </div>

            {/* Vacancy Details */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 mb-6">
              <h2 className="text-xl font-semibold text-barnes-dark-violet mb-4">Vacature Details</h2>
              <div className="space-y-4">
                {vacancy.description && (
                  <div>
                    <h3 className="font-medium text-barnes-dark-gray mb-2">Beschrijving</h3>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{vacancy.description}</p>
                  </div>
                )}
                {vacancy.requirements && (
                  <div>
                    <h3 className="font-medium text-barnes-dark-gray mb-2">Vereisten</h3>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{vacancy.requirements}</p>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4">
                  {vacancy.location && (
                    <div>
                      <h3 className="font-medium text-barnes-dark-gray mb-2">Locatie</h3>
                      <p className="text-sm text-gray-700">{vacancy.location}</p>
                    </div>
                  )}
                  {vacancy.salary_range && (
                    <div>
                      <h3 className="font-medium text-barnes-dark-gray mb-2">Salaris</h3>
                      <p className="text-sm text-gray-700">{vacancy.salary_range}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* AI Match & Quick Search */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 mb-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-barnes-dark-violet">Kandidaten Zoeken</h2>
                <button
                  onClick={handleAiMatch}
                  disabled={isMatching}
                  className="px-4 py-2 bg-gradient-to-r from-barnes-violet to-barnes-dark-violet text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isMatching ? (
                    <>
                      <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span>AI Matching...</span>
                    </>
                  ) : (
                    <>
                      <span>🤖</span>
                      <span>AI: Vind Beste Kandidaten</span>
                    </>
                  )}
                </button>
              </div>

              {/* AI Matches Section */}
              {showAiMatches && aiMatches.length > 0 && (
                <div className="mb-6 p-4 bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg">
                  <h3 className="font-semibold text-barnes-dark-violet mb-3 flex items-center gap-2">
                    <span>✨</span>
                    <span>AI Aanbevolen Kandidaten</span>
                  </h3>
                  <div className="space-y-3">
                    {aiMatches.slice(0, 5).map((match, idx) => (
                      <div
                        key={match.candidate_id || idx}
                        className="p-3 bg-white rounded-lg border border-blue-200 hover:border-barnes-violet transition-colors"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-barnes-violet text-white rounded-full flex items-center justify-center font-bold">
                              {Math.round(match.match_score)}
                            </div>
                            <div>
                              <div className="font-medium text-barnes-dark-violet">{match.candidate_name || 'Onbekende kandidaat'}</div>
                              <div className="text-xs text-gray-500">Match Score: {match.match_score.toFixed(1)}/10</div>
                            </div>
                          </div>
                          <input
                            type="checkbox"
                            checked={selectedCandidates.has(match.candidate_id)}
                            onChange={() => handleToggleCandidate(match.candidate_id)}
                            className="w-5 h-5 text-barnes-violet rounded focus:ring-barnes-violet"
                          />
                        </div>
                        <div className="text-xs text-gray-600 mt-2">
                          <div className="font-medium mb-1">Redenering:</div>
                          <div className="mb-2">{match.reasoning || 'Geen redenering beschikbaar'}</div>
                          {match.strengths && (Array.isArray(match.strengths) ? match.strengths.length > 0 : match.strengths) && (
                            <div className="text-green-700 mb-1">
                              <strong>Sterke punten:</strong> {Array.isArray(match.strengths) ? match.strengths.join(', ') : match.strengths}
                            </div>
                          )}
                          {match.concerns && (Array.isArray(match.concerns) ? match.concerns.length > 0 : match.concerns) && (
                            <div className="text-orange-700">
                              <strong>Aandachtspunten:</strong> {Array.isArray(match.concerns) ? match.concerns.join(', ') : match.concerns}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="relative">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Zoek op naam, email of CV tekst..."
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-barnes-violet focus:border-transparent"
                />
                {searchTerm && (
                  <div className="absolute z-10 w-full mt-2 bg-white border border-gray-200 rounded-lg shadow-lg max-h-96 overflow-y-auto">
                    {filteredCandidates.length > 0 ? (
                      filteredCandidates.map((candidate) => (
                        <div
                          key={candidate.id}
                          className="p-4 hover:bg-gray-50 border-b border-gray-100 last:border-b-0 flex items-center gap-3"
                        >
                          <input
                            type="checkbox"
                            checked={selectedCandidates.has(candidate.id)}
                            onChange={() => handleToggleCandidate(candidate.id)}
                            className="w-5 h-5 text-barnes-violet rounded focus:ring-barnes-violet"
                          />
                          <div className="flex-1 cursor-pointer" onClick={() => handleToggleCandidate(candidate.id)}>
                            <div className="font-medium text-barnes-dark-violet">{candidate.name}</div>
                            <div className="text-sm text-gray-500">{candidate.email}</div>
                            {candidate.resume_text && (
                              <div className="text-xs text-gray-400 mt-1 line-clamp-2">
                                {candidate.resume_text.substring(0, 150)}...
                              </div>
                            )}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="p-4 text-sm text-gray-500">Geen kandidaten gevonden</div>
                    )}
                  </div>
                )}
              </div>
              
              {/* Add Selected Button */}
              {selectedCandidates.size > 0 && (
                <div className="mt-4 flex items-center justify-between p-4 bg-barnes-violet/10 rounded-lg border border-barnes-violet/20">
                  <span className="text-sm font-medium text-barnes-dark-violet">
                    {selectedCandidates.size} kandidaat(en) geselecteerd
                  </span>
                  <button
                    onClick={handleAddSelectedCandidates}
                    disabled={isSubmitting}
                    className="px-4 py-2 bg-barnes-violet text-white rounded-lg hover:bg-barnes-dark-violet transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? 'Toevoegen...' : `Toevoegen (${selectedCandidates.size})`}
                  </button>
                </div>
              )}
            </div>

            {/* Assigned Candidates */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 mb-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-barnes-dark-violet">
                  Toegevoegde Kandidaten ({assignedCandidates.length})
                </h2>
                {assignedCandidates.length > 0 && (
                  <button
                    onClick={handleSendToCompany}
                    className="btn-primary"
                  >
                    Verstuur naar Bedrijf
                  </button>
                )}
              </div>
              
              {assignedCandidates.length > 0 ? (
                <div className="space-y-3">
                  {assignedCandidates.map((candidate) => (
                    <div
                      key={candidate.id}
                      className="p-4 border border-gray-200 rounded-lg hover:border-barnes-violet transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium text-barnes-dark-violet">{candidate.name}</div>
                          <div className="text-sm text-gray-500">{candidate.email}</div>
                          {candidate.company_note && (
                            <div className="text-xs text-gray-600 mt-2 p-2 bg-gray-50 rounded">
                              <strong>Bedrijfsnotitie:</strong> {candidate.company_note}
                            </div>
                          )}
                        </div>
                        <button
                          onClick={() => router.push(`/recruiter/kandidaten/${candidate.id}`)}
                          className="text-sm text-barnes-violet hover:underline"
                        >
                          Bekijk →
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <p>Nog geen kandidaten toegevoegd</p>
                  <p className="text-sm mt-2">Gebruik de zoekfunctie hierboven om kandidaten toe te voegen</p>
                </div>
              )}
            </div>
          </div>
        </div>

      </div>
    </ProtectedRoute>
  );
}


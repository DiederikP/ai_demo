'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getAuthHeaders } from '../lib/auth';

interface Vacancy {
  id: string;
  title: string;
  company: string;
  candidates_count: number;
  created_at: string;
  is_new?: boolean;
  is_assigned?: boolean;
}

interface Candidate {
  id: string;
  name: string;
  email: string;
  job_id: string;
  pipeline_stage: string;
  pipeline_status: string;
  created_at?: string;
  updated_at?: string;
  has_evaluation?: boolean;
}

export default function RecruiterDashboard() {
  const [vacancies, setVacancies] = useState<Vacancy[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [candidateFilter, setCandidateFilter] = useState<'all' | 'evaluated' | 'pending'>('all');
  const [expandedVacancies, setExpandedVacancies] = useState<Set<string>>(new Set());
  const router = useRouter();

  useEffect(() => {
    loadData();
    // Auto-refresh every 60 seconds to keep data up to date (reduced from 30s to prevent flickering)
    const interval = setInterval(() => {
      loadData();
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    try {
      const headers = getAuthHeaders();
      
      console.log('[RecruiterDashboard] Loading data...');
      console.log('[RecruiterDashboard] Headers:', headers);
      const headersObj = headers as Record<string, string>;
      console.log('[RecruiterDashboard] Token present:', !!headersObj['Authorization']);
      
      const [vacanciesRes, candidatesRes] = await Promise.all([
        fetch('/api/recruiter/vacancies?include_new=true', { headers }).catch((err) => {
          console.error('[RecruiterDashboard] Fetch error for vacancies:', err);
          throw err;
        }),
        fetch('/api/recruiter/candidates', { headers }).catch((err) => {
          console.error('[RecruiterDashboard] Fetch error for candidates:', err);
          throw err;
        })
      ]);
      
      console.log('[RecruiterDashboard] Vacancies response status:', vacanciesRes.status);
      console.log('[RecruiterDashboard] Candidates response status:', candidatesRes.status);

      if (vacanciesRes.ok) {
        const data = await vacanciesRes.json();
        console.log('[RecruiterDashboard] Loaded vacancies:', data.vacancies?.length || 0, data.vacancies);
        setVacancies(data.vacancies || []);
      } else {
        const errorData = await vacanciesRes.json().catch(() => ({ error: 'Unknown error' }));
        console.error('[RecruiterDashboard] Failed to load vacancies:', errorData);
        alert(`Fout bij laden vacatures: ${errorData.error || 'Onbekende fout'}`);
      }

      if (candidatesRes.ok) {
        const data = await candidatesRes.json();
        console.log('[RecruiterDashboard] Loaded candidates:', data.candidates?.length || 0);
        setCandidates(data.candidates || []);
      } else {
        const errorData = await candidatesRes.json().catch(() => ({ error: 'Unknown error' }));
        console.error('[RecruiterDashboard] Failed to load candidates:', errorData);
      }
    } catch (error: any) {
      console.error('Error loading data:', error);
      alert(`Fout bij laden data: ${error.message || 'Onbekende fout'}`);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-barnes-dark-gray">Laden...</div>
      </div>
    );
  }

  const totalCandidates = candidates.length;
  const activeVacancies = vacancies.filter(v => v.candidates_count > 0).length;

  // Group candidates by vacancy
  const candidatesByVacancy = candidates.reduce((acc, candidate) => {
    const jobId = candidate.job_id || 'unassigned';
    if (!acc[jobId]) {
      acc[jobId] = [];
    }
    acc[jobId].push(candidate);
    return acc;
  }, {} as Record<string, Candidate[]>);

  // Filter candidates based on selected filter
  const getFilteredCandidates = (candidatesList: Candidate[]) => {
    if (candidateFilter === 'evaluated') {
      return candidatesList.filter(c => c.has_evaluation);
    } else if (candidateFilter === 'pending') {
      return candidatesList.filter(c => !c.has_evaluation);
    }
    return candidatesList;
  };

  const toggleVacancyExpansion = (vacancyId: string) => {
    setExpandedVacancies(prev => {
      const newSet = new Set(prev);
      if (newSet.has(vacancyId)) {
        newSet.delete(vacancyId);
      } else {
        newSet.add(vacancyId);
      }
      return newSet;
    });
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Onbekend';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('nl-NL', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return 'Onbekend';
    }
  };

  const formatRelativeTime = (dateString?: string) => {
    if (!dateString) return 'Onbekend';
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);

      if (diffMins < 1) return 'Zojuist';
      if (diffMins < 60) return `${diffMins} min geleden`;
      if (diffHours < 24) return `${diffHours} uur geleden`;
      if (diffDays < 7) return `${diffDays} dag${diffDays !== 1 ? 'en' : ''} geleden`;
      return formatDate(dateString);
    } catch {
      return 'Onbekend';
    }
  };

  return (
    <div className="max-w-7xl mx-auto">
      <h1 className="text-3xl font-bold text-barnes-dark-violet mb-8">Recruiter Dashboard</h1>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
          <div className="text-sm text-gray-500 mb-1">Toegewezen Vacatures</div>
          <div className="text-3xl font-bold text-barnes-dark-violet">{vacancies.length}</div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
          <div className="text-sm text-gray-500 mb-1">Actieve Vacatures</div>
          <div className="text-3xl font-bold text-barnes-dark-violet">{activeVacancies}</div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
          <div className="text-sm text-gray-500 mb-1">Ingediende Kandidaten</div>
          <div className="text-3xl font-bold text-barnes-dark-violet">{totalCandidates}</div>
        </div>
      </div>

      {/* Recent Vacancies */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-8">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-barnes-dark-violet">Binnengekomen Vacatures</h2>
          <p className="text-sm text-gray-500 mt-1">Vacatures die door bedrijven aan jou zijn toegewezen</p>
        </div>
        <div className="p-6">
          {vacancies.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              Geen vacatures toegewezen
            </div>
          ) : (
            <div className="space-y-4">
              {vacancies.slice(0, 10).map((vacancy) => (
                <div
                  key={vacancy.id}
                  className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:border-barnes-violet transition-colors cursor-pointer"
                  onClick={() => router.push(`/recruiter/vacatures/${vacancy.id}`)}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="font-medium text-barnes-dark-violet">{vacancy.title}</div>
                      {vacancy.is_new && (
                        <span className="px-2 py-0.5 text-xs rounded-full bg-blue-100 text-blue-800 font-medium">
                          Nieuw
                        </span>
                      )}
                      {vacancy.is_assigned && !vacancy.is_new && (
                        <span className="px-2 py-0.5 text-xs rounded-full bg-green-100 text-green-800 font-medium">
                          Actief
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-gray-500 mb-1">{vacancy.company}</div>
                    <div className="flex items-center gap-4 text-xs text-gray-400">
                      <span className="flex items-center gap-1">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        Binnengekomen: {formatRelativeTime(vacancy.created_at)}
                      </span>
                      {vacancy.candidates_count > 0 && (
                        <span className="flex items-center gap-1">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                          </svg>
                          {vacancy.candidates_count} kandidaat{vacancy.candidates_count !== 1 ? 'en' : ''} teruggestuurd
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium text-barnes-dark-gray">{vacancy.candidates_count} kandidaten</div>
                    {vacancy.is_new && (
                      <div className="text-xs text-blue-600 mt-0.5">Wacht op actie</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Candidates Overview - Grouped by Vacancy */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-barnes-dark-violet">Mijn Kandidaten</h2>
              <p className="text-sm text-gray-500 mt-1">Kandidaten die je naar bedrijven hebt gestuurd</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCandidateFilter('all')}
                className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                  candidateFilter === 'all'
                    ? 'bg-barnes-violet text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Alle ({candidates.length})
              </button>
              <button
                onClick={() => setCandidateFilter('evaluated')}
                className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                  candidateFilter === 'evaluated'
                    ? 'bg-barnes-violet text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Geëvalueerd ({candidates.filter(c => c.has_evaluation).length})
              </button>
              <button
                onClick={() => setCandidateFilter('pending')}
                className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                  candidateFilter === 'pending'
                    ? 'bg-barnes-violet text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                In Afwachting ({candidates.filter(c => !c.has_evaluation).length})
              </button>
            </div>
          </div>
        </div>
        <div className="p-6">
          {candidates.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
              <p className="text-lg font-medium mb-1">Nog geen kandidaten ingediend</p>
              <p className="text-sm">Begin met het toevoegen van kandidaten aan vacatures</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Group by vacancy */}
              {vacancies
                .filter(v => {
                  const vacancyCandidates = candidatesByVacancy[v.id] || [];
                  return getFilteredCandidates(vacancyCandidates).length > 0;
                })
                .sort((a, b) => {
                  const aCandidates = candidatesByVacancy[a.id] || [];
                  const bCandidates = candidatesByVacancy[b.id] || [];
                  const aDate = aCandidates.length > 0 
                    ? (aCandidates[0].updated_at || aCandidates[0].created_at || '')
                    : (a.created_at || '');
                  const bDate = bCandidates.length > 0
                    ? (bCandidates[0].updated_at || bCandidates[0].created_at || '')
                    : (b.created_at || '');
                  return new Date(bDate).getTime() - new Date(aDate).getTime();
                })
                .map((vacancy) => {
                  const vacancyCandidates = getFilteredCandidates(candidatesByVacancy[vacancy.id] || [])
                    .sort((a, b) => {
                      const aDate = a.updated_at || a.created_at || '';
                      const bDate = b.updated_at || b.created_at || '';
                      return new Date(bDate).getTime() - new Date(aDate).getTime();
                    });
                  
                  if (vacancyCandidates.length === 0) return null;

                  const evaluatedCount = vacancyCandidates.filter(c => c.has_evaluation).length;
                  const pendingCount = vacancyCandidates.filter(c => !c.has_evaluation).length;
                  const isExpanded = expandedVacancies.has(vacancy.id);

                  return (
                    <div key={vacancy.id} className="border border-gray-200 rounded-lg overflow-hidden">
                      {/* Vacancy Header */}
                      <div
                        className="bg-gray-50 p-4 cursor-pointer hover:bg-gray-100 transition-colors"
                        onClick={() => toggleVacancyExpansion(vacancy.id)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-1">
                              <h3 className="font-semibold text-barnes-dark-violet">{vacancy.title}</h3>
                              <span className="text-sm text-gray-500">{vacancy.company}</span>
                            </div>
                            <div className="flex items-center gap-4 text-xs text-gray-500">
                              <span>{vacancyCandidates.length} kandidaat{vacancyCandidates.length !== 1 ? 'en' : ''}</span>
                              {evaluatedCount > 0 && (
                                <span className="flex items-center gap-1 text-green-600">
                                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                  </svg>
                                  {evaluatedCount} geëvalueerd
                                </span>
                              )}
                              {pendingCount > 0 && (
                                <span className="flex items-center gap-1 text-yellow-600">
                                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                                  </svg>
                                  {pendingCount} in afwachting
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                router.push(`/recruiter/vacatures/${vacancy.id}`);
                              }}
                              className="px-3 py-1.5 text-xs bg-barnes-violet text-white rounded-lg hover:bg-barnes-dark-violet transition-colors"
                            >
                              Bekijk Vacature
                            </button>
                            <svg
                              className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </div>
                        </div>
                      </div>

                      {/* Candidates List */}
                      {isExpanded && (
                        <div className="divide-y divide-gray-100">
                          {vacancyCandidates.map((candidate) => {
                            const hasEvaluation = candidate.has_evaluation;
                            return (
                              <div
                                key={candidate.id}
                                className="p-4 hover:bg-gray-50 transition-colors cursor-pointer"
                                onClick={() => router.push(`/recruiter/kandidaten/${candidate.id}`)}
                              >
                                <div className="flex items-start justify-between gap-4">
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                      <div className="font-medium text-barnes-dark-violet truncate">{candidate.name}</div>
                                      {hasEvaluation ? (
                                        <span className="px-2 py-0.5 text-xs rounded-full bg-green-100 text-green-800 font-medium flex-shrink-0">
                                          ✓ Geëvalueerd
                                        </span>
                                      ) : (
                                        <span className="px-2 py-0.5 text-xs rounded-full bg-yellow-100 text-yellow-800 font-medium flex-shrink-0">
                                          ⏳ In Afwachting
                                        </span>
                                      )}
                                    </div>
                                    <div className="text-sm text-gray-600 mb-2">{candidate.email}</div>
                                    <div className="flex items-center gap-4 text-xs text-gray-500">
                                      <span className="flex items-center gap-1">
                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                        Teruggestuurd: {formatRelativeTime(candidate.created_at)}
                                      </span>
                                      {candidate.updated_at && candidate.updated_at !== candidate.created_at && (
                                        <span className="flex items-center gap-1">
                                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                          </svg>
                                          Update: {formatRelativeTime(candidate.updated_at)}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  <div className="text-right flex-shrink-0">
                                    <div className="text-xs font-medium text-barnes-dark-gray mb-1">
                                      {candidate.pipeline_stage || 'Niet toegewezen'}
                                    </div>
                                    <div className={`text-xs px-2 py-0.5 rounded ${
                                      candidate.pipeline_status === 'rejected' ? 'bg-red-100 text-red-800' :
                                      candidate.pipeline_status === 'active' ? 'bg-blue-100 text-blue-800' :
                                      'bg-gray-100 text-gray-800'
                                    }`}>
                                      {candidate.pipeline_status || 'Actief'}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}

              {/* Unassigned candidates */}
              {getFilteredCandidates(candidatesByVacancy['unassigned'] || []).length > 0 && (
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <div
                    className="bg-gray-50 p-4 cursor-pointer hover:bg-gray-100 transition-colors"
                    onClick={() => toggleVacancyExpansion('unassigned')}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold text-barnes-dark-violet mb-1">Niet Toegewezen</h3>
                        <div className="text-xs text-gray-500">
                          {candidatesByVacancy['unassigned']?.length || 0} kandidaat{(candidatesByVacancy['unassigned']?.length || 0) !== 1 ? 'en' : ''} zonder vacature
                        </div>
                      </div>
                      <svg
                        className={`w-5 h-5 text-gray-400 transition-transform ${expandedVacancies.has('unassigned') ? 'rotate-180' : ''}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                  {expandedVacancies.has('unassigned') && (
                    <div className="divide-y divide-gray-100">
                      {getFilteredCandidates(candidatesByVacancy['unassigned'] || [])
                        .sort((a, b) => {
                          const aDate = a.updated_at || a.created_at || '';
                          const bDate = b.updated_at || b.created_at || '';
                          return new Date(bDate).getTime() - new Date(aDate).getTime();
                        })
                        .map((candidate) => (
                          <div
                            key={candidate.id}
                            className="p-4 hover:bg-gray-50 transition-colors cursor-pointer"
                            onClick={() => router.push(`/recruiter/kandidaten/${candidate.id}`)}
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <div className="font-medium text-barnes-dark-violet">{candidate.name}</div>
                                  {candidate.has_evaluation ? (
                                    <span className="px-2 py-0.5 text-xs rounded-full bg-green-100 text-green-800 font-medium">
                                      ✓ Geëvalueerd
                                    </span>
                                  ) : (
                                    <span className="px-2 py-0.5 text-xs rounded-full bg-yellow-100 text-yellow-800 font-medium">
                                      ⏳ In Afwachting
                                    </span>
                                  )}
                                </div>
                                <div className="text-sm text-gray-600 mb-2">{candidate.email}</div>
                                <div className="text-xs text-gray-500">
                                  Teruggestuurd: {formatRelativeTime(candidate.created_at)}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


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
}

export default function RecruiterDashboard() {
  const [vacancies, setVacancies] = useState<Vacancy[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
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
          <h2 className="text-xl font-semibold text-barnes-dark-violet">Mijn Vacatures</h2>
        </div>
        <div className="p-6">
          {vacancies.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              Geen vacatures toegewezen
            </div>
          ) : (
            <div className="space-y-4">
              {vacancies.slice(0, 5).map((vacancy) => (
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
                          Toegewezen
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-gray-500">{vacancy.company}</div>
                    {!vacancy.is_new && vacancy.candidates_count > 0 && (
                      <div className="text-xs text-gray-400 mt-0.5">
                        {vacancy.candidates_count} kandidaat{vacancy.candidates_count !== 1 ? 'en' : ''} ingediend
                      </div>
                    )}
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

      {/* Recent Candidates */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-barnes-dark-violet">Recente Kandidaten</h2>
        </div>
        <div className="p-6">
          {candidates.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              Nog geen kandidaten ingediend
            </div>
          ) : (
            <div className="space-y-4">
              {candidates.slice(0, 5).map((candidate) => {
                const hasEvaluation = (candidate as any).has_evaluation;
                return (
                  <div
                    key={candidate.id}
                    className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:border-barnes-violet transition-colors cursor-pointer"
                    onClick={() => router.push(`/recruiter/kandidaten/${candidate.id}`)}
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="font-medium text-barnes-dark-violet">{candidate.name}</div>
                        {hasEvaluation && (
                          <span className="w-2 h-2 rounded-full bg-green-500" title="Geëvalueerd"></span>
                        )}
                      </div>
                      <div className="text-sm text-gray-500">{candidate.email}</div>
                      {candidate.job_id && (
                        <div className="text-xs text-gray-400 mt-1">
                          Vacature: {vacancies.find(v => v.id === candidate.job_id)?.title || 'Onbekend'}
                        </div>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="flex items-center gap-2 mb-1">
                        {hasEvaluation ? (
                          <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-800 font-medium">
                            ✓ Geëvalueerd
                          </span>
                        ) : (
                          <span className="px-2 py-1 text-xs rounded-full bg-yellow-100 text-yellow-800 font-medium">
                            ⏳ Wacht op evaluatie
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-gray-500">{candidate.pipeline_stage || 'Niet toegewezen'}</div>
                      <div className="text-xs text-gray-400">{candidate.pipeline_status || 'Actief'}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


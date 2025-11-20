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
  }, []);

  const loadData = async () => {
    try {
      const headers = getAuthHeaders();
      
      console.log('[RecruiterDashboard] Loading data...');
      console.log('[RecruiterDashboard] Headers:', headers);
      const headersObj = headers as Record<string, string>;
      console.log('[RecruiterDashboard] Token present:', !!headersObj['Authorization']);
      
      const [vacanciesRes, candidatesRes] = await Promise.all([
        fetch('/api/recruiter/vacancies', { headers }).catch((err) => {
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
        setVacancies(data.vacancies || []);
      } else {
        const errorData = await vacanciesRes.json().catch(() => ({ error: 'Unknown error' }));
        console.error('Failed to load vacancies:', errorData);
        alert(`Fout bij laden vacatures: ${errorData.error || 'Onbekende fout'}`);
      }

      if (candidatesRes.ok) {
        const data = await candidatesRes.json();
        setCandidates(data.candidates || []);
      } else {
        const errorData = await candidatesRes.json().catch(() => ({ error: 'Unknown error' }));
        console.error('Failed to load candidates:', errorData);
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
                  <div>
                    <div className="font-medium text-barnes-dark-violet">{vacancy.title}</div>
                    <div className="text-sm text-gray-500">{vacancy.company}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium text-barnes-dark-gray">{vacancy.candidates_count} kandidaten</div>
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
              {candidates.slice(0, 5).map((candidate) => (
                <div
                  key={candidate.id}
                  className="flex items-center justify-between p-4 border border-gray-200 rounded-lg"
                >
                  <div>
                    <div className="font-medium text-barnes-dark-violet">{candidate.name}</div>
                    <div className="text-sm text-gray-500">{candidate.email}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-gray-500">{candidate.pipeline_stage || 'Niet toegewezen'}</div>
                    <div className="text-xs text-gray-400">{candidate.pipeline_status || 'Actief'}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


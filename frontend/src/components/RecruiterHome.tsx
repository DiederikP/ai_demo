'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getAuthHeaders } from '../lib/auth';
import { DocumentIcon, PencilIcon, PlusIcon, InboxIcon, ArrowRightIcon } from './Icons';

interface Vacancy {
  id: string;
  title: string;
  company: string;
  created_at: string;
  is_new?: boolean;
  is_assigned?: boolean;
  candidates_count?: number;
}

interface Candidate {
  id: string;
  name: string;
  email: string;
  job_id: string;
  created_at: string;
  pipeline_stage?: string;
  pipeline_status?: string;
}

interface Stats {
  totalVacancies: number;
  newVacancies: number;
  submittedCandidates: number;
  recentOffers: number;
  recentSubmissions: number;
}

export default function RecruiterHome() {
  const router = useRouter();
  const [vacancies, setVacancies] = useState<Vacancy[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [stats, setStats] = useState<Stats>({
    totalVacancies: 0,
    newVacancies: 0,
    submittedCandidates: 0,
    recentOffers: 0,
    recentSubmissions: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const headers = getAuthHeaders();
      
      const [vacanciesRes, candidatesRes] = await Promise.all([
        fetch('/api/recruiter/vacancies?include_new=true', { headers }),
        fetch('/api/recruiter/candidates', { headers })
      ]);

      let loadedVacancies: Vacancy[] = [];
      let loadedCandidates: Candidate[] = [];

      if (vacanciesRes.ok) {
        const vacanciesData = await vacanciesRes.json();
        loadedVacancies = vacanciesData.vacancies || [];
        setVacancies(loadedVacancies);
      }

      if (candidatesRes.ok) {
        const candidatesData = await candidatesRes.json();
        loadedCandidates = candidatesData.candidates || [];
        setCandidates(loadedCandidates);
      }

      // Calculate stats with loaded data
      const newVacancies = loadedVacancies.filter(v => v.is_new);
      
      // Recent offers (vacancies received in last 7 days)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const recentOffers = loadedVacancies.filter(v => {
        const created = new Date(v.created_at);
        return created >= sevenDaysAgo;
      }).length;

      // Recent submissions (candidates submitted in last 7 days)
      const recentSubmissions = loadedCandidates.filter(c => {
        const created = new Date(c.created_at);
        return created >= sevenDaysAgo;
      }).length;

      setStats({
        totalVacancies: loadedVacancies.length,
        newVacancies: newVacancies.length,
        submittedCandidates: loadedCandidates.length,
        recentOffers,
        recentSubmissions,
      });
    } catch (error) {
      console.error('Error loading data:', error);
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

  return (
    <div className="max-w-7xl mx-auto">
      {/* Hero Section */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-barnes-dark-violet mb-2">
          Recruiter Portal
        </h1>
        <p className="text-sm text-barnes-dark-gray">
          Overzicht van uw vacatures en kandidaten
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="text-xs font-medium text-gray-500 mb-2">Toegewezen Vacatures</div>
          <div className="text-3xl font-bold text-barnes-dark-violet">
            {stats.totalVacancies}
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="text-xs font-medium text-gray-500 mb-2">Nieuwe Vacatures</div>
          <div className="text-3xl font-bold text-barnes-dark-violet">
            {stats.newVacancies}
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="text-xs font-medium text-gray-500 mb-2">Ingediende Kandidaten</div>
          <div className="text-3xl font-bold text-barnes-dark-violet">
            {stats.submittedCandidates}
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="text-xs font-medium text-gray-500 mb-2">Nieuw Ingediend (7d)</div>
          <div className="text-3xl font-bold text-barnes-dark-violet">
            {stats.recentSubmissions}
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <button
          onClick={() => router.push('/recruiter/kandidaten/nieuw')}
          className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 hover:border-barnes-violet transition-colors text-left"
        >
          <div className="flex items-center gap-3 mb-2">
            <DocumentIcon className="w-5 h-5 text-barnes-violet" />
            <div className="font-semibold text-barnes-dark-violet">Nieuwe Kandidaat Uploaden</div>
          </div>
          <div className="text-sm text-gray-600">Upload een nieuwe kandidaat voor een vacature</div>
        </button>

        <button
          onClick={() => router.push('/recruiter/dashboard?module=kandidaten')}
          className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 hover:border-barnes-violet transition-colors text-left"
        >
          <div className="flex items-center gap-3 mb-2">
            <PencilIcon className="w-5 h-5 text-barnes-violet" />
            <div className="font-semibold text-barnes-dark-violet">Kandidaat Aanpassen</div>
          </div>
          <div className="text-sm text-gray-600">Bekijk en pas bestaande kandidaten aan</div>
        </button>

        <button
          onClick={() => router.push('/recruiter/dashboard?module=vacatures')}
          className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 hover:border-barnes-violet transition-colors text-left"
        >
          <div className="flex items-center gap-3 mb-2">
            <PlusIcon className="w-5 h-5 text-barnes-violet" />
            <div className="font-semibold text-barnes-dark-violet">Kandidaten Toevoegen</div>
          </div>
          <div className="text-sm text-gray-600">Voeg kandidaten toe aan beschikbare vacatures</div>
        </button>
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-barnes-dark-violet">Aangeboden door Bedrijven</h2>
          </div>
          <div className="space-y-3">
            {vacancies.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <div className="mb-2 flex justify-center">
                  <InboxIcon className="w-8 h-8 text-gray-300" />
                </div>
                <div className="text-sm">Geen vacatures ontvangen</div>
              </div>
            ) : (
              vacancies.slice(0, 5).map(vacancy => (
                <div
                  key={vacancy.id}
                  className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:border-barnes-violet transition-colors cursor-pointer"
                  onClick={() => router.push(`/recruiter/vacatures/${vacancy.id}`)}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="font-medium text-barnes-dark-violet">{vacancy.title}</div>
                      {vacancy.is_new && (
                        <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                          Nieuw
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-gray-500">{vacancy.company}</div>
                    <div className="text-xs text-gray-400 mt-1">{new Date(vacancy.created_at).toLocaleDateString('nl-NL')}</div>
                  </div>
                  <div className="text-barnes-violet">
                    <ArrowRightIcon className="w-4 h-4" />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-barnes-dark-violet">Teruggestuurd naar Bedrijven</h2>
          </div>
          <div className="space-y-3">
            {candidates.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <div className="mb-2 flex justify-center">
                  <InboxIcon className="w-8 h-8 text-gray-300" />
                </div>
                <div className="text-sm">Geen kandidaten teruggestuurd</div>
              </div>
            ) : (
              candidates
                .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                .slice(0, 5)
                .map(candidate => (
                  <div
                    key={candidate.id}
                    className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:border-barnes-violet transition-colors cursor-pointer"
                    onClick={() => router.push(`/recruiter/kandidaten/${candidate.id}`)}
                  >
                    <div className="flex-1">
                      <div className="font-medium text-barnes-dark-violet">{candidate.name}</div>
                      <div className="text-sm text-gray-500">{candidate.email}</div>
                      <div className="text-xs text-gray-400 mt-1">{new Date(candidate.created_at).toLocaleDateString('nl-NL')}</div>
                    </div>
                    <div className="text-barnes-violet">
                      <ArrowRightIcon className="w-4 h-4" />
                    </div>
                  </div>
                ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}


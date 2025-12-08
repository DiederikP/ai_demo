'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getAuthHeaders } from '../lib/auth';
import { DocumentIcon, UserIcon, CogIcon, ChartBarIcon, InboxIcon, ArrowRightIcon } from './Icons';
import ReviewCandidates from './ReviewCandidates';

interface JobDescription {
  id: string;
  title: string;
  company: string;
  created_at: string;
  is_active?: boolean;
  assigned_agency_id?: string | null;
}

interface Candidate {
  id: string;
  name: string;
  email: string;
  job_id: string;
  created_at: string;
  submitted_by_company_id?: string | null;
  pipeline_stage?: string;
}

interface Stats {
  totalVacancies: number;
  activeVacancies: number;
  candidatesFromRecruiters: number;
  candidatesSentToRecruiters: number;
  recentOffers: number;
  recentReturns: number;
}

export default function CompanyHome() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'overview' | 'review'>('overview');
  const [jobs, setJobs] = useState<JobDescription[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [stats, setStats] = useState<Stats>({
    totalVacancies: 0,
    activeVacancies: 0,
    candidatesFromRecruiters: 0,
    candidatesSentToRecruiters: 0,
    recentOffers: 0,
    recentReturns: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [selectedJobId, setSelectedJobId] = useState<string>('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const headers = getAuthHeaders();
      
      const [jobsRes, candidatesRes] = await Promise.all([
        fetch('/api/job-descriptions', { headers }),
        fetch('/api/candidates', { headers })
      ]);

      let loadedJobs: JobDescription[] = [];
      let loadedCandidates: Candidate[] = [];

      if (jobsRes.ok) {
        const jobsData = await jobsRes.json();
        loadedJobs = jobsData.jobs || [];
        setJobs(loadedJobs);
      }

      if (candidatesRes.ok) {
        const candidatesData = await candidatesRes.json();
        loadedCandidates = candidatesData.candidates || [];
        setCandidates(loadedCandidates);
      }

      // Calculate stats with loaded data
      const activeJobs = loadedJobs.filter(j => j.is_active !== false);
      const recruiterCandidates = loadedCandidates.filter(c => c.submitted_by_company_id != null);
      const companyCandidates = loadedCandidates.filter(c => c.submitted_by_company_id == null);
      
      // Recent offers (vacancies sent to recruiters in last 7 days)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const recentOffers = loadedJobs.filter(j => {
        const created = new Date(j.created_at);
        return created >= sevenDaysAgo && j.assigned_agency_id != null;
      }).length;

      // Recent returns (candidates from recruiters in last 7 days)
      const recentReturns = recruiterCandidates.filter(c => {
        const created = new Date(c.created_at);
        return created >= sevenDaysAgo;
      }).length;

      setStats({
        totalVacancies: loadedJobs.length,
        activeVacancies: activeJobs.length,
        candidatesFromRecruiters: recruiterCandidates.length,
        candidatesSentToRecruiters: companyCandidates.length,
        recentOffers,
        recentReturns,
      });
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const activeJobs = jobs.filter(j => j.is_active !== false);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-barnes-dark-gray">Laden...</div>
      </div>
    );
  }

  // Show review candidates tab if active
  if (activeTab === 'review') {
    return (
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <div className="flex items-center gap-4 mb-4">
            <button
              onClick={() => setActiveTab('overview')}
              className="text-barnes-dark-gray hover:text-barnes-violet transition-colors"
            >
              ← Terug naar overzicht
            </button>
          </div>
          <h1 className="text-2xl font-semibold text-barnes-dark-violet mb-2">
            Bedrijfsportal
          </h1>
        </div>
        <ReviewCandidates />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      {/* Hero Section */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-barnes-dark-violet mb-2">
          Bedrijfsportal
        </h1>
        <p className="text-sm text-barnes-dark-gray">
          Overzicht van uw vacatures en kandidaten
        </p>
      </div>

      {/* Tabs */}
      <div className="mb-6 border-b border-gray-200">
        <div className="flex gap-4">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-2 font-medium transition-colors border-b-2 ${
              activeTab === 'overview'
                ? 'text-barnes-violet border-barnes-violet'
                : 'text-barnes-dark-gray border-transparent hover:text-barnes-violet'
            }`}
          >
            Overzicht
          </button>
          <button
            onClick={() => setActiveTab('review')}
            className={`px-4 py-2 font-medium transition-colors border-b-2 ${
              activeTab === 'review'
                ? 'text-barnes-violet border-barnes-violet'
                : 'text-barnes-dark-gray border-transparent hover:text-barnes-violet'
            }`}
          >
            Aangeboden Kandidaat Beoordelen
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="text-xs font-medium text-gray-500 mb-2">Actieve Vacatures</div>
          <div className="text-3xl font-bold text-barnes-dark-violet">
            {stats.activeVacancies}
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="text-xs font-medium text-gray-500 mb-2">Kandidaten van Recruiters</div>
          <div className="text-3xl font-bold text-barnes-dark-violet">
            {stats.candidatesFromRecruiters}
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="text-xs font-medium text-gray-500 mb-2">Nieuw Aangeboden (7d)</div>
          <div className="text-3xl font-bold text-barnes-dark-violet">
            {stats.recentOffers}
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="text-xs font-medium text-gray-500 mb-2">Nieuw Teruggekregen (7d)</div>
          <div className="text-3xl font-bold text-barnes-dark-violet">
            {stats.recentReturns}
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <button
          onClick={() => router.push('/company/vacatures/nieuw')}
          className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 hover:border-barnes-violet transition-colors text-left"
        >
          <div className="flex items-center gap-3 mb-2">
            <DocumentIcon className="w-5 h-5 text-barnes-violet" />
            <div className="font-semibold text-barnes-dark-violet">Nieuwe Vacature Uploaden</div>
          </div>
          <div className="text-sm text-gray-600">Upload een nieuwe vacature om te delen met recruiters</div>
        </button>

        <button
          onClick={() => setActiveTab('review')}
          className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 hover:border-barnes-violet transition-colors text-left"
        >
          <div className="flex items-center gap-3 mb-2">
            <UserIcon className="w-5 h-5 text-barnes-violet" />
            <div className="font-semibold text-barnes-dark-violet">Aangeboden Kandidaat Beoordelen</div>
          </div>
          <div className="text-sm text-gray-600">Bekijk en beoordeel kandidaten van recruiters</div>
        </button>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="flex items-center gap-3 mb-3">
            <CogIcon className="w-5 h-5 text-barnes-violet" />
            <div className="font-semibold text-barnes-dark-violet">Doorwerken in Bestaande Vacature</div>
          </div>
          <select
            value={selectedJobId}
            onChange={(e) => setSelectedJobId(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg mb-3 focus:ring-2 focus:ring-barnes-violet focus:border-transparent text-sm"
          >
            <option value="">Selecteer een vacature...</option>
            {activeJobs.map(job => (
              <option key={job.id} value={job.id}>{job.title}</option>
            ))}
          </select>
          <button
            onClick={() => {
              if (selectedJobId) {
                router.push(`/company/vacatures/${selectedJobId}`);
              }
            }}
            disabled={!selectedJobId}
            className="w-full px-4 py-2 bg-barnes-violet text-white rounded-lg hover:bg-barnes-dark-violet transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Open Vacature
          </button>
        </div>

        <button
          onClick={() => router.push('/company/dashboard?module=vacatures')}
          className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 hover:border-barnes-violet transition-colors text-left"
        >
          <div className="flex items-center gap-3 mb-2">
            <ChartBarIcon className="w-5 h-5 text-barnes-violet" />
            <div className="font-semibold text-barnes-dark-violet">Bestaande Vacature Beoordelen</div>
          </div>
          <div className="text-sm text-gray-600">Bekijk alle vacatures en hun status</div>
        </button>
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-barnes-dark-violet">Aangeboden aan Recruiters</h2>
          </div>
          <div className="space-y-3">
            {jobs.filter(j => j.assigned_agency_id != null).length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <div className="mb-2 flex justify-center">
                  <InboxIcon className="w-8 h-8 text-gray-300" />
                </div>
                <div className="text-sm">Geen vacatures aangeboden aan recruiters</div>
              </div>
            ) : (
              jobs
                .filter(j => j.assigned_agency_id != null)
                .slice(0, 5)
                .map(job => (
                  <div
                    key={job.id}
                    className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:border-barnes-violet transition-colors cursor-pointer"
                    onClick={() => router.push(`/company/vacatures/${job.id}`)}
                  >
                    <div className="flex-1">
                      <div className="font-medium text-barnes-dark-violet">{job.title}</div>
                      <div className="text-sm text-gray-500">{new Date(job.created_at).toLocaleDateString('nl-NL')}</div>
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
            <h2 className="text-xl font-semibold text-barnes-dark-violet">Teruggekregen van Recruiters</h2>
          </div>
          <div className="space-y-3">
            {candidates.filter(c => c.submitted_by_company_id != null).length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <div className="mb-2 flex justify-center">
                  <InboxIcon className="w-8 h-8 text-gray-300" />
                </div>
                <div className="text-sm">Geen kandidaten teruggekregen van recruiters</div>
              </div>
            ) : (
              candidates
                .filter(c => c.submitted_by_company_id != null)
                .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                .slice(0, 5)
                .map(candidate => (
                  <div
                    key={candidate.id}
                    className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:border-barnes-violet transition-colors cursor-pointer"
                    onClick={() => router.push(`/company/kandidaten/${candidate.id}`)}
                  >
                    <div className="flex-1">
                      <div className="font-medium text-barnes-dark-violet">{candidate.name}</div>
                      <div className="text-sm text-gray-500">{new Date(candidate.created_at).toLocaleDateString('nl-NL')}</div>
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


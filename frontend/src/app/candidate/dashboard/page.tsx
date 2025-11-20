'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import ProtectedRoute from '../../../components/ProtectedRoute';
import { useAuth } from '../../../contexts/AuthContext';
import { getAuthHeaders } from '../../../lib/auth';

interface Application {
  id: string;
  candidate_id: string;
  job_id: string;
  job_title: string;
  company: string;
  location?: string;
  pipeline_stage: string;
  pipeline_status: string;
  created_at: string;
  evaluation_count?: number;
  conversation_count?: number;
}

interface TargetedJob {
  id: string;
  title: string;
  company: string;
  description: string;
  location?: string;
  salary_range?: string;
}

function CandidateDashboardContent() {
  const { user } = useAuth();
  const router = useRouter();
  const [applications, setApplications] = useState<Application[]>([]);
  const [targetedJobs, setTargetedJobs] = useState<TargetedJob[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdminView, setIsAdminView] = useState(false);

  const loadApplications = useCallback(async () => {
    try {
      const headers = getAuthHeaders();
      // Get all candidates (filtered by email if not admin)
      const url = user?.role === 'admin' 
        ? '/api/candidates' 
        : `/api/candidates?email=${encodeURIComponent(user?.email || '')}`;
      
      const response = await fetch(url, { headers });
      if (response.ok) {
        const data = await response.json();
        const candidates = data.candidates || [];
        
        // Convert candidates to applications format
        const apps: Application[] = [];
        candidates.forEach((candidate: any) => {
          // Check if candidate has this user's email
          if (!isAdminView && candidate.email !== user?.email) return;
          
          // Get jobs from job_id or preferential_job_ids
          const jobIds: string[] = [];
          if (candidate.job_id) jobIds.push(candidate.job_id);
          if (candidate.preferential_job_ids) {
            const prefIds = candidate.preferential_job_ids.split(',').map((id: string) => id.trim()).filter(Boolean);
            jobIds.push(...prefIds);
          }

          jobIds.forEach((jobId) => {
            const job = candidate.job || { id: jobId, title: 'Onbekende vacature', company: 'Onbekend' };
            apps.push({
              id: `${candidate.id}-${jobId}`,
              candidate_id: candidate.id,
              job_id: jobId,
              job_title: job.title || 'Onbekende vacature',
              company: job.company || 'Onbekend',
              location: job.location,
              pipeline_stage: candidate.pipeline_stage || 'introduced',
              pipeline_status: candidate.pipeline_status || 'active',
              created_at: candidate.created_at,
              evaluation_count: candidate.evaluation_count || 0,
              conversation_count: candidate.conversation_count || 0,
            });
          });
        });

        setApplications(apps);
      }
    } catch (error: any) {
      console.error('Error loading applications:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user, isAdminView]);

  const loadTargetedJobs = useCallback(async () => {
    try {
      // For now, show all active jobs (for admin/test purposes)
      // In production, this would use AI matching based on candidate profile
      const headers = getAuthHeaders();
      const response = await fetch('/api/job-descriptions', { headers });
      if (response.ok) {
        const data = await response.json();
        // Filter to active jobs only and limit to 5 for now
        const jobs = (data.jobs || []).slice(0, 5);
        setTargetedJobs(jobs.map((job: any) => ({
          id: job.id,
          title: job.title,
          company: job.company,
          description: job.description,
          location: job.location,
          salary_range: job.salary_range,
        })));
      }
    } catch (error: any) {
      console.error('Error loading targeted jobs:', error);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      loadApplications();
      loadTargetedJobs();
    }
  }, [user, isAdminView, loadApplications, loadTargetedJobs]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-barnes-dark-gray">Laden...</div>
      </div>
    );
  }

  const getStatusLabel = (stage: string, status: string) => {
    if (status === 'accepted') return 'Aangenomen';
    if (status === 'rejected') return 'Afgewezen';
    if (status === 'on_hold') return 'Op pauze';
    
    const stageLabels: Record<string, string> = {
      'introduced': 'Geïntroduceerd',
      'review': 'In beoordeling',
      'first_interview': 'Eerste gesprek',
      'second_interview': 'Tweede gesprek',
      'offer': 'Aanbod ontvangen',
      'complete': 'Voltooid',
    };
    return stageLabels[stage] || 'Actief';
  };

  const getStatusColor = (stage: string, status: string) => {
    if (status === 'accepted') return 'bg-green-100 text-green-800';
    if (status === 'rejected') return 'bg-red-100 text-red-800';
    if (status === 'on_hold') return 'bg-yellow-100 text-yellow-800';
    
    const stageColors: Record<string, string> = {
      'introduced': 'bg-gray-100 text-gray-800',
      'review': 'bg-blue-100 text-blue-800',
      'first_interview': 'bg-yellow-100 text-yellow-800',
      'second_interview': 'bg-orange-100 text-orange-800',
      'offer': 'bg-purple-100 text-purple-800',
      'complete': 'bg-green-100 text-green-800',
    };
    return stageColors[stage] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-barnes-dark-violet">
            Mijn Sollicitaties
          </h1>
          {user?.role === 'admin' && (
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isAdminView}
                onChange={(e) => setIsAdminView(e.target.checked)}
                className="rounded border-gray-300 text-barnes-violet focus:ring-barnes-violet"
              />
              <span className="text-sm text-barnes-dark-gray">Toon alle kandidaten (admin)</span>
            </label>
          )}
        </div>

        {/* Applications Status */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
          <h2 className="text-xl font-semibold text-barnes-dark-violet mb-4">
            Status van mijn sollicitaties
          </h2>
          {applications.length === 0 ? (
            <p className="text-barnes-dark-gray">
              Je hebt nog geen sollicitaties ingediend.
            </p>
          ) : (
            <div className="space-y-4">
              {applications.map((app) => (
                <div key={app.id} className="border border-gray-200 rounded-lg p-4 hover:border-barnes-violet transition-colors">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-1">
                      <h3 className="font-semibold text-barnes-dark-violet text-lg mb-1">{app.job_title}</h3>
                      <p className="text-sm text-barnes-dark-gray mb-2">{app.company}</p>
                      {app.location && (
                        <p className="text-xs text-gray-500">📍 {app.location}</p>
                      )}
                    </div>
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(app.pipeline_stage, app.pipeline_status)}`}>
                      {getStatusLabel(app.pipeline_stage, app.pipeline_status)}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-4 text-xs text-barnes-dark-gray pt-3 border-t border-gray-100">
                    <span>{app.evaluation_count || 0} evaluatie(s)</span>
                    <span>{app.conversation_count || 0} gesprek(ken)</span>
                    <span className="ml-auto">
                      Aangemeld: {new Date(app.created_at).toLocaleDateString('nl-NL')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Targeted Job Ads */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-xl font-semibold text-barnes-dark-violet mb-4">
            Vacatures die bij jou passen
          </h2>
          {user?.role === 'admin' && (
            <p className="text-xs text-gray-500 mb-4 italic">
              (Admin view: Toont alle beschikbare vacatures voor testdoeleinden)
            </p>
          )}
          {targetedJobs.length === 0 ? (
            <p className="text-barnes-dark-gray">
              Er zijn momenteel geen vacatures beschikbaar die bij jouw profiel passen.
            </p>
          ) : (
            <div className="space-y-4">
              {targetedJobs.map((job) => (
                <div key={job.id} className="border border-gray-200 rounded-lg p-4 hover:border-barnes-violet transition-colors">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex-1">
                      <h3 className="font-semibold text-barnes-dark-violet mb-1">{job.title}</h3>
                      <p className="text-sm text-barnes-dark-gray mb-2">{job.company}</p>
                      {job.location && (
                        <p className="text-xs text-gray-500 mb-2">📍 {job.location}</p>
                      )}
                      {job.salary_range && (
                        <p className="text-xs text-gray-500 mb-2">💰 {job.salary_range}</p>
                      )}
                    </div>
                  </div>
                  <p className="text-sm text-barnes-dark-gray mb-4 line-clamp-2">{job.description}</p>
                  <button 
                    onClick={() => router.push(`/company/vacatures/${job.id}`)}
                    className="px-4 py-2 bg-barnes-violet text-white rounded-lg hover:bg-barnes-dark-violet transition-colors text-sm"
                  >
                    Bekijk Details
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function CandidateDashboard() {
  return (
    <ProtectedRoute>
      <CandidateDashboardContent />
    </ProtectedRoute>
  );
}


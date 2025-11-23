'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import EmptyState from './EmptyState';
import AdvancedFilter from './AdvancedFilter';
import { useCompany } from '../contexts/CompanyContext';

interface Candidate {
  id: string;
  name: string;
  email: string;
  job_id: string | null;
  preferential_job_ids?: string | null;
  job?: {
    title: string;
    company: string;
  };
  motivational_letter?: string;
  created_at: string;
  conversation_count?: number;
  company_note?: string | null;
  // Extended fields
  motivation_reason?: string | null;
  test_results?: string | null;
  age?: number | null;
  years_experience?: number | null;
  skill_tags?: string | null;  // JSON array
  prior_job_titles?: string | null;  // JSON array
  certifications?: string | null;  // JSON array
  education_level?: string | null;
  location?: string | null;
  communication_level?: string | null;
  availability_per_week?: number | null;
  notice_period?: string | null;
  salary_expectation?: number | null;
  source?: string | null;
  pipeline_stage?: string | null;
  pipeline_status?: string | null;
}

interface Job {
  id: string;
  title: string;
  company: string;
}

type ViewMode = 'all' | 'no-jobs' | 'in-progress';

export default function CompanyKandidaten() {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedJobs, setSelectedJobs] = useState<string[]>([]);
  const [candidateName, setCandidateName] = useState('');
  const [candidateEmail, setCandidateEmail] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  // Extended candidate fields
  const [candidateForm, setCandidateForm] = useState({
    motivation_reason: '',
    test_results: '',
    age: '',
    years_experience: '',
    skill_tags: '',  // Comma-separated, will convert to JSON
    prior_job_titles: '',  // Comma-separated, will convert to JSON
    certifications: '',  // Comma-separated, will convert to JSON
    education_level: '',
    location: '',
    communication_level: '',
    availability_per_week: '',
    notice_period: '',
    salary_expectation: '',
    source: '',
    pipeline_stage: 'introduced',
    pipeline_status: 'active',
  });
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [filters, setFilters] = useState<any>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const candidatesPerPage = 25;
  const [duplicateModal, setDuplicateModal] = useState<{
    open: boolean;
    existingCandidateId?: string;
    existingCandidateName?: string;
    existingSourceName?: string;
    formData?: FormData;
  }>({ open: false });

  const { selectedCompany } = useCompany();

  // Load data
  useEffect(() => {
    loadCandidates();
    loadJobs();
    // Auto-refresh every 30 seconds
    const interval = setInterval(() => {
      loadCandidates();
      loadJobs();
    }, 30000);
    return () => clearInterval(interval);
  }, [selectedCompany]);
  
  const loadJobs = async () => {
    try {
      const companyParam = selectedCompany?.id ? `?company_id=${selectedCompany.id}` : '';
      const response = await fetch(`/api/job-descriptions${companyParam}`);
      if (response.ok) {
        const data = await response.json();
        setJobs(data.jobs || []);
      }
    } catch (error) {
      console.error('Error loading jobs:', error);
    }
  };

  const loadCandidates = async () => {
    try {
      const { getAuthHeaders } = await import('../lib/auth');
      const headers = getAuthHeaders();
      const companyParam = selectedCompany?.id ? `?company_id=${selectedCompany.id}` : '';
      const response = await fetch(`/api/candidates${companyParam}`, { headers });
      if (response.ok) {
        const data = await response.json();
        console.log('[CompanyKandidaten] Loaded candidates:', data.candidates?.length || 0);
        setCandidates(data.candidates || []);
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('[CompanyKandidaten] Failed to load candidates:', response.status, errorData);
      }
    } catch (error) {
      console.error('Error loading candidates:', error);
    }
  };

  // Filter candidates by view mode
  const filteredByViewMode = useMemo(() => {
    let filtered = [...candidates];

    if (viewMode === 'no-jobs') {
      filtered = filtered.filter(c => {
        const hasJobId = !!c.job_id;
        const hasPrefJobs = c.preferential_job_ids && c.preferential_job_ids.trim() !== '';
        return !hasJobId && !hasPrefJobs;
      });
    } else if (viewMode === 'in-progress') {
      filtered = filtered.filter(c => {
        const hasJobId = !!c.job_id;
        const hasPrefJobs = c.preferential_job_ids && c.preferential_job_ids.trim() !== '';
        return hasJobId || hasPrefJobs;
      });
    }

    return filtered;
  }, [candidates, viewMode]);

  // Apply filters and search
  const filteredCandidates = useMemo(() => {
    let filtered = [...filteredByViewMode];
    
    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(c => 
        c.name.toLowerCase().includes(term) || 
        c.email?.toLowerCase().includes(term) ||
        c.job?.title?.toLowerCase().includes(term)
      );
    }
    
    if (filters.jobIds && filters.jobIds.length > 0) {
      filtered = filtered.filter(c => {
        const matchesJobId = c.job_id && filters.jobIds.includes(c.job_id);
        if (matchesJobId) return true;
        
        if (c.preferential_job_ids) {
          const prefJobIds = c.preferential_job_ids.split(',').map(id => id.trim()).filter(Boolean);
          return filters.jobIds.some((jid: string) => prefJobIds.includes(jid));
        }
        
        return false;
      });
    }
    
    if (filters.hasMotivationLetter) {
      filtered = filtered.filter(c => c.motivational_letter);
    }
    
    if (filters.hasConversations) {
      filtered = filtered.filter(c => (c.conversation_count || 0) > 0);
    }
    
    return filtered;
  }, [filteredByViewMode, filters, searchTerm]);

  // Pagination
  const totalPages = Math.ceil(filteredCandidates.length / candidatesPerPage);
  const paginatedCandidates = useMemo(() => {
    const start = (currentPage - 1) * candidatesPerPage;
    return filteredCandidates.slice(start, start + candidatesPerPage);
  }, [filteredCandidates, currentPage]);

  // Get job status for a candidate
  const getCandidateJobStatus = (candidate: Candidate) => {
    const jobIds: string[] = [];
    if (candidate.job_id) {
      jobIds.push(candidate.job_id);
    }
    if (candidate.preferential_job_ids && candidate.preferential_job_ids.trim() !== '') {
      const prefIds = candidate.preferential_job_ids.split(',').map(id => id.trim()).filter(Boolean);
      jobIds.push(...prefIds);
    }
    
    // Remove duplicates (in case job_id is also in preferential_job_ids)
    const uniqueJobIds = Array.from(new Set(jobIds));
    
    const jobStatuses = uniqueJobIds
      .map(jobId => {
        const job = jobs.find(j => j.id === jobId);
        return job ? { id: jobId, title: job.title, company: job.company } : null;
      })
      .filter((job): job is { id: string; title: string; company: string } => job !== null);
    
    return jobStatuses;
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile || !candidateName) {
      alert('Selecteer een bestand en voer een naam in');
      return;
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('name', candidateName);
      if (candidateEmail) {
        formData.append('email', candidateEmail);
      }
      
      if (selectedJobs.length > 0) {
        formData.append('job_ids', selectedJobs.join(','));
      }

      // Add extended fields BEFORE the fetch call
      if (candidateForm.motivation_reason) formData.append('motivation_reason', candidateForm.motivation_reason);
      if (candidateForm.test_results) formData.append('test_results', candidateForm.test_results);
      if (candidateForm.age) formData.append('age', candidateForm.age);
      if (candidateForm.years_experience) formData.append('years_experience', candidateForm.years_experience);
      if (candidateForm.skill_tags) {
        const skillTagsArray = candidateForm.skill_tags.split(',').map(t => t.trim()).filter(Boolean);
        formData.append('skill_tags', JSON.stringify(skillTagsArray));
      }
      if (candidateForm.prior_job_titles) {
        const jobTitlesArray = candidateForm.prior_job_titles.split(',').map(t => t.trim()).filter(Boolean);
        formData.append('prior_job_titles', JSON.stringify(jobTitlesArray));
      }
      if (candidateForm.certifications) {
        const certsArray = candidateForm.certifications.split(',').map(t => t.trim()).filter(Boolean);
        formData.append('certifications', JSON.stringify(certsArray));
      }
      if (candidateForm.education_level) formData.append('education_level', candidateForm.education_level);
      if (candidateForm.location) formData.append('location', candidateForm.location);
      if (candidateForm.communication_level) formData.append('communication_level', candidateForm.communication_level);
      if (candidateForm.availability_per_week) formData.append('availability_per_week', candidateForm.availability_per_week);
      if (candidateForm.notice_period) formData.append('notice_period', candidateForm.notice_period);
      if (candidateForm.salary_expectation) formData.append('salary_expectation', candidateForm.salary_expectation);
      if (candidateForm.source) formData.append('source', candidateForm.source);
      if (candidateForm.pipeline_stage) formData.append('pipeline_stage', candidateForm.pipeline_stage);
      if (candidateForm.pipeline_status) formData.append('pipeline_status', candidateForm.pipeline_status);

      const response = await fetch('/api/upload-resume', {
        method: 'POST',
        body: formData
      });

      const responseData = await response.json().catch(() => ({}));

      // Check for duplicate warning (not an error, but a request for user action)
      if (!response.ok && responseData.duplicate_detected) {
        // Show duplicate modal with options
        setDuplicateModal({
          open: true,
          existingCandidateId: responseData.existing_candidate_id,
          existingCandidateName: responseData.existing_candidate_name,
          existingSourceName: responseData.existing_source_name || 'een andere partij',
          formData: formData  // Store formData for retry
        });
        setIsUploading(false);
        return;
      }

      if (response.ok) {
        await loadCandidates();
        setSelectedFile(null);
        setCandidateName('');
        setCandidateEmail('');
        setSelectedJobs([]);
        setCandidateForm({
          motivation_reason: '',
          test_results: '',
          age: '',
          years_experience: '',
          skill_tags: '',
          prior_job_titles: '',
          certifications: '',
          education_level: '',
          location: '',
          communication_level: '',
          availability_per_week: '',
          notice_period: '',
          salary_expectation: '',
          source: '',
          pipeline_stage: 'introduced',
          pipeline_status: 'active',
        });
        setShowAddModal(false);
        const message = responseData.overwritten 
          ? 'Kandidaat succesvol bijgewerkt (overschreven)'
          : 'Kandidaat succesvol geüpload';
        alert(message);
      } else {
        let errorMessage = 'Onbekende fout';
        try {
          const error = responseData.error || responseData.detail || responseData.message || 'Onbekende fout';
          errorMessage = error;
        } catch (e) {
          errorMessage = 'Onbekende fout';
        }
        alert('Fout bij uploaden: ' + errorMessage);
      }
    } catch (error: any) {
      alert('Fout bij uploaden: ' + error.message);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDuplicateAction = async (action: 'overwrite' | 'force' | 'cancel') => {
    if (action === 'cancel') {
      setDuplicateModal({ open: false });
      setIsUploading(false);
      return;
    }

    if (!duplicateModal.formData) {
      setDuplicateModal({ open: false });
      setIsUploading(false);
      return;
    }

    setIsUploading(true);
    try {
      const formData = duplicateModal.formData;
      
      if (action === 'overwrite' && duplicateModal.existingCandidateId) {
        // Update existing candidate
        formData.append('duplicate_candidate_id', duplicateModal.existingCandidateId);
      } else if (action === 'force') {
        // Force create duplicate (new entry)
        formData.append('force_duplicate', 'true');
      }

      const response = await fetch('/api/upload-resume', {
        method: 'POST',
        body: formData
      });

      const responseData = await response.json().catch(() => ({}));

      if (response.ok) {
        await loadCandidates();
        setSelectedFile(null);
        setCandidateName('');
        setCandidateEmail('');
        setSelectedJobs([]);
        setCandidateForm({
          motivation_reason: '',
          test_results: '',
          age: '',
          years_experience: '',
          skill_tags: '',
          prior_job_titles: '',
          certifications: '',
          education_level: '',
          location: '',
          communication_level: '',
          availability_per_week: '',
          notice_period: '',
          salary_expectation: '',
          source: '',
          pipeline_stage: 'introduced',
          pipeline_status: 'active',
        });
        setShowAddModal(false);
        setDuplicateModal({ open: false });
        const message = action === 'overwrite' 
          ? 'Kandidaat succesvol bijgewerkt'
          : 'Kandidaat succesvol toegevoegd (duplicaat toegestaan)';
        alert(message);
      } else {
        let errorMessage = 'Onbekende fout';
        try {
          const error = responseData.error || responseData.detail || responseData.message || 'Onbekende fout';
          errorMessage = error;
        } catch (e) {
          errorMessage = 'Onbekende fout';
        }
        alert('Fout bij uploaden: ' + errorMessage);
      }
    } catch (error: any) {
      alert('Fout bij uploaden: ' + error.message);
    } finally {
      setIsUploading(false);
      setDuplicateModal({ open: false });
    }
  };

  const handleDelete = async (candidateId: string, candidateName: string) => {
    if (!confirm(`Weet u zeker dat u ${candidateName} wilt verwijderen?`)) {
      return;
    }

    setDeletingId(candidateId);
    try {
      const response = await fetch(`/api/candidates/${candidateId}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        await loadCandidates();
      } else {
        const error = await response.json();
        alert('Fout bij verwijderen: ' + (error.error || 'Onbekende fout'));
      }
    } catch (error: any) {
      alert('Fout bij verwijderen: ' + error.message);
    } finally {
      setDeletingId(null);
    }
  };

  const stats = useMemo(() => {
    const total = candidates.length;
    const noJobs = candidates.filter(c => {
      const hasJobId = !!c.job_id;
      const hasPrefJobs = c.preferential_job_ids && c.preferential_job_ids.trim() !== '';
      return !hasJobId && !hasPrefJobs;
    }).length;
    const inProgress = total - noJobs;
    return { total, noJobs, inProgress };
  }, [candidates]);

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
        <h1 className="text-3xl font-bold text-barnes-dark-violet mb-2">Kandidaten</h1>
            <p className="text-barnes-dark-gray">Beheer en volg kandidaten in hun processen</p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="btn-primary px-6 py-2 flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Nieuwe Kandidaat
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="text-2xl font-bold text-barnes-dark-violet">{stats.total}</div>
            <div className="text-sm text-barnes-dark-gray">Totaal Kandidaten</div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="text-2xl font-bold text-orange-600">{stats.noJobs}</div>
            <div className="text-sm text-barnes-dark-gray">Zonder Vacature</div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="text-2xl font-bold text-green-600">{stats.inProgress}</div>
            <div className="text-sm text-barnes-dark-gray">In Proces</div>
          </div>
        </div>

        {/* View Mode Tabs */}
        <div className="flex gap-2 mb-4 border-b border-gray-200">
          <button
            onClick={() => {
              setViewMode('all');
              setCurrentPage(1);
            }}
            className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
              viewMode === 'all'
                ? 'border-barnes-violet text-barnes-dark-violet'
                : 'border-transparent text-barnes-dark-gray hover:text-barnes-dark-violet'
            }`}
          >
            Alle ({candidates.length})
          </button>
          <button
            onClick={() => {
              setViewMode('no-jobs');
              setCurrentPage(1);
            }}
            className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
              viewMode === 'no-jobs'
                ? 'border-barnes-violet text-barnes-dark-violet'
                : 'border-transparent text-barnes-dark-gray hover:text-barnes-dark-violet'
            }`}
          >
            Zonder Vacature ({stats.noJobs})
          </button>
          <button
            onClick={() => {
              setViewMode('in-progress');
              setCurrentPage(1);
            }}
            className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
              viewMode === 'in-progress'
                ? 'border-barnes-violet text-barnes-dark-violet'
                : 'border-transparent text-barnes-dark-gray hover:text-barnes-dark-violet'
            }`}
          >
            In Proces ({stats.inProgress})
          </button>
        </div>

        {/* Search and Filters */}
        <div className="flex gap-4 mb-4">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Zoeken op naam, email of vacature..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-barnes-violet"
            />
          </div>
          <AdvancedFilter
            onFilterChange={(newFilters) => {
              setFilters(newFilters);
              setCurrentPage(1);
            }}
            jobs={jobs.map(j => ({ id: j.id, title: j.title }))}
          />
        </div>
      </div>

      {/* Candidates Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {filteredCandidates.length === 0 ? (
          <EmptyState
            icon="📄"
            title="Geen kandidaten gevonden"
            description={
              searchTerm || (filters && Object.keys(filters).length > 0)
                ? "Probeer je zoekterm of filters aan te passen"
                : viewMode === 'no-jobs'
                ? "Alle kandidaten hebben vacatures toegewezen"
                : viewMode === 'in-progress'
                ? "Geen kandidaten in proces"
                : "Upload je eerste kandidaat om te beginnen"
            }
            action={
              filteredCandidates.length === 0 && !searchTerm && (!filters || Object.keys(filters).length === 0)
                ? {
                    label: "Nieuwe kandidaat toevoegen",
                    onClick: () => setShowAddModal(true)
                  }
                : undefined
            }
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-barnes-light-gray">
                  <tr>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-barnes-dark-violet">Naam</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-barnes-dark-violet">Email</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-barnes-dark-violet">Vacature(s)</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-barnes-dark-violet">Status</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-barnes-dark-violet">Motivatie</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-barnes-dark-violet">Gesprekken</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-barnes-dark-violet">Datum</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-barnes-dark-violet">Acties</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedCandidates.map((candidate, rowIdx) => {
                    const jobStatuses = getCandidateJobStatus(candidate);
                    return (
                      <tr 
                        key={candidate.id} 
                        className="hover:bg-gray-50 transition-colors border-b border-gray-200 last:border-b-0"
                      >
                        <td className="py-3 px-4">
                          <Link
                            href={`/company/kandidaten/${candidate.id}`}
                            className="text-barnes-violet hover:text-barnes-dark-violet font-medium hover:underline"
                          >
                            {candidate.name}
                          </Link>
                        </td>
                        <td className="py-3 px-4 text-sm text-barnes-dark-gray">
                          {candidate.email || '-'}
                        </td>
                        <td className="py-3 px-4">
                          {jobStatuses.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {jobStatuses.map((job, idx) => (
                                <span
                                  key={`${candidate.id}-${job.id}-${idx}`}
                                  className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-barnes-violet/10 text-barnes-violet border border-barnes-violet/20"
                                  title={`${job.title} bij ${job.company}`}
                                >
                                  {job.title}
                                  {candidate.job_id === job.id && (
                                    <span className="ml-1 text-green-600" title="Hoofdvacature">●</span>
                                  )}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-gray-400 text-sm">-</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          {jobStatuses.length > 0 ? (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                              Actief
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                              Wachtend
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          {candidate.motivational_letter ? (
                            <span className="text-green-600 text-sm">✓</span>
                          ) : (
                            <span className="text-gray-400 text-sm">-</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          {candidate.conversation_count && candidate.conversation_count > 0 ? (
                            <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-barnes-violet/10 text-barnes-violet rounded-full">
                              <span className="w-1.5 h-1.5 rounded-full bg-barnes-violet"></span>
                              {candidate.conversation_count}
                            </span>
                          ) : (
                            <span className="text-gray-400 text-xs">-</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-sm text-barnes-dark-gray">
                          {new Date(candidate.created_at).toLocaleDateString('nl-NL')}
                        </td>
                        <td className="py-3 px-4">
                          <button
                            onClick={() => handleDelete(candidate.id, candidate.name)}
                            disabled={deletingId === candidate.id}
                            className={`text-sm font-medium ${
                              deletingId === candidate.id 
                                ? 'text-gray-400 cursor-not-allowed' 
                                : 'text-red-600 hover:text-red-800'
                            }`}
                          >
                            {deletingId === candidate.id ? '...' : 'Verwijderen'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="border-t border-gray-200 px-4 py-3 flex items-center justify-between">
                <div className="text-sm text-barnes-dark-gray">
                  Toon {(currentPage - 1) * candidatesPerPage + 1} tot {Math.min(currentPage * candidatesPerPage, filteredCandidates.length)} van {filteredCandidates.length} kandidaten
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1 border border-gray-300 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                  >
                    Vorige
                  </button>
                  <div className="flex gap-1">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pageNum;
                      if (totalPages <= 5) {
                        pageNum = i + 1;
                      } else if (currentPage <= 3) {
                        pageNum = i + 1;
                      } else if (currentPage >= totalPages - 2) {
                        pageNum = totalPages - 4 + i;
                      } else {
                        pageNum = currentPage - 2 + i;
                      }
                      return (
                        <button
                          key={pageNum}
                          onClick={() => setCurrentPage(pageNum)}
                          className={`px-3 py-1 border rounded-lg text-sm ${
                            currentPage === pageNum
                              ? 'bg-barnes-violet text-white border-barnes-violet'
                              : 'border-gray-300 hover:bg-gray-50'
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                  </div>
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1 border border-gray-300 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                  >
                    Volgende
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Add Candidate Modal - Expanded with all new fields */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[95vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-gray-200 flex-shrink-0">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-semibold text-barnes-dark-violet">Nieuwe Kandidaat Toevoegen</h2>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <form onSubmit={handleUpload} className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Basic Information Section */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-barnes-dark-violet pb-2 border-b border-gray-200">Basis Informatie</h3>
                <div>
                  <label className="block text-sm font-medium text-barnes-dark-gray mb-2">
                    CV Bestand *
                  </label>
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx,.txt"
                    onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-barnes-violet"
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-barnes-dark-gray mb-2">
                      Naam *
                    </label>
                    <input
                      type="text"
                      value={candidateName}
                      onChange={(e) => setCandidateName(e.target.value)}
                      required
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-barnes-violet"
                      placeholder="Naam van kandidaat"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-barnes-dark-gray mb-2">
                      E-mail
                    </label>
                    <input
                      type="email"
                      value={candidateEmail}
                      onChange={(e) => setCandidateEmail(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-barnes-violet"
                      placeholder="email@example.com"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-barnes-dark-gray mb-2">
                      Leeftijd
                    </label>
                    <input
                      type="number"
                      value={candidateForm.age}
                      onChange={(e) => setCandidateForm({...candidateForm, age: e.target.value})}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-barnes-violet"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-barnes-dark-gray mb-2">
                      Jaren Ervaring
                    </label>
                    <input
                      type="number"
                      value={candidateForm.years_experience}
                      onChange={(e) => setCandidateForm({...candidateForm, years_experience: e.target.value})}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-barnes-violet"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-barnes-dark-gray mb-2">
                      Locatie
                    </label>
                    <input
                      type="text"
                      value={candidateForm.location}
                      onChange={(e) => setCandidateForm({...candidateForm, location: e.target.value})}
                      placeholder="bijv. Amsterdam"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-barnes-violet"
                    />
                  </div>
                </div>
              </div>

              {/* Professional Information Section */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-barnes-dark-violet pb-2 border-b border-gray-200">Professionele Informatie</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-barnes-dark-gray mb-2">
                      Opleidingsniveau
                    </label>
                    <select
                      value={candidateForm.education_level}
                      onChange={(e) => setCandidateForm({...candidateForm, education_level: e.target.value})}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-barnes-violet"
                    >
                      <option value="">Selecteer...</option>
                      <option value="MBO">MBO</option>
                      <option value="HBO">HBO</option>
                      <option value="Bachelor">Bachelor</option>
                      <option value="Master">Master</option>
                      <option value="PhD">PhD</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-barnes-dark-gray mb-2">
                      Communicatieniveau
                    </label>
                    <select
                      value={candidateForm.communication_level}
                      onChange={(e) => setCandidateForm({...candidateForm, communication_level: e.target.value})}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-barnes-violet"
                    >
                      <option value="">Selecteer...</option>
                      <option value="Native">Native</option>
                      <option value="Fluent">Vloeiend</option>
                      <option value="Intermediate">Gemiddeld</option>
                      <option value="Basic">Basis</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-barnes-dark-gray mb-2">
                    Vaardigheden (gescheiden door komma's)
                  </label>
                  <input
                    type="text"
                    value={candidateForm.skill_tags}
                    onChange={(e) => setCandidateForm({...candidateForm, skill_tags: e.target.value})}
                    placeholder="bijv. Python, JavaScript, React"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-barnes-violet"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-barnes-dark-gray mb-2">
                    Eerdere Functies (gescheiden door komma's)
                  </label>
                  <input
                    type="text"
                    value={candidateForm.prior_job_titles}
                    onChange={(e) => setCandidateForm({...candidateForm, prior_job_titles: e.target.value})}
                    placeholder="bijv. Software Developer, Team Lead"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-barnes-violet"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-barnes-dark-gray mb-2">
                    Certificeringen (gescheiden door komma's)
                  </label>
                  <input
                    type="text"
                    value={candidateForm.certifications}
                    onChange={(e) => setCandidateForm({...candidateForm, certifications: e.target.value})}
                    placeholder="bijv. AWS Certified, Scrum Master"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-barnes-violet"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-barnes-dark-gray mb-2">
                    Testresultaten / Skill Scores
                  </label>
                  <textarea
                    value={candidateForm.test_results}
                    onChange={(e) => setCandidateForm({...candidateForm, test_results: e.target.value})}
                    placeholder="Testresultaten of skill scores..."
                    rows={3}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-barnes-violet"
                  />
                </div>
              </div>

              {/* Availability & Compensation Section */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-barnes-dark-violet pb-2 border-b border-gray-200">Beschikbaarheid & Vergoeding</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-barnes-dark-gray mb-2">
                      Beschikbaar per week (uren)
                    </label>
                    <input
                      type="number"
                      value={candidateForm.availability_per_week}
                      onChange={(e) => setCandidateForm({...candidateForm, availability_per_week: e.target.value})}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-barnes-violet"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-barnes-dark-gray mb-2">
                      Opzegtermijn
                    </label>
                    <input
                      type="text"
                      value={candidateForm.notice_period}
                      onChange={(e) => setCandidateForm({...candidateForm, notice_period: e.target.value})}
                      placeholder="bijv. 2 weken, 1 maand"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-barnes-violet"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-barnes-dark-gray mb-2">
                      Salarisverwachting (EUR / 40h)
                    </label>
                    <input
                      type="number"
                      value={candidateForm.salary_expectation}
                      onChange={(e) => setCandidateForm({...candidateForm, salary_expectation: e.target.value})}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-barnes-violet"
                    />
                  </div>
                </div>
              </div>

              {/* Motivation & Application Section */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-barnes-dark-violet pb-2 border-b border-gray-200">Motivatie & Aanmelding</h3>
                <div>
                  <label className="block text-sm font-medium text-barnes-dark-gray mb-2">
                    Motivatie voor rol / Reden vertrek huidige functie
                  </label>
                  <textarea
                    value={candidateForm.motivation_reason}
                    onChange={(e) => setCandidateForm({...candidateForm, motivation_reason: e.target.value})}
                    placeholder="Waarom is de kandidaat geïnteresseerd in deze rol?"
                    rows={4}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-barnes-violet"
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-barnes-dark-gray mb-2">
                      Bron (Hoe is kandidaat gevonden?)
                    </label>
                    <select
                      value={candidateForm.source}
                      onChange={(e) => setCandidateForm({...candidateForm, source: e.target.value})}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-barnes-violet"
                    >
                      <option value="">Selecteer...</option>
                      <option value="LinkedIn">LinkedIn</option>
                      <option value="Indeed">Indeed</option>
                      <option value="Direct">Direct</option>
                      <option value="Agency">Recruitmentsbureau</option>
                      <option value="Referral">Referral</option>
                      <option value="Other">Anders</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-barnes-dark-gray mb-2">
                      Pipeline Stage
                    </label>
                    <select
                      value={candidateForm.pipeline_stage}
                      onChange={(e) => setCandidateForm({...candidateForm, pipeline_stage: e.target.value})}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-barnes-violet"
                    >
                      <option value="introduced">Geïntroduceerd</option>
                      <option value="review">Review/Vergelijking</option>
                      <option value="first_interview">Eerste gesprek + evaluatie</option>
                      <option value="second_interview">Tweede gesprek / technische test</option>
                      <option value="offer">Aanbieding</option>
                      <option value="complete">Proces voltooid</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-barnes-dark-gray mb-2">
                      Pipeline Status
                    </label>
                    <select
                      value={candidateForm.pipeline_status}
                      onChange={(e) => setCandidateForm({...candidateForm, pipeline_status: e.target.value})}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-barnes-violet"
                    >
                      <option value="active">Actief</option>
                      <option value="on_hold">On Hold</option>
                      <option value="rejected">Afgewezen</option>
                      <option value="accepted">Geaccepteerd</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Job Assignment Section */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-barnes-dark-violet pb-2 border-b border-gray-200">Vacature Toewijzing</h3>
                <div>
                  <label className="block text-sm font-medium text-barnes-dark-gray mb-2">
                    Preferentiële Vacatures (Optioneel - Meerdere selecteren mogelijk)
                  </label>
                  <div className="space-y-2 max-h-48 overflow-y-auto border border-gray-300 rounded-lg p-3">
                    {jobs.length === 0 ? (
                      <p className="text-sm text-gray-500">Geen vacatures beschikbaar</p>
                    ) : (
                      jobs.map(job => (
                        <label key={job.id} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded">
                          <input
                            type="checkbox"
                            checked={selectedJobs.includes(job.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedJobs([...selectedJobs, job.id]);
                              } else {
                                setSelectedJobs(selectedJobs.filter(id => id !== job.id));
                              }
                            }}
                            className="w-4 h-4 text-barnes-violet border-gray-300 rounded focus:ring-barnes-violet"
                          />
                          <span className="text-sm text-barnes-dark-gray">
                            {job.title} - {job.company}
                          </span>
                        </label>
                      ))
                    )}
                  </div>
                  <p className="text-xs text-barnes-dark-gray mt-1">
                    Selecteer vacatures waar deze kandidaat voorkeur voor heeft.
                  </p>
                </div>
              </div>

              {/* Form Actions */}
              <div className="flex gap-3 pt-4 border-t border-gray-200 sticky bottom-0 bg-white">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    // Reset form
                    setCandidateForm({
                      motivation_reason: '',
                      test_results: '',
                      age: '',
                      years_experience: '',
                      skill_tags: '',
                      prior_job_titles: '',
                      certifications: '',
                      education_level: '',
                      location: '',
                      communication_level: '',
                      availability_per_week: '',
                      notice_period: '',
                      salary_expectation: '',
                      source: '',
                      pipeline_stage: 'introduced',
                      pipeline_status: 'active',
                    });
                    setSelectedFile(null);
                    setCandidateName('');
                    setCandidateEmail('');
                    setSelectedJobs([]);
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-barnes-dark-gray hover:bg-gray-50"
                >
                  Annuleren
                </button>
                <button
                  type="submit"
                  disabled={isUploading}
                  className="flex-1 btn-primary px-4 py-2 disabled:opacity-50"
                >
                  {isUploading ? 'Uploaden...' : 'Kandidaat Toevoegen'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Duplicate Candidate Modal */}
      {duplicateModal.open && (
        <div
          className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setDuplicateModal({ open: false });
              setIsUploading(false);
            }
          }}
        >
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-semibold text-barnes-dark-violet">Dubbele kandidaat gedetecteerd</h3>
                <p className="text-sm text-barnes-dark-gray mt-1">
                  Deze kandidaat is al eerder ingediend
                </p>
              </div>
              <button
                onClick={() => {
                  setDuplicateModal({ open: false });
                  setIsUploading(false);
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>

            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm font-medium text-yellow-800 mb-2">Bestaande kandidaat gevonden:</p>
              <p className="text-sm text-yellow-700">
                <strong>{duplicateModal.existingCandidateName}</strong>
                {duplicateModal.existingSourceName && (
                  <> • Ingediend door: <strong>{duplicateModal.existingSourceName}</strong></>
                )}
              </p>
            </div>

            <div className="space-y-3">
              <p className="text-sm text-barnes-dark-gray">
                Kies wat u wilt doen met deze kandidaat:
              </p>

              <div className="space-y-2">
                <button
                  onClick={() => handleDuplicateAction('overwrite')}
                  disabled={isUploading || !duplicateModal.existingCandidateId}
                  className="w-full text-left p-4 border-2 border-barnes-violet rounded-lg hover:bg-barnes-violet/5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-6 h-6 rounded-full border-2 border-barnes-violet flex items-center justify-center mt-0.5">
                      <svg className="w-4 h-4 text-barnes-violet" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-barnes-dark-violet">Overschrijven</p>
                      <p className="text-xs text-barnes-dark-gray mt-1">
                        Vervang de bestaande kandidaat met de nieuwe informatie
                      </p>
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => handleDuplicateAction('force')}
                  disabled={isUploading}
                  className="w-full text-left p-4 border-2 border-orange-400 rounded-lg hover:bg-orange-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-6 h-6 rounded-full border-2 border-orange-400 flex items-center justify-center mt-0.5">
                      <svg className="w-4 h-4 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-orange-700">Toch toevoegen</p>
                      <p className="text-xs text-barnes-dark-gray mt-1">
                        Voeg een nieuwe kandidaat toe (duplicaat toegestaan)
                      </p>
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => handleDuplicateAction('cancel')}
                  disabled={isUploading}
                  className="w-full text-left p-4 border-2 border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-6 h-6 rounded-full border-2 border-gray-400 flex items-center justify-center mt-0.5">
                      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-gray-700">Annuleren</p>
                      <p className="text-xs text-barnes-dark-gray mt-1">
                        Onderbreek de upload en keer terug
                      </p>
                    </div>
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

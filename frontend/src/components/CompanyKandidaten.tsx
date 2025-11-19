'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import EmptyState from './EmptyState';
import AdvancedFilter from './AdvancedFilter';

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
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [filters, setFilters] = useState<any>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const candidatesPerPage = 25;

  // Load data
  useEffect(() => {
    loadCandidates();
    loadJobs();
  }, []);

  const loadJobs = async () => {
    try {
      const response = await fetch('/api/job-descriptions');
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
      const response = await fetch('/api/candidates');
      if (response.ok) {
        const data = await response.json();
        setCandidates(data.candidates || []);
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
    
    const jobStatuses = jobIds
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

      const response = await fetch('/api/upload-resume', {
        method: 'POST',
        body: formData
      });

      if (response.ok) {
        await loadCandidates();
        setSelectedFile(null);
        setCandidateName('');
        setCandidateEmail('');
        setSelectedJobs([]);
        setShowAddModal(false);
        alert('Kandidaat succesvol geüpload');
      } else {
        let errorMessage = 'Onbekende fout';
        try {
          const error = await response.json();
          errorMessage = error.error || error.detail || error.message || 'Onbekende fout';
        } catch (e) {
          const errorText = await response.text();
          errorMessage = errorText || 'Onbekende fout';
        }
        alert('Fout bij uploaden: ' + errorMessage);
      }
    } catch (error: any) {
      alert('Fout bij uploaden: ' + error.message);
    } finally {
      setIsUploading(false);
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
                <tbody className="divide-y divide-gray-100">
                  {paginatedCandidates.map(candidate => {
                    const jobStatuses = getCandidateJobStatus(candidate);
                    return (
                      <tr 
                        key={candidate.id} 
                        className="hover:bg-gray-50 transition-colors"
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
                                  key={job.id}
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

      {/* Add Candidate Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
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

            <form onSubmit={handleUpload} className="p-6 space-y-4">
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

              <div className="grid grid-cols-2 gap-4">
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
                    Email
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

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
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
    </div>
  );
}

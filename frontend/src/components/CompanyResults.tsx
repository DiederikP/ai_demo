'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import AdvancedFilter from './AdvancedFilter';
import { useCompany } from '../contexts/CompanyContext';

interface EvaluationResult {
  id: string;
  candidate_id: string;
  job_id: string;
  result_type: 'evaluation' | 'debate';
  selected_personas: string[];
  company_note?: string;
  created_at: string;
  updated_at?: string;
  result_data: any;
  candidate_name?: string;
  job_title?: string;
}

export default function CompanyResults() {
  const router = useRouter();
  const [results, setResults] = useState<EvaluationResult[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | 'evaluation' | 'debate'>('all');
  const [filterJob, setFilterJob] = useState<string>('');
  const [jobs, setJobs] = useState<any[]>([]);
  const [candidatesMap, setCandidatesMap] = useState<Record<string, string>>({});
  const [candidatesLoaded, setCandidatesLoaded] = useState(false);
  const [advancedFilters, setAdvancedFilters] = useState<any>({});

  useEffect(() => {
    // Load jobs and candidates in parallel for better performance
    Promise.all([loadJobs(), loadCandidates()]).then(() => {
      // Auto-load results after jobs and candidates are loaded
      loadResults();
    });
  }, []);

  useEffect(() => {
    if (!candidatesLoaded || jobs.length === 0) {
      return;
    }
    loadResults();
  }, [activeTab, filterJob, jobs, candidatesLoaded]);

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
      const companyParam = selectedCompany?.id ? `?company_id=${selectedCompany.id}` : '';
      const response = await fetch(`/api/candidates${companyParam}`);
      if (response.ok) {
        const data = await response.json();
        const map: Record<string, string> = {};
        (data.candidates || []).forEach((candidate: any) => {
          map[candidate.id] = candidate.name;
        });
        setCandidatesMap(map);
      }
    } catch (error) {
      console.error('Error loading candidates:', error);
    } finally {
      setCandidatesLoaded(true);
    }
  };

  const { selectedCompany } = useCompany();
  
  const loadResults = async () => {
    setIsLoading(true);
    try {
      const { getAuthHeaders } = await import('../lib/auth');
      const headers = getAuthHeaders();
      
      let url = '/api/evaluation-results';
      const params = new URLSearchParams();
      if (activeTab !== 'all') {
        params.append('result_type', activeTab);
      }
      if (filterJob) {
        params.append('job_id', filterJob);
      }
      if (selectedCompany?.id) {
        params.append('company_id', selectedCompany.id);
      }
      if (params.toString()) {
        url += '?' + params.toString();
      }

      const response = await fetch(url, { headers });
      if (response.ok) {
        const data = await response.json();
        const jobMap = jobs.reduce<Record<string, any>>((acc, job) => {
          acc[job.id] = job;
          return acc;
        }, {});

        const normalizedResults = (data.results || []).map((result: EvaluationResult) => {
          let parsedData = result.result_data;
          try {
            parsedData =
              typeof result.result_data === 'string'
                ? JSON.parse(result.result_data)
                : result.result_data;
          } catch {
            parsedData = result.result_data;
          }

          return {
            ...result,
            result_data: parsedData,
            candidate_name: candidatesMap[result.candidate_id] || result.candidate_name || 'Onbekende kandidaat',
            job_title: jobMap[result.job_id]?.title || result.job_title || 'Onbekende vacature',
          };
        });
        setResults(normalizedResults);
      }
    } catch (error) {
      console.error('Error loading results:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('nl-NL', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleDelete = async (resultId: string) => {
    try {
      const response = await fetch(`/api/evaluation-results/${resultId}`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          await loadResults();
        } else {
          alert(`Fout bij verwijderen: ${result.error || result.message || 'Onbekende fout'}`);
        }
      } else {
        let errorMessage = 'Onbekende fout';
        try {
          const error = await response.json();
          errorMessage = error.error || error.detail || error.message || JSON.stringify(error);
        } catch (e) {
          const errorText = await response.text();
          errorMessage = errorText || `HTTP ${response.status}: ${response.statusText}`;
        }
        console.error('Delete error response:', response.status, errorMessage);
        alert(`Fout bij verwijderen: ${errorMessage}`);
      }
    } catch (error: any) {
      console.error('Error deleting result:', error);
      alert(`Fout bij verwijderen: ${error.message || 'Onbekende fout'}`);
    }
  };

  // Calculate summary statistics
  const summaryStats = useMemo(() => {
    const evaluations = results.filter(r => r.result_type === 'evaluation');
    const debates = results.filter(r => r.result_type === 'debate');
    const uniqueJobs = new Set(results.map(r => r.job_id));
    const uniqueCandidates = new Set(results.map(r => r.candidate_id));
    
    return {
      total: results.length,
      evaluations: evaluations.length,
      debates: debates.length,
      jobs: uniqueJobs.size,
      candidates: uniqueCandidates.size,
    };
  }, [results]);

  // Job map - must be before early return
  const jobMap = useMemo(() => {
    return jobs.reduce<Record<string, any>>((acc, job) => {
      acc[job.id] = job;
      return acc;
    }, {});
  }, [jobs]);

  // Filtered results - must be before early return
  const filteredResults = useMemo(() => {
    return results.filter(result => {
      // Basic filters
      if (activeTab !== 'all' && result.result_type !== activeTab) {
        return false;
      }
      if (filterJob && result.job_id !== filterJob) {
        return false;
      }
      
      // Advanced filters
      if (advancedFilters.searchTerm) {
        const term = advancedFilters.searchTerm.toLowerCase();
        const candidateName = (result.candidate_name || '').toLowerCase();
        const jobTitle = (result.job_title || '').toLowerCase();
        if (!candidateName.includes(term) && !jobTitle.includes(term)) {
          return false;
        }
      }
      
      if (advancedFilters.jobIds && advancedFilters.jobIds.length > 0) {
        if (!advancedFilters.jobIds.includes(result.job_id)) {
          return false;
        }
      }
      
      if (advancedFilters.dateFrom) {
        const resultDate = new Date(result.created_at);
        const filterDate = new Date(advancedFilters.dateFrom);
        if (resultDate < filterDate) {
          return false;
        }
      }
      
      if (advancedFilters.dateTo) {
        const resultDate = new Date(result.created_at);
        const filterDate = new Date(advancedFilters.dateTo);
        filterDate.setHours(23, 59, 59, 999); // End of day
        if (resultDate > filterDate) {
          return false;
        }
      }
      
      return true;
    });
  }, [results, activeTab, filterJob, advancedFilters]);

  const resultsByJob: Record<string, EvaluationResult[]> = {};
  filteredResults.forEach(result => {
    if (!resultsByJob[result.job_id]) {
      resultsByJob[result.job_id] = [];
    }
    resultsByJob[result.job_id].push(result);
  });

  // Include jobs that have AI analysis even if there are no evaluation/debate results
  const jobIdsSet = new Set(Object.keys(resultsByJob));
  jobs.forEach(job => {
    if (job.ai_analysis && (!filterJob || filterJob === job.id)) {
      jobIdsSet.add(job.id);
    }
  });
  const jobIdsToShow = Array.from(jobIdsSet);

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-barnes-dark-violet mb-2">Resultaten</h1>
          <p className="text-barnes-dark-gray">Overzicht van alle evaluaties en debatten</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={loadResults}
            className="btn-secondary"
          >
            Vernieuwen
          </button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-sm text-barnes-dark-gray mb-1">Totaal</p>
          <p className="text-2xl font-bold text-barnes-dark-violet">{summaryStats.total}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-sm text-barnes-dark-gray mb-1">Evaluaties</p>
          <p className="text-2xl font-bold text-barnes-violet">{summaryStats.evaluations}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-sm text-barnes-dark-gray mb-1">Debatten</p>
          <p className="text-2xl font-bold text-barnes-orange">{summaryStats.debates}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-sm text-barnes-dark-gray mb-1">Vacatures</p>
          <p className="text-2xl font-bold text-barnes-dark-violet">{summaryStats.jobs}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-sm text-barnes-dark-gray mb-1">Kandidaten</p>
          <p className="text-2xl font-bold text-barnes-dark-violet">{summaryStats.candidates}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
        <div className="flex flex-col gap-4">
          {/* Tab Navigation */}
          <div className="flex border-b border-gray-200">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-6 py-3 font-medium transition-colors border-b-2 ${
                activeTab === 'all'
                  ? 'border-barnes-violet text-barnes-violet'
                  : 'border-transparent text-barnes-dark-gray hover:text-barnes-violet'
              }`}
            >
              Alle ({summaryStats.total})
            </button>
            <button
              onClick={() => setActiveTab('evaluation')}
              className={`px-6 py-3 font-medium transition-colors border-b-2 ${
                activeTab === 'evaluation'
                  ? 'border-barnes-violet text-barnes-violet'
                  : 'border-transparent text-barnes-dark-gray hover:text-barnes-violet'
              }`}
            >
              Evaluaties ({summaryStats.evaluations})
            </button>
            <button
              onClick={() => setActiveTab('debate')}
              className={`px-6 py-3 font-medium transition-colors border-b-2 ${
                activeTab === 'debate'
                  ? 'border-barnes-violet text-barnes-violet'
                  : 'border-transparent text-barnes-dark-gray hover:text-barnes-violet'
              }`}
            >
              Debatten ({summaryStats.debates})
            </button>
          </div>

          {/* Filters */}
          <div className="flex flex-col md:flex-row gap-4 items-end">
            <div className="flex-1">
              <label className="block text-sm font-medium text-barnes-dark-gray mb-2">
                Selecteer Vacature
              </label>
              <select
                value={filterJob}
                onChange={(e) => setFilterJob(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-barnes-violet text-barnes-dark-violet font-medium"
              >
                <option value="">Alle vacatures</option>
                {jobs.map(job => (
                  <option key={job.id} value={job.id}>
                    {job.title} - {job.company}
                  </option>
                ))}
              </select>
            </div>
            <div className="w-full md:w-auto">
              <AdvancedFilter
                onFilterChange={setAdvancedFilters}
                jobs={jobs.map(j => ({ id: j.id, title: j.title }))}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Results Per Vacature */}
      <div className="space-y-6">
        {jobIdsToShow.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
            <div className="text-6xl mb-4">📋</div>
            <p className="text-barnes-dark-gray text-lg">Geen resultaten gevonden</p>
            <p className="text-sm text-barnes-dark-gray mt-2">Pas de filters aan of voer een nieuwe evaluatie uit</p>
          </div>
        ) : (
          jobIdsToShow.map(jobId => {
            const job = jobMap[jobId];
            const jobResults = resultsByJob[jobId] || [];
            const evaluations = jobResults
              .filter(r => r.result_type === 'evaluation')
              .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
            const debates = jobResults
              .filter(r => r.result_type === 'debate')
              .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

            return (
              <section
                key={jobId}
                className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm"
              >
                {/* Job Header */}
                <div className="mb-6">
                  <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 mb-4">
                    <div className="flex-1">
                      <h2 className="text-2xl font-bold text-barnes-dark-violet mb-1">
                        {job?.title || 'Onbekende vacature'}
                      </h2>
                      <p className="text-sm text-barnes-dark-gray">
                        {job?.company || '—'} • {job?.location || 'Locatie onbekend'}
                      </p>
                    </div>
                    <div className="flex gap-3">
                      <button
                        onClick={() => router.push(`/company/vacatures/${jobId}`)}
                        className="px-4 py-2 text-sm border border-barnes-violet text-barnes-violet rounded-lg hover:bg-barnes-violet hover:text-white transition-colors"
                      >
                        Bekijk vacature →
                      </button>
                    </div>
                  </div>
                  
                  {/* Job Stats */}
                  <div className="flex flex-wrap gap-3">
                    <div className="px-3 py-1.5 rounded-lg bg-barnes-violet/10 text-barnes-violet text-sm font-medium">
                      {evaluations.length} Evaluatie{evaluations.length === 1 ? '' : 's'}
                    </div>
                    <div className="px-3 py-1.5 rounded-lg bg-barnes-orange/10 text-barnes-orange text-sm font-medium">
                      {debates.length} Debat{debates.length === 1 ? '' : 'ten'}
                    </div>
                    {jobResults.length > 0 && (
                      <div className="px-3 py-1.5 rounded-lg bg-gray-100 text-gray-700 text-sm font-medium">
                        {new Set(jobResults.map(r => r.candidate_id)).size} Kandidaat{new Set(jobResults.map(r => r.candidate_id)).size === 1 ? '' : 'en'}
                      </div>
                    )}
                  </div>
                </div>

                {/* Results - Merged: Evaluation with Debate tab inside */}
                {(evaluations.length > 0 || debates.length > 0) && (
                  <div>
                    {/* Evaluations - Main view */}
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-xl font-semibold text-barnes-dark-violet">📊 Evaluaties</h3>
                        {evaluations.length > 0 && (
                          <span className="text-xs text-barnes-dark-gray">
                            Laatste: {formatDate(evaluations[0].created_at)}
                          </span>
                        )}
                      </div>
                      {evaluations.length === 0 ? (
                        <div className="p-4 border border-dashed border-gray-200 rounded-xl text-sm text-barnes-dark-gray text-center">
                          Nog geen evaluaties opgeslagen
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {evaluations.map(evalResult => {
                            const score = evalResult.result_data?.combined_score;
                            const recommendation = evalResult.result_data?.combined_recommendation;
                            const companyNote = evalResult.company_note;
                            // Find related debate for this candidate
                            const relatedDebate = debates.find(d => d.candidate_id === evalResult.candidate_id);
                            
                            return (
                              <div
                                key={evalResult.id}
                                className="p-4 border-2 border-gray-200 rounded-xl hover:border-barnes-violet transition-all cursor-pointer bg-white hover:shadow-md"
                                onClick={() => router.push(`/company/results/${evalResult.id}`)}
                              >
                                <div className="flex items-start justify-between gap-3 mb-2">
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs text-barnes-dark-gray uppercase tracking-wide mb-1">Kandidaat</p>
                                    <p className="text-base font-semibold text-barnes-dark-violet truncate">
                                      {evalResult.candidate_name || 'Onbekende kandidaat'}
                                    </p>
                                  </div>
                                  {score !== undefined && (
                                    <div className="text-right flex-shrink-0">
                                      <div className="text-2xl font-bold text-barnes-violet leading-none">
                                        {Number(score).toFixed(1)}
                                      </div>
                                      <div className="text-[10px] text-barnes-dark-gray">/ 10</div>
                                    </div>
                                  )}
                                </div>
                                {recommendation && (
                                  <div className="mb-2">
                                    <p className="text-xs text-barnes-dark-gray uppercase tracking-wide mb-1">Advies</p>
                                    <p className="text-sm font-medium text-barnes-dark-violet line-clamp-1">{recommendation}</p>
                                  </div>
                                )}
                                {companyNote && (
                                  <div className="p-2 rounded-lg bg-barnes-orange/10 border border-barnes-orange/30 text-xs text-barnes-dark-violet mb-2">
                                    <p className="font-semibold text-[10px] uppercase mb-1">Bedrijfsnotitie (van recruiter)</p>
                                    <p className="line-clamp-2 mb-2">{companyNote}</p>
                                    {evalResult.selected_personas && evalResult.selected_personas.length > 0 && (
                                      <div className="mt-2 pt-2 border-t border-barnes-orange/20">
                                        <p className="text-[10px] text-barnes-dark-gray mb-1">Digitale werknemers die hierop hebben gereageerd:</p>
                                        <div className="flex flex-wrap gap-1">
                                          {evalResult.selected_personas.map((persona: string) => {
                                            const personaNames: Record<string, string> = {
                                              'hiring_manager': 'Hiring Manager',
                                              'bureaurecruiter': 'Bureaurecruiter',
                                              'hr_recruiter': 'HR / Inhouse Recruiter',
                                              'finance_director': 'Finance Director',
                                              'tech_lead': 'Tech Lead'
                                            };
                                            return (
                                              <span
                                                key={persona}
                                                className="px-1.5 py-0.5 text-[10px] rounded bg-barnes-violet/20 text-barnes-violet font-medium"
                                              >
                                                {personaNames[persona] || persona}
                                              </span>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                )}
                                {/* Show debate indicator if debate exists */}
                                {relatedDebate && (
                                  <div className="mb-2 p-2 rounded-lg bg-barnes-orange/10 border border-barnes-orange/30">
                                    <div className="flex items-center gap-2 text-xs">
                                      <span className="text-barnes-orange">💬</span>
                                      <span className="text-barnes-dark-violet font-medium">Debat beschikbaar</span>
                                      <span className="text-barnes-dark-gray">({formatDate(relatedDebate.created_at)})</span>
                                    </div>
                                  </div>
                                )}
                                <div className="flex items-center justify-between mt-3 pt-2 border-t border-gray-100 text-xs text-barnes-dark-gray">
                                  <span>{formatDate(evalResult.created_at)}</span>
                                  <span className="flex items-center gap-1 text-barnes-violet font-medium">
                                    Bekijken →
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Empty State */}
                {evaluations.length === 0 && debates.length === 0 && (
                  <div className="p-8 text-center border border-dashed border-gray-200 rounded-xl">
                    <p className="text-sm text-barnes-dark-gray">Nog geen resultaten voor deze vacature</p>
                  </div>
                )}
              </section>
            );
          })
        )}
      </div>
    </div>
  );
}


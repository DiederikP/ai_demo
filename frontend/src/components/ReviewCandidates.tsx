'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getAuthHeaders } from '../lib/auth';
import { UserIcon, CogIcon, CheckIcon } from './Icons';
import MultiSelectPersonaCard from './MultiSelectPersonaCard';

interface Job {
  id: string;
  title: string;
  company: string;
  created_at: string;
}

interface Candidate {
  id: string;
  name: string;
  email: string;
  job_id: string;
  created_at: string;
  pipeline_stage?: string;
  evaluations?: any[];
}

interface Persona {
  id: string;
  name: string;
  display_name: string;
  system_prompt: string;
  is_active: boolean;
}

interface JobWithCandidates {
  job: Job;
  candidates: Candidate[];
}

export default function ReviewCandidates() {
  const router = useRouter();
  const [jobsWithCandidates, setJobsWithCandidates] = useState<JobWithCandidates[]>([]);
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [selectedCandidates, setSelectedCandidates] = useState<Set<string>>(new Set());
  const [selectedPersonas, setSelectedPersonas] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRunningAnalysis, setIsRunningAnalysis] = useState(false);
  const [expandedJobs, setExpandedJobs] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const headers = getAuthHeaders();
      
      const [jobsRes, candidatesRes, personasRes] = await Promise.all([
        fetch('/api/job-descriptions', { headers }),
        fetch('/api/candidates', { headers }),
        fetch('/api/personas', { headers })
      ]);

      let jobs: Job[] = [];
      let candidates: Candidate[] = [];
      let loadedPersonas: Persona[] = [];

      if (jobsRes.ok) {
        const jobsData = await jobsRes.json();
        jobs = jobsData.jobs || [];
      }

      if (candidatesRes.ok) {
        const candidatesData = await candidatesRes.json();
        candidates = candidatesData.candidates || [];
      }

      if (personasRes.ok) {
        const personasData = await personasRes.json();
        loadedPersonas = personasData.personas || [];
      }

      // Filter candidates that are from recruitment agencies (have submitted_by_company_id)
      // and don't have evaluations yet (check if evaluations array is empty or pipeline_stage is early)
      const recruiterCandidates = candidates.filter(c => {
        if (!c.submitted_by_company_id) return false;
        // Show candidates that are in early stages or don't have evaluations
        const hasEvaluation = c.evaluations && Array.isArray(c.evaluations) && c.evaluations.length > 0;
        return !hasEvaluation || c.pipeline_stage === 'review' || c.pipeline_stage === 'introduced';
      });

      // Group candidates by job_id
      const jobMap = new Map<string, JobWithCandidates>();
      
      recruiterCandidates.forEach(candidate => {
        const jobId = candidate.job_id;
        if (!jobId) return;

        if (!jobMap.has(jobId)) {
          const job = jobs.find(j => j.id === jobId);
          if (job) {
            jobMap.set(jobId, { job, candidates: [] });
          }
        }

        const entry = jobMap.get(jobId);
        if (entry) {
          entry.candidates.push(candidate);
        }
      });

      setJobsWithCandidates(Array.from(jobMap.values()));
      setPersonas(loadedPersonas.filter(p => p.is_active));
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleCandidateSelection = (candidateId: string) => {
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

  const toggleJobExpansion = (jobId: string) => {
    setExpandedJobs(prev => {
      const newSet = new Set(prev);
      if (newSet.has(jobId)) {
        newSet.delete(jobId);
      } else {
        newSet.add(jobId);
      }
      return newSet;
    });
  };

  const selectAllCandidatesInJob = (jobId: string) => {
    const jobData = jobsWithCandidates.find(jwc => jwc.job.id === jobId);
    if (!jobData) return;

    setSelectedCandidates(prev => {
      const newSet = new Set(prev);
      jobData.candidates.forEach(c => newSet.add(c.id));
      return newSet;
    });
  };

  const handlePersonaToggle = (personaName: string) => {
    setSelectedPersonas(prev => 
      prev.includes(personaName) 
        ? prev.filter(p => p !== personaName)
        : [...prev, personaName]
    );
  };

  const handleRunAnalysis = async () => {
    if (selectedCandidates.size === 0) {
      alert('Selecteer minimaal één kandidaat');
      return;
    }

    if (selectedPersonas.length === 0) {
      alert('Selecteer minimaal één digitale werknemer');
      return;
    }

    setIsRunningAnalysis(true);
    try {
      // Run analysis for each selected candidate
      const candidateIds = Array.from(selectedCandidates);
      
      for (const candidateId of candidateIds) {
        const candidate = jobsWithCandidates
          .flatMap(jwc => jwc.candidates)
          .find(c => c.id === candidateId);

        if (!candidate) continue;

        const formData = new FormData();
        formData.append('candidate_id', candidateId);
        if (candidate.job_id) {
          formData.append('job_id', candidate.job_id);
        }
        
        selectedPersonas.forEach(personaName => {
          const persona = personas.find(p => p.name === personaName);
          if (persona) {
            formData.append(`${personaName}_prompt`, persona.system_prompt);
          }
        });

        const headers = getAuthHeaders();
        const response = await fetch('/api/evaluate-candidate', {
          method: 'POST',
          headers: headers,
          body: formData
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`Error evaluating candidate ${candidateId}:`, errorText);
        }
      }

      alert(`AI Analyse gestart voor ${candidateIds.length} kandidaat(en). De resultaten zijn binnenkort beschikbaar.`);
      
      // Clear selections and reload
      setSelectedCandidates(new Set());
      setSelectedPersonas([]);
      await loadData();
    } catch (error: any) {
      console.error('Error running analysis:', error);
      alert('Fout bij het starten van de AI Analyse: ' + (error.message || 'Onbekende fout'));
    } finally {
      setIsRunningAnalysis(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-barnes-dark-gray">Laden...</div>
      </div>
    );
  }

  if (jobsWithCandidates.length === 0) {
    return (
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-barnes-dark-violet mb-2">
            Aangeboden Kandidaat Beoordelen
          </h1>
          <p className="text-sm text-barnes-dark-gray">
            Beoordeel kandidaten die door recruitment agencies zijn aangeboden
          </p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <UserIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-barnes-dark-violet mb-2">
            Geen nieuwe kandidaten
          </h3>
          <p className="text-sm text-barnes-dark-gray">
            Er zijn momenteel geen nieuwe kandidaten van recruitment agencies om te beoordelen.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-barnes-dark-violet mb-2">
          Aangeboden Kandidaat Beoordelen
        </h1>
        <p className="text-sm text-barnes-dark-gray">
          Selecteer kandidaten en digitale werknemers om AI Analyse uit te voeren
        </p>
      </div>

      {/* Jobs with candidates */}
      <div className="space-y-4 mb-6">
        {jobsWithCandidates.map(({ job, candidates }) => (
          <div key={job.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div 
              className="p-4 cursor-pointer hover:bg-gray-50 transition-colors"
              onClick={() => toggleJobExpansion(job.id)}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <h3 className="font-semibold text-barnes-dark-violet">{job.title}</h3>
                  <p className="text-sm text-barnes-dark-gray">{job.company}</p>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-sm text-barnes-dark-gray">
                    {candidates.length} nieuwe kandidaat{candidates.length !== 1 ? 'en' : ''}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      selectAllCandidatesInJob(job.id);
                    }}
                    className="text-xs text-barnes-violet hover:text-barnes-dark-violet"
                  >
                    Selecteer alle
                  </button>
                  <svg 
                    className={`w-5 h-5 text-barnes-dark-gray transition-transform ${
                      expandedJobs.has(job.id) ? 'rotate-180' : ''
                    }`}
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
            </div>
            
            {expandedJobs.has(job.id) && (
              <div className="border-t border-gray-200 p-4 space-y-2">
                {candidates.map(candidate => (
                  <label
                    key={candidate.id}
                    className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:border-barnes-violet hover:bg-barnes-violet/5 cursor-pointer transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={selectedCandidates.has(candidate.id)}
                      onChange={() => toggleCandidateSelection(candidate.id)}
                      className="w-4 h-4 text-barnes-violet border-gray-300 rounded focus:ring-barnes-violet"
                    />
                    <div className="flex-1">
                      <div className="font-medium text-barnes-dark-violet">{candidate.name}</div>
                      <div className="text-sm text-barnes-dark-gray">{candidate.email}</div>
                    </div>
                    <div className="text-xs text-barnes-dark-gray">
                      {new Date(candidate.created_at).toLocaleDateString('nl-NL')}
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Persona Selection */}
      {selectedCandidates.size > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <h3 className="text-lg font-semibold text-barnes-dark-violet mb-4">
            Selecteer Digitale Werknemers
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {personas.map(persona => (
              <MultiSelectPersonaCard
                key={persona.id}
                persona={persona}
                isSelected={selectedPersonas.includes(persona.name)}
                onToggle={handlePersonaToggle}
              />
            ))}
          </div>
        </div>
      )}

      {/* Action Button */}
      {selectedCandidates.size > 0 && selectedPersonas.length > 0 && (
        <div className="flex justify-end">
          <button
            onClick={handleRunAnalysis}
            disabled={isRunningAnalysis}
            className="px-6 py-3 bg-barnes-violet text-white rounded-lg hover:bg-barnes-dark-violet transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isRunningAnalysis ? (
              <>
                <CogIcon className="w-5 h-5 animate-spin" />
                <span>AI Analyse wordt uitgevoerd...</span>
              </>
            ) : (
              <>
                <CheckIcon className="w-5 h-5" />
                <span>Start AI Analyse ({selectedCandidates.size} kandidaat{selectedCandidates.size !== 1 ? 'en' : ''})</span>
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}


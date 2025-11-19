'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import EmptyState from './EmptyState';
import AdvancedFilter from './AdvancedFilter';

interface Candidate {
  id: string;
  name: string;
  email: string;
  job_id: string;
  preferential_job_ids?: string | null;
  job?: {
    title: string;
    company: string;
  };
  motivational_letter?: string;
  created_at: string;
  conversation_count?: number;
}

export default function CompanyKandidaten() {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedJobs, setSelectedJobs] = useState<string[]>([]);  // Changed to array for multiple jobs
  const [candidateName, setCandidateName] = useState('');
  const [candidateEmail, setCandidateEmail] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [jobs, setJobs] = useState<any[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [filters, setFilters] = useState<any>({});

  const filteredCandidates = useMemo(() => {
    let filtered = [...candidates];
    
    if (filters.searchTerm) {
      const term = filters.searchTerm.toLowerCase();
      filtered = filtered.filter(c => 
        c.name.toLowerCase().includes(term) || 
        c.email?.toLowerCase().includes(term)
      );
    }
    
    if (filters.jobIds && filters.jobIds.length > 0) {
      filtered = filtered.filter(c => 
        filters.jobIds.includes(c.job_id) ||
        (c.preferential_job_ids && filters.jobIds.some((jid: string) => 
          c.preferential_job_ids?.split(',').map(id => id.trim()).includes(jid)
        ))
      );
    }
    
    if (filters.hasMotivationLetter) {
      filtered = filtered.filter(c => c.motivational_letter);
    }
    
    if (filters.hasConversations) {
      filtered = filtered.filter(c => (c.conversation_count || 0) > 0);
    }
    
    return filtered;
  }, [candidates, filters]);

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
      
      // Add preferential job IDs if selected
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

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-barnes-dark-violet mb-2">Kandidaten</h1>
        <p className="text-barnes-dark-gray">Beheer en upload kandidaten</p>
      </div>

      {/* Upload Form */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
        <h2 className="text-xl font-semibold text-barnes-dark-violet mb-4">Nieuwe Kandidaat Uploaden</h2>
        <form onSubmit={handleUpload} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
            <div className="md:col-span-2">
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
                Selecteer vacatures waar deze kandidaat voorkeur voor heeft. Kandidaat kan later voor andere vacatures geëvalueerd worden.
              </p>
            </div>
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
          <button
            type="submit"
            disabled={isUploading}
            className="btn-primary px-6 py-2 disabled:opacity-50"
          >
            {isUploading ? 'Uploaden...' : 'Upload Kandidaat'}
          </button>
        </form>
      </div>

      {/* Candidates List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-barnes-dark-violet">Alle Kandidaten</h2>
          <AdvancedFilter
            onFilterChange={setFilters}
            jobs={jobs.map(j => ({ id: j.id, title: j.title }))}
          />
        </div>
        
        {filteredCandidates.length === 0 ? (
            <EmptyState
              icon="📄"
              title="Geen kandidaten gevonden"
              description={Object.keys(filters).length > 0 
                ? "Probeer je filters aan te passen"
                : "Upload je eerste kandidaat om te beginnen met evalueren"}
              action={Object.keys(filters).length > 0 ? undefined : {
                label: "Nieuwe kandidaat uploaden",
                onClick: () => {
                  const form = document.querySelector('form');
                  form?.scrollIntoView({ behavior: 'smooth' });
                }
              }}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 text-sm font-semibold text-barnes-dark-violet">Naam</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-barnes-dark-violet">Email</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-barnes-dark-violet">Vacature</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-barnes-dark-violet">Motivatiebrief</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-barnes-dark-violet">Gesprekken</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-barnes-dark-violet">Datum</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-barnes-dark-violet">Acties</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCandidates.map(candidate => (
                  <tr key={candidate.id} data-candidate-id={candidate.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4 text-barnes-dark-gray">
                      <Link
                        href={`/company/kandidaten/${candidate.id}`}
                        className="text-barnes-violet hover:text-barnes-dark-violet font-medium hover:underline"
                      >
                        {candidate.name}
                      </Link>
                    </td>
                    <td className="py-3 px-4 text-barnes-dark-gray">{candidate.email || '-'}</td>
                    <td className="py-3 px-4 text-barnes-dark-gray">{candidate.job?.title || '-'}</td>
                    <td className="py-3 px-4 text-barnes-dark-gray text-sm">
                      {candidate.motivational_letter ? (
                        <span className="text-green-600">✓ Aanwezig</span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-barnes-dark-gray text-sm">
                      {candidate.conversation_count && candidate.conversation_count > 0 ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-barnes-violet/10 text-barnes-violet rounded-full">
                          <span className="w-1.5 h-1.5 rounded-full bg-barnes-violet animate-pulse"></span>
                          {candidate.conversation_count}
                        </span>
                      ) : (
                        <span className="text-gray-400 text-xs">Geen</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-barnes-dark-gray text-sm">
                      {new Date(candidate.created_at).toLocaleDateString('nl-NL')}
                    </td>
                    <td className="py-3 px-4">
                      <button
                        onClick={async () => {
                          if (confirm(`Weet u zeker dat u ${candidate.name} wilt verwijderen?`)) {
                            setDeletingId(candidate.id);
                            
                            try {
                              const response = await fetch(`/api/candidates/${candidate.id}`, {
                                method: 'DELETE',
                              });
                              if (response.ok) {
                                // Visual feedback: fade out and remove
                                const row = document.querySelector(`tr[data-candidate-id="${candidate.id}"]`) as HTMLElement;
                                if (row) {
                                  row.style.transition = 'opacity 0.3s ease-out';
                                  row.style.opacity = '0';
                                  setTimeout(async () => {
                                    await loadCandidates();
                                    setDeletingId(null);
                                  }, 300);
                                } else {
                                  await loadCandidates();
                                  setDeletingId(null);
                                }
                              } else {
                                setDeletingId(null);
                                const error = await response.json();
                                console.error('Fout bij verwijderen:', error.error || 'Onbekende fout');
                              }
                            } catch (error: any) {
                              setDeletingId(null);
                              console.error('Fout bij verwijderen:', error.message);
                            }
                          }
                        }}
                        disabled={deletingId === candidate.id}
                        className={`text-sm font-medium ${
                          deletingId === candidate.id 
                            ? 'text-gray-400 cursor-not-allowed' 
                            : 'text-red-600 hover:text-red-800'
                        }`}
                      >
                        {deletingId === candidate.id ? 'Verwijderen...' : 'Verwijderen'}
                      </button>
                    </td>
                  </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </div>

    </div>
  );
}


'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getAuthHeaders } from '../lib/auth';

interface Candidate {
  id: string;
  name: string;
  email: string;
  job_id: string;
  job?: {
    id: string;
    title: string;
    company: string;
  };
  pipeline_stage: string;
  pipeline_status: string;
  created_at: string;
  has_evaluation?: boolean;
  evaluation_count?: number;
  submitted_by_company_id?: string;
}

export default function RecruiterCandidates() {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    loadCandidates();
    // Auto-refresh every 30 seconds to keep evaluation status up to date
    const interval = setInterval(() => {
      loadCandidates();
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadCandidates = async () => {
    try {
      const headers = getAuthHeaders();
      const response = await fetch('/api/recruiter/candidates', { headers });
      if (response.ok) {
        const data = await response.json();
        setCandidates(data.candidates || []);
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('Failed to load candidates:', errorData);
        alert(`Fout bij laden kandidaten: ${errorData.error || 'Onbekende fout'}`);
      }
    } catch (error: any) {
      console.error('Error loading candidates:', error);
      alert(`Fout bij laden kandidaten: ${error.message || 'Onbekende fout'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (candidateId: string) => {
    if (!confirm('Weet je zeker dat je deze kandidaat wilt verwijderen? Deze actie kan niet ongedaan worden gemaakt.')) {
      return;
    }

    try {
      const headers = getAuthHeaders();
      const response = await fetch(`/api/candidates/${candidateId}`, {
        method: 'DELETE',
        headers,
      });

      if (response.ok) {
        // Reload candidates list
        loadCandidates();
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        alert(`Fout bij verwijderen kandidaat: ${errorData.error || 'Onbekende fout'}`);
      }
    } catch (error: any) {
      console.error('Error deleting candidate:', error);
      alert(`Fout bij verwijderen kandidaat: ${error.message || 'Onbekende fout'}`);
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
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold text-barnes-dark-violet">Mijn Kandidaten</h1>
        <div className="flex gap-3">
          <Link
            href="/recruiter/kandidaten/import"
            className="px-4 py-2 bg-gray-100 text-barnes-dark-gray rounded-lg hover:bg-gray-200 transition-colors"
          >
            📥 Import Kandidaten
          </Link>
          <Link
            href="/recruiter/kandidaten/nieuw"
            className="px-4 py-2 bg-barnes-violet text-white rounded-lg hover:bg-barnes-dark-violet transition-colors"
          >
            + Nieuwe Kandidaat
          </Link>
        </div>
      </div>

      {candidates.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
          <div className="text-gray-500 mb-4">Nog geen kandidaten ingediend</div>
          <Link
            href="/recruiter/kandidaten/nieuw"
            className="text-barnes-violet hover:underline"
          >
            Dien je eerste kandidaat in →
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Naam</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Vacature</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status in Bedrijf</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fase</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Acties</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {candidates.map((candidate) => (
                <tr key={candidate.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-barnes-dark-violet">{candidate.name}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-500">{candidate.email}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {candidate.job ? (
                      <div>
                        <div className="flex items-center gap-2">
                          <div className="text-sm font-medium text-barnes-dark-violet">{candidate.job.title}</div>
                          {(candidate.job as any).is_new && (
                            <span className="px-1.5 py-0.5 text-[10px] rounded-full bg-blue-100 text-blue-800 font-medium">
                              Nieuw
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-gray-500">{candidate.job.company}</div>
                        {!((candidate.job as any).is_new) && candidate.job.title && (
                          <div className="text-xs text-gray-400 mt-0.5">
                            {candidate.job.title === 'HR Officer' ? 'Actief' : 'In behandeling'}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-sm text-gray-400">Geen vacature</div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="space-y-2">
                      {/* Evaluation Status */}
                      <div className="flex items-center gap-2">
                        {candidate.has_evaluation ? (
                          <div className="flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-green-500"></span>
                            <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-800 font-medium">
                              ✓ Geëvalueerd
                            </span>
                            {candidate.evaluation_count && candidate.evaluation_count > 1 && (
                              <span className="text-xs text-gray-500">({candidate.evaluation_count}x)</span>
                            )}
                          </div>
                        ) : (
                          <div className="flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse"></span>
                            <span className="px-2 py-1 text-xs rounded-full bg-yellow-100 text-yellow-800 font-medium">
                              ⏳ Wacht op evaluatie
                            </span>
                          </div>
                        )}
                      </div>
                      {/* Pipeline Status */}
                      <div>
                        <span className={`px-2 py-1 text-xs rounded-full font-medium ${
                          candidate.pipeline_status === 'active' ? 'bg-blue-100 text-blue-800' :
                          candidate.pipeline_status === 'on_hold' ? 'bg-yellow-100 text-yellow-800' :
                          candidate.pipeline_status === 'rejected' ? 'bg-red-100 text-red-800' :
                          candidate.pipeline_status === 'accepted' ? 'bg-green-100 text-green-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {candidate.pipeline_status === 'active' ? '🟢 Actief' :
                           candidate.pipeline_status === 'on_hold' ? '⏸️ On Hold' :
                           candidate.pipeline_status === 'rejected' ? '❌ Afgewezen' :
                           candidate.pipeline_status === 'accepted' ? '✅ Geaccepteerd' :
                           '⚪ Actief'}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="space-y-1">
                      <div className="text-sm font-medium text-barnes-dark-violet">
                        {candidate.pipeline_stage || 'Niet toegewezen'}
                      </div>
                      {candidate.pipeline_stage && (
                        <div className="text-xs text-gray-500">
                          {candidate.pipeline_stage === 'introduced' ? 'Geïntroduceerd' :
                           candidate.pipeline_stage === 'review' ? 'Review/Vergelijking' :
                           candidate.pipeline_stage === 'first_interview' ? 'Eerste Interview' :
                           candidate.pipeline_stage === 'second_interview' ? 'Tweede Interview' :
                           candidate.pipeline_stage === 'offer' ? 'Aanbod' :
                           candidate.pipeline_stage === 'complete' ? 'Voltooid' :
                           candidate.pipeline_stage}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <div className="flex gap-2">
                      {!candidate.job_id && (
                        <button
                          onClick={() => router.push(`/recruiter/kandidaten/${candidate.id}?assign=true`)}
                          className="px-3 py-1 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm"
                          title="Koppel aan vacature"
                        >
                          Koppel
                        </button>
                      )}
                      <button
                        onClick={() => router.push(`/recruiter/kandidaten/${candidate.id}`)}
                        className="px-3 py-1 bg-barnes-violet text-white rounded-lg hover:bg-barnes-dark-violet transition-colors text-sm"
                      >
                        Details
                      </button>
                      <button
                        onClick={() => handleDelete(candidate.id)}
                        className="px-3 py-1 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors text-sm"
                      >
                        Verwijder
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}


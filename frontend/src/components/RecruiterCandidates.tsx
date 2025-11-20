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
  pipeline_stage: string;
  pipeline_status: string;
  created_at: string;
}

export default function RecruiterCandidates() {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    loadCandidates();
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
        <Link
          href="/recruiter/kandidaten/nieuw"
          className="px-4 py-2 bg-barnes-violet text-white rounded-lg hover:bg-barnes-dark-violet transition-colors"
        >
          + Nieuwe Kandidaat
        </Link>
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
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
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
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      candidate.pipeline_status === 'active' ? 'bg-green-100 text-green-800' :
                      candidate.pipeline_status === 'on_hold' ? 'bg-yellow-100 text-yellow-800' :
                      candidate.pipeline_status === 'rejected' ? 'bg-red-100 text-red-800' :
                      candidate.pipeline_status === 'accepted' ? 'bg-blue-100 text-blue-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {candidate.pipeline_status || 'Actief'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-500">{candidate.pipeline_stage || 'Niet toegewezen'}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <button
                      onClick={() => router.push(`/recruiter/kandidaten/${candidate.id}`)}
                      className="px-3 py-1 bg-barnes-violet text-white rounded-lg hover:bg-barnes-dark-violet transition-colors text-sm"
                    >
                      Details
                    </button>
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


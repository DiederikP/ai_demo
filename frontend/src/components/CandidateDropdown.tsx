'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getAuthHeaders } from '../lib/auth';

interface Candidate {
  id: string;
  name: string;
  email: string;
  resume_text?: string;
  created_at: string;
}

export default function CandidateDropdown() {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const router = useRouter();

  useEffect(() => {
    loadCandidates();
  }, []);

  const loadCandidates = async () => {
    try {
      const headers = getAuthHeaders();
      const response = await fetch('/api/candidates', { headers });
      if (response.ok) {
        const data = await response.json();
        setCandidates(data.candidates || []);
      }
    } catch (error) {
      console.error('Error loading candidates:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredCandidates = candidates.filter(candidate => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      candidate.name.toLowerCase().includes(search) ||
      candidate.email?.toLowerCase().includes(search) ||
      candidate.resume_text?.toLowerCase().includes(search)
    );
  });

  return (
    <div className="px-4 mt-2">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-3 py-2 text-sm text-barnes-dark-gray hover:bg-gray-50 rounded-lg transition-colors"
      >
        <span>Kandidaten ({candidates.length})</span>
        <svg
          className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {isOpen && (
        <div className="mt-2 bg-white border border-gray-200 rounded-lg shadow-lg max-h-96 flex flex-col">
          {/* Search Input */}
          <div className="p-2 border-b border-gray-200">
            <input
              type="text"
              placeholder="Zoek kandidaat..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-barnes-violet focus:border-transparent"
              autoFocus
            />
          </div>
          
          {/* Candidates List */}
          <div className="overflow-y-auto max-h-64">
            {isLoading ? (
              <div className="px-3 py-2 text-xs text-gray-500">Laden...</div>
            ) : filteredCandidates.length === 0 ? (
              <div className="px-3 py-2 text-xs text-gray-500">
                {searchTerm ? 'Geen kandidaten gevonden' : 'Geen kandidaten'}
              </div>
            ) : (
              filteredCandidates.map((candidate) => (
                <button
                  key={candidate.id}
                  onClick={() => {
                    router.push(`/company/kandidaten/${candidate.id}`);
                    setIsOpen(false);
                  }}
                  className="w-full text-left px-3 py-2 text-xs text-barnes-dark-gray hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-b-0"
                >
                  <div className="font-medium">{candidate.name}</div>
                  {candidate.email && (
                    <div className="text-gray-500 truncate">{candidate.email}</div>
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}


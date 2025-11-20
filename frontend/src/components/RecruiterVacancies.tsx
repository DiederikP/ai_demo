'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getAuthHeaders } from '../lib/auth';

interface Vacancy {
  id: string;
  title: string;
  company: string;
  description: string;
  requirements: string;
  location: string;
  salary_range: string;
  candidates_count: number;
  created_at: string;
  is_assigned?: boolean;
}

export default function RecruiterVacancies() {
  const [vacancies, setVacancies] = useState<Vacancy[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    loadVacancies();
  }, []);

  const [showNewVacancies, setShowNewVacancies] = useState(true);

  const loadVacancies = async () => {
    try {
      const headers = getAuthHeaders();
      const url = `/api/recruiter/vacancies?include_new=${showNewVacancies}`;
      const response = await fetch(url, { headers });
      if (response.ok) {
        const data = await response.json();
        setVacancies(data.vacancies || []);
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('Failed to load vacancies:', errorData);
        alert(`Fout bij laden vacatures: ${errorData.error || 'Onbekende fout'}`);
      }
    } catch (error: any) {
      console.error('Error loading vacancies:', error);
      alert(`Fout bij laden vacatures: ${error.message || 'Onbekende fout'}`);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadVacancies();
  }, [showNewVacancies]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-barnes-dark-gray">Laden...</div>
      </div>
    );
  }

  const assignedVacancies = vacancies.filter(v => v.is_assigned);
  const newVacancies = vacancies.filter(v => !v.is_assigned);

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold text-barnes-dark-violet">Vacatures</h1>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={showNewVacancies}
            onChange={(e) => setShowNewVacancies(e.target.checked)}
            className="rounded border-gray-300 text-barnes-violet focus:ring-barnes-violet"
          />
          <span className="text-sm text-barnes-dark-gray">Toon nieuwe vacatures</span>
        </label>
      </div>

      {/* New Vacancies Section */}
      {showNewVacancies && newVacancies.length > 0 && (
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-barnes-dark-violet mb-4">
            Nieuwe Vacatures ({newVacancies.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            {newVacancies.map((vacancy) => (
              <div
                key={vacancy.id}
                className="bg-blue-50 border-2 border-blue-200 rounded-lg shadow-sm p-6 hover:border-blue-400 transition-colors cursor-pointer"
                onClick={() => router.push(`/recruiter/vacatures/${vacancy.id}`)}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                    Nieuw
                  </span>
                </div>
                <h3 className="text-xl font-semibold text-barnes-dark-violet mb-2">{vacancy.title}</h3>
                <div className="text-sm text-gray-500 mb-4">{vacancy.company}</div>
                
                {vacancy.location && (
                  <div className="text-sm text-gray-600 mb-2">📍 {vacancy.location}</div>
                )}
                
                {vacancy.salary_range && (
                  <div className="text-sm text-gray-600 mb-4">💰 {vacancy.salary_range}</div>
                )}

                <button className="w-full mt-4 px-4 py-2 bg-barnes-violet text-white rounded-lg hover:bg-barnes-dark-violet transition-colors text-sm">
                  Bekijk vacature →
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Assigned Vacancies Section */}
      {assignedVacancies.length > 0 && (
        <div>
          <h2 className="text-xl font-semibold text-barnes-dark-violet mb-4">
            Mijn Toegewezen Vacatures ({assignedVacancies.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {assignedVacancies.map((vacancy) => (
              <div
                key={vacancy.id}
                className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:border-barnes-violet transition-colors cursor-pointer"
                onClick={() => router.push(`/recruiter/vacatures/${vacancy.id}`)}
              >
                <h3 className="text-xl font-semibold text-barnes-dark-violet mb-2">{vacancy.title}</h3>
                <div className="text-sm text-gray-500 mb-4">{vacancy.company}</div>
                
                {vacancy.location && (
                  <div className="text-sm text-gray-600 mb-2">📍 {vacancy.location}</div>
                )}
                
                {vacancy.salary_range && (
                  <div className="text-sm text-gray-600 mb-4">💰 {vacancy.salary_range}</div>
                )}

                <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                  <div className="text-sm font-medium text-barnes-dark-gray">
                    {vacancy.candidates_count} {vacancy.candidates_count === 1 ? 'kandidaat' : 'kandidaten'}
                  </div>
                  <button className="text-sm text-barnes-violet hover:underline">
                    Bekijk details →
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {vacancies.length === 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
          <div className="text-gray-500 mb-4">Geen vacatures beschikbaar</div>
          <div className="text-sm text-gray-400">
            {showNewVacancies 
              ? "Er zijn momenteel geen nieuwe of toegewezen vacatures"
              : "Neem contact op met de beheerder om vacatures toegewezen te krijgen"
            }
          </div>
        </div>
      )}
    </div>
  );
}


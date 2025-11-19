'use client';

import { useState } from 'react';

interface FilterOptions {
  searchTerm?: string;
  skills?: string[];
  experienceMin?: number;
  experienceMax?: number;
  scoreMin?: number;
  scoreMax?: number;
  hasMotivationLetter?: boolean;
  hasConversations?: boolean;
  dateFrom?: string;
  dateTo?: string;
  jobIds?: string[];
}

interface AdvancedFilterProps {
  onFilterChange: (filters: FilterOptions) => void;
  jobs?: Array<{ id: string; title: string }>;
}

export default function AdvancedFilter({ onFilterChange, jobs = [] }: AdvancedFilterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [filters, setFilters] = useState<FilterOptions>({});

  const updateFilter = (key: keyof FilterOptions, value: any) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    onFilterChange(newFilters);
  };

  const clearFilters = () => {
    const emptyFilters: FilterOptions = {};
    setFilters(emptyFilters);
    onFilterChange(emptyFilters);
  };

  const hasActiveFilters = Object.values(filters).some(v => 
    v !== undefined && v !== null && v !== '' && 
    (Array.isArray(v) ? v.length > 0 : true)
  );

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:border-barnes-violet transition-colors text-sm"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
        </svg>
        <span>Filters</span>
        {hasActiveFilters && (
          <span className="px-2 py-0.5 bg-barnes-violet text-white text-xs rounded-full">
            {Object.values(filters).filter(v => v !== undefined && v !== null && v !== '' && (Array.isArray(v) ? v.length > 0 : true)).length}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute z-20 mt-2 w-96 bg-white border border-gray-200 rounded-lg shadow-lg p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-barnes-dark-violet">Geavanceerde Filters</h3>
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="text-xs text-barnes-violet hover:underline"
                >
                  Alles wissen
                </button>
              )}
            </div>

            {/* Search Term */}
            <div>
              <label className="block text-sm font-medium text-barnes-dark-gray mb-1">
                Zoekterm
              </label>
              <input
                type="text"
                value={filters.searchTerm || ''}
                onChange={(e) => updateFilter('searchTerm', e.target.value)}
                placeholder="Naam, email, etc."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-barnes-violet"
              />
            </div>

            {/* Score Range */}
            <div>
              <label className="block text-sm font-medium text-barnes-dark-gray mb-1">
                Score Range
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  max="10"
                  value={filters.scoreMin || ''}
                  onChange={(e) => updateFilter('scoreMin', e.target.value ? Number(e.target.value) : undefined)}
                  placeholder="Min"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-barnes-violet"
                />
                <span className="text-gray-400">-</span>
                <input
                  type="number"
                  min="0"
                  max="10"
                  value={filters.scoreMax || ''}
                  onChange={(e) => updateFilter('scoreMax', e.target.value ? Number(e.target.value) : undefined)}
                  placeholder="Max"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-barnes-violet"
                />
              </div>
            </div>

            {/* Experience Range */}
            <div>
              <label className="block text-sm font-medium text-barnes-dark-gray mb-1">
                Ervaring (jaren)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  value={filters.experienceMin || ''}
                  onChange={(e) => updateFilter('experienceMin', e.target.value ? Number(e.target.value) : undefined)}
                  placeholder="Min"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-barnes-violet"
                />
                <span className="text-gray-400">-</span>
                <input
                  type="number"
                  min="0"
                  value={filters.experienceMax || ''}
                  onChange={(e) => updateFilter('experienceMax', e.target.value ? Number(e.target.value) : undefined)}
                  placeholder="Max"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-barnes-violet"
                />
              </div>
            </div>

            {/* Job Filter */}
            {jobs.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-barnes-dark-gray mb-1">
                  Vacature
                </label>
                <select
                  multiple
                  value={filters.jobIds || []}
                  onChange={(e) => {
                    const selected = Array.from(e.target.selectedOptions, option => option.value);
                    updateFilter('jobIds', selected.length > 0 ? selected : undefined);
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-barnes-violet"
                  size={3}
                >
                  {jobs.map(job => (
                    <option key={job.id} value={job.id}>{job.title}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Boolean Filters */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={filters.hasMotivationLetter || false}
                  onChange={(e) => updateFilter('hasMotivationLetter', e.target.checked ? true : undefined)}
                  className="w-4 h-4 text-barnes-violet border-gray-300 rounded focus:ring-barnes-violet"
                />
                <span className="text-sm text-barnes-dark-gray">Heeft motivatiebrief</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={filters.hasConversations || false}
                  onChange={(e) => updateFilter('hasConversations', e.target.checked ? true : undefined)}
                  className="w-4 h-4 text-barnes-violet border-gray-300 rounded focus:ring-barnes-violet"
                />
                <span className="text-sm text-barnes-dark-gray">Heeft gesprekken</span>
              </label>
            </div>

            {/* Date Range */}
            <div>
              <label className="block text-sm font-medium text-barnes-dark-gray mb-1">
                Datum Range
              </label>
              <div className="space-y-2">
                <input
                  type="date"
                  value={filters.dateFrom || ''}
                  onChange={(e) => updateFilter('dateFrom', e.target.value || undefined)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-barnes-violet"
                />
                <input
                  type="date"
                  value={filters.dateTo || ''}
                  onChange={(e) => updateFilter('dateTo', e.target.value || undefined)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-barnes-violet"
                />
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}


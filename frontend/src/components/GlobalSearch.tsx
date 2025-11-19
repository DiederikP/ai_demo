'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

interface SearchResult {
  type: 'candidate' | 'job' | 'persona' | 'result';
  id: string;
  title: string;
  subtitle?: string;
  href: string;
}

export default function GlobalSearch() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const router = useRouter();
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(true);
        setTimeout(() => inputRef.current?.focus(), 100);
      }
      if (e.key === 'Escape') {
        setIsOpen(false);
        setQuery('');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    const search = async () => {
      setIsLoading(true);
      try {
        const [candidatesRes, jobsRes, personasRes, resultsRes] = await Promise.all([
          fetch('/api/candidates'),
          fetch('/api/job-descriptions'),
          fetch('/api/personas'),
          fetch('/api/evaluation-results'),
        ]);

        const allResults: SearchResult[] = [];

        if (candidatesRes.ok) {
          const data = await candidatesRes.json();
          const candidates = (data.candidates || []).filter((c: any) =>
            c.name.toLowerCase().includes(query.toLowerCase()) ||
            c.email?.toLowerCase().includes(query.toLowerCase())
          );
          candidates.forEach((c: any) => {
            allResults.push({
              type: 'candidate',
              id: c.id,
              title: c.name,
              subtitle: c.email || 'Geen email',
              href: `/company/kandidaten/${c.id}`,
            });
          });
        }

        if (jobsRes.ok) {
          const data = await jobsRes.json();
          const jobs = (data.jobs || []).filter((j: any) =>
            j.title.toLowerCase().includes(query.toLowerCase()) ||
            j.company.toLowerCase().includes(query.toLowerCase())
          );
          jobs.forEach((j: any) => {
            allResults.push({
              type: 'job',
              id: j.id,
              title: j.title,
              subtitle: j.company,
              href: `/company/vacatures/${j.id}`,
            });
          });
        }

        if (personasRes.ok) {
          const data = await personasRes.json();
          const personas = (data.personas || []).filter((p: any) =>
            p.display_name.toLowerCase().includes(query.toLowerCase()) ||
            p.name.toLowerCase().includes(query.toLowerCase())
          );
          personas.forEach((p: any) => {
            allResults.push({
              type: 'persona',
              id: p.id,
              title: p.display_name,
              subtitle: p.name,
              href: `/company/dashboard?module=personas`,
            });
          });
        }

        setResults(allResults.slice(0, 8));
      } catch (error) {
        console.error('Search error:', error);
      } finally {
        setIsLoading(false);
      }
    };

    const debounce = setTimeout(search, 300);
    return () => clearTimeout(debounce);
  }, [query]);

  const handleSelect = (result: SearchResult) => {
    router.push(result.href);
    setIsOpen(false);
    setQuery('');
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'candidate':
        return '📄';
      case 'job':
        return '💼';
      case 'persona':
        return '👥';
      case 'result':
        return '📋';
      default:
        return '🔍';
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'candidate':
        return 'Kandidaat';
      case 'job':
        return 'Vacature';
      case 'persona':
        return 'Digitale Werknemer';
      case 'result':
        return 'Resultaat';
      default:
        return '';
    }
  };

  return (
    <>
      {/* Search Trigger Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:border-barnes-violet transition-colors text-sm text-barnes-dark-gray"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <span className="hidden md:inline">Zoeken...</span>
        <span className="hidden md:inline text-xs text-gray-400">⌘K</span>
      </button>

      {/* Search Modal */}
      {isOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center pt-[10vh]" onClick={() => setIsOpen(false)}>
          <div
            ref={searchRef}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Search Input */}
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setSelectedIndex(0);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'ArrowDown') {
                      e.preventDefault();
                      setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1));
                    } else if (e.key === 'ArrowUp') {
                      e.preventDefault();
                      setSelectedIndex((prev) => Math.max(prev - 1, 0));
                    } else if (e.key === 'Enter' && results[selectedIndex]) {
                      handleSelect(results[selectedIndex]);
                    }
                  }}
                  placeholder="Zoek naar kandidaten, vacatures, digitale werknemers..."
                  className="flex-1 outline-none text-barnes-dark-violet placeholder-gray-400"
                  autoFocus
                />
                {query && (
                  <button
                    onClick={() => {
                      setQuery('');
                      inputRef.current?.focus();
                    }}
                    className="p-1 hover:bg-gray-100 rounded"
                  >
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            </div>

            {/* Search Results */}
            <div className="max-h-96 overflow-y-auto">
              {isLoading ? (
                <div className="p-8 text-center text-barnes-dark-gray">
                  <div className="inline-block w-6 h-6 border-2 border-barnes-violet border-t-transparent rounded-full animate-spin"></div>
                  <p className="mt-2 text-sm">Zoeken...</p>
                </div>
              ) : results.length > 0 ? (
                <div className="py-2">
                  {results.map((result, index) => (
                    <button
                      key={`${result.type}-${result.id}`}
                      onClick={() => handleSelect(result)}
                      className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left ${
                        index === selectedIndex ? 'bg-barnes-violet/5' : ''
                      }`}
                    >
                      <span className="text-2xl">{getTypeIcon(result.type)}</span>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-barnes-dark-violet truncate">{result.title}</p>
                        {result.subtitle && (
                          <p className="text-sm text-barnes-dark-gray truncate">{result.subtitle}</p>
                        )}
                      </div>
                      <span className="text-xs text-gray-400 px-2 py-1 bg-gray-100 rounded">
                        {getTypeLabel(result.type)}
                      </span>
                    </button>
                  ))}
                </div>
              ) : query ? (
                <div className="p-8 text-center text-barnes-dark-gray">
                  <p className="text-sm">Geen resultaten gevonden voor "{query}"</p>
                </div>
              ) : (
                <div className="p-8 text-center text-barnes-dark-gray">
                  <p className="text-sm">Begin met typen om te zoeken...</p>
                  <p className="text-xs mt-2 text-gray-400">Druk op ⌘K om snel te zoeken</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}


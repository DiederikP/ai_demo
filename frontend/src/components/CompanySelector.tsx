'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '../contexts/AuthContext';

type PortalType = 'company' | 'recruiter' | 'candidate';

interface Portal {
  id: PortalType;
  name: string;
  icon: string;
  route: string;
}

const PORTALS: Portal[] = [
  { id: 'company', name: 'Bedrijf', icon: '🏢', route: '/company/dashboard' },
  { id: 'recruiter', name: 'Recruiter', icon: '👔', route: '/recruiter/dashboard' },
  { id: 'candidate', name: 'Kandidaat', icon: '👤', route: '/candidate/dashboard' }
];

export default function PortalSelector() {
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [currentPortal, setCurrentPortal] = useState<PortalType>('company');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Determine current portal based on route
  useEffect(() => {
    if (pathname) {
      if (pathname.startsWith('/recruiter')) {
        setCurrentPortal('recruiter');
      } else if (pathname.startsWith('/candidate')) {
        setCurrentPortal('candidate');
      } else {
        setCurrentPortal('company');
      }
    }
  }, [pathname]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const handlePortalSelect = (portal: Portal) => {
    setIsOpen(false);
    router.push(portal.route);
  };

  const currentPortalData = PORTALS.find(p => p.id === currentPortal) || PORTALS[0];

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg hover:border-barnes-violet transition-colors text-sm font-medium text-barnes-dark-violet"
        title="Wissel portal"
      >
        <span className="text-lg">{currentPortalData.icon}</span>
        <span className="max-w-[150px] truncate">
          {currentPortalData.name}
        </span>
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
        <div className="absolute top-full left-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-lg z-50 min-w-[200px]">
          <div className="p-2">
            <div className="px-3 py-2 text-xs font-semibold text-barnes-dark-gray uppercase tracking-wide border-b border-gray-200 mb-1">
              Portals
            </div>
            {PORTALS.map((portal) => (
              <button
                key={portal.id}
                onClick={() => handlePortalSelect(portal)}
                className={`w-full text-left px-3 py-2 rounded-lg transition-colors text-sm flex items-center gap-2 ${
                  currentPortal === portal.id
                    ? 'bg-barnes-violet/10 text-barnes-violet font-medium'
                    : 'text-barnes-dark-gray hover:bg-gray-50'
                }`}
              >
                <span className="text-base">{portal.icon}</span>
                <span className="flex-1">{portal.name}</span>
                {currentPortal === portal.id && (
                  <svg className="w-4 h-4 text-barnes-violet flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}


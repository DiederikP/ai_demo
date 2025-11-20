'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../contexts/AuthContext';

interface RecruiterNavigationProps {
  activeModule: 'dashboard' | 'vacatures' | 'kandidaten';
  onModuleChange: (module: 'dashboard' | 'vacatures' | 'kandidaten') => void;
  onCollapsedChange?: (isCollapsed: boolean) => void;
}

export default function RecruiterNavigation({ activeModule, onModuleChange, onCollapsedChange }: RecruiterNavigationProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { user, logout: logoutAuth } = useAuth();
  const router = useRouter();
  
  useEffect(() => {
    if (onCollapsedChange) {
      onCollapsedChange(isCollapsed);
    }
  }, [isCollapsed, onCollapsedChange]);

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    logoutAuth();
    router.push('/company/login');
  };

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: '📊' },
    { id: 'vacatures', label: 'Mijn Vacatures', icon: '💼' },
    { id: 'kandidaten', label: 'Mijn Kandidaten', icon: '👥' },
  ];

  return (
    <>
      {/* Mobile menu button */}
      <button
        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        className="md:hidden fixed top-4 left-4 z-50 p-2 bg-white rounded-lg shadow-lg border border-gray-200"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {/* Navigation */}
      <nav 
        className={`bg-white border-r border-gray-200 h-screen fixed left-0 top-0 transition-all duration-300 z-50 flex flex-col ${
          isCollapsed ? 'w-16' : 'w-64'
        } ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}
      >
        {/* Header */}
        <div className="p-4 border-b border-gray-200 bg-gray-50">
          {!isCollapsed && (
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-barnes-dark-violet">Recruiter Portal</h2>
              <button
                onClick={() => setIsCollapsed(true)}
                className="p-1 rounded hover:bg-gray-200"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                </svg>
              </button>
            </div>
          )}
          {isCollapsed && (
            <div className="flex justify-center">
              <button
                onClick={() => setIsCollapsed(false)}
                className="w-8 h-8 rounded-lg border border-gray-200 text-barnes-dark-gray flex items-center justify-center hover:border-barnes-violet transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          )}
        </div>

        {/* Navigation Items */}
        <div className="flex-1 overflow-y-auto py-4">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                onModuleChange(item.id as 'dashboard' | 'vacatures' | 'kandidaten');
                setIsMobileMenuOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-4 py-3 transition-colors ${
                activeModule === item.id
                  ? 'bg-barnes-violet/10 text-barnes-violet border-r-2 border-barnes-violet'
                  : 'text-barnes-dark-gray hover:bg-gray-50'
              }`}
            >
              <span className="text-xl">{item.icon}</span>
              {!isCollapsed && <span className="font-medium">{item.label}</span>}
            </button>
          ))}
        </div>

        {/* User Section */}
        <div className="p-4 border-t border-gray-200">
          {!isCollapsed && user && (
            <div className="mb-3">
              <div className="text-sm font-medium text-barnes-dark-gray">{user.name}</div>
              <div className="text-xs text-gray-500">{user.email}</div>
            </div>
          )}
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            {!isCollapsed && <span>Uitloggen</span>}
          </button>
        </div>
      </nav>
    </>
  );
}


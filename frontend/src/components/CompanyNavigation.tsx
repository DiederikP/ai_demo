'use client';

import { useState, useEffect } from 'react';
import GlobalSearch from './GlobalSearch';
import NotificationCenter from './NotificationCenter';

interface CompanyNavigationProps {
  activeModule: 'dashboard' | 'vacatures' | 'personas' | 'kandidaten' | 'resultaten';
  onModuleChange: (module: 'dashboard' | 'vacatures' | 'personas' | 'kandidaten' | 'resultaten') => void;
}

interface CompanyInfo {
  id: string;
  name: string;
  slug: string;
  primary_domain?: string | null;
  plan?: string | null;
  status?: string | null;
}

interface UserSummary {
  id: string;
  email: string;
  name: string;
  role: string;
  company?: CompanyInfo | null;
}

export default function CompanyNavigation({ activeModule, onModuleChange }: CompanyNavigationProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [companyInfo, setCompanyInfo] = useState<CompanyInfo | null>(null);
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [accountName, setAccountName] = useState('Demo User');
  const [accountEmail, setAccountEmail] = useState('demo@barnes.nl');
  const [accountError, setAccountError] = useState<string | null>(null);
  const [isSavingAccount, setIsSavingAccount] = useState(false);

  const setActiveUser = (user: UserSummary) => {
    localStorage.setItem('current_user_id', user.id);
    localStorage.setItem('current_user_email', user.email);
    localStorage.setItem('current_user_name', user.name);
    if (user.company?.id) {
      localStorage.setItem('current_company_id', user.company.id);
      localStorage.setItem('current_company_name', user.company.name);
      localStorage.setItem('current_company_plan', user.company.plan || '');
    } else {
      localStorage.removeItem('current_company_id');
      localStorage.removeItem('current_company_name');
      localStorage.removeItem('current_company_plan');
    }
    setCurrentUserId(user.id);
    setAccountEmail(user.email);
    setAccountName(user.name);
    setCompanyInfo(user.company || null);
    loadUnreadCount(user.id);
    setIsAccountModalOpen(false);
  };

  const fetchUserById = async (userId: string): Promise<UserSummary | null> => {
    try {
      const response = await fetch(`/api/users?user_id=${encodeURIComponent(userId)}`);
      const data = await response.json();
      if (data.success && data.users && data.users.length > 0) {
        return data.users[0] as UserSummary;
      }
    } catch (error) {
      console.error('Error loading user by id:', error);
    }
    return null;
  };

  const fetchUserByEmail = async (email: string): Promise<UserSummary | null> => {
    try {
      const response = await fetch(`/api/users?email=${encodeURIComponent(email)}`);
      const data = await response.json();
      if (data.success && data.users && data.users.length > 0) {
        return data.users[0] as UserSummary;
      }
    } catch (error) {
      console.error('Error loading user by email:', error);
    }
    return null;
  };

  const handleAccountButtonClick = () => {
    setAccountError(null);
    setIsAccountModalOpen(true);
  };

  const handleAccountSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!accountEmail) {
      setAccountError('E-mailadres is verplicht');
      return;
    }
    setIsSavingAccount(true);
    setAccountError(null);
    try {
      const existing = await fetchUserByEmail(accountEmail);
      if (existing) {
        setActiveUser(existing);
        return;
      }
      const formData = new FormData();
      formData.append('email', accountEmail);
      formData.append('name', accountName || accountEmail.split('@')[0]);
      formData.append('role', 'admin');
      const response = await fetch('/api/users', {
        method: 'POST',
        body: formData,
      });
      const data = await response.json();
      if (data.success && data.user) {
        setActiveUser(data.user as UserSummary);
      } else {
        throw new Error(data.detail || data.error || 'Kon gebruiker niet aanmaken');
      }
    } catch (error: any) {
      setAccountError(error.message || 'Kon account niet opslaan');
    } finally {
      setIsSavingAccount(false);
    }
  };

  // Initialize current user or prompt for account setup
  useEffect(() => {
    const initUser = async () => {
      const storedUserId = localStorage.getItem('current_user_id');
      const storedEmail = localStorage.getItem('current_user_email');
      const storedName = localStorage.getItem('current_user_name');
      if (storedEmail) setAccountEmail(storedEmail);
      if (storedName) setAccountName(storedName);

      if (storedUserId) {
        const user = await fetchUserById(storedUserId);
        if (user) {
          setActiveUser(user);
          return;
        }
        localStorage.removeItem('current_user_id');
      }

      if (storedEmail) {
        const user = await fetchUserByEmail(storedEmail);
        if (user) {
          setActiveUser(user);
          return;
        }
      }

      setIsAccountModalOpen(true);
    };

    initUser();
  }, []);

  const loadUnreadCount = (userId: string) => {
    fetch(`/api/notifications?user_id=${userId}&unread_only=true`)
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setUnreadCount(data.notifications?.length || 0);
        }
      })
      .catch(err => console.error('Error loading unread count:', err));
  };

      const modules = [
        { id: 'dashboard' as const, label: 'Nieuwe Evaluatie', icon: '⚙️' },
        { id: 'vacatures' as const, label: 'Vacatures', icon: '💼' },
        { id: 'personas' as const, label: 'Digitale Werknemers', icon: '👥' },
        { id: 'kandidaten' as const, label: 'Kandidaten', icon: '📄' },
        { id: 'resultaten' as const, label: 'Resultaten', icon: '📋' },
      ];

  return (
    <>
      {/* Mobile menu button */}
      <button
        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        className="md:hidden fixed top-4 left-4 z-50 p-2 bg-white rounded-lg shadow-lg border border-gray-200"
        aria-label="Toggle menu"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          {isMobileMenuOpen ? (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          )}
        </svg>
      </button>

      {/* Mobile menu overlay */}
      {isMobileMenuOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Desktop/Mobile Navigation */}
      <nav className={`bg-white border-r border-gray-200 h-screen fixed left-0 top-0 transition-all duration-300 z-50 ${
        isCollapsed ? 'w-16' : 'w-64'
      } ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between gap-2">
          <button
            onClick={handleAccountButtonClick}
            className={`flex items-center gap-3 rounded-2xl border border-gray-200 bg-barnes-violet/5 px-3 py-2 text-left hover:border-barnes-violet transition-colors ${
              isCollapsed ? 'w-10 h-10 justify-center text-barnes-dark-violet' : 'w-full'
            }`}
          >
            <div className={`flex items-center gap-3 ${isCollapsed ? 'justify-center' : ''}`}>
              <div className="w-9 h-9 rounded-full bg-barnes-violet/80 text-white font-semibold flex items-center justify-center text-sm">
                {(accountName || 'Demo')[0].toUpperCase()}
              </div>
              {!isCollapsed && (
                <div className="flex flex-col">
                  <span className="text-sm font-semibold text-barnes-dark-violet">{accountName}</span>
                  <span className="text-xs text-barnes-dark-gray truncate max-w-[140px]">{accountEmail}</span>
                </div>
              )}
            </div>
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsNotificationOpen(true)}
              className="relative w-9 h-9 rounded-full border border-gray-200 text-barnes-dark-gray flex items-center justify-center hover:border-barnes-violet transition-colors"
              aria-label="Notificaties"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 px-1.5 py-0.5 bg-barnes-violet text-white text-[10px] rounded-full">
                  {unreadCount}
                </span>
              )}
            </button>
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="w-9 h-9 rounded-full border border-gray-200 text-barnes-dark-gray flex items-center justify-center hover:border-barnes-violet transition-colors"
              aria-label={isCollapsed ? 'Expand menu' : 'Collapse menu'}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {isCollapsed ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                )}
              </svg>
            </button>
          </div>
        </div>
      </div>

      <div className="py-4 space-y-4">
        {!isCollapsed && (
          <div className="px-4">
            <GlobalSearch />
          </div>
        )}
        {modules.map((module) => (
          <button
            key={module.id}
            onClick={() => {
              onModuleChange(module.id);
              setIsMobileMenuOpen(false);
            }}
            className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
              activeModule === module.id
                ? 'bg-barnes-violet/10 text-barnes-violet border-r-2 border-barnes-violet'
                : 'text-barnes-dark-gray hover:bg-gray-50'
            }`}
          >
            <span className="text-xl">{module.icon}</span>
            {!isCollapsed && <span className="font-medium">{module.label}</span>}
          </button>
        ))}
      </div>

      <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200 space-y-3">
        {companyInfo && (
          !isCollapsed ? (
            <div className="rounded-2xl border border-gray-200 bg-white/80 p-3">
              <p className="text-[10px] uppercase text-barnes-dark-gray tracking-widest mb-1">Bedrijf</p>
              <p className="text-sm font-semibold text-barnes-dark-violet">{companyInfo.name}</p>
              <p className="text-xs text-barnes-dark-gray">
                {(companyInfo.primary_domain || 'Eigen domein')} • {(companyInfo.plan || 'trial').toUpperCase()}
              </p>
            </div>
          ) : (
            <div
              className="text-[10px] text-center text-barnes-dark-gray uppercase tracking-widest"
              title={`${companyInfo.name} • ${(companyInfo.plan || 'trial').toUpperCase()}`}
            >
              {companyInfo.name.slice(0, 10)}
            </div>
          )
        )}
        <button
          onClick={() => window.location.href = '/'}
          className="w-full flex items-center gap-3 px-4 py-3 text-left text-barnes-dark-gray hover:bg-gray-50 rounded-lg transition-colors"
        >
          <span>←</span>
          {!isCollapsed && <span>Terug naar website</span>}
        </button>
      </div>

      {currentUserId && (
        <NotificationCenter
          userId={currentUserId}
          isOpen={isNotificationOpen}
          onClose={() => {
            setIsNotificationOpen(false);
            if (currentUserId) {
              fetch(`/api/notifications?user_id=${currentUserId}&unread_only=true`)
                .then(res => res.json())
                .then(data => {
                  if (data.success) {
                    setUnreadCount(data.notifications?.length || 0);
                  }
                })
                .catch(err => console.error('Error loading notifications:', err));
            }
          }}
        />
      )}
      </nav>

      {isAccountModalOpen && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/60 px-4">
          <form
            onSubmit={handleAccountSubmit}
            className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-6 space-y-4"
          >
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-widest text-barnes-dark-gray/70">Omgeving</p>
              <h3 className="text-2xl font-semibold text-barnes-dark-violet">
                Kies of maak een bedrijfsomgeving
              </h3>
              <p className="text-sm text-barnes-dark-gray">
                Iedereen met hetzelfde e-maildomein deelt automatisch dezelfde omgeving. Later kun je een paywall
                toevoegen voor betaalde accounts.
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-barnes-dark-gray">Naam</label>
              <input
                type="text"
                value={accountName}
                onChange={(e) => setAccountName(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-barnes-violet focus:border-transparent"
                placeholder="Voor- en achternaam"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-barnes-dark-gray">Zakelijk e-mailadres</label>
              <input
                type="email"
                value={accountEmail}
                onChange={(e) => setAccountEmail(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-barnes-violet focus:border-transparent"
                placeholder="naam@bedrijf.nl"
                required
              />
            </div>

            <div className="text-xs text-barnes-dark-gray bg-barnes-violet/5 border border-barnes-violet/20 rounded-lg p-3">
              Tip: maak accounts aan voor collega's (bijv. vaatje@zuljehemhebben.nl en diederik@zuljehemhebben.nl)
              om dezelfde bedrijfssandbox te delen.
            </div>

            {accountError && (
              <p className="text-sm text-red-600">{accountError}</p>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
              {currentUserId && (
                <button
                  type="button"
                  onClick={() => setIsAccountModalOpen(false)}
                  className="px-4 py-2 text-sm text-barnes-dark-gray hover:text-barnes-dark-violet"
                >
                  Annuleren
                </button>
              )}
              <button
                type="submit"
                disabled={isSavingAccount}
                className="px-4 py-2 text-sm font-semibold text-white bg-barnes-violet rounded-lg hover:bg-barnes-dark-violet disabled:opacity-50"
              >
                {isSavingAccount ? 'Bezig...' : 'Activeer omgeving'}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}


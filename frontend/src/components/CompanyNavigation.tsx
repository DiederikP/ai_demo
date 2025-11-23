'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import GlobalSearch from './GlobalSearch';
import NotificationCenter from './NotificationCenter';
import { useAuth } from '../contexts/AuthContext';
import { usePermissions } from '../hooks/usePermissions';
import { getAuthHeaders } from '../lib/auth';

interface CompanyNavigationProps {
  activeModule: 'dashboard' | 'vacatures' | 'personas' | 'kandidaten' | 'resultaten' | 'notifications' | 'overview';
  onModuleChange: (module: 'dashboard' | 'vacatures' | 'personas' | 'kandidaten' | 'resultaten' | 'notifications' | 'overview') => void;
  onCollapsedChange?: (isCollapsed: boolean) => void;
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

export default function CompanyNavigation({ activeModule, onModuleChange, onCollapsedChange }: CompanyNavigationProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { user, logout: logoutAuth, isLoading: authLoading } = useAuth();
  const { isAdmin } = usePermissions();
  const router = useRouter();
  
  useEffect(() => {
    if (onCollapsedChange) {
      onCollapsedChange(isCollapsed);
    }
  }, [isCollapsed, onCollapsedChange]);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [companyInfo, setCompanyInfo] = useState<CompanyInfo | null>(null);
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [accountName, setAccountName] = useState(user?.name || 'Demo User');
  const [accountEmail, setAccountEmail] = useState(user?.email || 'demo@barnes.nl');
  const [accountError, setAccountError] = useState<string | null>(null);
  const [isSavingAccount, setIsSavingAccount] = useState(false);

  // Update account info from auth context
  useEffect(() => {
    if (user) {
      setAccountName(user.name);
      setAccountEmail(user.email);
      setCurrentUserId(user.id);
      if (user.company_id) {
        // Load company info if needed
      }
    }
  }, [user]);

  const handleLogout = () => {
    logoutAuth();
    router.push('/company/login');
  };

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

  // Initialize current user - show active users in sandbox, don't prompt for account creation
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

      // Don't show account modal - just use current auth user if available
      if (user) {
        setAccountEmail(user.email);
        setAccountName(user.name);
        setCurrentUserId(user.id);
      }
    };

    initUser();
  }, [user]);

  const loadUnreadCount = (userId: string) => {
    const headers = getAuthHeaders();
    fetch(`/api/notifications?user_id=${userId}&unread_only=true`, { headers })
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
        { id: 'notifications' as const, label: 'Notificaties', icon: '🔔' },
      ];

      // Add admin module if user is admin
      const allModules = isAdmin ? [
        ...modules,
        { id: 'admin' as const, label: 'Admin', icon: '🔧', href: '/admin/manage' }
      ] : modules;

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
      <nav 
        className={`bg-white border-r border-gray-200 h-screen fixed left-0 top-0 transition-all duration-300 z-50 flex flex-col ${
          isCollapsed ? 'w-16' : 'w-64'
        } ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}
        style={{
          '--nav-width': isCollapsed ? '4rem' : '16rem'
        } as React.CSSProperties}
      >
      {/* Removed Portal Selector from top - portals now in sidepane */}
      
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between gap-2">
          <button
            onClick={handleAccountButtonClick}
            className={`flex items-center gap-3 rounded-2xl border border-gray-200 bg-barnes-violet/5 px-3 py-2 text-left hover:border-barnes-violet transition-colors ${
              isCollapsed ? 'w-10 h-10 justify-center text-barnes-dark-violet' : 'flex-1'
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
          {!isCollapsed && (
            <button
              onClick={handleLogout}
              className="w-9 h-9 rounded-full border border-gray-200 text-barnes-dark-gray hover:border-red-300 hover:bg-red-50 hover:text-red-600 flex items-center justify-center transition-colors"
              title="Uitloggen"
              aria-label="Uitloggen"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          )}
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                onModuleChange('notifications');
                setIsNotificationOpen(false);
              }}
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
              className="w-9 h-9 rounded-full border-2 border-barnes-violet/50 text-barnes-dark-violet flex items-center justify-center hover:border-barnes-violet hover:bg-barnes-violet/10 transition-all duration-200 shadow-sm"
              aria-label={isCollapsed ? 'Expand menu' : 'Collapse menu'}
              title={isCollapsed ? 'Menu uitklappen' : 'Menu inklappen'}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                {isCollapsed ? (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
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
        {allModules.map((module: any) => (
          <div key={module.id}>
            {module.href ? (
              <a
                href={module.href}
                className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                  'text-barnes-dark-gray hover:bg-gray-50'
                }`}
              >
                <span className="text-xl">{module.icon}</span>
                {!isCollapsed && <span className="font-medium">{module.label}</span>}
              </a>
            ) : (
              <button
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
            )}
          </div>
        ))}
      </div>

      <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200 space-y-3 bg-white">
        {companyInfo && (
          !isCollapsed ? (
            <button
              onClick={() => {
                // Navigate to company settings or dashboard
                if (onModuleChange) {
                  onModuleChange('dashboard');
                } else {
                  window.location.href = '/company/dashboard';
                }
              }}
              className="w-full rounded-2xl border border-gray-200 bg-white/80 p-3 hover:bg-gray-50 hover:border-barnes-violet transition-colors text-left cursor-pointer"
            >
              <p className="text-[10px] uppercase text-barnes-dark-gray tracking-widest mb-1">Bedrijf</p>
              <p className="text-sm font-semibold text-barnes-dark-violet">{companyInfo.name}</p>
              <p className="text-xs text-barnes-dark-gray">
                {(companyInfo.primary_domain || 'Eigen domein')} • {(companyInfo.plan || 'trial').toUpperCase()}
              </p>
            </button>
          ) : (
            <button
              onClick={() => {
                if (onModuleChange) {
                  onModuleChange('dashboard');
                } else {
                  window.location.href = '/company/dashboard';
                }
              }}
              className="w-full text-[10px] text-center text-barnes-dark-gray uppercase tracking-widest hover:text-barnes-violet transition-colors p-2 rounded-lg hover:bg-gray-50 cursor-pointer"
              title={`${companyInfo.name} • ${(companyInfo.primary_domain || 'Eigen domein')} • ${(companyInfo.plan || 'trial').toUpperCase()}`}
            >
              {companyInfo.name.slice(0, 8)}
            </button>
          )
        )}
        <button
          onClick={() => window.location.href = '/'}
          className={`w-full flex items-center gap-3 px-4 py-3 text-left text-barnes-dark-gray hover:bg-gray-50 rounded-lg transition-colors ${isCollapsed ? 'justify-center px-2' : ''}`}
          title={isCollapsed ? 'Terug naar website' : undefined}
        >
          <span className="text-lg">←</span>
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

      {/* Removed account modal - user just sees active users in sandbox */}
    </>
  );
}


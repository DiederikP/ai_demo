'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import ProtectedRoute from '../../../components/ProtectedRoute';
import CompanyNavigation from '../../../components/CompanyNavigation';
import CompanyDashboard from '../../../components/CompanyDashboard';
import CompanyVacatures from '../../../components/CompanyVacatures';
import CompanyPersonas from '../../../components/CompanyPersonas';
import CompanyKandidaten from '../../../components/CompanyKandidaten';
import CompanyResults from '../../../components/CompanyResults';
import CompanyNotifications from '../../../components/CompanyNotifications';

type Module = 'dashboard' | 'vacatures' | 'personas' | 'kandidaten' | 'resultaten' | 'notifications';

function CompanyDashboardContent() {
  const searchParams = useSearchParams();
  const [activeModule, setActiveModule] = useState<Module>('dashboard');

  useEffect(() => {
    const module = searchParams.get('module');
    if (module && ['dashboard', 'vacatures', 'personas', 'kandidaten', 'resultaten', 'notifications'].includes(module)) {
      setActiveModule(module as Module);
    }
    // If refresh parameter is present, trigger refresh
    const refresh = searchParams.get('refresh');
    if (refresh && module === 'vacatures') {
      // Small delay to ensure component is mounted
      const timer = setTimeout(() => {
        // Trigger a custom event that CompanyVacatures can listen to
        window.dispatchEvent(new CustomEvent('refresh-vacatures'));
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [searchParams]);

  // Force refresh when navigating to vacatures module
  useEffect(() => {
    if (activeModule === 'vacatures') {
      // Small delay to ensure component is mounted
      const timer = setTimeout(() => {
        // Trigger a custom event that CompanyVacatures can listen to
        window.dispatchEvent(new CustomEvent('refresh-vacatures'));
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [activeModule]);

  const renderModule = () => {
    switch (activeModule) {
      case 'dashboard':
        return <CompanyDashboard />;
      case 'vacatures':
        // Use key to force remount when refresh parameter changes
        return <CompanyVacatures key={searchParams.get('refresh') || 'default'} />;
      case 'personas':
        return <CompanyPersonas />;
      case 'kandidaten':
        return <CompanyKandidaten />;
      case 'resultaten':
        return <CompanyResults />;
      case 'notifications':
        return <CompanyNotifications />;
      default:
        return <CompanyDashboard />;
    }
  };

  const [isNavCollapsed, setIsNavCollapsed] = useState(false);

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-barnes-light-gray">
        <CompanyNavigation 
          activeModule={activeModule} 
          onModuleChange={setActiveModule}
          onCollapsedChange={setIsNavCollapsed}
        />
        <div 
          className="transition-all duration-300 p-4 md:p-8 min-h-screen"
          style={{ marginLeft: isNavCollapsed ? '4rem' : '16rem' }}
        >
          {renderModule()}
        </div>
      </div>
    </ProtectedRoute>
  );
}

export default function CompanyDashboardPage() {
  return (
    <ProtectedRoute requiredRole="user">
      <Suspense fallback={<div className="min-h-screen bg-barnes-light-gray flex items-center justify-center">Laden...</div>}>
        <CompanyDashboardContent />
      </Suspense>
    </ProtectedRoute>
  );
}


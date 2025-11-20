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

type Module = 'dashboard' | 'vacatures' | 'personas' | 'kandidaten' | 'resultaten';

function CompanyDashboardContent() {
  const searchParams = useSearchParams();
  const [activeModule, setActiveModule] = useState<Module>('dashboard');

  useEffect(() => {
    const module = searchParams.get('module');
    if (module && ['dashboard', 'vacatures', 'personas', 'kandidaten', 'resultaten'].includes(module)) {
      setActiveModule(module as Module);
    }
  }, [searchParams]);

  const renderModule = () => {
    switch (activeModule) {
      case 'dashboard':
        return <CompanyDashboard />;
      case 'vacatures':
        return <CompanyVacatures />;
      case 'personas':
        return <CompanyPersonas />;
      case 'kandidaten':
        return <CompanyKandidaten />;
      case 'resultaten':
        return <CompanyResults />;
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
    <Suspense fallback={<div className="min-h-screen bg-barnes-light-gray flex items-center justify-center">Laden...</div>}>
      <CompanyDashboardContent />
    </Suspense>
  );
}


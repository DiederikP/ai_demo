'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import ProtectedRoute from '../../../components/ProtectedRoute';
import RecruiterNavigation from '../../../components/RecruiterNavigation';
import RecruiterHome from '../../../components/RecruiterHome';
import RecruiterDashboard from '../../../components/RecruiterDashboard';
import RecruiterVacancies from '../../../components/RecruiterVacancies';
import RecruiterCandidates from '../../../components/RecruiterCandidates';

type Module = 'home' | 'dashboard' | 'vacatures' | 'kandidaten';

function RecruiterDashboardContent() {
  const searchParams = useSearchParams();
  const [activeModule, setActiveModule] = useState<Module>('home');

  useEffect(() => {
    const module = searchParams.get('module');
    if (module && ['home', 'dashboard', 'vacatures', 'kandidaten'].includes(module)) {
      setActiveModule(module as Module);
    }
  }, [searchParams]);

  const renderModule = () => {
    switch (activeModule) {
      case 'home':
        return <RecruiterHome />;
      case 'dashboard':
        return <RecruiterDashboard />;
      case 'vacatures':
        return <RecruiterVacancies />;
      case 'kandidaten':
        return <RecruiterCandidates />;
      default:
        return <RecruiterHome />;
    }
  };

  const [isNavCollapsed, setIsNavCollapsed] = useState(false);

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-barnes-light-gray">
        <RecruiterNavigation 
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

export default function RecruiterDashboardPage() {
  return (
    <ProtectedRoute requiredRole="recruiter">
      <Suspense fallback={<div className="min-h-screen bg-barnes-light-gray flex items-center justify-center">Laden...</div>}>
        <RecruiterDashboardContent />
      </Suspense>
    </ProtectedRoute>
  );
}


'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../contexts/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: 'admin' | 'recruiter' | 'viewer' | 'user';
  fallback?: React.ReactNode;
}

/**
 * Protected Route Component
 * Redirects to login if not authenticated
 * Can optionally check for specific role
 */
export default function ProtectedRoute({ 
  children, 
  requiredRole,
  fallback 
}: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/company/login');
    }
  }, [isAuthenticated, isLoading, router]);

  // Show fallback or nothing while loading
  if (isLoading) {
    return fallback || (
      <div className="min-h-screen flex items-center justify-center bg-barnes-light-gray">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-barnes-violet border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-barnes-dark-gray">Laden...</p>
        </div>
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    return null;
  }

  // Check role if required
  if (requiredRole && user) {
    const userRole = user.role?.toLowerCase();
    const roleHierarchy: Record<string, number> = {
      'admin': 3,
      'recruiter': 2,
      'viewer': 1,
      'user': 0,
    };
    
    const requiredLevel = roleHierarchy[requiredRole] || 0;
    const userLevel = roleHierarchy[userRole] || 0;
    
    if (userLevel < requiredLevel) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-barnes-light-gray">
          <div className="text-center bg-white rounded-xl p-8 border border-gray-200 shadow-lg max-w-md mx-4">
            <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-barnes-dark-violet mb-2">Toegang Geweigerd</h2>
            <p className="text-barnes-dark-gray mb-6">
              Je hebt geen toegang tot deze pagina. Vereiste rol: {requiredRole}
            </p>
            <button
              onClick={() => router.push('/company/dashboard')}
              className="btn-primary"
            >
              Terug naar Dashboard
            </button>
          </div>
        </div>
      );
    }
  }

  return <>{children}</>;
}


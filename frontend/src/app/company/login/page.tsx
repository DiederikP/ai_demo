'use client';

import { useState, useEffect, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Header from '../../../components/Header';
import { useAuth } from '../../../contexts/AuthContext';

export default function CompanyLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const { login, isLoading, isAuthenticated, user } = useAuth();
  const router = useRouter();

  // Redirect if already authenticated - but only after a delay to allow form interaction
  useEffect(() => {
    if (isAuthenticated && user && !isLoading) {
      // Small delay to prevent immediate redirect (allows user to see login page if needed)
      const timer = setTimeout(() => {
        const role = user.role?.toLowerCase();
        if (role === 'recruiter') {
          router.push('/recruiter/dashboard');
        } else if (role === 'candidate') {
          router.push('/candidate/dashboard');
        } else {
          // Admin, company_admin, company_user all go to company dashboard
          router.push('/company/dashboard');
        }
      }, 500); // 500ms delay
      return () => clearTimeout(timer);
    }
  }, [isAuthenticated, user, isLoading, router]);

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    
    if (!email || !password) {
      setError('Vul alstublieft email en wachtwoord in');
      return;
    }

    try {
      console.log('[Login Page] Attempting login...');
      await login(email, password);
      console.log('[Login Page] Login successful, redirecting...');
      
      // Wait a moment for auth context to update
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Refresh user from context after login
      const updatedUser = await fetch('/api/auth/me', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      }).then(res => res.json()).catch(() => null);
      
      const role = updatedUser?.role?.toLowerCase() || user?.role?.toLowerCase();
      console.log('[Company Login Page] User role:', role);
      
      // Redirect based on role
      if (role === 'recruiter') {
        router.push('/recruiter/dashboard');
      } else if (role === 'candidate') {
        router.push('/candidate/dashboard');
      } else {
        // Admin, company_admin, company_user all go to company dashboard
        router.push('/company/dashboard');
      }
    } catch (err: any) {
      console.error('[Login Page] Login error:', err);
      console.error('[Login Page] Error details:', {
        message: err?.message,
        error: err?.error,
        detail: err?.detail,
        stack: err?.stack,
        name: err?.name,
        toString: err?.toString(),
        fullError: err
      });
      
      // Extract error message from various possible formats
      let errorMessage = 'Inloggen mislukt. Controleer uw email en wachtwoord.';
      
      // Try multiple ways to extract the error message
      if (err?.message && typeof err.message === 'string' && err.message !== '[object Object]') {
        errorMessage = err.message;
      } else if (err?.error && typeof err.error === 'string' && err.error !== '[object Object]') {
        errorMessage = err.error;
      } else if (err?.detail && typeof err.detail === 'string' && err.detail !== '[object Object]') {
        errorMessage = err.detail;
      } else if (typeof err === 'string' && err !== '[object Object]') {
        errorMessage = err;
      } else {
        // Try to stringify the error if it's an object
        try {
          const errorStr = JSON.stringify(err);
          if (errorStr && errorStr !== '{}' && errorStr !== '[object Object]') {
            const parsed = JSON.parse(errorStr);
            if (parsed.error) errorMessage = parsed.error;
            else if (parsed.detail) errorMessage = parsed.detail;
            else if (parsed.message) errorMessage = parsed.message;
            else errorMessage = errorStr;
          }
        } catch (e) {
          // If stringify fails, try toString but check it's not [object Object]
          if (err?.toString && typeof err.toString === 'function') {
            const str = err.toString();
            if (str && str !== '[object Object]' && str !== 'Error') {
              errorMessage = str;
            }
          }
        }
      }
      
      // Ensure we always have a valid string
      if (!errorMessage || errorMessage === '[object Object]' || errorMessage === '{}') {
        errorMessage = 'Inloggen mislukt. Controleer uw email en wachtwoord.';
      }
      
      setError(errorMessage);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-barnes-light-gray to-white">
      <Header />
      <div className="max-w-md mx-auto px-6 py-16">
        <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-200">
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-full bg-barnes-orange flex items-center justify-center mx-auto mb-4">
              <span className="text-white font-bold text-2xl">B</span>
            </div>
            <h1 className="text-3xl font-bold text-barnes-dark-violet mb-2">Company Login</h1>
            <p className="text-barnes-dark-gray">Access your company dashboard</p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-barnes-dark-gray mb-2">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-barnes-violet focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
                placeholder="company@example.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-barnes-dark-gray mb-2">
                Wachtwoord
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isLoading}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-barnes-violet focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full btn-primary py-3 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Bezig met inloggen...' : 'Inloggen'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}


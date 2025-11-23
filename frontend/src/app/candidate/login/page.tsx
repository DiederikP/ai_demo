'use client';

import { useState, useEffect, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Header from '../../../components/Header';
import { useAuth } from '../../../contexts/AuthContext';

export default function CandidateLogin() {
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
        // Prioritize candidate portal for candidate users
        if (role === 'candidate') {
          router.push('/candidate/dashboard');
        } else if (role === 'admin') {
          router.push('/company/dashboard'); // Admin can choose
        } else if (role === 'recruiter') {
          router.push('/recruiter/dashboard');
        } else if (role === 'company_admin' || role === 'company_user') {
          router.push('/company/dashboard');
        } else {
          router.push('/candidate/dashboard');
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
      console.log('[Candidate Login Page] Attempting login...');
      await login(email, password);
      console.log('[Candidate Login Page] Login successful, redirecting...');
      
      // Wait a moment for auth context to update
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Fetch updated user from API to get the most current role
      const updatedUser = await fetch('/api/auth/me', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      }).then(res => res.json()).catch(() => null);
      
      const role = updatedUser?.role?.toLowerCase() || user?.role?.toLowerCase();
      console.log('[Candidate Login Page] User role:', role);
      
      // Redirect based on role - prioritize candidate portal for candidate users
      if (role === 'candidate') {
        router.push('/candidate/dashboard');
      } else if (role === 'admin') {
        router.push('/company/dashboard'); // Admin can choose
      } else if (role === 'recruiter') {
        router.push('/recruiter/dashboard');
      } else if (role === 'company_admin' || role === 'company_user') {
        router.push('/company/dashboard');
      } else {
        router.push('/candidate/dashboard');
      }
    } catch (err: any) {
      console.error('[Candidate Login Page] Login error:', err);
      console.error('[Candidate Login Page] Error details:', {
        message: err.message,
        stack: err.stack,
        name: err.name,
        toString: err.toString()
      });
      
      // Extract error message from various possible formats
      let errorMessage = 'Inloggen mislukt. Controleer uw email en wachtwoord.';
      
      if (err.message) {
        errorMessage = err.message;
      } else if (err.error) {
        errorMessage = err.error;
      } else if (err.detail) {
        errorMessage = err.detail;
      } else if (typeof err === 'string') {
        errorMessage = err;
      } else if (err.toString && err.toString() !== '[object Object]') {
        errorMessage = err.toString();
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
              <span className="text-white font-bold text-2xl">C</span>
            </div>
            <h1 className="text-3xl font-bold text-barnes-dark-violet mb-2">Candidate Login</h1>
            <p className="text-barnes-dark-gray">Access your candidate dashboard</p>
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
                placeholder="candidate@example.com"
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


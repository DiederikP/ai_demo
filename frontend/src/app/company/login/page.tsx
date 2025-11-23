'use client';

import { useState, useEffect, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Header from '../../../components/Header';
import { useAuth } from '../../../contexts/AuthContext';

export default function CompanyLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const { login, isLoading, isAuthenticated } = useAuth();
  const router = useRouter();

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      router.push('/company/dashboard');
    }
  }, [isAuthenticated, router]);

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
      router.push('/company/dashboard');
    } catch (err: any) {
      console.error('[Login Page] Login error:', err);
      console.error('[Login Page] Error details:', {
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


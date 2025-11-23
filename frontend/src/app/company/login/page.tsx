'use client';

import { useState, useRef, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Header from '../../../components/Header';
import { useAuth } from '../../../contexts/AuthContext';

interface AccountTile {
  email: string;
  name: string;
  role: string;
  description: string;
  icon: string;
  color: string;
  bgColor: string;
}

const ACCOUNT_OPTIONS: AccountTile[] = [
  {
    email: 'user@admin.nl',
    name: 'Admin',
    role: 'Administrator',
    description: 'Volledige toegang tot alle portals',
    icon: '👑',
    color: 'text-purple-700',
    bgColor: 'bg-purple-50 hover:bg-purple-100 border-purple-200'
  },
  {
    email: 'user@company.nl',
    name: 'Company',
    role: 'Bedrijf',
    description: 'Bedrijfsportal - vacatures en kandidaten',
    icon: '🏢',
    color: 'text-blue-700',
    bgColor: 'bg-blue-50 hover:bg-blue-100 border-blue-200'
  },
  {
    email: 'user@recruiter.nl',
    name: 'Recruiter',
    role: 'Recruiter',
    description: 'Recruiterportal - kandidaten beheren',
    icon: '👔',
    color: 'text-green-700',
    bgColor: 'bg-green-50 hover:bg-green-100 border-green-200'
  },
  {
    email: 'user@kandidaat.nl',
    name: 'Candidate',
    role: 'Kandidaat',
    description: 'Kandidaatportal - sollicitatiestatus',
    icon: '👤',
    color: 'text-orange-700',
    bgColor: 'bg-orange-50 hover:bg-orange-100 border-orange-200'
  }
];

export default function CompanyLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [selectedAccount, setSelectedAccount] = useState<AccountTile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { login, isLoading } = useAuth();
  const router = useRouter();
  const passwordInputRef = useRef<HTMLInputElement>(null);

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
      
      const role = updatedUser?.role?.toLowerCase();
      console.log('[Company Login Page] User role:', role);
      
      if (!role) {
        throw new Error('Kon gebruikersrol niet bepalen. Probeer opnieuw in te loggen.');
      }
      
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

  const handleAccountSelect = (account: AccountTile) => {
    setEmail(account.email);
    setSelectedAccount(account);
    setError(null);
    // Focus password field after a short delay
    setTimeout(() => {
      passwordInputRef.current?.focus();
    }, 100);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-barnes-light-gray to-white">
      <Header />
      <div className="max-w-4xl mx-auto px-6 py-16">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-full bg-barnes-orange flex items-center justify-center mx-auto mb-4">
            <span className="text-white font-bold text-2xl">B</span>
          </div>
          <h1 className="text-3xl font-bold text-barnes-dark-violet mb-2">Login</h1>
          <p className="text-barnes-dark-gray">Kies een account om in te loggen</p>
        </div>

        {/* Account Selection Tiles */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          {ACCOUNT_OPTIONS.map((account) => (
            <button
              key={account.email}
              type="button"
              onClick={() => handleAccountSelect(account)}
              className={`p-6 rounded-xl border-2 transition-all duration-200 text-left ${
                selectedAccount?.email === account.email
                  ? `${account.bgColor} border-2 border-current shadow-lg scale-105`
                  : `${account.bgColor} border-gray-200`
              }`}
            >
              <div className="flex items-start gap-4">
                <div className="text-4xl">{account.icon}</div>
                <div className="flex-1">
                  <div className={`font-bold text-lg mb-1 ${account.color}`}>
                    {account.name}
                  </div>
                  <div className="text-sm text-gray-600 mb-1">{account.role}</div>
                  <div className="text-xs text-gray-500">{account.description}</div>
                  <div className="text-xs text-gray-400 mt-2 font-mono">{account.email}</div>
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Login Form */}
        <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-200">
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
                onChange={(e) => {
                  setEmail(e.target.value);
                  setSelectedAccount(null);
                }}
                required
                disabled={isLoading}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-barnes-violet focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
                placeholder="Kies een account hierboven of voer email in"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-barnes-dark-gray mb-2">
                Wachtwoord
              </label>
              <input
                ref={passwordInputRef}
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
              disabled={isLoading || !email || !password}
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


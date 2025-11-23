'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { getAuthHeaders } from '../../../lib/auth';

export default function AdminResetPage() {
  const [isResetting, setIsResetting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleReset = async () => {
    if (!confirm('⚠️ WAARSCHUWING: Dit zal ALLE data verwijderen!\n\nDit omvat:\n- Alle candidates\n- Alle vacatures\n- Alle evaluaties\n- Alle notificaties\n- Alle gebruikers (behalve 4 vereiste)\n\nWeet je zeker dat je de database wilt resetten?\n\nDeze actie kan NIET ongedaan worden gemaakt!')) {
      return;
    }

    const secondConfirm = prompt('Type "RESET" om te bevestigen:');
    if (secondConfirm !== 'RESET') {
      setMessage('Reset geannuleerd - je hebt niet "RESET" getypt');
      return;
    }

    setIsResetting(true);
    setError(null);
    setMessage(null);

    try {
      const headers = getAuthHeaders();
      const response = await fetch('/api/admin/reset-database?confirm=true', {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || data.error || 'Failed to reset database');
      }

      setMessage(`✅ Database succesvol gereset!\n\n${JSON.stringify(data, null, 2)}`);
      
      // Redirect to login after 3 seconds
      setTimeout(() => {
        router.push('/company/login');
      }, 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to reset database');
      console.error('Reset error:', err);
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="min-h-screen bg-barnes-light-gray flex items-center justify-center p-4">
      <div className="max-w-2xl w-full bg-white rounded-lg shadow-lg p-8">
        <h1 className="text-3xl font-bold text-barnes-dark-violet mb-6">
          Admin: Database Reset
        </h1>
        
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
          <p className="text-yellow-800 font-semibold mb-2">⚠️ Waarschuwing:</p>
          <ul className="list-disc list-inside text-yellow-700 space-y-1">
            <li>Deze actie zal <strong>ALLE data</strong> verwijderen</li>
            <li>Alle candidates, vacatures, evaluaties en notificaties worden gewist</li>
            <li>Alle gebruikers worden verwijderd (behalve de 4 vereiste)</li>
            <li>Deze actie kan <strong>NIET</strong> ongedaan worden gemaakt</li>
            <li>Na reset worden de 4 vereiste gebruikers automatisch opnieuw aangemaakt</li>
          </ul>
        </div>

        {message && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
            <p className="text-green-800 whitespace-pre-line">{message}</p>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-800">❌ Fout: {error}</p>
          </div>
        )}

        <button
          onClick={handleReset}
          disabled={isResetting}
          className={`w-full px-6 py-3 rounded-lg font-semibold text-white transition-colors ${
            isResetting
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-red-600 hover:bg-red-700'
          }`}
        >
          {isResetting ? 'Bezig met resetten...' : '🗑️ Database Resetten'}
        </button>

        <div className="mt-6 text-sm text-gray-600">
          <p className="mb-2">Na reset kun je inloggen met:</p>
          <ul className="list-disc list-inside space-y-1">
            <li>Admin: <code>User@admin.nl</code> / <code>admin123</code></li>
            <li>Company: <code>user@company.nl</code> / <code>company123</code></li>
            <li>Recruiter: <code>user@recruiter.nl</code> / <code>recruiter123</code></li>
            <li>Candidate: <code>user@kandidaat.nl</code> / <code>kandidaat123</code></li>
          </ul>
        </div>
      </div>
    </div>
  );
}


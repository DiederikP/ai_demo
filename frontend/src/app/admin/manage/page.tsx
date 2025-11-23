'use client';

import { useState, useEffect } from 'react';
import ProtectedRoute from '../../../components/ProtectedRoute';
import { useAuth } from '../../../contexts/AuthContext';
import { getAuthHeaders } from '../../../lib/auth';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';

interface RecordCount {
  candidates: number;
  jobs: number;
  users: number;
  evaluations: number;
  notifications: number;
  companies: number;
}

interface Record {
  id: string;
  [key: string]: any;
}

export default function AdminManagePage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [counts, setCounts] = useState<RecordCount | null>(null);
  const [records, setRecords] = useState<Record[]>([]);
  const [recordType, setRecordType] = useState<string>('candidates');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (user?.role?.toLowerCase() === 'admin') {
      loadCounts();
      loadRecords();
    }
  }, [user, recordType]);

  const loadCounts = async () => {
    try {
      // We'll need to create endpoints for counts, for now we'll get them from the records
      // For now, we'll estimate from loaded records
    } catch (err) {
      console.error('Error loading counts:', err);
    }
  };

  const loadRecords = async () => {
    setLoading(true);
    setError(null);
    try {
      const headers = getAuthHeaders();
      let url = '';
      
      switch (recordType) {
        case 'candidates':
          url = `${BACKEND_URL}/candidates`;
          break;
        case 'jobs':
          url = `${BACKEND_URL}/job-descriptions`;
          break;
        case 'users':
          url = `${BACKEND_URL}/users`;
          break;
        case 'companies':
          url = `${BACKEND_URL}/companies`;
          break;
        default:
          setRecords([]);
          setLoading(false);
          return;
      }

      const response = await fetch(url, { headers });
      if (!response.ok) {
        throw new Error(`Failed to load ${recordType}`);
      }

      const data = await response.json();
      
      if (recordType === 'candidates') {
        setRecords(data.candidates || []);
        setCounts(prev => ({ ...prev, candidates: (data.candidates || []).length } as RecordCount));
      } else if (recordType === 'jobs') {
        setRecords(data.job_descriptions || data.jobs || []);
        setCounts(prev => ({ ...prev, jobs: (data.job_descriptions || data.jobs || []).length } as RecordCount));
      } else if (recordType === 'users') {
        setRecords(data.users || []);
        setCounts(prev => ({ ...prev, users: (data.users || []).length } as RecordCount));
      } else if (recordType === 'companies') {
        setRecords(data.companies || []);
        setCounts(prev => ({ ...prev, companies: (data.companies || []).length } as RecordCount));
      }
    } catch (err: any) {
      console.error(`Error loading ${recordType}:`, err);
      setError(err.message || `Failed to load ${recordType}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Weet je zeker dat je "${name}" wilt verwijderen?\n\nDeze actie kan niet ongedaan worden gemaakt.`)) {
      return;
    }

    setError(null);
    setSuccess(null);

    try {
      const headers = getAuthHeaders();
      
      // Build the correct URL based on record type
      let url = '';
      switch (recordType) {
        case 'candidates':
          url = `${BACKEND_URL}/candidates/${id}`;
          break;
        case 'jobs':
          url = `${BACKEND_URL}/job-descriptions/${id}`;
          break;
        case 'users':
          url = `${BACKEND_URL}/users/${id}`;
          break;
        default:
          throw new Error(`Delete not supported for ${recordType}`);
      }

      const response = await fetch(url, {
        method: 'DELETE',
        headers
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || errorData.error || 'Failed to delete record');
      }

      setSuccess(`"${name}" succesvol verwijderd`);
      // Reload records
      setTimeout(() => {
        loadRecords();
        setSuccess(null);
      }, 1000);
    } catch (err: any) {
      console.error('Error deleting record:', err);
      setError(err.message || 'Failed to delete record');
    }
  };

  const getRecordName = (record: Record): string => {
    if (recordType === 'candidates') {
      return record.name || record.email || record.id;
    } else if (recordType === 'jobs') {
      return record.title || record.id;
    } else if (recordType === 'users') {
      return record.email || record.name || record.id;
    } else if (recordType === 'companies') {
      return record.name || record.slug || record.id;
    }
    return record.id;
  };

  const getRecordDisplayInfo = (record: Record): { primary: string; secondary?: string } => {
    if (recordType === 'candidates') {
      return {
        primary: record.name || 'Unknown',
        secondary: record.email || record.job_id || undefined
      };
    } else if (recordType === 'jobs') {
      return {
        primary: record.title || 'Unknown',
        secondary: record.company || record.location || undefined
      };
    } else if (recordType === 'users') {
      return {
        primary: record.email || 'Unknown',
        secondary: `${record.name || ''} (${record.role || 'user'})`.trim() || undefined
      };
    } else if (recordType === 'companies') {
      return {
        primary: record.name || 'Unknown',
        secondary: record.slug || record.primary_domain || undefined
      };
    }
    return { primary: record.id };
  };

  return (
    <ProtectedRoute requiredRole="admin">
      <div className="min-h-screen bg-barnes-light-gray p-6">
        <div className="max-w-7xl mx-auto">
          <div className="bg-white rounded-xl shadow-lg p-8">
            <div className="mb-6">
              <h1 className="text-3xl font-bold text-barnes-dark-violet mb-2">
                Admin: Recordbeheer
              </h1>
              <p className="text-barnes-dark-gray">
                Bekijk en verwijder records uit de database
              </p>
            </div>

            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
                {error}
              </div>
            )}

            {success && (
              <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700">
                {success}
              </div>
            )}

            {/* Record Type Selector */}
            <div className="mb-6 flex gap-4 flex-wrap">
              {[
                { key: 'candidates', label: 'Kandidaten', icon: '👤' },
                { key: 'jobs', label: 'Vacatures', icon: '💼' },
                { key: 'users', label: 'Gebruikers', icon: '👥' },
                { key: 'companies', label: 'Bedrijven', icon: '🏢' },
              ].map((type) => (
                <button
                  key={type.key}
                  onClick={() => setRecordType(type.key)}
                  className={`px-6 py-3 rounded-lg font-semibold transition-colors ${
                    recordType === type.key
                      ? 'bg-barnes-violet text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <span className="mr-2">{type.icon}</span>
                  {type.label}
                  {counts && counts[type.key as keyof RecordCount] !== undefined && (
                    <span className="ml-2 text-sm">({counts[type.key as keyof RecordCount]})</span>
                  )}
                </button>
              ))}
            </div>

            {/* Records List */}
            {loading ? (
              <div className="text-center py-12">
                <div className="w-12 h-12 border-4 border-barnes-violet border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-barnes-dark-gray">Laden...</p>
              </div>
            ) : records.length === 0 ? (
              <div className="text-center py-12 bg-gray-50 rounded-lg">
                <p className="text-barnes-dark-gray text-lg">Geen {recordType} gevonden</p>
              </div>
            ) : (
              <div className="space-y-4">
                {records.map((record) => {
                  const display = getRecordDisplayInfo(record);
                  return (
                    <div
                      key={record.id}
                      className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex-1">
                        <div className="font-semibold text-barnes-dark-violet">
                          {display.primary}
                        </div>
                        {display.secondary && (
                          <div className="text-sm text-barnes-dark-gray mt-1">
                            {display.secondary}
                          </div>
                        )}
                        <div className="text-xs text-gray-500 mt-1">
                          ID: {record.id.substring(0, 8)}...
                        </div>
                      </div>
                      <button
                        onClick={() => handleDelete(record.id, display.primary)}
                        className="ml-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-semibold"
                      >
                        Verwijderen
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="mt-8 pt-6 border-t border-gray-200">
              <a
                href="/admin/reset"
                className="inline-block px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-semibold"
              >
                🗑️ Volledige Database Reset
              </a>
            </div>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}


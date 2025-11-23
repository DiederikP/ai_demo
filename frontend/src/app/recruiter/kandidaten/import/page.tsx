'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import ProtectedRoute from '../../../../components/ProtectedRoute';
import { getAuthHeaders } from '../../../../lib/auth';
import Link from 'next/link';

export default function RecruiterImportCandidates() {
  const router = useRouter();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type === 'application/json' || file.name.endsWith('.json')) {
        setSelectedFile(file);
        setError(null);
      } else {
        setError('Alleen JSON bestanden zijn toegestaan');
        setSelectedFile(null);
      }
    }
  };

  const handleImport = async () => {
    if (!selectedFile) {
      setError('Selecteer eerst een JSON bestand');
      return;
    }

    setIsUploading(true);
    setError(null);
    setSuccess(false);

    try {
      const fileContent = await selectedFile.text();
      const candidates = JSON.parse(fileContent);

      if (!Array.isArray(candidates)) {
        throw new Error('JSON bestand moet een array van kandidaten bevatten');
      }

      const headers = getAuthHeaders();
      let successCount = 0;
      let errorCount = 0;
      const errors: string[] = [];

      // Import candidates one by one
      for (const candidate of candidates) {
        try {
          const formData = new FormData();
          
          // Required fields
          if (candidate.name) formData.append('name', candidate.name);
          if (candidate.email) formData.append('email', candidate.email);
          
          // Optional fields
          if (candidate.job_id) formData.append('job_id', candidate.job_id);
          if (candidate.motivation_reason) formData.append('motivation_reason', candidate.motivation_reason);
          if (candidate.age) formData.append('age', String(candidate.age));
          if (candidate.years_experience) formData.append('years_experience', String(candidate.years_experience));
          if (candidate.location) formData.append('location', candidate.location);
          if (candidate.salary_expectation) formData.append('salary_expectation', String(candidate.salary_expectation));
          if (candidate.notice_period) formData.append('notice_period', candidate.notice_period);
          if (candidate.source) formData.append('source', candidate.source);
          
          // Array fields
          if (candidate.skill_tags && Array.isArray(candidate.skill_tags)) {
            formData.append('skill_tags', JSON.stringify(candidate.skill_tags));
          }
          if (candidate.prior_job_titles && Array.isArray(candidate.prior_job_titles)) {
            formData.append('prior_job_titles', JSON.stringify(candidate.prior_job_titles));
          }
          if (candidate.certifications && Array.isArray(candidate.certifications)) {
            formData.append('certifications', JSON.stringify(candidate.certifications));
          }

          const response = await fetch('/api/upload-resume', {
            method: 'POST',
            headers,
            body: formData,
          });

          if (response.ok) {
            successCount++;
          } else {
            const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
            errorCount++;
            errors.push(`${candidate.name || 'Onbekend'}: ${errorData.error || 'Onbekende fout'}`);
          }
        } catch (err: any) {
          errorCount++;
          errors.push(`${candidate.name || 'Onbekend'}: ${err.message || 'Onbekende fout'}`);
        }
      }

      if (successCount > 0) {
        setSuccess(true);
        if (errorCount > 0) {
          setError(`${successCount} kandidaten geïmporteerd, ${errorCount} fouten. Details: ${errors.join('; ')}`);
        } else {
          setTimeout(() => {
            router.push('/recruiter/kandidaten');
          }, 2000);
        }
      } else {
        setError(`Geen kandidaten geïmporteerd. Fouten: ${errors.join('; ')}`);
      }
    } catch (error: any) {
      setError(`Fout bij importeren: ${error.message || 'Onbekende fout'}`);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <ProtectedRoute>
      <div className="max-w-4xl mx-auto p-8">
        <div className="mb-6">
          <Link
            href="/recruiter/kandidaten"
            className="text-barnes-violet hover:text-barnes-dark-violet mb-4 inline-block"
          >
            ← Terug naar Kandidaten
          </Link>
          <h1 className="text-3xl font-bold text-barnes-dark-violet mb-2">Import Kandidaten</h1>
          <p className="text-barnes-dark-gray">
            Upload een JSON bestand met kandidaten om ze in bulk te importeren
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="mb-6">
            <label className="block text-sm font-medium text-barnes-dark-gray mb-2">
              Selecteer JSON Bestand
            </label>
            <input
              type="file"
              accept=".json,application/json"
              onChange={handleFileSelect}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-barnes-violet focus:border-transparent"
            />
            {selectedFile && (
              <p className="mt-2 text-sm text-green-600">✓ {selectedFile.name} geselecteerd</p>
            )}
          </div>

          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h3 className="font-semibold text-barnes-dark-violet mb-2">JSON Formaat:</h3>
            <pre className="text-xs bg-white p-3 rounded border border-gray-200 overflow-x-auto">
{`[
  {
    "name": "Jan Jansen",
    "email": "jan@example.com",
    "job_id": "optional-job-id",
    "motivation_reason": "Looking for new challenges",
    "age": 30,
    "years_experience": 5,
    "location": "Amsterdam",
    "salary_expectation": 50000,
    "skill_tags": ["JavaScript", "React"],
    "prior_job_titles": ["Frontend Developer"],
    "certifications": ["AWS Certified"]
  }
]`}
            </pre>
          </div>

          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
              {error}
            </div>
          )}

          {success && !error && (
            <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700">
              Kandidaten succesvol geïmporteerd! Je wordt doorgestuurd...
            </div>
          )}

          <div className="flex gap-4">
            <button
              onClick={handleImport}
              disabled={!selectedFile || isUploading}
              className="px-6 py-2 bg-barnes-violet text-white rounded-lg hover:bg-barnes-dark-violet transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isUploading ? 'Importeren...' : 'Importeer Kandidaten'}
            </button>
            <Link
              href="/recruiter/kandidaten"
              className="px-6 py-2 bg-gray-100 text-barnes-dark-gray rounded-lg hover:bg-gray-200 transition-colors"
            >
              Annuleren
            </Link>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}


'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import CompanyNavigation from '../../../../components/CompanyNavigation';
import UserSelector from '../../../../components/UserSelector';

export default function NewJobPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    title: '',
    company: '',
    description: '',
    requirements: '',
    location: '',
    salary_range: ''
  });
  const [jobUrl, setJobUrl] = useState('');
  const [isLoadingFromUrl, setIsLoadingFromUrl] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedWatchers, setSelectedWatchers] = useState<string[]>([]);
  const [showAiFeedback, setShowAiFeedback] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<any>(null);
  const [tempJobId, setTempJobId] = useState<string | null>(null);

  const handleAnalyzeJob = async () => {
    if (!formData.title || !formData.description) {
      alert('Vul ten minste titel en beschrijving in voordat je AI feedback aanvraagt');
      return;
    }
    
    setIsAnalyzing(true);
    try {
      // First save as draft to get job ID
      const requestData = {
        ...formData,
        watcher_user_ids: selectedWatchers
      };
      
      const { getAuthHeaders } = await import('../../../../lib/auth');
      const headers = getAuthHeaders();
      
      const saveResponse = await fetch('/api/upload-job', {
        method: 'POST',
        headers,
        body: JSON.stringify(requestData)
      });
      
      if (!saveResponse.ok) {
        throw new Error('Kon vacature niet opslaan voor analyse');
      }
      
      const saveResult = await saveResponse.json();
      const jobId = saveResult.job?.id || saveResult.id;
      setTempJobId(jobId);
      
      // Now analyze the job
      const { getAuthHeaders: getAnalyzeHeaders } = await import('../../../../lib/auth');
      const analyzeHeaders = getAnalyzeHeaders();
      
      const analyzeResponse = await fetch('/api/analyze-job', {
        method: 'POST',
        headers: analyzeHeaders,
        body: JSON.stringify({ job_id: jobId })
      });
      
      if (!analyzeResponse.ok) {
        throw new Error('Kon vacature niet analyseren');
      }
      
      const analyzeResult = await analyzeResponse.json();
      setAiAnalysis(analyzeResult);
      setShowAiFeedback(true);
    } catch (error: any) {
      alert(error.message || 'Analyse mislukt');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      // Include watchers in the request
      const requestData = {
        ...formData,
        watcher_user_ids: selectedWatchers
      };
      
      // If we have a temp job ID, update it; otherwise create new
      const url = tempJobId ? `/api/upload-job?id=${tempJobId}` : '/api/upload-job';
      const method = tempJobId ? 'PUT' : 'POST';
      
      const { getAuthHeaders } = await import('../../../../lib/auth');
      const headers = getAuthHeaders();
      
      console.log('[NewJobPage] Submitting job with headers:', Object.keys(headers));
      
      const response = await fetch(url, {
        method,
        headers,
        body: JSON.stringify(requestData)
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({ error: 'Onbekende fout' }));
        throw new Error(data.error || data.detail || 'Opslaan mislukt');
      }
      
      const result = await response.json();
      const jobId = result.job?.id || result.id || tempJobId;
      
      // Add watchers if selected
      if (jobId && selectedWatchers.length > 0) {
        await Promise.all(
          selectedWatchers.map(userId =>
            fetch('/api/job-watchers', {
              method: 'POST',
              headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
              body: new URLSearchParams({ job_id: jobId, user_id: userId })
            })
          )
        );
      }
      
      // Force a hard refresh by adding timestamp to URL
      router.push(`/company/dashboard?module=vacatures&refresh=${Date.now()}`);
    } catch (error: any) {
      alert(error.message || 'Opslaan mislukt');
    } finally {
      setIsSaving(false);
    }
  };

  const handleFillFromUrl = async () => {
    if (!jobUrl.trim()) return;
    setIsLoadingFromUrl(true);
    try {
      const response = await fetch('/api/extract-job-from-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: jobUrl.trim() })
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Kon vacature niet ophalen');
      }
      if (result.success && result.job) {
        setFormData({
          title: result.job.title || '',
          company: result.job.company || '',
          description: result.job.description || '',
          requirements: result.job.requirements || '',
          location: result.job.location || '',
          salary_range: result.job.salary_range || ''
        });
        setJobUrl('');
      } else {
        throw new Error(result.error || 'Geen gegevens gevonden');
      }
    } catch (error: any) {
      alert(error.message || 'Kon vacature niet ophalen');
    } finally {
      setIsLoadingFromUrl(false);
    }
  };

  return (
    <div className="min-h-screen bg-barnes-light-gray">
      <CompanyNavigation
        activeModule="vacatures"
        onModuleChange={(module) => {
          if (module === 'vacatures') {
            router.push('/company/dashboard?module=vacatures');
          } else {
            router.push(`/company/dashboard?module=${module}`);
          }
        }}
      />
      <div className="p-4 md:p-8 transition-all duration-300" style={{ marginLeft: 'var(--nav-width, 16rem)' }}>
        <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-sm border border-gray-200 p-4 md:p-8 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <button
                onClick={() => router.back()}
                className="text-barnes-violet hover:text-barnes-dark-violet flex items-center gap-2 mb-3"
              >
                <span>←</span>
                <span>Terug</span>
              </button>
              <h1 className="text-3xl font-bold text-barnes-dark-violet">Nieuwe Vacature</h1>
              <p className="text-sm text-barnes-dark-gray">Maak een nieuwe vacature aan</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="p-4 bg-barnes-violet/5 rounded-xl border border-barnes-violet/20">
              <label className="block text-sm font-medium text-barnes-dark-violet mb-2">
                Vul automatisch in via URL (optioneel)
              </label>
              <div className="flex flex-col gap-2 md:flex-row">
                <input
                  type="url"
                  value={jobUrl}
                  onChange={(e) => setJobUrl(e.target.value)}
                  placeholder="https://voorbeeld.nl/vacature"
                  className="input-field flex-1"
                />
                <button
                  type="button"
                  onClick={handleFillFromUrl}
                  disabled={isLoadingFromUrl || !jobUrl.trim()}
                  className="btn-secondary disabled:opacity-50"
                >
                  {isLoadingFromUrl ? 'Bezig...' : 'Vul van URL'}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-barnes-dark-gray mb-2">Titel *</label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="input-field"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-barnes-dark-gray mb-2">Bedrijf *</label>
                <input
                  type="text"
                  required
                  value={formData.company}
                  onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                  className="input-field"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-barnes-dark-gray mb-2">Beschrijving *</label>
              <textarea
                rows={4}
                required
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="input-field"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-barnes-dark-gray mb-2">Vereisten</label>
              <textarea
                rows={3}
                value={formData.requirements}
                onChange={(e) => setFormData({ ...formData, requirements: e.target.value })}
                className="input-field"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-barnes-dark-gray mb-2">Locatie</label>
                <input
                  type="text"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  className="input-field"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-barnes-dark-gray mb-2">Salaris</label>
                <input
                  type="text"
                  value={formData.salary_range}
                  onChange={(e) => setFormData({ ...formData, salary_range: e.target.value })}
                  className="input-field"
                />
              </div>
            </div>

            <div>
              <UserSelector
                selectedUserIds={selectedWatchers}
                onChange={setSelectedWatchers}
                label="Mensen die deze vacature moeten bekijken"
                placeholder="Selecteer gebruikers die notificaties moeten ontvangen..."
              />
            </div>

            {/* AI Feedback Section */}
            {showAiFeedback && aiAnalysis && (
              <div className="p-6 bg-blue-50 border-2 border-blue-200 rounded-xl">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-barnes-dark-violet">AI Feedback</h3>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAiFeedback(false);
                      setAiAnalysis(null);
                    }}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    ✕
                  </button>
                </div>
                <div className="space-y-4 text-sm">
                  {aiAnalysis.analysis && (
                    <div>
                      <h4 className="font-medium text-barnes-dark-violet mb-2">Analyse:</h4>
                      <div className="bg-white p-4 rounded-lg border border-gray-200 whitespace-pre-wrap">
                        {aiAnalysis.analysis}
                      </div>
                    </div>
                  )}
                  {aiAnalysis.suggestions && (
                    <div>
                      <h4 className="font-medium text-barnes-dark-violet mb-2">Suggesties:</h4>
                      <div className="bg-white p-4 rounded-lg border border-gray-200 whitespace-pre-wrap">
                        {aiAnalysis.suggestions}
                      </div>
                    </div>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-4">
                  💡 Je kunt de vacature aanpassen op basis van deze feedback voordat je deze opslaat.
                </p>
              </div>
            )}

            <div className="flex justify-between items-center">
              <button
                type="button"
                onClick={handleAnalyzeJob}
                disabled={isAnalyzing || !formData.title || !formData.description}
                className="btn-secondary disabled:opacity-50"
              >
                {isAnalyzing ? 'AI analyseert...' : '🤖 Vraag AI Feedback'}
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="btn-primary disabled:opacity-50"
              >
                {isSaving ? 'Opslaan...' : 'Vacature Aanmaken'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}



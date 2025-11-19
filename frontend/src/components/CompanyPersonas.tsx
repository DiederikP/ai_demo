'use client';

import { useState, useEffect } from 'react';

interface Persona {
  id: string;
  name: string;
  display_name: string;
  system_prompt: string;
  is_active: boolean;
  created_at: string;
}

interface PersonaActivity {
  persona_id: string;
  persona_name: string;
  job_id: string;
  job_title: string;
  last_activity: string;
  activity_count: number;
}

export default function CompanyPersonas() {
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [personaActivities, setPersonaActivities] = useState<Record<string, PersonaActivity[]>>({});
  const [selectedPersonaId, setSelectedPersonaId] = useState<string | null>(null);
  const [personaEvaluationDetails, setPersonaEvaluationDetails] = useState<Record<string, any[]>>({});
  const [isPersonaModalOpen, setIsPersonaModalOpen] = useState(false);
  const [editingPersona, setEditingPersona] = useState<Persona | null>(null);
  const [personaForm, setPersonaForm] = useState({
    name: '',
    display_name: '',
    system_prompt: ''
  });
  const [isSavingPersona, setIsSavingPersona] = useState(false);

  useEffect(() => {
    loadPersonas();
  }, []);

  useEffect(() => {
    if (personas.length > 0) {
      loadPersonaActivities();
    }
  }, [personas]);

  const loadPersonas = async () => {
    try {
      const response = await fetch('/api/personas');
      if (response.ok) {
        const data = await response.json();
        setPersonas(data.personas || []);
      }
    } catch (error) {
      console.error('Error loading personas:', error);
    }
  };

  const loadPersonaActivities = async () => {
    try {
      const activities: Record<string, PersonaActivity[]> = {};
      const evaluationDetails: Record<string, any[]> = {};
      
      // Load all data in parallel for better performance
      const [resultsRes, jobsRes] = await Promise.all([
        fetch('/api/evaluation-results'),
        fetch('/api/job-descriptions')
      ]);
      
      const resultsData = resultsRes.ok ? await resultsRes.json() : { results: [] };
      const results = resultsData.results || [];
      
      const jobsData = jobsRes.ok ? await jobsRes.json() : { jobs: [] };
      const jobs = jobsData.jobs || [];
      
      // Process results to find persona activities
      personas.forEach(persona => {
        activities[persona.id] = [];
        const jobActivityMap: Record<string, { count: number; lastDate: string }> = {};
        evaluationDetails[persona.id] = [];
        
        results.forEach((result: any) => {
          const resultData = typeof result.result_data === 'string' 
            ? JSON.parse(result.result_data) 
            : result.result_data || {};
          const selectedPersonas = typeof result.selected_personas === 'string' 
            ? JSON.parse(result.selected_personas) 
            : result.selected_personas || [];
          
          if (selectedPersonas.includes(persona.name) || selectedPersonas.includes(persona.id)) {
            const job = jobs.find((j: any) => j.id === result.job_id);
            if (job) {
              if (!jobActivityMap[result.job_id]) {
                jobActivityMap[result.job_id] = { count: 0, lastDate: result.created_at };
              }
              jobActivityMap[result.job_id].count++;
              if (new Date(result.created_at) > new Date(jobActivityMap[result.job_id].lastDate)) {
                jobActivityMap[result.job_id].lastDate = result.created_at;
              }
            }
          }

          if (result.result_type === 'evaluation' && resultData.evaluations) {
            Object.entries(resultData.evaluations).forEach(([personaKey, evaluation]: [string, any]) => {
              if (
                personaKey === persona.name ||
                personaKey === persona.id ||
                personaKey === persona.display_name
              ) {
                const job = jobs.find((j: any) => j.id === result.job_id);
                const prompts = resultData.persona_prompts || {};
                const personaPrompt = prompts?.[personaKey] || persona.system_prompt;
                evaluationDetails[persona.id].push({
                  candidate_name: result.candidate_name || 'Onbekende kandidaat',
                  job_title: job?.title || 'Onbekende vacature',
                  created_at: result.created_at,
                  score: evaluation.score,
                  recommendation: evaluation.recommendation,
                  analysis: evaluation.analysis,
                  big_hits: evaluation.big_hits,
                  big_misses: evaluation.big_misses,
                  prompt: personaPrompt,
                });
              }
            });
          }
        });
        
        // Convert to array
        Object.entries(jobActivityMap).forEach(([jobId, data]) => {
          const job = jobs.find((j: any) => j.id === jobId);
          if (job) {
            activities[persona.id].push({
              persona_id: persona.id,
              persona_name: persona.name,
              job_id: jobId,
              job_title: job.title,
              last_activity: data.lastDate,
              activity_count: data.count
            });
          }
        });
        
        // Sort by last activity (most recent first)
        activities[persona.id].sort((a, b) => 
          new Date(b.last_activity).getTime() - new Date(a.last_activity).getTime()
        );
      });
      
      setPersonaActivities(activities);
      setPersonaEvaluationDetails(evaluationDetails);
    } catch (error) {
      console.error('Error loading persona activities:', error);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('nl-NL', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const openPersonaModal = (persona?: Persona) => {
    if (persona) {
      setEditingPersona(persona);
      setPersonaForm({
        name: persona.name,
        display_name: persona.display_name,
        system_prompt: persona.system_prompt
      });
    } else {
      setEditingPersona(null);
      setPersonaForm({
        name: '',
        display_name: '',
        system_prompt: ''
      });
    }
    setIsPersonaModalOpen(true);
  };

  const closePersonaModal = () => {
    setIsPersonaModalOpen(false);
    setEditingPersona(null);
  };

  const handlePersonaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingPersona(true);
    try {
      const response = await fetch('/api/personas', {
        method: editingPersona ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...personaForm,
          ...(editingPersona && { id: editingPersona.id })
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Opslaan mislukt');
      }

      await loadPersonas();
      closePersonaModal();
    } catch (error) {
      console.error('Error saving persona:', error);
      alert('Kon digitale werknemer niet opslaan. Probeer het opnieuw.');
    } finally {
      setIsSavingPersona(false);
    }
  };

  const handlePersonaDelete = async (personaId: string) => {
    if (!confirm('Weet je zeker dat je deze digitale werknemer wilt verwijderen?')) return;
    try {
      const response = await fetch(`/api/personas?id=${personaId}`, { method: 'DELETE' });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Verwijderen mislukt');
      }
      await loadPersonas();
      if (selectedPersonaId === personaId) {
        setSelectedPersonaId(null);
      }
    } catch (error) {
      console.error('Error deleting persona:', error);
      alert('Kon digitale werknemer niet verwijderen.');
    }
  };

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-8">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-barnes-dark-violet mb-2">Digitale Werknemers</h1>
            <p className="text-barnes-dark-gray">Bekijk en beheer je digitale werknemers per vacature en evaluatie-activiteit</p>
          </div>
          <button
            onClick={() => openPersonaModal()}
            className="btn-primary"
          >
            Nieuwe Digitale Werknemer
          </button>
        </div>
      </div>

      {/* Persona Cards as Employees/Agents */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        {personas.filter(p => p.is_active).map(persona => {
          const activities = personaActivities[persona.id] || [];
          return (
            <div 
              key={persona.id}
              className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => setSelectedPersonaId(selectedPersonaId === persona.id ? null : persona.id)}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-full bg-barnes-violet/10 flex items-center justify-center">
                  <span className="text-xl font-bold text-barnes-violet">
                    {persona.display_name[0]}
                  </span>
                </div>
                <div>
                  <h3 className="font-semibold text-barnes-dark-violet">{persona.display_name}</h3>
                  <p className="text-xs text-barnes-dark-gray">Digitale werknemer</p>
                </div>
              </div>
              
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-barnes-dark-gray">Actieve vacatures:</span>
                  <span className="font-medium text-barnes-dark-violet">{activities.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-barnes-dark-gray">Totaal evaluaties:</span>
                  <span className="font-medium text-barnes-dark-violet">
                    {activities.reduce((sum, a) => sum + a.activity_count, 0)}
                  </span>
                </div>
                {activities.length > 0 && (
                  <div className="pt-2 border-t border-gray-200">
                    <p className="text-xs text-barnes-dark-gray">
                      Laatste activiteit: {formatDate(activities[0].last_activity)}
                    </p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Persona Activity Detail */}
      {selectedPersonaId && personaActivities[selectedPersonaId] && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 mb-6">
            <div>
              <h2 className="text-2xl font-semibold text-barnes-dark-violet mb-1">
                {personas.find(p => p.id === selectedPersonaId)?.display_name}
              </h2>
              <p className="text-sm text-barnes-dark-gray">
                Digitale werknemer overzicht en activiteit
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  const persona = personas.find(p => p.id === selectedPersonaId);
                  if (persona) openPersonaModal(persona);
                }}
                className="btn-secondary px-4 py-2 text-sm"
              >
                Bewerken
              </button>
              <button
                onClick={() => selectedPersonaId && handlePersonaDelete(selectedPersonaId)}
                className="px-4 py-2 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
              >
                Verwijderen
              </button>
              <button
                onClick={() => setSelectedPersonaId(null)}
                className="text-gray-500 hover:text-gray-700 text-2xl leading-none"
                aria-label="Sluiten"
              >
                ×
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
            <div className="border border-gray-200 rounded-xl p-4">
              <p className="text-xs uppercase tracking-wide text-gray-500 mb-1">Technische naam</p>
              <p className="font-semibold text-barnes-dark-violet">
                {personas.find(p => p.id === selectedPersonaId)?.name}
              </p>
            </div>
            <div className="border border-gray-200 rounded-xl p-4">
              <p className="text-xs uppercase tracking-wide text-gray-500 mb-1">Status</p>
              <p className="font-semibold text-barnes-dark-violet">
                {personas.find(p => p.id === selectedPersonaId)?.is_active ? 'Actief' : 'Inactief'}
              </p>
            </div>
            <div className="border border-gray-200 rounded-xl p-4">
              <p className="text-xs uppercase tracking-wide text-gray-500 mb-1">Aangemaakt op</p>
              <p className="font-semibold text-barnes-dark-violet">
                {personas.find(p => p.id === selectedPersonaId)?.created_at
                  ? formatDate(personas.find(p => p.id === selectedPersonaId)!.created_at)
                  : 'Onbekend'}
              </p>
            </div>
          </div>

          <div className="mb-6">
            <h3 className="text-lg font-semibold text-barnes-dark-violet mb-2">Rolbeschrijving</h3>
            <div className="bg-barnes-violet/5 border border-barnes-violet/20 rounded-xl p-4 text-sm leading-relaxed text-barnes-dark-violet/90 whitespace-pre-line">
              {personas.find(p => p.id === selectedPersonaId)?.system_prompt || 'Geen beschrijving beschikbaar.'}
            </div>
          </div>

          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold text-barnes-dark-violet">Recente Activiteit</h3>
            <span className="text-xs text-barnes-dark-gray">
              {personaActivities[selectedPersonaId].length} actieve vacature
              {personaActivities[selectedPersonaId].length === 1 ? '' : 's'}
            </span>
          </div>

          {personaActivities[selectedPersonaId].length === 0 ? (
            <div className="p-6 bg-gray-50 border border-dashed border-gray-200 rounded-xl text-center text-sm text-barnes-dark-gray">
              Geen recente activiteiten voor deze digitale werknemer
            </div>
          ) : (
            <div className="space-y-3">
              {personaActivities[selectedPersonaId].map((activity, idx) => (
                <div key={idx} className="border border-gray-200 rounded-xl p-4">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                    <div>
                      <h4 className="font-semibold text-barnes-dark-violet">{activity.job_title}</h4>
                      <p className="text-sm text-barnes-dark-gray">
                        {activity.activity_count} evaluatie{activity.activity_count !== 1 ? 's' : ''} uitgevoerd
                      </p>
                    </div>
                    <div className="text-xs text-barnes-dark-gray">
                      Laatste activiteit: {formatDate(activity.last_activity)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {personaEvaluationDetails[selectedPersonaId] && personaEvaluationDetails[selectedPersonaId].length > 0 && (
            <div className="mt-8">
              <h3 className="text-lg font-semibold text-barnes-dark-violet mb-3">Evaluatiegeschiedenis</h3>
              <div className="space-y-3">
                {personaEvaluationDetails[selectedPersonaId].slice(0, 6).map((evaluation, idx) => (
                  <div key={idx} className="border border-gray-200 rounded-xl p-4 bg-gray-50">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 mb-3">
                      <div>
                        <p className="font-semibold text-barnes-dark-violet">{evaluation.candidate_name}</p>
                        <p className="text-sm text-barnes-dark-gray">{evaluation.job_title}</p>
                      </div>
                      <div className="text-xs text-barnes-dark-gray">
                        {formatDate(evaluation.created_at)}
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                      <div className="p-3 rounded-lg bg-white border border-gray-200">
                        <p className="text-xs text-barnes-dark-gray uppercase mb-1">Score</p>
                        <p className="text-xl font-semibold text-barnes-dark-violet">{evaluation.score ?? '-'}</p>
                      </div>
                      <div className="p-3 rounded-lg bg-white border border-gray-200 md:col-span-2">
                        <p className="text-xs text-barnes-dark-gray uppercase mb-1">Advies</p>
                        <p className="text-barnes-dark-gray">{evaluation.recommendation || 'Geen advies beschikbaar'}</p>
                      </div>
                    </div>
                    {evaluation.analysis && (
                      <div className="mt-3 p-3 rounded-lg bg-white border border-gray-200 text-sm text-barnes-dark-gray whitespace-pre-wrap">
                        {evaluation.analysis}
                      </div>
                    )}
                    {(evaluation.big_hits || evaluation.big_misses) && (
                      <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                        {evaluation.big_hits && (
                          <div className="p-3 rounded-lg bg-green-50 border border-green-200">
                            <p className="font-semibold text-green-700 mb-1">Pluspunten</p>
                            <p className="text-green-800 whitespace-pre-wrap">{evaluation.big_hits}</p>
                          </div>
                        )}
                        {evaluation.big_misses && (
                          <div className="p-3 rounded-lg bg-red-50 border border-red-200">
                            <p className="font-semibold text-red-700 mb-1">Aandachtspunten</p>
                            <p className="text-red-800 whitespace-pre-wrap">{evaluation.big_misses}</p>
                          </div>
                        )}
                      </div>
                    )}
                    {evaluation.prompt && (
                      <details className="mt-3 bg-white border border-barnes-violet/20 rounded-lg p-3 text-sm">
                        <summary className="text-barnes-dark-violet font-semibold cursor-pointer">
                          Gebruikte prompt bekijken
                        </summary>
                        <pre className="mt-2 whitespace-pre-wrap text-barnes-dark-gray text-xs">
                          {evaluation.prompt}
                        </pre>
                      </details>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {isPersonaModalOpen && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              closePersonaModal();
            }
          }}
        >
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-semibold text-barnes-dark-violet">
                  {editingPersona ? 'Bewerk Digitale Werknemer' : 'Nieuwe Digitale Werknemer'}
                </h3>
                <p className="text-sm text-barnes-dark-gray">
                  {editingPersona
                    ? 'Pas de eigenschappen van deze digitale werknemer aan.'
                    : 'Definieer een nieuwe digitale werknemer inclusief gedrag en focus.'}
                </p>
              </div>
              <button
                onClick={closePersonaModal}
                className="text-gray-500 hover:text-gray-700 text-2xl leading-none"
                aria-label="Sluiten"
              >
                ×
              </button>
            </div>

            <form onSubmit={handlePersonaSubmit} className="p-6 space-y-4 overflow-y-auto max-h-[70vh]">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2 text-barnes-dark-violet">Technische naam *</label>
                  <input
                    type="text"
                    required
                    value={personaForm.name}
                    onChange={(e) => setPersonaForm({ ...personaForm, name: e.target.value })}
                    className="input-field"
                    placeholder="bijv. finance_director"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2 text-barnes-dark-violet">Weergavenaam *</label>
                  <input
                    type="text"
                    required
                    value={personaForm.display_name}
                    onChange={(e) => setPersonaForm({ ...personaForm, display_name: e.target.value })}
                    className="input-field"
                    placeholder="bijv. Financieel Directeur"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2 text-barnes-dark-violet">Rolbeschrijving / System Prompt *</label>
                <textarea
                  required
                  rows={8}
                  value={personaForm.system_prompt}
                  onChange={(e) => setPersonaForm({ ...personaForm, system_prompt: e.target.value })}
                  className="input-field"
                  placeholder="Omschrijf hoe deze digitale werknemer kandidaten beoordeelt..."
                />
              </div>

              <div className="flex gap-4 pt-4">
                <button
                  type="button"
                  onClick={closePersonaModal}
                  className="btn-secondary flex-1"
                >
                  Annuleren
                </button>
                <button
                  type="submit"
                  disabled={isSavingPersona}
                  className="btn-primary flex-1"
                >
                  {isSavingPersona ? 'Opslaan...' : (editingPersona ? 'Bijwerken' : 'Aanmaken')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}


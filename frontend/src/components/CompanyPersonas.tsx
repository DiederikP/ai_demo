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

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  company_id?: string;
  created_at: string;
}

export default function CompanyPersonas() {
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [users, setUsers] = useState<User[]>([]);
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
  const [activeTab, setActiveTab] = useState<'digital' | 'users'>('digital');

  useEffect(() => {
    loadPersonas();
    loadUsers();
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

  const loadUsers = async () => {
    try {
      const response = await fetch('/api/users');
      if (response.ok) {
        const data = await response.json();
        // Get current company ID from localStorage
        const currentCompanyId = localStorage.getItem('current_company_id');
        if (currentCompanyId && data.users) {
          // Filter users by company
          const companyUsers = data.users.filter((user: User) => 
            user.company_id === currentCompanyId
          );
          setUsers(companyUsers || []);
        } else {
          setUsers(data.users || []);
        }
      }
    } catch (error) {
      console.error('Error loading users:', error);
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
      const currentCompanyId = typeof window !== 'undefined'
        ? localStorage.getItem('current_company_id')
        : null;

      const payload = {
        ...personaForm,
        ...(editingPersona && { id: editingPersona.id }),
        ...(currentCompanyId ? { company_id: currentCompanyId } : {})
      };

      const response = await fetch('/api/personas', {
        method: editingPersona ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        let errorMessage = 'Opslaan mislukt';
        try {
          const errorData = await response.json();
          errorMessage = errorData.detail || errorData.error || errorMessage;
        } catch {
          const errorText = await response.text();
          if (errorText) errorMessage = errorText;
        }
        throw new Error(errorMessage);
      }

      await loadPersonas();
      closePersonaModal();
    } catch (error) {
      console.error('Error saving persona:', error);
      alert(error instanceof Error ? error.message : 'Kon digitale werknemer niet opslaan. Probeer het opnieuw.');
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

  const handleAddUser = async (email: string) => {
    if (!email || !email.includes('@')) {
      alert('Voer een geldig e-mailadres in');
      return;
    }
    
    try {
      const formData = new FormData();
      formData.append('email', email);
      // Extract name from email (before @)
      const name = email.split('@')[0].replace(/[._]/g, ' ').split(' ').map(word => 
        word.charAt(0).toUpperCase() + word.slice(1)
      ).join(' ');
      formData.append('name', name);
      formData.append('role', 'user');
      
      // Get current company ID if available
      const currentCompanyId = localStorage.getItem('current_company_id');
      if (currentCompanyId) {
        formData.append('company_id', currentCompanyId);
      }
      
      const response = await fetch('/api/users', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Kon gebruiker niet toevoegen');
      }
      
      const data = await response.json();
      if (data.success) {
        await loadUsers();
        alert(`Gebruiker ${email} succesvol toegevoegd aan bedrijfsomgeving`);
      } else {
        throw new Error(data.error || 'Kon gebruiker niet toevoegen');
      }
    } catch (error: any) {
      console.error('Error adding user:', error);
      alert(error.message || 'Kon gebruiker niet toevoegen. Probeer het opnieuw.');
    }
  };

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-8">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-barnes-dark-violet mb-2">Werknemers</h1>
            <p className="text-barnes-dark-gray">Bekijk digitale werknemers en echte gebruikers/werknemers in deze tenant</p>
          </div>
          <button
            onClick={() => openPersonaModal()}
            className="btn-primary"
          >
            Nieuwe Digitale Werknemer
          </button>
        </div>
      </div>

      {/* Tabs for Digital Employees and Actual Users */}
      <div className="mb-6 border-b border-gray-200">
        <div className="flex gap-4">
          <button
            onClick={() => setActiveTab('digital')}
            className={`px-4 py-2 font-medium transition-colors border-b-2 ${
              activeTab === 'digital'
                ? 'text-barnes-violet border-barnes-violet'
                : 'text-barnes-dark-gray border-transparent hover:text-barnes-violet'
            }`}
          >
            Digitale Werknemers ({personas.filter(p => p.is_active).length})
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`px-4 py-2 font-medium transition-colors border-b-2 ${
              activeTab === 'users'
                ? 'text-barnes-violet border-barnes-violet'
                : 'text-barnes-dark-gray border-transparent hover:text-barnes-violet'
            }`}
          >
            Gebruikers/Werknemers ({users.length})
          </button>
        </div>
      </div>

      {/* Digital Employees Tab */}
      {activeTab === 'digital' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6 mb-6">
        {personas.filter(p => p.is_active).map(persona => {
          const activities = personaActivities[persona.id] || [];
          const totalEvaluations = activities.reduce((sum, a) => sum + a.activity_count, 0);
          const evaluationDetails = personaEvaluationDetails[persona.id] || [];
          return (
            <div 
              key={persona.id}
              className="bg-white rounded-xl shadow-md border-2 border-gray-200 p-8 cursor-pointer hover:shadow-lg hover:border-barnes-violet/50 transition-all"
              onClick={() => setSelectedPersonaId(selectedPersonaId === persona.id ? null : persona.id)}
            >
              <div className="flex items-start gap-4 mb-6">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-barnes-violet/20 to-barnes-violet/10 flex items-center justify-center flex-shrink-0">
                  <span className="text-3xl font-bold text-barnes-violet">
                    {persona.display_name[0]}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-xl font-bold text-barnes-dark-violet mb-1">{persona.display_name}</h3>
                  <p className="text-sm text-barnes-dark-gray mb-2">Digitale werknemer</p>
                  <p className="text-xs text-barnes-dark-gray font-mono bg-gray-50 px-2 py-1 rounded inline-block">
                    {persona.name}
                  </p>
                </div>
              </div>
              
              <div className="space-y-3 text-sm">
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-barnes-violet/5 rounded-lg border border-barnes-violet/20">
                    <div className="text-xs text-barnes-dark-gray mb-1">Actieve vacatures</div>
                    <div className="text-2xl font-bold text-barnes-dark-violet">{activities.length}</div>
                  </div>
                  <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                    <div className="text-xs text-barnes-dark-gray mb-1">Totaal evaluaties</div>
                    <div className="text-2xl font-bold text-green-700">{totalEvaluations}</div>
                  </div>
                </div>
                
                {evaluationDetails.length > 0 && (
                  <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                    <div className="text-xs text-barnes-dark-gray mb-1">Recente evaluaties</div>
                    <div className="text-sm font-medium text-blue-700">{evaluationDetails.length}</div>
                  </div>
                )}
                
                {activities.length > 0 && (
                  <div className="pt-3 border-t border-gray-200">
                    <p className="text-xs text-barnes-dark-gray">
                      <span className="font-medium">Laatste activiteit:</span> {formatDate(activities[0].last_activity)}
                    </p>
                    {activities[0].job_title && (
                      <p className="text-xs text-barnes-dark-gray mt-1">
                        Bij: {activities[0].job_title}
                      </p>
                    )}
                  </div>
                )}
                
                {persona.system_prompt && (
                  <div className="pt-3 border-t border-gray-200">
                    <p className="text-xs font-medium text-barnes-dark-gray mb-1">Rolbeschrijving</p>
                    <p className="text-xs text-barnes-dark-gray line-clamp-3">
                      {persona.system_prompt.substring(0, 150)}
                      {persona.system_prompt.length > 150 ? '...' : ''}
                    </p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
        </div>
      )}

      {/* Actual Users/Employees Tab */}
      {activeTab === 'users' && (
        <div>
          {/* Add User Button - Admin functionality */}
          <div className="mb-6 flex justify-end">
            <button
              onClick={() => {
                const email = prompt('Voer e-mailadres in voor nieuwe gebruiker:');
                if (email && email.includes('@')) {
                  handleAddUser(email);
                } else if (email) {
                  alert('Voer een geldig e-mailadres in');
                }
              }}
              className="px-4 py-2 bg-barnes-violet text-white rounded-lg hover:bg-barnes-dark-violet transition-colors text-sm"
            >
              + Gebruiker toevoegen
            </button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
            {users.map(user => (
              <div
                key={user.id}
                className="bg-white rounded-xl shadow-md border-2 border-gray-200 p-6 hover:shadow-lg hover:border-barnes-violet/50 transition-all"
              >
                <div className="flex items-start gap-4 mb-4">
                  <div className="w-14 h-14 rounded-full bg-gradient-to-br from-barnes-orange/20 to-barnes-orange/10 flex items-center justify-center flex-shrink-0">
                    <span className="text-2xl font-bold text-barnes-orange">
                      {user.name[0]?.toUpperCase() || 'U'}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-bold text-barnes-dark-violet mb-1">{user.name}</h3>
                    <p className="text-sm text-barnes-dark-gray mb-1">{user.email}</p>
                    <span className="inline-block px-2 py-1 text-xs font-medium bg-barnes-violet/10 text-barnes-violet rounded">
                      {user.role || 'Gebruiker'}
                    </span>
                  </div>
                </div>
                
                <div className="pt-3 border-t border-gray-200">
                  <p className="text-xs text-barnes-dark-gray">
                    Lid sinds: {new Date(user.created_at).toLocaleDateString('nl-NL')}
                  </p>
                </div>
              </div>
            ))}
            {users.length === 0 && (
              <div className="col-span-full text-center py-12 bg-gray-50 rounded-xl border-2 border-dashed border-gray-300">
                <p className="text-barnes-dark-gray mb-2">Geen gebruikers gevonden</p>
                <p className="text-sm text-gray-500 mb-4">Gebruikers worden automatisch toegevoegd wanneer ze inloggen</p>
                <button
                  onClick={() => {
                    const email = prompt('Voer e-mailadres in voor nieuwe gebruiker:');
                    if (email && email.includes('@')) {
                      handleAddUser(email);
                    } else if (email) {
                      alert('Voer een geldig e-mailadres in');
                    }
                  }}
                  className="px-4 py-2 bg-barnes-violet text-white rounded-lg hover:bg-barnes-dark-violet transition-colors text-sm"
                >
                  + Eerste gebruiker toevoegen
                </button>
              </div>
            )}
          </div>
        </div>
      )}

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


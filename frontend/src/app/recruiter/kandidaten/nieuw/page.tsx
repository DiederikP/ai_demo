'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import ProtectedRoute from '../../../../components/ProtectedRoute';
import { getAuthHeaders } from '../../../../lib/auth';
import Link from 'next/link';
import DuplicateCandidateModal from '../../../../components/DuplicateCandidateModal';

interface Vacancy {
  id: string;
  title: string;
  company: string;
}

export default function RecruiterNewCandidate() {
  const router = useRouter();
  const [vacancies, setVacancies] = useState<Vacancy[]>([]);
  const [selectedVacancy, setSelectedVacancy] = useState<string>('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [motivationFile, setMotivationFile] = useState<File | null>(null);
  const [companyNote, setCompanyNote] = useState('');
  const [companyNoteFile, setCompanyNoteFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [duplicateInfo, setDuplicateInfo] = useState<{
    existing_candidate_id: string;
    existing_candidate_name: string;
    existing_candidate_email: string;
    existing_source_name?: string;
  } | null>(null);
  const [formDataToSubmit, setFormDataToSubmit] = useState<FormData | null>(null);

  // Extended candidate fields
  const [candidateForm, setCandidateForm] = useState({
    motivation_reason: '',
    test_results: '',
    age: '',
    years_experience: '',
    skill_tags: '',  // Comma-separated
    prior_job_titles: '',  // Comma-separated
    certifications: '',  // Comma-separated
    education_level: '',
    location: '',
    communication_level: '',
    availability_per_week: '',
    notice_period: '',
    salary_expectation: '',
    source: '',
  });

  useEffect(() => {
    loadVacancies();
  }, []);

  const loadVacancies = async () => {
    try {
      const headers = getAuthHeaders();
      const response = await fetch('/api/recruiter/vacancies', { headers });
      if (response.ok) {
        const data = await response.json();
        setVacancies(data.vacancies || []);
      }
    } catch (error: any) {
      console.error('Error loading vacancies:', error);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleMotivationFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setMotivationFile(file);
    }
  };

  const handleCompanyNoteFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setCompanyNoteFile(file);
    }
  };

  const submitFormData = async (formData: FormData, forceDuplicate: boolean = false, duplicateCandidateId?: string) => {
    setIsUploading(true);
    setError(null);

    try {
      if (forceDuplicate) {
        formData.append('force_duplicate', 'true');
      }
      if (duplicateCandidateId) {
        formData.append('duplicate_candidate_id', duplicateCandidateId);
      }

      const { getAuthHeadersForFormData } = await import('../../../../lib/auth');
      const headers = getAuthHeadersForFormData();
      
      console.log('[RecruiterNewCandidate] Uploading candidate with formData keys:', Array.from(formData.keys()));
      
      const response = await fetch('/api/upload-resume', {
        method: 'POST',
        headers,
        body: formData,
      });

      console.log('[RecruiterNewCandidate] Response status:', response.status, response.statusText);

      // Get response text first
      const responseText = await response.text();
      console.log('[RecruiterNewCandidate] Response text:', responseText.substring(0, 500));

      let data: any = {};
      try {
        data = JSON.parse(responseText);
      } catch (e) {
        console.error('[RecruiterNewCandidate] Failed to parse JSON:', e);
        // If not JSON, treat as error
        setError(responseText || `Server error: ${response.status} ${response.statusText}`);
        setIsUploading(false);
        return;
      }

      if (!response.ok) {
        console.error('[RecruiterNewCandidate] Upload error:', {
          status: response.status,
          statusText: response.statusText,
          data
        });
        
        if (data.duplicate_detected) {
          // Show duplicate modal with options
          setDuplicateInfo({
            existing_candidate_id: data.existing_candidate_id,
            existing_candidate_name: data.existing_candidate_name || 'Onbekend',
            existing_candidate_email: data.existing_candidate_email || '',
            existing_source_name: data.existing_source_name,
          });
          setFormDataToSubmit(formData);
          setIsUploading(false);
          return;
        } else {
          const errorMessage = data.error || data.detail || data.message || `Fout bij uploaden kandidaat (${response.status})`;
          setError(errorMessage);
        }
        setIsUploading(false);
        return;
      }
      
      // Check if response indicates failure even with 200 status
      if (data.success === false) {
        const errorMessage = data.error || data.detail || data.message || 'Fout bij uploaden kandidaat';
        console.error('[RecruiterNewCandidate] Upload failed:', errorMessage);
        setError(errorMessage);
        setIsUploading(false);
        return;
      }
      
      // Success - redirect to candidate detail or list
      if (data.candidate_id) {
        router.push(`/recruiter/kandidaten/${data.candidate_id}`);
      } else {
        setError('Kandidaat is geüpload maar geen ID ontvangen. Probeer de pagina te vernieuwen.');
        setIsUploading(false);
      }
    } catch (error: any) {
      console.error('[RecruiterNewCandidate] Exception uploading candidate:', error);
      console.error('[RecruiterNewCandidate] Error stack:', error.stack);
      setError(error.message || error.toString() || 'Fout bij uploaden kandidaat');
      setIsUploading(false);
    }
  };

  const handleDuplicateOverwrite = async () => {
    if (!formDataToSubmit || !duplicateInfo) return;
    await submitFormData(formDataToSubmit, false, duplicateInfo.existing_candidate_id);
  };

  const handleDuplicateInterrupt = () => {
    setDuplicateInfo(null);
    setFormDataToSubmit(null);
    setError('Kandidaat upload onderbroken. Je kunt de bestaande kandidaat bekijken of later opnieuw proberen.');
  };

  const handleDuplicateForceAdd = async () => {
    if (!formDataToSubmit) return;
    await submitFormData(formDataToSubmit, true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedFile) {
      setError('Selecteer een CV bestand');
      return;
    }

    // Vacancy is now optional - can be assigned later
    const formData = new FormData();
    formData.append('file', selectedFile);
    // Only add job_id if a vacancy is selected
    if (selectedVacancy) {
      formData.append('job_id', selectedVacancy);
    }
    
    // Name and email are extracted automatically from CV - don't send them
    if (motivationFile) formData.append('motivation_file', motivationFile);
    
    // Company note (recruiter's note about the candidate)
    if (companyNoteFile) {
      formData.append('company_note_file', companyNoteFile);
    } else if (companyNote) {
      formData.append('company_note', companyNote);
    }

    // Extended fields
    if (candidateForm.motivation_reason) formData.append('motivation_reason', candidateForm.motivation_reason);
    if (candidateForm.test_results) formData.append('test_results', candidateForm.test_results);
    if (candidateForm.age) formData.append('age', candidateForm.age);
    if (candidateForm.years_experience) formData.append('years_experience', candidateForm.years_experience);
    if (candidateForm.skill_tags) formData.append('skill_tags', JSON.stringify(candidateForm.skill_tags.split(',').map(t => t.trim()).filter(t => t)));
    if (candidateForm.prior_job_titles) formData.append('prior_job_titles', JSON.stringify(candidateForm.prior_job_titles.split(',').map(t => t.trim()).filter(t => t)));
    if (candidateForm.certifications) formData.append('certifications', JSON.stringify(candidateForm.certifications.split(',').map(t => t.trim()).filter(t => t)));
    if (candidateForm.education_level) formData.append('education_level', candidateForm.education_level);
    if (candidateForm.location) formData.append('location', candidateForm.location);
    if (candidateForm.communication_level) formData.append('communication_level', candidateForm.communication_level);
    if (candidateForm.availability_per_week) formData.append('availability_per_week', candidateForm.availability_per_week);
    if (candidateForm.notice_period) formData.append('notice_period', candidateForm.notice_period);
    if (candidateForm.salary_expectation) formData.append('salary_expectation', candidateForm.salary_expectation);
    if (candidateForm.source) formData.append('source', candidateForm.source);

    // Pipeline defaults for new submissions
    formData.append('pipeline_stage', 'introduced');
    formData.append('pipeline_status', 'active');

    await submitFormData(formData);
  };

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-4xl mx-auto">
          <div className="mb-6">
            <Link
              href="/recruiter/dashboard?module=kandidaten"
              className="text-barnes-violet hover:underline text-sm mb-4 inline-block"
            >
              ← Terug naar kandidaten
            </Link>
            <h1 className="text-3xl font-bold text-barnes-dark-violet">
              Nieuwe Kandidaat Toevoegen
            </h1>
            <p className="text-barnes-dark-gray mt-2">
              Dien een kandidaat in voor een vacature
            </p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg mb-6">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-6">
            {/* Vacancy Selection - Optional (can be assigned later) */}
            <div>
              <label className="block text-sm font-medium text-barnes-dark-violet mb-2">
                Vacature (optioneel - kan later worden toegewezen)
              </label>
              <select
                value={selectedVacancy}
                onChange={(e) => setSelectedVacancy(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-barnes-violet"
              >
                <option value="">Geen vacature (later toewijzen)</option>
                {vacancies.map((vacancy) => (
                  <option key={vacancy.id} value={vacancy.id}>
                    {vacancy.title} - {vacancy.company}
                  </option>
                ))}
              </select>
            </div>

            {/* CV Upload */}
            <div>
              <label className="block text-sm font-medium text-barnes-dark-violet mb-2">
                CV Bestand * <span className="text-red-500">*</span>
              </label>
              <input
                type="file"
                accept=".pdf,.doc,.docx"
                onChange={handleFileChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-barnes-violet"
                required
              />
              {selectedFile && (
                <p className="text-sm text-barnes-dark-gray mt-2">Geselecteerd: {selectedFile.name}</p>
              )}
            </div>


            {/* Motivation Letter */}
            <div>
              <label className="block text-sm font-medium text-barnes-dark-violet mb-2">
                Motivatiebrief (optioneel)
              </label>
              <input
                type="file"
                accept=".pdf,.doc,.docx"
                onChange={handleMotivationFileChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-barnes-violet"
              />
              {motivationFile && (
                <p className="text-sm text-barnes-dark-gray mt-2">Geselecteerd: {motivationFile.name}</p>
              )}
            </div>

            {/* Company Note (Recruiter's Note) */}
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <label className="block text-sm font-medium text-barnes-dark-violet mb-2">
                Bedrijfsnotitie (Je eigen notities over deze kandidaat)
              </label>
              <p className="text-xs text-barnes-dark-gray mb-3">
                Deze notitie wordt meegegeven aan het bedrijf en kan belangrijke informatie bevatten zoals motivatie, salariswensen, beschikbaarheid, etc.
              </p>
              <textarea
                value={companyNote}
                onChange={(e) => setCompanyNote(e.target.value)}
                className="w-full h-32 px-4 py-2 border border-amber-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-barnes-violet resize-none"
                placeholder="Bijv: Zeer gemotiveerd voor deze rol. Beschikbaar vanaf januari. Salariswens: €3500-4000..."
              />
              <div className="mt-2">
                <label className="block text-sm text-barnes-dark-gray mb-2">
                  Of upload een notitie bestand:
                </label>
                <input
                  type="file"
                  accept=".pdf,.doc,.docx,.txt"
                  onChange={handleCompanyNoteFileChange}
                  className="w-full px-4 py-2 border border-amber-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-barnes-violet"
                />
                {companyNoteFile && (
                  <p className="text-sm text-barnes-dark-gray mt-2">Geselecteerd: {companyNoteFile.name}</p>
                )}
              </div>
            </div>

            {/* Extended Fields - Partially Visible */}
            <div className="border border-gray-200 rounded-lg p-4 space-y-4">
              <h3 className="text-sm font-medium text-barnes-dark-violet mb-4">
                Extra Informatie (optioneel)
              </h3>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-barnes-dark-violet mb-2">
                      Motivatie / Reden van vertrek
                    </label>
                    <input
                      type="text"
                      value={candidateForm.motivation_reason}
                      onChange={(e) => setCandidateForm({...candidateForm, motivation_reason: e.target.value})}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-barnes-violet"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-barnes-dark-violet mb-2">
                      Salarisverwachting (EUR/40u)
                    </label>
                    <input
                      type="number"
                      value={candidateForm.salary_expectation}
                      onChange={(e) => setCandidateForm({...candidateForm, salary_expectation: e.target.value})}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-barnes-violet"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-barnes-dark-violet mb-2">
                      Leeftijd
                    </label>
                    <input
                      type="number"
                      value={candidateForm.age}
                      onChange={(e) => setCandidateForm({...candidateForm, age: e.target.value})}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-barnes-violet"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-barnes-dark-violet mb-2">
                      Jaren ervaring
                    </label>
                    <input
                      type="number"
                      value={candidateForm.years_experience}
                      onChange={(e) => setCandidateForm({...candidateForm, years_experience: e.target.value})}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-barnes-violet"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-barnes-dark-violet mb-2">
                      Locatie
                    </label>
                    <input
                      type="text"
                      value={candidateForm.location}
                      onChange={(e) => setCandidateForm({...candidateForm, location: e.target.value})}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-barnes-violet"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-barnes-dark-violet mb-2">
                    Vaardigheden (komma-gescheiden)
                  </label>
                  <input
                    type="text"
                    value={candidateForm.skill_tags}
                    onChange={(e) => setCandidateForm({...candidateForm, skill_tags: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-barnes-violet"
                    placeholder="Bijv: Python, React, Teamleiding"
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-barnes-dark-violet mb-2">
                      Beschikbaarheid per week (uren)
                    </label>
                    <input
                      type="number"
                      value={candidateForm.availability_per_week}
                      onChange={(e) => setCandidateForm({...candidateForm, availability_per_week: e.target.value})}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-barnes-violet"
                      placeholder="Bijv: 32"
                      min="0"
                      max="40"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-barnes-dark-violet mb-2">
                      Opzegtermijn
                    </label>
                    <input
                      type="text"
                      value={candidateForm.notice_period}
                      onChange={(e) => setCandidateForm({...candidateForm, notice_period: e.target.value})}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-barnes-violet"
                      placeholder="Bijv: 1 maand"
                    />
                  </div>
                </div>
                
                {/* Additional Fields - Collapsible */}
                <details className="border-t border-gray-200 pt-4 mt-4">
                  <summary className="cursor-pointer text-sm font-medium text-barnes-dark-gray mb-4">
                    Meer velden (test results, certificaten, etc.)
                  </summary>
                  <div className="space-y-4 mt-4">
                    <div>
                      <label className="block text-sm font-medium text-barnes-dark-violet mb-2">
                        Test Resultaten / Skill Scores
                      </label>
                      <input
                        type="text"
                        value={candidateForm.test_results}
                        onChange={(e) => setCandidateForm({...candidateForm, test_results: e.target.value})}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-barnes-violet"
                        placeholder="Bijv: Technical test: 85%, Personality: Good fit"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-barnes-dark-violet mb-2">
                        Vorige Functietitels (komma-gescheiden)
                      </label>
                      <input
                        type="text"
                        value={candidateForm.prior_job_titles}
                        onChange={(e) => setCandidateForm({...candidateForm, prior_job_titles: e.target.value})}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-barnes-violet"
                        placeholder="Bijv: Software Developer, Team Lead, Senior Engineer"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-barnes-dark-violet mb-2">
                        Certificaten (komma-gescheiden)
                      </label>
                      <input
                        type="text"
                        value={candidateForm.certifications}
                        onChange={(e) => setCandidateForm({...candidateForm, certifications: e.target.value})}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-barnes-violet"
                        placeholder="Bijv: AWS Certified, Scrum Master, ITIL"
                      />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-barnes-dark-violet mb-2">
                          Opleidingsniveau
                        </label>
                        <select
                          value={candidateForm.education_level}
                          onChange={(e) => setCandidateForm({...candidateForm, education_level: e.target.value})}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-barnes-violet"
                        >
                          <option value="">Selecteer...</option>
                          <option value="VMBO">VMBO</option>
                          <option value="HAVO">HAVO</option>
                          <option value="VWO">VWO</option>
                          <option value="MBO">MBO</option>
                          <option value="HBO">HBO</option>
                          <option value="WO Bachelor">WO Bachelor</option>
                          <option value="WO Master">WO Master</option>
                          <option value="PhD">PhD</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-barnes-dark-violet mb-2">
                          Communicatieniveau
                        </label>
                        <select
                          value={candidateForm.communication_level}
                          onChange={(e) => setCandidateForm({...candidateForm, communication_level: e.target.value})}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-barnes-violet"
                        >
                          <option value="">Selecteer...</option>
                          <option value="Basis">Basis</option>
                          <option value="Goed">Goed</option>
                          <option value="Zeer Goed">Zeer Goed</option>
                          <option value="Uitstekend">Uitstekend</option>
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-barnes-dark-violet mb-2">
                        Bron / Sourcing
                      </label>
                      <input
                        type="text"
                        value={candidateForm.source}
                        onChange={(e) => setCandidateForm({...candidateForm, source: e.target.value})}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-barnes-violet"
                        placeholder="Bijv: LinkedIn, Indeed, Referral, etc."
                      />
                    </div>
                  </div>
                </details>
              </div>
            </div>

            {/* Submit Button */}
            <div className="flex gap-4 pt-4 border-t border-gray-200">
              <button
                type="submit"
                disabled={isUploading}
                className="px-6 py-2 bg-barnes-violet text-white rounded-lg hover:bg-barnes-dark-violet transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isUploading ? 'Uploaden...' : 'Kandidaat Indienen'}
              </button>
              <Link
                href="/recruiter/dashboard?module=kandidaten"
                className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
              >
                Annuleren
              </Link>
            </div>
          </form>

          {/* Duplicate Candidate Modal */}
          {duplicateInfo && (
            <DuplicateCandidateModal
              isOpen={!!duplicateInfo}
              onClose={() => {
                setDuplicateInfo(null);
                setFormDataToSubmit(null);
              }}
              existingCandidate={{
                id: duplicateInfo.existing_candidate_id,
                name: duplicateInfo.existing_candidate_name,
                email: duplicateInfo.existing_candidate_email,
                source_name: duplicateInfo.existing_source_name,
              }}
              onOverwrite={handleDuplicateOverwrite}
              onInterrupt={handleDuplicateInterrupt}
              onForceAdd={handleDuplicateForceAdd}
            />
          )}
        </div>
      </div>
    </ProtectedRoute>
  );
}


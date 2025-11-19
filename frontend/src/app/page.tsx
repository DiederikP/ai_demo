'use client';

import { useState, useEffect } from 'react';
import Header from '../components/Header';
import Hero from '../components/Hero';
import FeatureCard from '../components/FeatureCard';
import MultiSelectPersonaCard from '../components/MultiSelectPersonaCard';
import JobDescriptionManager from '../components/JobDescriptionManager';
import PersonaManager from '../components/PersonaManager';
import ReasoningPanel from '../components/ReasoningPanel';
import Footer from '../components/Footer';

interface EvaluationResult {
  score: number;
  strengths: string;
  weaknesses: string;
  analysis: string;
  recommendation: string;
  big_hits?: string; // Big matches between candidate and job
  big_misses?: string; // Big mismatches or risks
  persona_display_name?: string;
  persona_name?: string;
  error?: string;
}

interface EvaluationResults {
  evaluations: { [personaName: string]: EvaluationResult };
  persona_count: number;
  azure_used: boolean;
  extraction_method: string;
  combined_analysis?: string;
  combined_recommendation?: string;
  combined_score?: number; // Combined score for multiple personas
  verdict?: string; // For debate results
  full_prompt?: string; // Full prompt sent to GPT
}

interface DebateResult {
  transcript: string;
}

interface JobDescription {
  id: string;
  title: string;
  company: string;
  description: string;
  requirements: string;
  location: string;
  salary_range: string;
  created_at: string;
}

interface Persona {
  id: string;
  name: string;
  display_name: string;
  system_prompt: string;
  is_active: boolean;
  created_at: string;
}

interface ReasoningStep {
  step: number;
  title: string;
  content: string;
  timestamp: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
}

export default function Home() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [motivationFile, setMotivationFile] = useState<File | null>(null);
  const [selectedPersonas, setSelectedPersonas] = useState<string[]>([]);
  const [selectedJob, setSelectedJob] = useState<JobDescription | null>(null);
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [evaluationResult, setEvaluationResult] = useState<EvaluationResults | null>(null);
  const [isDebating, setIsDebating] = useState(false);
  const [debateResult, setDebateResult] = useState<DebateResult | null>(null);
  const [reasoningSteps, setReasoningSteps] = useState<ReasoningStep[]>([]);
  const [showReasoningPanel, setShowReasoningPanel] = useState(false);
  const [showManageJobs, setShowManageJobs] = useState(false);
  const [showManagePersonas, setShowManagePersonas] = useState(false);
  const [companyNote, setCompanyNote] = useState('');
  const [companyNoteFile, setCompanyNoteFile] = useState<File | null>(null);
  const [fullPrompt, setFullPrompt] = useState<string>('');
  const [jobAnalysis, setJobAnalysis] = useState<any>(null);
  const [isAnalyzingJob, setIsAnalyzingJob] = useState(false);
  const [azureUsed, setAzureUsed] = useState<boolean | null>(null);
  const [extractionMethod, setExtractionMethod] = useState<string>('');
  const [aiConfig, setAiConfig] = useState<any>(null);
  
  // Job description states
  const [jobDescriptions, setJobDescriptions] = useState<JobDescription[]>([]);

  // Load data
  const loadPersonas = async () => {
    try {
      const response = await fetch('/api/personas');
      if (response.ok) {
        const result = await response.json();
        setPersonas(result.personas || []);
      } else {
        console.error('Failed to load personas:', response.status, response.statusText);
      }
    } catch (error: any) {
      console.error('Error loading personas:', error);
      // Don't crash the app - just log the error
    }
  };

  const loadJobDescriptions = async () => {
    try {
      const response = await fetch('/api/upload-job');
      if (response.ok) {
        const result = await response.json();
        setJobDescriptions(result.jobs || []);
      } else {
        console.error('Failed to load job descriptions:', response.status, response.statusText);
      }
    } catch (error: any) {
      console.error('Error loading job descriptions:', error);
      // Don't crash the app - just log the error
    }
  };

  const loadConfig = async () => {
    try {
      const response = await fetch('/api/config');
      if (response.ok) {
        const config = await response.json();
        setAiConfig(config);
      } else {
        console.error('Failed to load config:', response.status, response.statusText);
      }
    } catch (error: any) {
      console.error('Error loading config:', error);
      // Don't crash the app - just log the error
    }
  };

  // Wake up backend on initial load to prevent cold start delays
  const wakeUpBackend = () => {
    try {
      // Use Next.js API route instead of direct backend call to avoid CORS issues
      // The API route will handle the backend wake-up
      fetch('/api/config', {
        method: 'GET',
        // Fire and forget - don't wait for response
      }).catch(() => {
        // Silently ignore all errors - this is just a wake-up call
      });
    } catch (error) {
      // Silently ignore - this should never block page load
    }
  };

  useEffect(() => {
    // Wake up backend first (fire and forget)
    wakeUpBackend();
    
    // Load data - wrap each in error handling to prevent unhandled rejections
    loadPersonas().catch((error) => {
      console.error('Unhandled error in loadPersonas:', error);
    });
    loadJobDescriptions().catch((error) => {
      console.error('Unhandled error in loadJobDescriptions:', error);
    });
    loadConfig().catch((error) => {
      console.error('Unhandled error in loadConfig:', error);
    });
  }, []);

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

  const handlePersonaToggle = (personaName: string) => {
    setSelectedPersonas(prev => 
      prev.includes(personaName) 
        ? prev.filter(p => p !== personaName)
        : [...prev, personaName]
    );
  };

  const handleJobChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const jobId = e.target.value;
    console.log('Job selection changed. jobId:', jobId, 'Type:', typeof jobId);
    const job = jobDescriptions.find(j => j.id === jobId);
    console.log('Found job:', job ? `${job.title} at ${job.company} (ID: ${job.id})` : 'NOT FOUND');
    setSelectedJob(job || null);
    if (!job) {
      console.warn('Job not found in jobDescriptions. Available jobs:', jobDescriptions.map(j => ({ id: j.id, title: j.title })));
    }
  };

  const addReasoningStep = (step: Omit<ReasoningStep, 'timestamp'>) => {
    const newStep: ReasoningStep = {
      ...step,
      timestamp: new Date().toLocaleTimeString()
    };
    setReasoningSteps(prev => [...prev, newStep]);
  };

  const updateReasoningStep = (stepNumber: number, updates: Partial<ReasoningStep>) => {
    setReasoningSteps(prev => 
      prev.map(step => 
        step.step === stepNumber ? { ...step, ...updates } : step
      )
    );
  };

  const handleEvaluate = async () => {
    if (!selectedFile || !selectedJob || selectedPersonas.length === 0) {
      alert('Selecteer een bestand, ten minste één persona en een vacature');
      return;
    }

    setIsEvaluating(true);
    setEvaluationResult(null);
    setReasoningSteps([]);
    setShowReasoningPanel(true);

    // Add initial reasoning steps
    addReasoningStep({
      step: 1,
      title: 'File Processing',
      content: 'Extracting text from uploaded CV...',
      status: 'processing'
    });

    addReasoningStep({
      step: 2,
      title: 'Job Analysis',
      content: 'Analyzing job requirements and matching criteria...',
      status: 'pending'
    });

    addReasoningStep({
      step: 3,
      title: 'AI Evaluation',
      content: 'Analyzing candidate-job match...',
      status: 'pending'
    });

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('job_id', selectedJob.id);
      formData.append('strictness', 'medium');
      
      // Add all selected personas
      selectedPersonas.forEach(personaName => {
        const persona = personas.find(p => p.name === personaName);
        if (persona) {
          formData.append(`${personaName}_prompt`, persona.system_prompt);
        }
      });

      if (motivationFile) {
        formData.append('motivation_file', motivationFile);
      }
      
      if (companyNote) {
        formData.append('company_note', companyNote);
      }
      
      if (companyNoteFile) {
        formData.append('company_note_file', companyNoteFile);
      }

      // Update step 1 as completed
      updateReasoningStep(1, { status: 'completed', content: 'CV tekst succesvol geëxtraheerd' });
      
      // Update step 2 as processing
      updateReasoningStep(2, { status: 'processing' });

      const response = await fetch('/api/review', {
        method: 'POST',
        body: formData,
      });

      let result;
      if (!response.ok) {
        let errorMessage = 'Evaluatie mislukt';
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorData.errorDetail || errorMessage;
        } catch {
          const errorText = await response.text();
          errorMessage = errorText || `Evaluatie mislukt: ${response.status} ${response.statusText}`;
        }
        throw new Error(errorMessage);
      }

      // Parse response only if OK
      result = await response.json();

      // Update step 2 as completed
      updateReasoningStep(2, { status: 'completed', content: 'Vacaturevereisten geanalyseerd' });
      
      // Update step 3 as processing
      updateReasoningStep(3, { status: 'processing' });
      
      // Update step 3 as completed
      updateReasoningStep(3, { status: 'completed', content: 'AI evaluatie succesvol voltooid' });

      // Validate result structure
      if (!result) {
        throw new Error('Geen respons van de server ontvangen. Probeer het opnieuw.');
      }
      
      if (!result.evaluations) {
        throw new Error('Ongeldige respons van de server: ' + (result.error || 'Geen evaluaties ontvangen'));
      }

      setEvaluationResult(result);
      if (result.full_prompt) {
        setFullPrompt(result.full_prompt);
      }
      if (result.azure_used !== undefined) {
        setAzureUsed(result.azure_used);
      }
      if (result.extraction_method) {
        setExtractionMethod(result.extraction_method);
      }
    } catch (error: any) {
      console.error('Fout bij evalueren kandidaat:', error);
      const errorMessage = error?.message || 'Onbekende fout';
      updateReasoningStep(3, { status: 'error', content: 'Evaluatie mislukt - ' + errorMessage });
      // Use setTimeout to prevent blocking UI
      setTimeout(() => {
        alert('Fout bij evalueren kandidaat: ' + errorMessage + '\n\nProbeer het opnieuw of controleer of alle velden correct zijn ingevuld.');
      }, 100);
    } finally {
      setIsEvaluating(false);
      // Hide reasoning panel after a delay if there's an error
      if (reasoningSteps.some(step => step.status === 'error')) {
        setTimeout(() => {
          setShowReasoningPanel(false);
        }, 3000);
      }
    }
  };

  const handleDebate = async () => {
    if (!selectedFile || selectedPersonas.length === 0 || !selectedJob) {
      alert('Please select a file, at least one persona, and a job posting');
      return;
    }

    setIsDebating(true);
    setDebateResult(null);
    setReasoningSteps([]);
    setShowReasoningPanel(true);

    // Add debate reasoning steps
    addReasoningStep({
      step: 1,
      title: 'Multi-Persona Setup',
      content: `Preparing debate between ${selectedPersonas.length} expert persona(s)...`,
      status: 'processing'
    });

    addReasoningStep({
      step: 2,
      title: 'Expert Discussion',
      content: 'Facilitating AI-powered expert debate...',
      status: 'pending'
    });

    addReasoningStep({
      step: 3,
      title: 'Consensus Building',
      content: 'Analyzing expert opinions and building consensus...',
      status: 'pending'
    });

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('job_id', selectedJob.id);
      
      // Add all selected personas
      selectedPersonas.forEach(personaName => {
        const persona = personas.find(p => p.name === personaName);
        if (persona) {
          formData.append(`${personaName}_prompt`, persona.system_prompt);
        }
      });

      if (motivationFile) {
        formData.append('motivation_file', motivationFile);
      }
      
      if (companyNote) {
        formData.append('company_note', companyNote);
      }
      
      if (companyNoteFile) {
        formData.append('company_note_file', companyNoteFile);
      }

      // Update step 1 as completed
      updateReasoningStep(1, { status: 'completed', content: 'Personas configured for debate' });
      
      // Update step 2 as processing
      updateReasoningStep(2, { status: 'processing' });

      const response = await fetch('/api/debate', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Debate failed');
      }

      // Update step 2 as completed
      updateReasoningStep(2, { status: 'completed', content: 'Expert discussion completed' });
      
      // Update step 3 as processing
      updateReasoningStep(3, { status: 'processing' });

      const result = await response.json();
      
      // Update step 3 as completed
      updateReasoningStep(3, { status: 'completed', content: 'Consensus analysis completed' });

      setDebateResult(result);
      if (result.full_prompt) {
        setFullPrompt(result.full_prompt);
      }
      if (result.azure_used !== undefined) {
        setAzureUsed(result.azure_used);
      }
      if (result.extraction_method) {
        setExtractionMethod(result.extraction_method);
      }
    } catch (error: any) {
      console.error('Error running debate:', error);
      updateReasoningStep(3, { status: 'error', content: 'Debate failed - ' + (error?.message || 'Unknown error') });
      alert('Error running debate. Please try again.');
    } finally {
      setIsDebating(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-white text-slate-800">
      <Header />
      
      <main className="flex-1">
        <Hero />
        
        {/* Features Section */}
        <section id="features" className="max-w-6xl mx-auto px-6 py-20">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-barnes-dark-violet mb-4">
              Waarom Barnes AI?
            </h2>
            <p className="text-lg text-barnes-dark-gray max-w-2xl mx-auto">
              Ons AI-gestuurde evaluatiesysteem biedt uitgebreide inzichten vanuit meerdere expertperspectieven.
            </p>
          </div>
          
          <div className="grid gap-8 md:grid-cols-3">
            <FeatureCard 
              title="Expert AI Persona's" 
              desc="Krijg evaluaties van Hiring Manager, Bureaurecruiter en HR/Inhouse Recruiter experts aangedreven door geavanceerde AI."
              icon="🤖"
              color="orange"
            />
            <FeatureCard 
              title="Vacaturespecifieke Analyse" 
              desc="Elke evaluatie is afgestemd op uw specifieke vacaturevereisten en bedrijfsbehoeften."
              icon="🎯"
              color="violet"
            />
            <FeatureCard 
              title="Directe Resultaten" 
              desc="Van upload tot uitgebreide evaluatie in minuten, niet uren of dagen."
              icon="⚡"
              color="blue"
            />
          </div>
        </section>

        {/* Evaluation Section */}
        <section className="bg-barnes-light-gray py-20">
          <div className="max-w-7xl mx-auto px-6">
            <div className="text-center mb-16">
              <h2 className="text-4xl font-bold text-barnes-dark-violet mb-4">
                Probeer Het Nu
              </h2>
              <p className="text-lg text-barnes-dark-gray max-w-2xl mx-auto">
                Upload het CV van een kandidaat en krijg directe AI-gestuurde evaluatie van expert persona's.
              </p>
            </div>

            {/* Management Section */}
            <div className="mb-12 space-y-8">
              {/* Job Management */}
              <div className="card">
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-semibold text-barnes-dark-violet">Vacatures</h3>
                    <button
                      type="button"
                      onClick={() => setShowManageJobs(!showManageJobs)}
                      className="btn-secondary text-sm"
                    >
                      {showManageJobs ? 'Verberg' : 'Toon'} Beheer
                    </button>
                  </div>
                
                  {/* Job Selection */}
                  <div className="mb-6">
                    <label className="block text-sm font-medium mb-3 text-barnes-dark-violet">
                      Selecteer Vacature *
                    </label>
                    <select 
                      className="input-field" 
                      value={selectedJob?.id || ''} 
                      onChange={handleJobChange}
                      required
                    >
                      <option value="">Kies een vacature...</option>
                      {jobDescriptions.map((job) => (
                        <option key={job.id} value={job.id}>
                          {job.title} at {job.company}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Selected Job Preview */}
                  {selectedJob && (
                    <div className="p-6 bg-barnes-violet/5 rounded-lg border border-barnes-violet/20 mb-4">
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="text-lg font-semibold text-barnes-dark-violet">
                          {selectedJob.title} at {selectedJob.company}
                        </h4>
                        <button
                          onClick={async () => {
                            setIsAnalyzingJob(true);
                            setJobAnalysis(null); // Clear previous analysis
                            try {
                              // Validate job is selected
                              if (!selectedJob || !selectedJob.id) {
                                console.error('No job selected. selectedJob:', selectedJob);
                                console.error('Available jobs:', jobDescriptions);
                                throw new Error('Please select a job posting first.');
                              }
                              
                              // Double-check the job still exists in the list
                              const jobExists = jobDescriptions.find(j => j.id === selectedJob.id);
                              if (!jobExists) {
                                console.error('Selected job not found in current job list!');
                                console.error('Selected job ID:', selectedJob.id);
                                console.error('Available job IDs:', jobDescriptions.map(j => j.id));
                                throw new Error('The selected job posting is no longer available. Please refresh and select again.');
                              }
                              
                              console.log('=== Job Analysis Request ===');
                              console.log('Selected Job ID:', selectedJob.id, 'Type:', typeof selectedJob.id);
                              console.log('Selected Job Title:', selectedJob.title);
                              console.log('Selected Job Company:', selectedJob.company);
                              console.log('Full selectedJob:', JSON.stringify(selectedJob, null, 2));
                              
                              const response = await fetch('/api/analyze-job', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ job_id: String(selectedJob.id) })
                              });
                              
                              if (!response.ok) {
                                let errorMessage = 'Analysis failed';
                                let errorDetail = '';
                                try {
                                  const errorData = await response.json();
                                  errorMessage = errorData.error || errorMessage;
                                  errorDetail = errorData.errorDetail || '';
                                  console.error('Backend error response:', errorData);
                                  console.error('Response status:', response.status);
                                } catch (e) {
                                  // If response is not JSON, use status text
                                  const errorText = await response.text();
                                  console.error('Non-JSON error response:', errorText);
                                  errorMessage = `Analysis failed: ${response.status} ${response.statusText}`;
                                  errorDetail = errorText;
                                }
                                
                                // Log the job ID that was sent for debugging
                                console.error('Failed job ID that was sent:', selectedJob.id);
                                console.error('Failed job details:', { title: selectedJob.title, company: selectedJob.company });
                                
                                throw new Error(errorMessage + (errorDetail ? `\n\nDetails: ${errorDetail}` : ''));
                              }
                              
                              const result = await response.json();
                              
                              // Check if we got actual analysis data
                              if (result.success !== false && result.role_analysis) {
                                setJobAnalysis(result);
                              } else if (result.success === false) {
                                throw new Error(result.error || 'Analysis returned no data');
                              } else {
                                // Even if success is true, check if we have meaningful data
                                const hasData = result.role_analysis && result.role_analysis !== 'Analysis unavailable';
                                if (hasData) {
                                  setJobAnalysis(result);
                                } else {
                                  throw new Error('Analysis completed but returned no meaningful data. Please try again.');
                                }
                              }
                            } catch (error: any) {
                              console.error('Error analyzing job:', error);
                              
                              // Extract user-friendly error message
                              let errorMessage = 'Unable to analyze the job posting at this time.';
                              let troubleshooting = '';
                              
                              if (error.message) {
                                errorMessage = error.message;
                                
                                // Add specific troubleshooting tips based on error
                                if (errorMessage.includes('not found') || errorMessage.includes('No job postings')) {
                                  troubleshooting = '\n\n💡 Troubleshooting:\n• Make sure you have created at least one job posting\n• Try refreshing the page and selecting a job posting again\n• Check the "Manage Job Postings" section';
                                } else if (errorMessage.includes('API') || errorMessage.includes('unavailable') || errorMessage.includes('rate limit')) {
                                  troubleshooting = '\n\n💡 Troubleshooting:\n• Check your OpenAI API key in backend/.env\n• Verify the backend server is running\n• Wait a moment if rate limit was reached\n• Check your internet connection';
                                } else if (errorMessage.includes('connection') || errorMessage.includes('fetch') || errorMessage.includes('Failed to fetch')) {
                                  troubleshooting = '\n\n💡 Troubleshooting:\n• Ensure the backend server is running on port 8000\n• Check: http://localhost:8000\n• Verify your network connection\n• Restart the backend server if needed';
                                } else if (errorMessage.includes('select') || errorMessage.includes('required')) {
                                  troubleshooting = '\n\n💡 Troubleshooting:\n• Select a job posting from the dropdown above\n• Ensure the job posting is fully loaded';
                                } else {
                                  troubleshooting = '\n\n💡 Troubleshooting:\n• Ensure a job posting is selected\n• Check the backend server is running\n• Verify your network connection\n• Try refreshing the page\n• Check browser console (F12) for details';
                                }
                              }
                              
                              // Show user-friendly alert with troubleshooting
                              alert(`⚠️ Error: ${errorMessage}${troubleshooting}`);
                              setJobAnalysis(null);
                            } finally {
                              setIsAnalyzingJob(false);
                            }
                          }}
                          className="btn-secondary text-sm"
                          disabled={isAnalyzingJob}
                        >
                          {isAnalyzingJob ? (
                            <span className="flex items-center gap-2">
                              <div className="w-4 h-4 border-2 border-barnes-dark-gray border-t-transparent rounded-full animate-spin"></div>
                              Analyzing...
                            </span>
                          ) : (
                            'AI Analysis'
                          )}
                        </button>
                      </div>
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div>
                          <div className="space-y-2 text-sm text-barnes-dark-gray">
                            {selectedJob.location && (
                              <div className="flex items-center gap-2">
                                <span className="text-lg">📍</span>
                                <span>{selectedJob.location}</span>
                              </div>
                            )}
                            {selectedJob.salary_range && (
                              <div className="flex items-center gap-2">
                                <span className="text-lg">💰</span>
                                <span>{selectedJob.salary_range}</span>
                              </div>
                            )}
                          </div>
                        </div>
                        <div>
                          {selectedJob.description && (
                            <div className="mb-3">
                              <details className="cursor-pointer">
                                <summary className="font-medium text-barnes-dark-violet mb-2 list-none">
                                  <span className="flex items-center gap-2">
                                    <span>📄 Beschrijving</span>
                                    <span className="text-xs text-barnes-dark-gray">({selectedJob.description.length} karakters)</span>
                                  </span>
                                </summary>
                                <p className="text-sm text-barnes-dark-gray leading-relaxed mt-2 pl-4">
                                  {selectedJob.description}
                                </p>
                              </details>
                            </div>
                          )}
                          {selectedJob.requirements && (
                            <div>
                              <details className="cursor-pointer">
                                <summary className="font-medium text-barnes-dark-violet mb-2 list-none">
                                  <span className="flex items-center gap-2">
                                    <span>📋 Vereisten</span>
                                    <span className="text-xs text-barnes-dark-gray">({selectedJob.requirements.length} karakters)</span>
                                  </span>
                                </summary>
                                <p className="text-sm text-barnes-dark-gray leading-relaxed mt-2 pl-4">
                                  {selectedJob.requirements}
                                </p>
                              </details>
                            </div>
                          )}
                        </div>
                      </div>
                      {jobAnalysis && (
                        <div className="mt-4 p-4 bg-barnes-orange/5 rounded-lg border border-barnes-orange/20">
                          <h5 className="font-medium text-barnes-dark-violet mb-3">AI Analysis</h5>
                          <div className="text-sm text-barnes-dark-gray space-y-4">
                            {jobAnalysis.role_analysis && (
                              <div>
                                <div className="font-semibold text-barnes-dark-violet mb-1">Role Analysis</div>
                                <div className="leading-relaxed">{jobAnalysis.role_analysis}</div>
                              </div>
                            )}
                            {jobAnalysis.description_match && (
                              <div>
                                <div className="font-semibold text-barnes-dark-violet mb-1">Description-to-Role Match</div>
                                <div className="leading-relaxed">{jobAnalysis.description_match}</div>
                              </div>
                            )}
                            {jobAnalysis.correctness && (
                              <div>
                                <div className="font-semibold text-barnes-dark-violet mb-1">Correctness</div>
                                <div className="leading-relaxed">{jobAnalysis.correctness}</div>
                              </div>
                            )}
                            {jobAnalysis.research_quality && (
                              <div>
                                <div className="font-semibold text-barnes-dark-violet mb-1">Research Quality</div>
                                <div className="leading-relaxed">{jobAnalysis.research_quality}</div>
                              </div>
                            )}
                            {jobAnalysis.role_extension && (
                              <div>
                                <div className="font-semibold text-barnes-dark-violet mb-1">Role Extension Recommendations</div>
                                <div className="leading-relaxed">{jobAnalysis.role_extension}</div>
                              </div>
                            )}
                            {!jobAnalysis.role_analysis && !jobAnalysis.description_match && !jobAnalysis.correctness && !jobAnalysis.research_quality && !jobAnalysis.role_extension && (
                              <div className="text-barnes-orange-red">No analysis data received. Please try again.</div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Manage Job Postings - Collapsible */}
                {showManageJobs && (
                  <div id="manage-jobs" className="mt-6 pt-6 border-t border-gray-200">
                        <h4 className="text-lg font-semibold text-barnes-dark-violet mb-4">Add Job Posting</h4>
                    <JobDescriptionManager 
                      jobs={jobDescriptions} 
                      onJobsChange={loadJobDescriptions} 
                    />
                  </div>
                )}
              </div>

              {/* Persona Management */}
              <div className="card">
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-semibold text-barnes-dark-violet">Digitale Werknemer(s)</h3>
                    <button
                      type="button"
                      onClick={() => setShowManagePersonas(!showManagePersonas)}
                      className="btn-secondary text-sm"
                    >
                      {showManagePersonas ? 'Verberg' : 'Toon'} Beheer
                    </button>
                  </div>
                
                  {/* Persona Selection */}
                  <div>
                    <label className="block text-sm font-medium mb-4 text-barnes-dark-violet">
                      Selecteer Digitale Werknemers ({selectedPersonas.length} geselecteerd)
                    </label>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      {personas.map((persona) => (
                        <MultiSelectPersonaCard
                          key={persona.id}
                          persona={persona}
                          isSelected={selectedPersonas.includes(persona.name)}
                          onToggle={handlePersonaToggle}
                        />
                      ))}
                    </div>
                    
                    {selectedPersonas.length > 0 && (
                      <div className="mt-6 p-4 bg-barnes-orange/5 rounded-lg border border-barnes-orange/20">
                        <div className="text-sm font-medium text-barnes-dark-violet mb-2">
                          Geselecteerde Digitale Werknemers:
                        </div>
                        <div className="text-sm text-barnes-dark-gray">
                          {selectedPersonas.map(name => 
                            personas.find(p => p.name === name)?.display_name
                          ).join(', ')}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Manage Digitale Werknemers - Collapsible */}
                {showManagePersonas && (
                  <div className="mt-6 pt-6 border-t border-gray-200">
                    <h4 className="text-lg font-semibold text-barnes-dark-violet mb-4">Beheer Digitale Werknemers</h4>
                    <PersonaManager 
                      personas={personas} 
                      onPersonasChange={loadPersonas} 
                    />
                  </div>
                )}
              </div>
            </div>

            {/* File Upload Section */}
            <div className="mb-12">
              <div className="card">
                <h3 className="text-xl font-semibold text-barnes-dark-violet mb-6">Documenten Uploaden</h3>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium mb-3 text-barnes-dark-violet">
                      Upload CV (PDF, DOC, DOCX, TXT) *
                    </label>
                    <input
                      type="file"
                      accept=".pdf,.doc,.docx,.txt"
                      onChange={handleFileChange}
                      className="input-field file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-barnes-orange/10 file:text-barnes-orange hover:file:bg-barnes-orange/20"
                    />
                    {selectedFile && (
                      <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                        <div className="flex items-center gap-2 text-sm text-green-700">
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                          {selectedFile.name} geselecteerd
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium mb-3 text-barnes-dark-violet">
                      Upload Motivatiebrief (Optioneel)
                    </label>
                    <input
                      type="file"
                      accept=".pdf,.doc,.docx,.txt"
                      onChange={handleMotivationFileChange}
                      className="input-field file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-barnes-violet/10 file:text-barnes-violet hover:file:bg-barnes-violet/20"
                    />
                    {motivationFile && (
                      <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                        <div className="flex items-center gap-2 text-sm text-green-700">
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                          {motivationFile.name} geselecteerd
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="lg:col-span-2">
                    <label className="block text-sm font-medium mb-3 text-barnes-dark-violet">
                      Bedrijfsnotitie (Optioneel - Tekst of Bestand)
                    </label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <textarea
                        value={companyNote}
                        onChange={(e) => setCompanyNote(e.target.value)}
                        rows={4}
                        placeholder="Dit zijn de notities van het bemiddelingsbureau over de kandidaat"
                        className="input-field"
                      />
                      <div>
                        <input
                          type="file"
                          accept=".pdf,.doc,.docx,.txt"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              setCompanyNoteFile(file);
                              setCompanyNote(''); // Clear text if file selected
                            }
                          }}
                          className="input-field file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-barnes-orange/10 file:text-barnes-orange hover:file:bg-barnes-orange/20"
                        />
                        {companyNoteFile && (
                          <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                            <div className="flex items-center gap-2 text-sm text-green-700">
                              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                              {companyNoteFile.name} geselecteerd
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="mb-12">
              <div className="card">
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="flex-1">
                    <button
                      onClick={handleEvaluate}
                      disabled={!selectedFile || !selectedJob || selectedPersonas.length === 0 || isEvaluating}
                      className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed py-4 text-lg"
                    >
                      {isEvaluating ? (
                        <div className="flex items-center justify-center gap-2">
                          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          Bezig met evalueren...
                        </div>
                      ) : (
                        'Evalueer Kandidaat'
                      )}
                    </button>
                    <div className="text-xs text-barnes-dark-gray mt-2 text-center">
                      Gebruikt: CV + Motivatiebrief + Vacature + Bedrijfsnotitie + Geselecteerde Persona's ({selectedPersonas.length} persona{selectedPersonas.length !== 1 ? '\'s' : ''})
                    </div>
                  </div>
                  
                  <div className="flex-1">
                    <button
                      onClick={handleDebate}
                      disabled={selectedPersonas.length === 0 || !selectedJob || isDebating}
                      className="btn-secondary w-full disabled:opacity-50 disabled:cursor-not-allowed py-4 text-lg"
                    >
                      {isDebating ? (
                        <div className="flex items-center justify-center gap-2">
                          <div className="w-5 h-5 border-2 border-barnes-dark-gray border-t-transparent rounded-full animate-spin"></div>
                          Bezig met debatteren...
                        </div>
                      ) : (
                        'Expert Debat'
                      )}
                    </button>
                    <div className="text-xs text-barnes-dark-gray mt-2 text-center">
                      Gebruikt: CV + Motivatiebrief + Vacature + Bedrijfsnotitie + Geselecteerde Persona's
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Results */}
            {evaluationResult && evaluationResult.evaluations && (
              <div className="mb-12 animate-fade-in">
                {/* Combined Analysis - Show First */}
                {evaluationResult.combined_analysis && evaluationResult.persona_count > 1 && (
                  <div className="card mb-6 border-2 border-barnes-dark-violet">
                    <h3 className="text-xl font-bold text-barnes-dark-violet mb-3">
                      📊 Totaalanalyse - Alle Perspectieven
                    </h3>
                    {evaluationResult.combined_score && (
                      <div className="mb-4 p-4 bg-gradient-to-r from-barnes-violet/10 to-barnes-orange/10 rounded-lg border-2 border-barnes-dark-violet">
                        <div className="flex items-center gap-4">
                          <div className="text-3xl font-bold text-barnes-dark-violet">
                            {Math.min(Math.max(parseFloat(evaluationResult.combined_score.toString()), 1), 10).toFixed(1)}<span className="text-lg">/10</span>
                          </div>
                          <div className="text-sm text-barnes-dark-gray">
                            Gemiddelde score van {evaluationResult.persona_count} perspectieven
                          </div>
                        </div>
                      </div>
                    )}
                    <div className="mb-4 p-4 bg-barnes-light-gray rounded-lg border border-barnes-dark-violet/20">
                      <h4 className="text-base font-semibold text-barnes-dark-violet mb-2">Gecombineerde Evaluatie</h4>
                      <p className="text-sm text-barnes-dark-gray leading-relaxed">{evaluationResult.combined_analysis}</p>
                    </div>
                    {evaluationResult.combined_recommendation && (
                      <div className={`p-4 rounded-lg border-2 ${
                        evaluationResult.combined_recommendation.includes('Sterk geschikt') 
                          ? 'bg-green-50 border-green-500' 
                          : evaluationResult.combined_recommendation.includes('Twijfelgeval')
                          ? 'bg-yellow-50 border-yellow-500'
                          : 'bg-red-50 border-red-500'
                      }`}>
                        <h4 className="text-base font-semibold text-barnes-dark-violet mb-1">Eindadvies</h4>
                        <p className="text-base font-bold text-barnes-dark-violet">{evaluationResult.combined_recommendation}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Display evaluation for each selected persona - Collapsible and Compact */}
                {Object.entries(evaluationResult.evaluations).map(([personaName, evalData]) => {
                  const persona = personas.find(p => p.name === personaName);
                  const displayName = evalData.persona_display_name || persona?.display_name || personaName;
                  
                  return (
                    <details key={personaName} className="card mb-3 group">
                      <summary className="cursor-pointer list-none">
                        <div className="flex items-center justify-between">
                          <h3 className="text-lg font-bold text-barnes-dark-violet">
                            👤 {displayName}
                          </h3>
                          <div className="flex items-center gap-3">
                            {evalData.score && (
                              <div className="text-2xl font-bold text-barnes-dark-violet">
                                {Math.min(Math.max(parseFloat(evalData.score.toString()), 1), 10).toFixed(1)}<span className="text-sm">/10</span>
                              </div>
                            )}
                            <span className="text-barnes-dark-gray group-open:rotate-180 transition-transform">▼</span>
                          </div>
                        </div>
                      </summary>
                      
                      {evalData.error ? (
                        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
                          {evalData.error}
                        </div>
                      ) : (
                        <div className="mt-4 space-y-3">
                          {/* Recommendation - Compact */}
                          {evalData.recommendation && (
                            <div className={`p-3 rounded-lg border-2 ${
                              evalData.recommendation.includes('Sterk geschikt') 
                                ? 'bg-green-50 border-green-500' 
                                : evalData.recommendation.includes('Twijfelgeval')
                                ? 'bg-yellow-50 border-yellow-500'
                                : 'bg-red-50 border-red-500'
                            }`}>
                              <p className="text-sm font-bold text-barnes-dark-violet">{evalData.recommendation}</p>
                            </div>
                          )}

                          {/* Strengths - Compact */}
                          {evalData.strengths && (
                            <div className="p-3 bg-barnes-orange/5 rounded-lg border border-barnes-orange/20">
                              <h4 className="text-sm font-semibold text-barnes-dark-violet mb-1 flex items-center gap-1">
                                <span>💪</span> Sterke Punten
                              </h4>
                              <p className="text-xs text-barnes-dark-gray leading-relaxed line-clamp-3">{evalData.strengths}</p>
                            </div>
                          )}

                          {/* Weaknesses - Compact */}
                          {evalData.weaknesses && (
                            <div className="p-3 bg-barnes-orange-red/5 rounded-lg border border-barnes-orange-red/20">
                              <h4 className="text-sm font-semibold text-barnes-dark-violet mb-1 flex items-center gap-1">
                                <span>⚠️</span> Aandachtspunten
                              </h4>
                              <p className="text-xs text-barnes-dark-gray leading-relaxed line-clamp-3">{evalData.weaknesses}</p>
                            </div>
                          )}

                          {/* Analysis - Compact */}
                          {evalData.analysis && (
                            <div className="p-3 bg-barnes-light-gray rounded-lg border border-barnes-dark-violet/20">
                              <h4 className="text-sm font-semibold text-barnes-dark-violet mb-1">Gedetailleerde Analyse</h4>
                              <p className="text-xs text-barnes-dark-gray leading-relaxed line-clamp-4">{evalData.analysis}</p>
                            </div>
                          )}

                          {/* Big Hits - if present */}
                          {evalData.big_hits && (
                            <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                              <h4 className="text-sm font-semibold text-green-700 mb-1 flex items-center gap-1">
                                <span>✅</span> Grote Matches
                              </h4>
                              <p className="text-xs text-green-800 leading-relaxed">{evalData.big_hits}</p>
                            </div>
                          )}

                          {/* Big Misses - if present */}
                          {evalData.big_misses && (
                            <div className="p-3 bg-red-50 rounded-lg border border-red-200">
                              <h4 className="text-sm font-semibold text-red-700 mb-1 flex items-center gap-1">
                                <span>⚠️</span> Grote Mismatches
                              </h4>
                              <p className="text-xs text-red-800 leading-relaxed">{evalData.big_misses}</p>
                            </div>
                          )}
                        </div>
                      )}
                    </details>
                  );
                })}
              </div>
            )}

            {/* Debate Results - WhatsApp-like Conversation View */}
            {debateResult && (
              <div className="mb-12 animate-fade-in">
                <div className="card">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-bold text-barnes-dark-violet flex items-center gap-2">
                      <span className="text-xl">💬</span>
                      Expert Debat
                    </h3>
                  </div>
                  
                  {/* WhatsApp-style Conversation View - Only show conversation, no evaluations */}
                  <div className="mb-6">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-lg font-semibold text-barnes-dark-violet">💬 Gesprek</h4>
                      <button
                        onClick={async () => {
                          try {
                            const { jsPDF } = await import('jspdf');
                            const doc = new jsPDF();
                            
                            let yPos = 20;
                            const pageWidth = doc.internal.pageSize.getWidth();
                            const pageHeight = doc.internal.pageSize.getHeight();
                            const margin = 15;
                            const maxWidth = pageWidth - (margin * 2);
                            
                            // Title
                            doc.setFontSize(18);
                            doc.setTextColor(75, 0, 130); // barnes-dark-violet
                            doc.text('Barnes AI Expert Debate Export', margin, yPos);
                            yPos += 15;
                            
                            // Debate Transcript
                            if (debateResult?.transcript) {
                              doc.setFontSize(12);
                              doc.setTextColor(0, 0, 0);
                              doc.text('Expert Debat Transcript:', margin, yPos);
                              yPos += 7;
                              doc.setFontSize(10);
                              const transcriptLines = doc.splitTextToSize(debateResult.transcript, maxWidth);
                              doc.text(transcriptLines, margin, yPos);
                              yPos += transcriptLines.length * 5 + 10;
                            }
                            
                            // Company Note
                            if (companyNote || companyNoteFile) {
                              doc.setFontSize(12);
                              doc.text('Company Note:', margin, yPos);
                              yPos += 7;
                              doc.setFontSize(10);
                              const noteText = companyNote || `File: ${companyNoteFile?.name}`;
                              const noteLines = doc.splitTextToSize(noteText, maxWidth);
                              doc.text(noteLines, margin, yPos);
                              yPos += noteLines.length * 5 + 10;
                            }
                            
                            // Motivation Letter
                            if (motivationFile) {
                              doc.setFontSize(12);
                              doc.text(`Motivation letter: ${motivationFile.name}`, margin, yPos);
                              yPos += 10;
                            }
                            
                            // Prompts
                            doc.setFontSize(12);
                            doc.text('Persona Prompts:', margin, yPos);
                            yPos += 10;
                            selectedPersonas.forEach(name => {
                              const p = personas.find(pp => pp.name === name);
                              if (p) {
                                doc.setFontSize(10);
                                doc.setFont('helvetica', 'bold');
                                doc.text(`${p.display_name}:`, margin, yPos);
                                yPos += 5;
                                doc.setFont('helvetica', 'normal');
                                const promptLines = doc.splitTextToSize(p.system_prompt, maxWidth);
                                doc.text(promptLines, margin, yPos);
                                yPos += promptLines.length * 5 + 8;
                              }
                              
                              if (yPos > pageHeight - 40) {
                                doc.addPage();
                                yPos = 20;
                              }
                            });
                            
                            doc.save('debate_export.pdf');
                          } catch (error: any) {
                            console.error('Error generating PDF:', error);
                            alert('Error generating PDF. Please try again.');
                          }
                        }}
                        className="btn-secondary text-sm"
                      >
                        📥 Download PDF
                      </button>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4 max-h-[600px] overflow-y-auto" style={{ scrollBehavior: 'smooth' }}>
                      <div className="space-y-3">
                        {(() => {
                        // Parse debate transcript - now expects JSON format
                        let transcript = debateResult.transcript || '';
                        
                        let conversation: Array<{ role: string; content: string }> = [];
                        
                        try {
                          // Try to parse as JSON first
                          // Handle both string JSON and already parsed objects
                          if (typeof transcript === 'string') {
                            conversation = JSON.parse(transcript);
                          } else if (Array.isArray(transcript)) {
                            conversation = transcript;
                          } else {
                            throw new Error('Transcript is not a valid format');
                          }
                          
                          // Validate it's an array
                          if (!Array.isArray(conversation)) {
                            throw new Error('Parsed transcript is not an array');
                          }
                          
                          console.log('Successfully parsed JSON conversation:', conversation.length, 'messages');
                        } catch (e) {
                          // Fallback: if not JSON, try old format parsing
                          console.warn('Debate transcript is not JSON, attempting legacy parsing:', e);
                          const debateStartPattern = /(\[MODERATOR\]|\[HIRING|\[BUREAU|\[HR|\[.*RECRUITER|\[.*MANAGER)/i;
                          const debateStartMatch = transcript.search(debateStartPattern);
                          if (debateStartMatch > 0) {
                            transcript = transcript.substring(debateStartMatch);
                          }
                          
                          const speakerPattern = /\[([A-Z_ ]+)\]\s*\n/g;
                          const parts = transcript.split(speakerPattern);
                          
                          for (let i = 1; i < parts.length; i += 2) {
                            if (i + 1 < parts.length) {
                              const speakerTag = parts[i].trim();
                              let messageText = parts[i + 1] || '';
                              messageText = messageText.trim();
                              
                              const nextSpeakerIndex = messageText.search(/\[[A-Z_ ]+\]\s*\n/);
                              if (nextSpeakerIndex > 0) {
                                messageText = messageText.substring(0, nextSpeakerIndex).trim();
                              }
                              
                              if (!messageText) continue;
                              
                              let speakerName = speakerTag.replace(/_/g, ' ');
                              if (speakerName.includes('MODERATOR')) {
                                speakerName = 'Moderator';
                              } else {
                                speakerName = speakerName.split(' ')
                                  .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
                                  .join(' ');
                              }
                              
                              conversation.push({ role: speakerName, content: messageText });
                            }
                          }
                        }
                        
                        // Convert to messages format for rendering
                        const messages: Array<{ speaker: string; text: string; isOrchestrator: boolean; timestamp: string; personaName: string }> = [];
                        
                        // Generate simulated timestamps starting from 09:00
                        let currentMinute = 0;
                        const getTimestamp = () => {
                          const minutes = currentMinute % 60;
                          const hours = 9 + Math.floor(currentMinute / 60);
                          currentMinute += Math.floor(Math.random() * 3) + 1;
                          return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
                        };
                        
                        // Process each message from JSON array - ensure each is a separate bubble
                        conversation.forEach((msg) => {
                          const role = msg.role || 'Unknown';
                          let content = msg.content || '';
                          
                          // Skip empty messages
                          if (!content || !content.trim()) {
                            return;
                          }
                          
                          // Clean up content
                          content = content.trim();
                          
                          const isOrchestrator = role.toLowerCase() === 'moderator';
                          
                          // Each message becomes its own bubble
                          messages.push({
                            speaker: role,
                            text: content,
                            isOrchestrator,
                            timestamp: getTimestamp(),
                            personaName: role.toLowerCase()
                          });
                        });
                        
                        // Debug: log if we have messages
                        if (messages.length === 0) {
                          console.warn('No messages parsed from conversation:', conversation);
                        } else {
                          console.log(`Parsed ${messages.length} messages from conversation`);
                        }
                        
                        // Fallback: If no LangChain format detected, try original parsing
                        if (messages.length === 0) {
                          const lines = transcript.split('\n').filter(line => line.trim());
                          let currentSpeaker = 'System';
                          let currentText = '';
                          let currentMinute = 0;
                          const getTimestamp = () => {
                            const minutes = currentMinute % 60;
                            const hours = 9 + Math.floor(currentMinute / 60);
                            currentMinute += Math.floor(Math.random() * 3) + 1;
                            return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
                          };
                          
                          lines.forEach(line => {
                            const speakerMatch = line.match(/^([A-Za-z\s]+(?:Manager|Lead|Officer|Expert)?):\s*(.*)$/);
                            if (speakerMatch) {
                              if (currentText.trim()) {
                                messages.push({ 
                                  speaker: currentSpeaker, 
                                  text: currentText.trim(), 
                                  isOrchestrator: false,
                                  timestamp: getTimestamp(),
                                  personaName: currentSpeaker.toLowerCase()
                                });
                              }
                              currentSpeaker = speakerMatch[1];
                              currentText = speakerMatch[2] || '';
                            } else if (line.trim()) {
                              currentText += (currentText ? ' ' : '') + line.trim();
                            }
                          });
                          
                          if (currentText.trim()) {
                            messages.push({ 
                              speaker: currentSpeaker, 
                              text: currentText.trim(), 
                              isOrchestrator: false,
                              timestamp: getTimestamp(),
                              personaName: currentSpeaker.toLowerCase()
                            });
                          }
                          
                          // Final fallback
                          if (messages.length === 0) {
                            messages.push({ 
                              speaker: 'Debate', 
                              text: transcript, 
                              isOrchestrator: false,
                              timestamp: '09:00',
                              personaName: 'debate'
                            });
                          }
                        }
                        
                        // Determine persona colors
                        const getPersonaColor = (personaName: string, isModerator: boolean) => {
                          if (isModerator) return 'violet';
                          const lowerName = personaName.toLowerCase();
                          if (lowerName.includes('hiring') || lowerName.includes('manager')) return 'blue';
                          if (lowerName.includes('bureau') || (lowerName.includes('recruiter') && !lowerName.includes('hr'))) return 'green';
                          if (lowerName.includes('hr') || lowerName.includes('inhouse')) return 'gray';
                          return 'orange';
                        };
                        
                        // Ensure we have messages to render
                        if (messages.length === 0) {
                          return (
                            <div className="text-center text-gray-500 py-8">
                              Geen berichten gevonden in het debat transcript.
                            </div>
                          );
                        }
                        
                        // Determine alignment based on conversation flow (back-and-forth)
                        // Moderator always left, personas alternate based on conversation sequence
                        return messages.map((msg, idx) => {
                          // Ensure each message has valid speaker and text
                          const speaker = msg.speaker || 'Unknown';
                          const text = msg.text || '';
                          
                          if (!text || !text.trim()) {
                            return null; // Skip empty messages
                          }
                          
                          const persona = personas.find(p => 
                            speaker.toLowerCase().includes(p.display_name.toLowerCase()) ||
                            speaker.toLowerCase().includes(p.name.toLowerCase()) ||
                            p.display_name.toLowerCase().includes(speaker.toLowerCase().split(' ')[0])
                          );
                          
                          const isModerator = msg.isOrchestrator;
                          
                          // For natural back-and-forth: alternate based on message sequence
                          // Moderator always left, personas alternate left/right based on position in conversation
                          let isRight = false;
                          if (!isModerator) {
                            // Count how many non-moderator messages before this one
                            const nonModeratorCount = messages.slice(0, idx).filter(m => !m.isOrchestrator).length;
                            // Alternate: first persona left, second right, third left, etc.
                            isRight = nonModeratorCount % 2 === 1;
                          }
                          const personaColor = getPersonaColor(msg.personaName, isModerator);
                          
                          // Color scheme based on persona type
                          let bgColor = '';
                          let iconBg = '';
                          let textColor = '';
                          
                          if (isModerator) {
                            bgColor = 'bg-barnes-dark-violet';
                            iconBg = 'bg-barnes-dark-violet';
                            textColor = 'text-white';
                          } else if (personaColor === 'blue') {
                            bgColor = isRight ? 'bg-blue-500' : 'bg-blue-100';
                            iconBg = 'bg-blue-500';
                            textColor = isRight ? 'text-white' : 'text-blue-900';
                          } else if (personaColor === 'green') {
                            bgColor = isRight ? 'bg-green-500' : 'bg-green-100';
                            iconBg = 'bg-green-500';
                            textColor = isRight ? 'text-white' : 'text-green-900';
                          } else if (personaColor === 'gray') {
                            bgColor = isRight ? 'bg-gray-600' : 'bg-gray-100';
                            iconBg = 'bg-gray-600';
                            textColor = isRight ? 'text-white' : 'text-gray-900';
                          } else {
                            bgColor = isRight ? 'bg-barnes-orange' : 'bg-orange-100';
                            iconBg = 'bg-barnes-orange';
                            textColor = isRight ? 'text-white' : 'text-orange-900';
                          }
                          
                          const displayName = persona ? persona.display_name : speaker;
                          
                          return (
                            <div
                              key={idx}
                              className={`flex ${isRight ? 'justify-end' : 'justify-start'} animate-fade-in mb-2`}
                              style={{ animationDelay: `${idx * 0.05}s` }}
                            >
                              <div className={`flex items-start gap-2 max-w-[75%] ${isRight ? 'flex-row-reverse' : 'flex-row'}`}>
                                {/* Avatar */}
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${iconBg} ${textColor}`}>
                                  {displayName[0].toUpperCase()}
                                </div>
                                
                                {/* Message Bubble */}
                                <div className={`rounded-2xl px-4 py-2.5 shadow-md ${bgColor} ${textColor}`}>
                                  {/* Speaker Name and Timestamp */}
                                  <div className={`flex items-center justify-between mb-1 ${textColor} opacity-90`}>
                                    <span className="text-xs font-semibold">{displayName}</span>
                                    <span className="text-xs ml-2">{msg.timestamp}</span>
                                  </div>
                                  {/* Message Text */}
                                  <div className={`text-sm leading-relaxed whitespace-pre-wrap ${textColor}`}>
                                    {text}
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        });
                      })()}
                      </div>
                    </div>
                  </div>
                  
                  {/* Collapsible Sections - Show After Conversation */}
                  <div className="mt-6 space-y-3">
                    <h4 className="text-lg font-semibold text-barnes-dark-violet mb-3">📋 Details</h4>
                    
                    {companyNote && (
                      <div className="p-3 rounded-lg border border-barnes-violet/20 bg-barnes-violet/5">
                        <details className="cursor-pointer">
                          <summary className="text-sm font-medium text-barnes-dark-violet">📝 Bedrijfsnotitie</summary>
                          <div className="text-sm text-barnes-dark-gray mt-2 pl-4">{companyNote}</div>
                        </details>
                      </div>
                    )}
                    {companyNoteFile && (
                      <div className="p-3 rounded-lg border border-barnes-violet/20 bg-barnes-violet/5">
                        <details className="cursor-pointer">
                          <summary className="text-sm font-medium text-barnes-dark-violet">📝 Bedrijfsnotitie (Bestand)</summary>
                          <div className="text-sm text-barnes-dark-gray mt-2 pl-4">Bestand: {companyNoteFile.name}</div>
                        </details>
                      </div>
                    )}
                    <div className="p-3 rounded-lg border border-barnes-orange/20 bg-barnes-orange/5">
                      <details className="cursor-pointer">
                        <summary className="text-sm font-medium text-barnes-dark-violet">⚙️ Gebruikte Prompts</summary>
                        <div className="text-sm text-barnes-dark-gray space-y-3 mt-2 pl-4">
                          {selectedPersonas.map(name => {
                            const p = personas.find(pp => pp.name === name);
                            return (
                              <div key={name} className="border-l-2 border-barnes-orange pl-3">
                                <div className="font-medium text-barnes-dark-violet mb-1">{p?.display_name || name}</div>
                                <div className="text-xs">{p?.system_prompt}</div>
                              </div>
                            );
                          })}
                        </div>
                      </details>
                    </div>
                    {fullPrompt && (
                      <div className="p-3 rounded-lg border border-barnes-orange/20 bg-barnes-orange/5">
                        <details className="cursor-pointer">
                          <summary className="text-sm font-medium text-barnes-dark-violet">📤 Volledige Prompt Verzonden naar GPT</summary>
                          <pre className="text-xs text-barnes-dark-gray whitespace-pre-wrap mt-2 p-3 bg-white rounded border overflow-auto max-h-96 pl-4">
                            {fullPrompt}
                          </pre>
                        </details>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
        </div>
        </section>

      {/* Pricing Section */}
      <section id="pricing" className="bg-white py-20">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-barnes-dark-violet mb-4">Pricing</h2>
            <p id="from" className="text-lg text-barnes-dark-gray">From €199/month — scale with your needs.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="card p-6">
              <h3 className="text-xl font-semibold text-barnes-dark-violet">Starter</h3>
              <p className="text-barnes-dark-gray mt-2">€199/month</p>
              <ul className="mt-4 text-sm text-barnes-dark-gray space-y-2">
                <li>Up to 50 evaluations</li>
                <li>Job posting CRUD</li>
                <li>Default personas</li>
              </ul>
              <a href="/login" className="btn-primary mt-6 inline-block text-center w-full">Get Started</a>
            </div>
            <div className="card p-6 border-barnes-violet border-2">
              <h3 className="text-xl font-semibold text-barnes-dark-violet">Professional</h3>
              <p className="text-barnes-dark-gray mt-2">€499/month</p>
              <ul className="mt-4 text-sm text-barnes-dark-gray space-y-2">
                <li>Up to 250 evaluations</li>
                <li>Custom personas (CRUD)</li>
                <li>Debate mode</li>
              </ul>
              <a href="/login" className="btn-primary mt-6 inline-block text-center w-full">Get Started</a>
            </div>
            <div className="card p-6">
              <h3 className="text-xl font-semibold text-barnes-dark-violet">Enterprise</h3>
              <p className="text-barnes-dark-gray mt-2">Custom</p>
              <ul className="mt-4 text-sm text-barnes-dark-gray space-y-2">
                <li>Unlimited evaluations</li>
                <li>SSO & SLA</li>
                <li>Dedicated support</li>
              </ul>
              <a href="#pricing" className="btn-secondary mt-6 inline-block text-center w-full">Contact Sales</a>
            </div>
          </div>
        </div>
      </section>

      {/* AI Configuration Display */}
      {aiConfig && (
        <section className="bg-barnes-light-gray py-12">
          <div className="max-w-7xl mx-auto px-6">
            <div className="card">
              <h3 className="text-xl font-semibold text-barnes-dark-violet mb-4">AI Model Configuration</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
                <div>
                  <h4 className="font-medium text-barnes-dark-violet mb-2">OpenAI Models</h4>
                  <div className="space-y-1 text-barnes-dark-gray">
                    <div>Evaluation: <strong>{aiConfig.openai_models?.evaluation || 'N/A'}</strong></div>
                    <div>Debate: <strong>{aiConfig.openai_models?.debate || 'N/A'}</strong></div>
                    <div>Job Analysis: <strong>{aiConfig.openai_models?.job_analysis || 'N/A'}</strong></div>
                    <div>Text Extraction: <strong>{aiConfig.openai_models?.text_extraction || 'N/A'}</strong></div>
                  </div>
                </div>
                <div>
                  <h4 className="font-medium text-barnes-dark-violet mb-2">Azure Document Intelligence</h4>
                  <div className="space-y-1 text-barnes-dark-gray">
                    <div>Enabled: <strong>{aiConfig.azure_document_intelligence?.enabled ? '✅ Yes' : '❌ No'}</strong></div>
                    <div>Configured: <strong>{aiConfig.azure_document_intelligence?.configured ? '✅ Yes' : '❌ No'}</strong></div>
                    {aiConfig.azure_document_intelligence?.endpoint && (
                      <div className="text-xs mt-2">Endpoint: {aiConfig.azure_document_intelligence.endpoint}</div>
                    )}
                  </div>
                </div>
                <div>
                  <h4 className="font-medium text-barnes-dark-violet mb-2">Extraction Priority</h4>
                  <div className="text-barnes-dark-gray">
                    <ol className="list-decimal list-inside space-y-1">
                      {(aiConfig.extraction_priority || []).map((method: string, idx: number) => (
                        <li key={idx}><strong>{method}</strong></li>
                      ))}
                    </ol>
                  </div>
                </div>
                <div>
                  <h4 className="font-medium text-barnes-dark-violet mb-2">Temperature Settings</h4>
                  <div className="space-y-1 text-barnes-dark-gray">
                    <div>Evaluation: <strong>{aiConfig.openai_temperature?.evaluation || 'N/A'}</strong></div>
                    <div>Debate: <strong>{aiConfig.openai_temperature?.debate || 'N/A'}</strong></div>
                    <div>Job Analysis: <strong>{aiConfig.openai_temperature?.job_analysis || 'N/A'}</strong></div>
                  </div>
                </div>
              </div>
              <div className="mt-4 p-3 bg-white rounded border border-gray-200 text-xs text-barnes-dark-gray">
                💡 <strong>Tip:</strong> To change these settings, edit <code className="bg-gray-100 px-1 rounded">backend/config.py</code> and restart the backend server.
              </div>
            </div>
          </div>
        </section>
      )}
      </main>
      
      <Footer />

      {/* Reasoning Panel */}
      <ReasoningPanel
        steps={reasoningSteps}
        isVisible={showReasoningPanel}
        onClose={() => setShowReasoningPanel(false)}
      />
    </div>
  );
}
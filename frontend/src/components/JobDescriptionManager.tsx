'use client';

import { useState } from 'react';
import { buildAnalysisSections, buildExtensionBlock, AnalysisSection, ExtensionBlock } from '../utils/analysis';

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

interface JobDescriptionManagerProps {
  jobs: JobDescription[];
  onJobsChange: () => void;
}

export default function JobDescriptionManager({ jobs, onJobsChange }: JobDescriptionManagerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [editingJob, setEditingJob] = useState<JobDescription | null>(null);
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
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<any>(null);
  const analysisSections = buildAnalysisSections(aiAnalysis);
  const extensionBlock = buildExtensionBlock(aiAnalysis);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const response = await fetch('/api/upload-job', {
        method: editingJob ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          ...(editingJob && { id: editingJob.id })
        })
      });

      if (response.ok) {
        onJobsChange();
        setIsOpen(false);
        setEditingJob(null);
        setFormData({ title: '', company: '', description: '', requirements: '', location: '', salary_range: '' });
        setJobUrl(''); // Clear URL field
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        alert(`Failed to save job: ${errorData.error || errorData.detail || 'Unknown error'}`);
      }
    } catch (error: any) {
      console.error('Error saving job:', error);
      alert(`Failed to save job: ${error?.message || 'Unknown error'}`);
    }
  };

  const handleDelete = async (jobId: string) => {
    if (!confirm('Are you sure you want to delete this job posting?')) return;
    
    try {
      const response = await fetch(`/api/upload-job?id=${jobId}`, { method: 'DELETE' });
      if (response.ok) {
        onJobsChange();
      }
    } catch (error) {
      console.error('Error deleting job:', error);
    }
  };

  const handleEdit = (job: JobDescription) => {
    setEditingJob(job);
    setFormData({
      title: job.title,
      company: job.company,
      description: job.description,
      requirements: job.requirements,
      location: job.location,
      salary_range: job.salary_range
    });
    setIsOpen(true);
  };

  const handleFillFromUrl = async () => {
    if (!jobUrl || !jobUrl.trim()) {
      alert('Please enter a valid URL');
      return;
    }

    setIsLoadingFromUrl(true);
    try {
      const response = await fetch('/api/extract-job-from-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: jobUrl.trim() })
      });

      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Failed to extract job posting from URL');
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
        alert('Job posting extracted successfully! Please review and adjust the fields before saving.');
      } else {
        throw new Error(result.error || 'Failed to extract job details');
      }
    } catch (error: any) {
      console.error('Error extracting job from URL:', error);
      alert(`Error: ${error?.message || 'Failed to extract job posting from URL'}`);
    } finally {
      setIsLoadingFromUrl(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="btn-secondary text-sm"
      >
        Manage Jobs
      </button>

      {isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setIsOpen(false);
              setEditingJob(null);
            }
          }}
        >
          <div
            className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-xl font-semibold text-barnes-dark-violet">
                {editingJob ? 'Edit Job Posting' : 'Create Job Posting'}
              </h3>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto max-h-[60vh]">
              {/* URL Input for Auto-fill */}
              <div className="mb-6 p-4 bg-barnes-violet/5 rounded-lg border border-barnes-violet/20">
                <label className="block text-sm font-medium mb-2 text-barnes-dark-violet">
                  Fill from Job Posting URL (Optional)
                </label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={jobUrl}
                    onChange={(e) => setJobUrl(e.target.value)}
                    placeholder="https://example.com/job-posting"
                    className="input-field flex-1"
                  />
                  <button
                    type="button"
                    onClick={handleFillFromUrl}
                    disabled={isLoadingFromUrl || !jobUrl.trim()}
                    className="btn-secondary whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLoadingFromUrl ? (
                      <span className="flex items-center gap-2">
                        <div className="w-4 h-4 border-2 border-barnes-dark-gray border-t-transparent rounded-full animate-spin"></div>
                        Extracting...
                      </span>
                    ) : (
                      'Extract from URL'
                    )}
                  </button>
                </div>
                <p className="text-xs text-barnes-dark-gray mt-2">
                  Paste a job posting URL to automatically fill in the job details
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2 text-barnes-dark-violet">Title *</label>
                  <input
                    type="text"
                    required
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2 text-barnes-dark-violet">Company *</label>
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
                <label className="block text-sm font-medium mb-2 text-barnes-dark-violet">Description *</label>
                <textarea
                  required
                  rows={4}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="input-field"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2 text-barnes-dark-violet">Requirements</label>
                <textarea
                  rows={3}
                  value={formData.requirements}
                  onChange={(e) => setFormData({ ...formData, requirements: e.target.value })}
                  className="input-field"
                />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2 text-barnes-dark-violet">Location</label>
                  <input
                    type="text"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2 text-barnes-dark-violet">Salary Range</label>
                  <input
                    type="text"
                    value={formData.salary_range}
                    onChange={(e) => setFormData({ ...formData, salary_range: e.target.value })}
                    className="input-field"
                  />
                </div>
              </div>
              
              {/* AI Analysis Section */}
              {editingJob && (
                <div className="p-4 bg-barnes-violet/5 rounded-lg border border-barnes-violet/20">
                  <div className="flex items-center justify-between mb-3">
                    <label className="block text-sm font-medium text-barnes-dark-violet">
                      AI Analysis
                    </label>
                    <button
                      type="button"
                      onClick={async () => {
                        if (!editingJob) return;
                        setIsAnalyzing(true);
                        try {
                          const response = await fetch('/api/analyze-job', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ job_id: editingJob.id })
                          });
                          if (response.ok) {
                            const result = await response.json();
                            setAiAnalysis(result);
                          } else {
                            const error = await response.json();
                            alert(`Analysis failed: ${error.error || 'Unknown error'}`);
                          }
                        } catch (error: any) {
                          alert(`Error: ${error.message || 'Failed to analyze job'}`);
                        } finally {
                          setIsAnalyzing(false);
                        }
                      }}
                      disabled={isAnalyzing || !editingJob}
                      className="btn-secondary text-sm disabled:opacity-50"
                    >
                      {isAnalyzing ? 'Analyzing...' : 'Run AI Analysis'}
                    </button>
                  </div>
                  {(analysisSections.length > 0 || extensionBlock) ? (
                    <div className="mt-3 space-y-3 text-sm">
                      {analysisSections.map((section) => (
                        <div key={section.label} className="p-3 bg-white rounded-lg border border-gray-200">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-semibold uppercase tracking-wide text-barnes-dark-violet">
                              {section.label}
                            </span>
                            {section.rating !== null && (
                              <span className="text-xs font-semibold text-barnes-violet">
                                {section.rating.toFixed(1)} / 10
                              </span>
                            )}
                          </div>
                          <p className="text-barnes-dark-gray leading-relaxed">{section.summary}</p>
                        </div>
                      ))}
                      {extensionBlock && (
                        <div className="p-3 bg-white rounded-lg border border-gray-200">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-semibold uppercase tracking-wide text-barnes-dark-violet">
                              Roluitbreiding
                            </span>
                            {extensionBlock.advice && (
                              <span className="text-[11px] text-barnes-violet font-semibold">
                                Advies: {extensionBlock.advice}
                              </span>
                            )}
                          </div>
                          <p className="text-barnes-dark-gray leading-relaxed">{extensionBlock.overview}</p>
                          {extensionBlock.recommended_actions.length > 0 && (
                            <ul className="mt-2 space-y-2 text-xs text-barnes-dark-gray">
                              {extensionBlock.recommended_actions.map((action, idx) => (
                                <li key={`${action.title}-${idx}`} className="border border-dashed border-gray-300 rounded-lg p-2">
                                  <div className="flex items-center justify-between mb-1">
                                    <span className="font-semibold">{action.title}</span>
                                    {action.priority && (
                                      <span className="uppercase tracking-wide text-[10px]">
                                        {action.priority}
                                      </span>
                                    )}
                                  </div>
                                  {action.impact && <p>{action.impact}</p>}
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="mt-3 text-xs text-barnes-dark-gray">
                      Nog geen AI analyse beschikbaar voor deze vacature.
                    </p>
                  )}
                </div>
              )}

              <div className="flex gap-4 pt-4">
                <button type="submit" className="btn-primary flex-1">
                  {editingJob ? 'Update Job' : 'Create Job'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    setEditingJob(null);
                    setFormData({ title: '', company: '', description: '', requirements: '', location: '', salary_range: '' });
                    setAiAnalysis(null);
                  }}
                  className="btn-secondary flex-1"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Jobs List */}
      <div className="mt-6 space-y-3">
        {jobs.map((job) => (
          <div key={job.id} className="card flex items-start justify-between">
            <div className="flex-1 pr-4">
              <h4 className="font-semibold text-barnes-dark-violet">{job.title}</h4>
              <p className="text-sm text-barnes-dark-gray">{job.company} • {job.location}</p>
              <p className="text-xs text-gray-500 mt-1 line-clamp-2">{job.description}</p>
            </div>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => handleEdit(job)}
                className="px-3 py-1 text-xs bg-barnes-violet text-white rounded-lg hover:bg-barnes-dark-violet transition-colors duration-200"
              >
                Edit
              </button>
              <button
                onClick={() => handleDelete(job.id)}
                className="px-3 py-1 text-xs bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors duration-200"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

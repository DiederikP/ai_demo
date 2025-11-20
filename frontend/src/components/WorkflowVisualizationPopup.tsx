'use client';

import { useState, useEffect, useMemo } from 'react';

interface WorkflowStep {
  step: string;
  agent?: string;
  agents?: string[];
  duration: number;
  timestamp: number;
  parallel?: boolean;
  message?: string;
}

interface Persona {
  id: string;
  name: string;
  display_name: string;
}

interface WorkflowVisualizationPopupProps {
  isOpen: boolean;
  onClose: () => void;
  timingData?: {
    steps: WorkflowStep[];
    total: number;
    start_time?: number;
    end_time?: number;
  };
  debateData?: Array<{ role: string; content: string }>;
  isProcessing: boolean;
  currentStep?: string;
  personas?: Persona[];
  selectedPersonas?: string[];
}

export default function WorkflowVisualizationPopup({
  isOpen,
  onClose,
  timingData,
  debateData,
  isProcessing,
  currentStep,
  personas = [],
  selectedPersonas = []
}: WorkflowVisualizationPopupProps) {
  const [elapsedTime, setElapsedTime] = useState(0);
  const [actualStartTime, setActualStartTime] = useState<number | null>(null);

  // Update actual start time when timing data arrives
  useEffect(() => {
    if (timingData?.start_time) {
      const startTimeMs = timingData.start_time > 946684800000 
        ? timingData.start_time 
        : timingData.start_time * 1000;
      setActualStartTime(startTimeMs);
    }
  }, [timingData]);

  // Update elapsed time based on actual timing
  useEffect(() => {
    if (!isOpen || !isProcessing) {
      setElapsedTime(0);
      return;
    }

    const interval = setInterval(() => {
      if (actualStartTime) {
        const elapsed = Math.floor((Date.now() - actualStartTime) / 1000);
        setElapsedTime(elapsed);
      } else {
        setElapsedTime(prev => prev + 1);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isOpen, isProcessing, actualStartTime]);

  // Process timing data and calculate accurate progress
  const { sequentialSteps, parallelSteps, currentStepIndex, progress, isActuallyComplete, activePersonas, isDebateStarting } = useMemo(() => {
    const displaySteps = (timingData && timingData.steps && timingData.steps.length > 0) 
      ? timingData.steps 
      : [];
    
    if (displaySteps.length === 0) {
      return {
        sequentialSteps: [],
        parallelSteps: [],
        currentStepIndex: 0,
        progress: 0,
        isActuallyComplete: !isProcessing && timingData?.end_time,
        activePersonas: selectedPersonas || [],
        isDebateStarting: false
      };
    }
    
    const sequential: Array<{ step: WorkflowStep; index: number }> = [];
    const parallel: Array<{ step: WorkflowStep; index: number }> = [];
    
    displaySteps.forEach((step, index) => {
      const isParallel = step.parallel || (step.agents && step.agents.length > 1);
      if (isParallel) {
        parallel.push({ step, index });
      } else {
        sequential.push({ step, index });
      }
    });

    // Calculate current step and progress based on ACTUAL timing data
    let currentIdx = 0;
    let calculatedProgress = 0;
    let isComplete = false;
    let activeAgents: string[] = [];
    let debateStarting = false;

    if (timingData && timingData.steps && timingData.steps.length > 0 && actualStartTime) {
      const elapsed = (Date.now() - actualStartTime) / 1000;
      
      let cumulativeTime = 0;
      for (let i = 0; i < displaySteps.length; i++) {
        const step = displaySteps[i];
        const stepStart = step.timestamp 
          ? (step.timestamp > 946684800000 ? step.timestamp : step.timestamp * 1000) / 1000 - (actualStartTime / 1000)
          : cumulativeTime;
        const stepDuration = step.duration || 0;
        const stepEnd = stepStart + stepDuration;

        // Check if debate is starting
        if (step.step?.includes('moderator') && step.step?.includes('opening')) {
          if (elapsed >= stepStart && elapsed < stepEnd) {
            debateStarting = true;
          }
        }

        if (elapsed >= stepEnd) {
          currentIdx = i + 1;
          cumulativeTime = stepEnd;
        } else if (elapsed >= stepStart) {
          currentIdx = i;
          const stepProgress = (elapsed - stepStart) / stepDuration;
          calculatedProgress = ((i + stepProgress) / displaySteps.length) * 100;
          
          // Get active agents for current step
          if (step.agents && step.agents.length > 0) {
            activeAgents = step.agents;
          } else if (step.agent) {
            activeAgents = [step.agent];
          }
          break;
        } else {
          break;
        }
      }

      if (currentIdx >= displaySteps.length) {
        isComplete = true;
        calculatedProgress = 100;
        currentIdx = displaySteps.length;
      }
    } else if (timingData?.end_time) {
      isComplete = true;
      calculatedProgress = 100;
      currentIdx = displaySteps.length;
    } else {
      calculatedProgress = 5;
      activeAgents = selectedPersonas || [];
    }

    const finalIsComplete = isComplete && !isProcessing;

    return {
      sequentialSteps: sequential,
      parallelSteps: parallel,
      currentStepIndex: currentIdx,
      progress: Math.min(Math.max(calculatedProgress, 0), 100),
      isActuallyComplete: finalIsComplete,
      allSteps: displaySteps,
      activePersonas: activeAgents.length > 0 ? activeAgents : (selectedPersonas || []),
      isDebateStarting: debateStarting
    };
  }, [timingData, isProcessing, actualStartTime, selectedPersonas]);

  if (!isOpen) return null;

  const getStepDescription = (step: string) => {
    const stepMap: { [key: string]: string } = {
      'moderator_opening': 'Moderator opent debat',
      'personas_round1': 'Digital employees delen perspectief',
      'moderator_guidance': 'Moderator begeleidt discussie',
      'personas_round2': 'Digital employees discussiëren',
      'moderator_deepening': 'Moderator verdiept discussie',
      'personas_round3': 'Digital employees geven laatste redenering',
      'moderator_conclusion': 'Moderator komt tot conclusie',
      'personas_initial_thoughts': 'Eerste indrukken (overgeslagen)',
      'personas_response_round2': 'Digital employees reageren',
      'moderator_final_question': 'Moderator vraagt afronding',
      'personas_final_perspectives': 'Laatste perspectief',
      'moderator_final_summary': 'Moderator samenvatting',
      'initializing': 'Initialiseren'
    };
    return stepMap[step] || step.replace(/_/g, ' ');
  };

  const allSteps = timingData && timingData.steps && timingData.steps.length > 0 
    ? timingData.steps 
    : [];
  const totalTime = timingData?.total || 0;
  const showCompleteStatus = isActuallyComplete && !isProcessing;

  // Get persona display names
  const getPersonaDisplayName = (personaIdOrName: string) => {
    const persona = personas.find(p => p.id === personaIdOrName || p.name === personaIdOrName);
    return persona?.display_name || personaIdOrName;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-6">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl h-[85vh] overflow-hidden flex flex-col border border-gray-200">
        {/* Header - Clean Tech Design */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-lg bg-gradient-to-br from-barnes-violet to-barnes-dark-violet flex items-center justify-center ${isProcessing && !showCompleteStatus ? 'animate-pulse' : ''}`}>
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Workflow Status</h2>
              <p className="text-sm text-gray-600 mt-0.5">
                {showCompleteStatus 
                  ? `Voltooid in ${totalTime.toFixed(1)}s` 
                  : isProcessing 
                    ? `Bezig • ${elapsedTime}s verstreken`
                    : 'Initialiseren...'}
              </p>
            </div>
          </div>
          {showCompleteStatus && (
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors p-2 hover:bg-gray-100 rounded-lg"
              aria-label="Sluiten"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-white">
          {/* Overall Progress Bar */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Algemene Voortgang</span>
              <span className="text-2xl font-bold text-barnes-violet">{Math.round(progress)}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
              <div 
                className={`h-3 rounded-full transition-all duration-300 ${
                  showCompleteStatus 
                    ? 'bg-green-500' 
                    : 'bg-gradient-to-r from-barnes-violet to-purple-600'
                }`}
                style={{ width: `${progress}%` }}
              >
                {isProcessing && !showCompleteStatus && (
                  <div className="h-full w-full bg-white/30 animate-pulse"></div>
                )}
              </div>
            </div>
          </div>

          {/* Active Digital Employees */}
          {activePersonas.length > 0 && (
            <div className="mb-8 p-4 bg-blue-50 rounded-xl border border-blue-200">
              <div className="flex items-center gap-2 mb-3">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                <h3 className="text-sm font-semibold text-blue-900 uppercase tracking-wide">Actieve Digital Employees</h3>
              </div>
              <div className="flex flex-wrap gap-2">
                {activePersonas.map((personaId, idx) => (
                  <div
                    key={idx}
                    className="px-3 py-1.5 bg-white rounded-lg border border-blue-300 text-sm font-medium text-blue-900 shadow-sm"
                  >
                    {getPersonaDisplayName(personaId)}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Debate Starting Indicator */}
          {isDebateStarting && !showCompleteStatus && (
            <div className="mb-6 p-4 bg-purple-50 rounded-xl border-2 border-purple-400 animate-pulse">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse"></div>
                <span className="text-sm font-semibold text-purple-900">Debat wordt gestart...</span>
              </div>
            </div>
          )}

          {/* Show loading state if no steps yet */}
          {allSteps.length === 0 && isProcessing && (
            <div className="text-center py-16">
              <div className="w-16 h-16 border-4 border-barnes-violet border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-lg font-semibold text-gray-900">Workflow wordt geïnitialiseerd</p>
              <p className="text-sm text-gray-600 mt-2">Digital employees worden geactiveerd</p>
            </div>
          )}

          {/* Steps Display */}
          {allSteps.length > 0 && (
            <div className="space-y-4">
              {/* Sequential Steps */}
              {sequentialSteps.length > 0 && (
                <div className="bg-gray-50 rounded-xl border border-gray-200 p-5">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                      <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-base font-semibold text-gray-900">Sequentiële Stappen</h3>
                      <p className="text-xs text-gray-600">Moderator workflow</p>
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    {sequentialSteps.map(({ step, index }) => {
                      const isActive = index === currentStepIndex && isProcessing && !showCompleteStatus;
                      const isCompleted = index < currentStepIndex || showCompleteStatus;
                      
                      return (
                        <div
                          key={index}
                          className={`p-4 rounded-lg border-2 transition-all ${
                            isActive
                              ? 'bg-yellow-50 border-yellow-400 shadow-md'
                              : isCompleted
                              ? 'bg-green-50 border-green-300'
                              : 'bg-white border-gray-200 opacity-50'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-3">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                                isActive
                                  ? 'bg-yellow-400 text-yellow-900'
                                  : isCompleted
                                  ? 'bg-green-500 text-white'
                                  : 'bg-gray-300 text-gray-600'
                              }`}>
                                {isCompleted ? '✓' : index + 1}
                              </div>
                              <span className={`text-sm font-medium ${
                                isActive ? 'text-yellow-900' : isCompleted ? 'text-green-900' : 'text-gray-600'
                              }`}>
                                {getStepDescription(step.step || step.step)}
                              </span>
                            </div>
                            {isActive && (
                              <span className="px-2 py-1 bg-yellow-400 text-yellow-900 text-xs font-bold rounded animate-pulse">
                                ACTIEF
                              </span>
                            )}
                          </div>
                          {isActive && (
                            <div className="mt-3 w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
                              <div 
                                className="bg-yellow-400 h-1.5 rounded-full transition-all duration-500 animate-pulse"
                                style={{ width: '75%' }}
                              />
                            </div>
                          )}
                          {step.duration > 0 && (
                            <div className="text-xs text-gray-500 mt-2">
                              Duur: {step.duration.toFixed(1)}s
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Parallel Steps */}
              {parallelSteps.length > 0 && (
                <div className="bg-gray-50 rounded-xl border border-gray-200 p-5">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                      <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-base font-semibold text-gray-900">Parallelle Uitvoering</h3>
                      <p className="text-xs text-gray-600">Digital employees werken gelijktijdig</p>
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    {parallelSteps.map(({ step, index }) => {
                      const isActive = index === currentStepIndex && isProcessing && !showCompleteStatus;
                      const isCompleted = index < currentStepIndex || showCompleteStatus;
                      const agents = step.agents || (step.agent ? [step.agent] : []);
                      
                      return (
                        <div
                          key={index}
                          className={`p-4 rounded-lg border-2 transition-all ${
                            isActive
                              ? 'bg-blue-50 border-blue-400 shadow-md'
                              : isCompleted
                              ? 'bg-green-50 border-green-300'
                              : 'bg-white border-gray-200 opacity-50'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-3">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                                isActive
                                  ? 'bg-blue-400 text-blue-900'
                                  : isCompleted
                                  ? 'bg-green-500 text-white'
                                  : 'bg-gray-300 text-gray-600'
                              }`}>
                                {isCompleted ? '✓' : index + 1}
                              </div>
                              <div>
                                <span className={`text-sm font-medium block ${
                                  isActive ? 'text-blue-900' : isCompleted ? 'text-green-900' : 'text-gray-600'
                                }`}>
                                  {getStepDescription(step.step || step.step)}
                                </span>
                                <span className="text-xs text-gray-500 mt-0.5">
                                  {agents.length > 0 
                                    ? agents.map(id => getPersonaDisplayName(id)).join(', ')
                                    : `${agents.length || 1} digital employee(s)`
                                  }
                                </span>
                              </div>
                            </div>
                            {isActive && (
                              <span className="px-2 py-1 bg-blue-400 text-blue-900 text-xs font-bold rounded animate-pulse">
                                ACTIEF
                              </span>
                            )}
                          </div>
                          {isActive && (
                            <div className="mt-3 w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
                              <div 
                                className="bg-blue-400 h-1.5 rounded-full transition-all duration-500 animate-pulse"
                                style={{ width: '60%' }}
                              />
                            </div>
                          )}
                          {step.duration > 0 && (
                            <div className="text-xs text-gray-500 mt-2">
                              Duur: {step.duration.toFixed(1)}s
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Summary Stats */}
          {showCompleteStatus && timingData && (
            <div className="mt-8 grid grid-cols-3 gap-4">
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 text-center">
                <div className="text-2xl font-bold text-barnes-violet">{totalTime.toFixed(1)}s</div>
                <div className="text-xs text-gray-600 mt-1 font-medium">Totale tijd</div>
              </div>
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 text-center">
                <div className="text-2xl font-bold text-green-600">{parallelSteps.length}</div>
                <div className="text-xs text-gray-600 mt-1 font-medium">Parallelle stappen</div>
              </div>
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 text-center">
                <div className="text-2xl font-bold text-purple-600">{sequentialSteps.length}</div>
                <div className="text-xs text-gray-600 mt-1 font-medium">Sequentiële stappen</div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
          <div className="flex items-center gap-3 text-sm">
            {showCompleteStatus ? (
              <>
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="font-medium text-gray-900">Evaluatie voltooid</span>
              </>
            ) : isProcessing ? (
              <>
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="font-medium text-gray-900">Bezig met evaluatie ({elapsedTime}s)</span>
              </>
            ) : (
              <>
                <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                <span className="text-gray-600">Wachten op start...</span>
              </>
            )}
          </div>
          {showCompleteStatus && (
            <button
              onClick={onClose}
              className="px-4 py-2 bg-barnes-violet text-white rounded-lg hover:bg-barnes-dark-violet transition-colors font-medium text-sm"
            >
              Sluiten
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

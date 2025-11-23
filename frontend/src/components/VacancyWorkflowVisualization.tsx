'use client';

import { useMemo } from 'react';

interface WorkflowStep {
  id: string;
  label: string;
  icon: string;
  status: 'completed' | 'active' | 'pending';
  timestamp?: string;
}

interface VacancyWorkflowVisualizationProps {
  vacancyId: string;
  vacancyCreatedAt?: string;
  recruiterNotified?: boolean;
  candidatesAdded?: number;
  candidatesProposed?: boolean;
  evaluationStarted?: boolean;
  debateCompleted?: boolean;
  decisionMade?: boolean;
}

export default function VacancyWorkflowVisualization({
  vacancyId,
  vacancyCreatedAt,
  recruiterNotified = false,
  candidatesAdded = 0,
  candidatesProposed = false,
  evaluationStarted = false,
  debateCompleted = false,
  decisionMade = false,
}: VacancyWorkflowVisualizationProps) {
  const steps: WorkflowStep[] = useMemo(() => {
    const workflowSteps: WorkflowStep[] = [
      {
        id: 'created',
        label: 'Vacature geplaatst',
        icon: '📝',
        status: vacancyCreatedAt ? 'completed' : 'pending',
        timestamp: vacancyCreatedAt,
      },
      {
        id: 'recruiter_notified',
        label: 'Recruiter geïnformeerd',
        icon: '📢',
        status: recruiterNotified ? 'completed' : 'pending',
      },
      {
        id: 'candidates_added',
        label: `Kandidaten toegevoegd (${candidatesAdded})`,
        icon: '👥',
        status: candidatesAdded > 0 ? 'completed' : 'pending',
      },
      {
        id: 'candidates_proposed',
        label: 'Kandidaten voorgesteld',
        icon: '📤',
        status: candidatesProposed ? 'completed' : 'pending',
      },
      {
        id: 'evaluation',
        label: 'Evaluatie gestart',
        icon: '🔍',
        status: evaluationStarted ? 'completed' : 'pending',
      },
      {
        id: 'debate',
        label: 'Debat voltooid',
        icon: '💬',
        status: debateCompleted ? 'completed' : 'pending',
      },
      {
        id: 'decision',
        label: 'Beslissing genomen',
        icon: '✅',
        status: decisionMade ? 'completed' : 'pending',
      },
    ];

    // Mark the first pending step as active
    const firstPendingIndex = workflowSteps.findIndex(step => step.status === 'pending');
    if (firstPendingIndex > 0 && firstPendingIndex < workflowSteps.length) {
      workflowSteps[firstPendingIndex].status = 'active';
    }

    return workflowSteps;
  }, [
    vacancyCreatedAt,
    recruiterNotified,
    candidatesAdded,
    candidatesProposed,
    evaluationStarted,
    debateCompleted,
    decisionMade,
  ]);

  const getStepColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-500 border-green-500';
      case 'active':
        return 'bg-barnes-violet border-barnes-violet animate-pulse';
      default:
        return 'bg-gray-300 border-gray-300';
    }
  };

  const getStepTextColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'text-green-700';
      case 'active':
        return 'text-barnes-violet font-semibold';
      default:
        return 'text-gray-500';
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-barnes-dark-violet mb-6">Workflow Voortgang</h3>
      <div className="relative">
        {/* Connection lines */}
        <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gray-200" style={{ marginTop: '24px', marginBottom: '24px' }} />
        
        <div className="space-y-6">
          {steps.map((step, index) => (
            <div key={step.id} className="relative flex items-start gap-4">
              {/* Step indicator */}
              <div className={`relative z-10 w-12 h-12 rounded-full border-2 flex items-center justify-center ${getStepColor(step.status)} transition-all duration-300`}>
                <span className="text-xl">{step.icon}</span>
                {step.status === 'completed' && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                )}
              </div>
              
              {/* Step content */}
              <div className="flex-1 pt-2">
                <div className={`text-sm font-medium ${getStepTextColor(step.status)}`}>
                  {step.label}
                </div>
                {step.timestamp && (
                  <div className="text-xs text-gray-500 mt-1">
                    {new Date(step.timestamp).toLocaleString('nl-NL')}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}


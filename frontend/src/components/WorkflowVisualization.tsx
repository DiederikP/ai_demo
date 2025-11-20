'use client';

import { useState, useEffect } from 'react';

interface WorkflowStep {
  step: string;
  agent?: string;
  agents?: string[];
  duration: number;
  timestamp: number;
  parallel?: boolean;
}

interface WorkflowVisualizationProps {
  timingData?: {
    steps: WorkflowStep[];
    total: number;
    start_time?: number;
    end_time?: number;
  };
  debateData?: Array<{ role: string; content: string }>;
  isActive?: boolean;
}

export default function WorkflowVisualization({
  timingData,
  debateData,
  isActive = false
}: WorkflowVisualizationProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);

  useEffect(() => {
    if (!isPlaying || !timingData || !timingData.steps) return;

    const interval = setInterval(() => {
      setCurrentStep((prev) => {
        if (prev >= timingData.steps.length - 1) {
          setIsPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, 1000 / playbackSpeed);

    return () => clearInterval(interval);
  }, [isPlaying, playbackSpeed, timingData]);

  if (!timingData || !timingData.steps || timingData.steps.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-barnes-dark-violet mb-4">Workflow Visualisatie</h3>
        <p className="text-barnes-dark-gray">Geen timing data beschikbaar</p>
      </div>
    );
  }

  const steps = timingData.steps;
  const totalTime = timingData.total || 0;

  // Calculate relative positions
  const getStepPosition = (step: WorkflowStep, index: number) => {
    if (totalTime === 0) return 0;
    const elapsed = step.timestamp - (timingData.start_time || 0);
    return (elapsed / totalTime) * 100;
  };

  const getStepWidth = (step: WorkflowStep) => {
    if (totalTime === 0) return 10;
    return (step.duration / totalTime) * 100;
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-barnes-dark-violet">Workflow Visualisatie</h3>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setIsPlaying(!isPlaying);
              if (!isPlaying && currentStep >= steps.length - 1) {
                setCurrentStep(0);
              }
            }}
            className="px-3 py-1 bg-barnes-violet text-white rounded-lg text-sm hover:bg-barnes-dark-violet"
          >
            {isPlaying ? '⏸️ Pauze' : '▶️ Afspelen'}
          </button>
          <select
            value={playbackSpeed}
            onChange={(e) => setPlaybackSpeed(Number(e.target.value))}
            className="px-2 py-1 border border-gray-300 rounded text-sm"
          >
            <option value={0.5}>0.5x</option>
            <option value={1}>1x</option>
            <option value={2}>2x</option>
            <option value={4}>4x</option>
          </select>
          <button
            onClick={() => setCurrentStep(0)}
            className="px-3 py-1 border border-gray-300 rounded-lg text-sm hover:bg-gray-50"
          >
            ↺ Reset
          </button>
        </div>
      </div>

      {/* Timeline */}
      <div className="relative mb-8" style={{ height: '200px' }}>
        {/* Time axis */}
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-200 rounded">
          {steps.map((step, index) => {
            const position = getStepPosition(step, index);
            const width = getStepWidth(step);
            const isActive = index <= currentStep;
            
            return (
              <div
                key={index}
                className={`absolute h-full rounded transition-all ${
                  isActive ? 'bg-barnes-violet' : 'bg-gray-300'
                }`}
                style={{
                  left: `${position}%`,
                  width: `${Math.max(width, 2)}%`,
                  zIndex: isActive ? 10 : 1
                }}
                title={`${step.step}: ${step.duration}s`}
              />
            );
          })}
        </div>

        {/* Agent nodes */}
        {steps.map((step, index) => {
          const position = getStepPosition(step, index);
          const isActive = index <= currentStep;
          const agents = step.agents || (step.agent ? [step.agent] : []);
          
          return (
            <div
              key={index}
              className="absolute transition-all"
              style={{
                left: `${position}%`,
                bottom: '20px',
                transform: 'translateX(-50%)',
                zIndex: isActive ? 20 : 10
              }}
            >
              <div
                className={`w-12 h-12 rounded-full flex items-center justify-center text-white text-xs font-semibold shadow-lg ${
                  isActive
                    ? step.parallel
                      ? 'bg-green-500'
                      : 'bg-barnes-violet'
                    : 'bg-gray-400'
                }`}
                title={`${step.step}\n${agents.join(', ')}\n${step.duration}s`}
              >
                {step.parallel ? '⚡' : '🤖'}
              </div>
              <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-1 text-xs text-barnes-dark-gray whitespace-nowrap">
                {step.agent || (step.agents && step.agents.length > 0 ? `${step.agents.length}x` : step.step)}
              </div>
            </div>
          );
        })}

        {/* Current time indicator */}
        {isPlaying && (
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-30"
            style={{
              left: `${getStepPosition(steps[currentStep] || steps[0], currentStep)}%`,
              transform: 'translateX(-50%)'
            }}
          />
        )}
      </div>

      {/* Step details */}
      <div className="space-y-2">
        <div className="text-sm font-semibold text-barnes-dark-violet mb-2">
          Stappen ({currentStep + 1}/{steps.length})
        </div>
        {steps.slice(0, currentStep + 1).map((step, index) => {
          const agents = step.agents || (step.agent ? [step.agent] : []);
          return (
            <div
              key={index}
              className="flex items-center gap-3 p-2 bg-gray-50 rounded border border-gray-200"
            >
              <div className={`w-3 h-3 rounded-full ${step.parallel ? 'bg-green-500' : 'bg-barnes-violet'}`} />
              <div className="flex-1">
                <div className="text-sm font-medium text-barnes-dark-violet">
                  {step.step.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </div>
                <div className="text-xs text-barnes-dark-gray">
                  {agents.join(', ')} • {step.duration}s
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary */}
      <div className="mt-6 pt-4 border-t border-gray-200">
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <div className="text-barnes-dark-gray">Totale tijd</div>
            <div className="text-lg font-semibold text-barnes-dark-violet">{totalTime.toFixed(2)}s</div>
          </div>
          <div>
            <div className="text-barnes-dark-gray">Aantal stappen</div>
            <div className="text-lg font-semibold text-barnes-dark-violet">{steps.length}</div>
          </div>
          <div>
            <div className="text-barnes-dark-gray">Parallel uitgevoerd</div>
            <div className="text-lg font-semibold text-barnes-dark-violet">
              {steps.filter(s => s.parallel).length}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


'use client';

import { useState, useEffect } from 'react';

interface ReasoningStep {
  step: number;
  title: string;
  content: string;
  timestamp: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
}

interface ReasoningPanelProps {
  steps: ReasoningStep[];
  isVisible: boolean;
  onClose: () => void;
}

export default function ReasoningPanel({ steps, isVisible, onClose }: ReasoningPanelProps) {
  const [shouldShow, setShouldShow] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (isVisible) {
      setShouldShow(true);
      setIsAnimating(false);
    } else {
      // Animate out before hiding
      setIsAnimating(true);
      const timer = setTimeout(() => {
        setShouldShow(false);
        setIsAnimating(false);
      }, 300); // Match animation duration
      return () => clearTimeout(timer);
    }
  }, [isVisible]);

  // Auto-hide after all steps are completed
  useEffect(() => {
    if (steps.length > 0) {
      const allCompleted = steps.every(step => step.status === 'completed' || step.status === 'error');
      if (allCompleted && isVisible) {
        const timer = setTimeout(() => {
          onClose();
        }, 3000); // Auto-hide after 3 seconds
        return () => clearTimeout(timer);
      }
    }
  }, [steps, isVisible, onClose]);

  if (!shouldShow) return null;

  return (
    <div className={`fixed bottom-4 right-4 w-72 bg-white border border-gray-200 shadow-2xl rounded-xl z-50 overflow-hidden transition-all duration-300 ${
      isAnimating ? 'translate-y-full opacity-0' : 'translate-y-0 opacity-100'
    }`} style={{ maxHeight: '500px' }}>
      <div className="h-full flex flex-col">
        {/* Header - Compact */}
        <div className="flex items-center justify-between p-3 border-b border-gray-200 bg-barnes-light-gray">
          <h3 className="text-sm font-semibold text-barnes-dark-violet">AI Reasoning</h3>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-gray-100 transition-colors duration-200"
            aria-label="Close panel"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Steps - Compact */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {steps.length === 0 ? (
            <div className="text-center text-barnes-dark-gray py-4">
              <div className="text-2xl mb-2">🤖</div>
              <p className="text-xs">Start evaluatie om AI reasoning te zien</p>
            </div>
          ) : (
            steps.map((step) => (
              <div
                key={step.step}
                className={`p-2 rounded-lg border transition-all duration-200 ${
                  step.status === 'completed'
                    ? 'border-green-200 bg-green-50'
                    : step.status === 'processing'
                    ? 'border-blue-200 bg-blue-50 animate-pulse'
                    : step.status === 'error'
                    ? 'border-red-200 bg-red-50'
                    : 'border-gray-200 bg-gray-50'
                }`}
              >
                <div className="flex items-start gap-2">
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0 ${
                    step.status === 'completed'
                      ? 'bg-green-500 text-white'
                      : step.status === 'processing'
                      ? 'bg-blue-500 text-white'
                      : step.status === 'error'
                      ? 'bg-red-500 text-white'
                      : 'bg-gray-300 text-gray-600'
                  }`}>
                    {step.status === 'completed' ? '✓' : step.status === 'processing' ? '⟳' : step.status === 'error' ? '✗' : step.step}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-barnes-dark-violet text-xs">{step.title}</h4>
                    <p className="text-xs text-barnes-dark-gray mt-0.5 leading-relaxed line-clamp-2">{step.content}</p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

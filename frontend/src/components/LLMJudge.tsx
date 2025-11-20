'use client';

import { useState } from 'react';

interface JudgeEvaluation {
  evaluation_id: number;
  input_hash: string;
  confidence_score: number;
  quality_score: number;
  consistency_score: number;
  timing_score: number;
  breakdown: {
    quality: {
      length_score: number;
      structure_score: number;
      completeness_score: number;
    };
    timing: Record<string, number>;
    similarity_to_others: number;
    similar_outputs_count: number;
  };
  similar_inputs_found: number;
  recommendations: string[];
}

interface LLMJudgeProps {
  resultId: string;
  onEvaluate?: (evaluation: JudgeEvaluation) => void;
}

/**
 * LLM Judge Component
 * Clickable LLM judge to second-guess actions and provide confidence level for model performance
 * Shows how similar inputs yield similar outputs
 */
export default function LLMJudge({ resultId, onEvaluate }: LLMJudgeProps) {
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [evaluation, setEvaluation] = useState<JudgeEvaluation | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleEvaluate = async () => {
    if (!resultId) {
      setError('Geen result ID opgegeven');
      return;
    }

    setIsEvaluating(true);
    setError(null);
    
    try {
      const formData = new FormData();
      formData.append('result_id', resultId);

      const response = await fetch('/api/llm-judge/evaluate', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        let errorMessage = 'Evaluatie mislukt';
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorData.detail || errorMessage;
        } catch {
          const errorText = await response.text();
          errorMessage = errorText || errorMessage;
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();
      if (data.success && data.evaluation) {
        setEvaluation(data.evaluation);
        if (onEvaluate) {
          onEvaluate(data.evaluation);
        }
      } else {
        throw new Error('Ongeldig response formaat');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to evaluate LLM performance');
      console.error('LLM Judge evaluation error:', err);
    } finally {
      setIsEvaluating(false);
    }
  };

  const getConfidenceColor = (score: number) => {
    if (score >= 0.8) return 'text-green-700 bg-green-50 border-green-200';
    if (score >= 0.6) return 'text-yellow-700 bg-yellow-50 border-yellow-200';
    return 'text-red-700 bg-red-50 border-red-200';
  };

  const getConfidenceLabel = (score: number) => {
    if (score >= 0.8) return 'Hoog';
    if (score >= 0.6) return 'Gemiddeld';
    return 'Laag';
  };

  return (
    <div className="bg-surface rounded-xl border border-border p-6 notion-block">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-primary">LLM Judge</h3>
          <p className="text-xs text-secondary mt-1">
            Beoordeelt de performance van de digitale werknemers (agents), niet de kandidaat evaluatie
          </p>
        </div>
        <button
          onClick={handleEvaluate}
          disabled={isEvaluating || !resultId}
          className="px-4 py-2 bg-barnes-violet text-white rounded-lg text-sm hover:bg-barnes-dark-violet disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-120"
        >
          {isEvaluating ? 'Evalueren...' : 'Evalueer Agent Performance'}
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      {evaluation && (
        <div className="space-y-4">
          {/* Confidence Score */}
          <div className="p-4 bg-surface-alt rounded-lg border border-border">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-secondary">Vertrouwensscore</span>
              <span className={`px-3 py-1 rounded-full text-sm font-semibold border ${getConfidenceColor(evaluation.confidence_score)}`}>
                {getConfidenceLabel(evaluation.confidence_score)} ({(evaluation.confidence_score * 100).toFixed(0)}%)
              </span>
            </div>
            <div className="w-full bg-border rounded-full h-2 mt-2">
              <div
                className={`h-2 rounded-full transition-all duration-300 ${
                  evaluation.confidence_score >= 0.8 ? 'bg-green-500' :
                  evaluation.confidence_score >= 0.6 ? 'bg-yellow-500' : 'bg-red-500'
                }`}
                style={{ width: `${evaluation.confidence_score * 100}%` }}
              />
            </div>
          </div>

          {/* Score Breakdown */}
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
              <div className="text-xs text-secondary mb-1">Kwaliteit</div>
              <div className="text-lg font-semibold text-blue-600">
                {(evaluation.quality_score * 100).toFixed(0)}%
              </div>
            </div>
            <div className="p-3 bg-purple-50 rounded-lg border border-purple-200">
              <div className="text-xs text-secondary mb-1">Consistentie</div>
              <div className="text-lg font-semibold text-purple-600">
                {(evaluation.consistency_score * 100).toFixed(0)}%
              </div>
            </div>
            <div className="p-3 bg-orange-50 rounded-lg border border-orange-200">
              <div className="text-xs text-secondary mb-1">Timing</div>
              <div className="text-lg font-semibold text-orange-600">
                {(evaluation.timing_score * 100).toFixed(0)}%
              </div>
            </div>
          </div>

          {/* Quality Breakdown */}
          <div className="p-4 bg-surface-alt rounded-lg border border-border">
            <div className="text-sm font-medium text-primary mb-3">Kwaliteitsdetails</div>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-secondary">Lengte score</span>
                <span className="font-medium text-primary">
                  {evaluation.breakdown.quality.length_score.toFixed(2)}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-secondary">Structuur score</span>
                <span className="font-medium text-primary">
                  {evaluation.breakdown.quality.structure_score.toFixed(2)}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-secondary">Volledigheid score</span>
                <span className="font-medium text-primary">
                  {evaluation.breakdown.quality.completeness_score.toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          {/* Similar Inputs */}
          {evaluation.similar_inputs_found > 0 && (
            <div className="p-3 bg-blue-50 rounded-lg border border-blue-200 text-sm">
              <span className="font-medium text-primary">
                {evaluation.similar_inputs_found} vergelijkbare input(s) gevonden
              </span>
              <div className="text-secondary mt-1">
                Consistentie met andere outputs: {(evaluation.breakdown.similarity_to_others * 100).toFixed(0)}%
              </div>
              <div className="text-xs text-secondary mt-1">
                Dit laat zien hoe vergelijkbare inputs tot vergelijkbare outputs leiden
              </div>
            </div>
          )}

          {/* Recommendations */}
          <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="text-sm font-medium text-primary mb-2">Aanbevelingen</div>
            <ul className="space-y-1">
              {evaluation.recommendations.map((rec, index) => (
                <li key={index} className="text-sm text-secondary">
                  {rec}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {!evaluation && !error && !isEvaluating && (
        <p className="text-sm text-secondary text-center py-4">
          Klik op "Evalueer Performance" om de LLM output te beoordelen en consistentie te controleren
        </p>
      )}
    </div>
  );
}

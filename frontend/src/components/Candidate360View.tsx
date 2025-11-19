'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';

interface EvaluationResult {
  id: string;
  result_type: 'evaluation' | 'debate';
  job_id: string;
  job_title?: string;
  created_at: string;
  result_data: any;
  selected_personas: string[];
}

interface Conversation {
  id: string;
  title: string;
  summary: string;
  created_at?: string;
}

type ConversationTimelineEntry = Conversation & {
  type: 'conversation';
  created_at: string;
};

type TimelineItem = EvaluationResult | ConversationTimelineEntry;

interface Candidate360ViewProps {
  candidateId: string;
  candidateName: string;
  evaluationResults: EvaluationResult[];
  conversations: Conversation[];
  jobs: Array<{ id: string; title: string; company: string }>;
}

export default function Candidate360View({
  candidateId,
  candidateName,
  evaluationResults,
  conversations,
  jobs,
}: Candidate360ViewProps) {
  const [summary, setSummary] = useState<string>('');
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const timelineItems = useMemo(() => {
    const conversationEntries: ConversationTimelineEntry[] = conversations.map(conversation => ({
      ...conversation,
      type: 'conversation',
      created_at: conversation.created_at ?? new Date().toISOString(),
    }));

    return [...evaluationResults, ...conversationEntries].sort((a, b) => {
      const dateA = new Date(a.created_at || 0).getTime();
      const dateB = new Date(b.created_at || 0).getTime();
      return dateB - dateA;
    });
  }, [evaluationResults, conversations]);

  const isConversationItem = (
    item: TimelineItem,
  ): item is ConversationTimelineEntry => 'type' in item && item.type === 'conversation';

  const isEvaluationItem = (item: TimelineItem): item is EvaluationResult =>
    'result_type' in item;

  // Calculate average score
  const calculateAverageScore = () => {
    const scores: number[] = [];
    evaluationResults.forEach(result => {
      if (result.result_type === 'evaluation' && result.result_data?.combined_score) {
        scores.push(result.result_data.combined_score);
      } else if (result.result_type === 'evaluation' && result.result_data?.evaluations) {
        Object.values(result.result_data.evaluations).forEach((evaluation: any) => {
          if (evaluation.score) scores.push(evaluation.score);
        });
      }
    });
    if (scores.length === 0) return null;
    return scores.reduce((a, b) => a + b, 0) / scores.length;
  };

  const averageScore = calculateAverageScore();

  // Generate AI summary
  const generateSummary = async () => {
    setIsGeneratingSummary(true);
    try {
      // Collect all evaluation data
      const evaluationTexts = evaluationResults
        .filter(r => r.result_type === 'evaluation')
        .map(r => {
          if (r.result_data?.combined_analysis) {
            return r.result_data.combined_analysis;
          }
          return '';
        })
        .filter(Boolean)
        .join('\n\n');

      if (!evaluationTexts) {
        setSummary('Nog geen evaluaties beschikbaar voor samenvatting.');
        return;
      }

      const response = await fetch('/api/generate-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidate_name: candidateName,
          evaluations: evaluationTexts,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setSummary(data.summary || 'Samenvatting kon niet worden gegenereerd.');
      }
    } catch (error) {
      console.error('Error generating summary:', error);
      setSummary('Fout bij genereren samenvatting.');
    } finally {
      setIsGeneratingSummary(false);
    }
  };

  // Get job match scores
  const getJobMatchScores = () => {
    const jobScores: Record<string, { score: number; count: number }> = {};
    
    evaluationResults.forEach(result => {
      if (result.job_id) {
        if (!jobScores[result.job_id]) {
          jobScores[result.job_id] = { score: 0, count: 0 };
        }
        
        if (result.result_type === 'evaluation' && result.result_data?.combined_score) {
          jobScores[result.job_id].score += result.result_data.combined_score;
          jobScores[result.job_id].count += 1;
        }
      }
    });

    return Object.entries(jobScores).map(([jobId, data]) => ({
      jobId,
      job: jobs.find(j => j.id === jobId),
      averageScore: data.count > 0 ? data.score / data.count : 0,
      evaluationCount: data.count,
    }));
  };

  const jobMatchScores = getJobMatchScores();

  return (
    <div className="space-y-6">
      {/* Summary Card */}
      <div className="bg-gradient-to-br from-barnes-violet/10 to-barnes-orange/10 rounded-2xl border-2 border-barnes-violet/20 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-barnes-dark-violet">360° Overzicht</h2>
          <button
            onClick={generateSummary}
            disabled={isGeneratingSummary || evaluationResults.length === 0}
            className="btn-secondary text-sm disabled:opacity-50"
          >
            {isGeneratingSummary ? 'Genereren...' : 'AI Samenvatting'}
          </button>
        </div>
        
        {summary ? (
          <div className="bg-white/80 rounded-xl p-4 backdrop-blur-sm">
            <p className="text-barnes-dark-gray leading-relaxed whitespace-pre-wrap">{summary}</p>
          </div>
        ) : (
          <p className="text-barnes-dark-gray text-sm">
            Klik op "AI Samenvatting" om een overzicht te genereren op basis van alle evaluaties.
          </p>
        )}
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="text-sm text-barnes-dark-gray mb-1">Gemiddelde Score</div>
          <div className="text-3xl font-bold text-barnes-violet">
            {averageScore ? averageScore.toFixed(1) : '-'}
          </div>
          {averageScore && <div className="text-xs text-gray-400 mt-1">/ 10</div>}
        </div>
        
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="text-sm text-barnes-dark-gray mb-1">Evaluaties</div>
          <div className="text-3xl font-bold text-barnes-violet">
            {evaluationResults.filter(r => r.result_type === 'evaluation').length}
          </div>
        </div>
        
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="text-sm text-barnes-dark-gray mb-1">Debatten</div>
          <div className="text-3xl font-bold text-barnes-violet">
            {evaluationResults.filter(r => r.result_type === 'debate').length}
          </div>
        </div>
        
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="text-sm text-barnes-dark-gray mb-1">Gesprekken</div>
          <div className="text-3xl font-bold text-barnes-violet">
            {conversations.length}
          </div>
        </div>
      </div>

      {/* Job Match Scores */}
      {jobMatchScores.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-barnes-dark-violet mb-4">Match Scores per Vacature</h3>
          <div className="space-y-3">
            {jobMatchScores.map(({ jobId, job, averageScore, evaluationCount }) => (
              <div key={jobId} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex-1">
                  <p className="font-medium text-barnes-dark-violet">
                    {job?.title || 'Onbekende vacature'}
                  </p>
                  <p className="text-xs text-barnes-dark-gray">
                    {evaluationCount} evaluatie{evaluationCount !== 1 ? 's' : ''}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className="text-2xl font-bold text-barnes-violet">
                      {averageScore.toFixed(1)}
                    </div>
                    <div className="text-xs text-gray-400">/ 10</div>
                  </div>
                  <div className="w-24 bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-barnes-violet h-2 rounded-full transition-all"
                      style={{ width: `${(averageScore / 10) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Timeline */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-barnes-dark-violet mb-4">Tijdlijn</h3>
        <div className="space-y-4">
          {timelineItems.map((item, idx) => {
            const isConversation = isConversationItem(item);
            const isEvaluation = isEvaluationItem(item) && item.result_type === 'evaluation';

            return (
              <div
                key={`${item.id}-${idx}`}
                className="flex items-start gap-4 pb-4 border-b border-gray-100 last:border-0"
              >
                <div className="w-2 h-2 rounded-full bg-barnes-violet mt-2" />
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium text-barnes-dark-violet">
                      {isConversation
                        ? 'Gesprek'
                        : isEvaluation
                        ? 'Evaluatie'
                        : 'Debat'}
                    </span>
                    {'job_title' in item && item.job_title && (
                      <span className="text-xs text-barnes-dark-gray">
                        - {item.job_title}
                      </span>
                    )}
                  </div>
                  {isConversation && item.title && (
                    <p className="text-sm text-barnes-dark-gray">{item.title}</p>
                  )}
                  {isEvaluation && item.result_data?.combined_score && (
                    <p className="text-sm text-barnes-dark-gray">
                      Score: {item.result_data.combined_score.toFixed(1)}/10
                    </p>
                  )}
                  <p className="text-xs text-gray-400 mt-1">
                    {new Date(item.created_at || 0).toLocaleString('nl-NL')}
                  </p>
                </div>
                {isEvaluationItem(item) && item.id && (
                  <Link
                    href={`/company/results/${item.id}`}
                    className="text-xs text-barnes-violet hover:underline"
                  >
                    Bekijk →
                  </Link>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}


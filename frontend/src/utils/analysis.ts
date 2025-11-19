export interface AnalysisSection {
  label: string;
  summary: string;
  rating: number | null;
}

export interface ExtensionBlock {
  overview: string;
  advice?: string;
  recommended_actions: Array<{
    title: string;
    impact?: string;
    priority?: string;
  }>;
}

const getSectionValue = (data: any, key: string, fallbackKey?: string) => {
  if (!data) return null;
  if (data[key] !== undefined) return data[key];
  if (fallbackKey && data[fallbackKey] !== undefined) return data[fallbackKey];
  return null;
};

const normalizeSection = (value: any, label: string): AnalysisSection | null => {
  if (value === null || value === undefined) return null;

  if (typeof value === 'string' || typeof value === 'number') {
    const summary = String(value).trim();
    if (!summary) return null;
    return { label, summary, rating: null };
  }

  if (typeof value === 'object') {
    const summary =
      value.summary ||
      value.samenvatting ||
      value.description ||
      value.analysis ||
      '';
    const ratingValue = value.rating ?? value.score ?? null;
    const rating =
      typeof ratingValue === 'number'
        ? Math.min(10, Math.max(1, Math.round(ratingValue * 10) / 10))
        : null;

    if (!summary && rating === null) {
      return null;
    }

    return {
      label: value.label || label,
      summary: summary || 'Geen aanvullende informatie',
      rating,
    };
  }

  return null;
};

const normalizeExtension = (value: any): ExtensionBlock | null => {
  if (!value) return null;

  if (typeof value === 'string') {
    return {
      overview: value,
      advice: '',
      recommended_actions: [],
    };
  }

  if (typeof value === 'object') {
    const overview =
      value.overview || value.samenvatting || value.analysis || '';
    const advice = value.advice || value.advies || value.status || '';
    const rawActions =
      value.recommended_actions ||
      value.aanbevolen_acties ||
      value.actions ||
      [];

    const recommended_actions = Array.isArray(rawActions)
      ? rawActions.map((action: any) => {
          if (typeof action === 'string') {
            return {
              title: action,
              impact: '',
              priority: 'middel',
            };
          }
          if (typeof action === 'object' && action) {
            return {
              title:
                action.title ||
                action.naam ||
                action.actie ||
                action.acties ||
                'Aanbeveling',
              impact: action.impact || action.toelichting || '',
              priority: action.priority || action.prioriteit || 'middel',
            };
          }
          return null;
        }).filter(Boolean) as ExtensionBlock['recommended_actions']
      : [];

    return {
      overview: overview || 'Geen aanvullende informatie',
      advice,
      recommended_actions,
    };
  }

  return null;
};

export const buildAnalysisSections = (analysisData: any): AnalysisSection[] => {
  const mapping = [
    { key: 'analysis', fallback: 'role_analysis', label: 'Analyse' },
    { key: 'match', fallback: 'description_match', label: 'Match' },
    { key: 'correctness', fallback: 'correctness', label: 'Correctheid' },
    { key: 'quality', fallback: 'research_quality', label: 'Kwaliteit' },
  ];

  return mapping
    .map(({ key, fallback, label }) => {
      const value = getSectionValue(analysisData, key, fallback);
      return normalizeSection(value, label);
    })
    .filter((section): section is AnalysisSection => Boolean(section));
};

export const buildExtensionBlock = (analysisData: any): ExtensionBlock | null => {
  const value = getSectionValue(analysisData, 'extension', 'role_extension');
  return normalizeExtension(value);
};


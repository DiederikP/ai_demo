'use client';

interface CandidateReviewInfographicProps {
  hasResume: boolean;
  hasMotivationLetter: boolean;
  hasCompanyNote: boolean;
  hasCompanyEvaluation: boolean;
  personas: string[];
  companyNote?: string;
}

export default function CandidateReviewInfographic({
  hasResume,
  hasMotivationLetter,
  hasCompanyNote,
  hasCompanyEvaluation,
  personas,
  companyNote,
}: CandidateReviewInfographicProps) {
  const items = [
    {
      label: 'CV/Resume',
      icon: '📄',
      active: hasResume,
      color: 'barnes-violet',
    },
    {
      label: 'Motivatiebrief',
      icon: '✉️',
      active: hasMotivationLetter,
      color: 'barnes-violet',
    },
    {
      label: 'Bedrijfsnotitie',
      icon: '📝',
      active: hasCompanyNote,
      color: 'barnes-orange',
      tooltip: companyNote,
    },
    {
      label: 'Bedrijfsevaluatie',
      icon: '⭐',
      active: hasCompanyEvaluation,
      color: 'barnes-orange',
    },
  ];

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-barnes-dark-violet mb-4">
        Kandidaat Review Overzicht
      </h3>
      
      {/* Review Items */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {items.map((item, idx) => (
          <div
            key={idx}
            className={`relative p-4 rounded-lg border-2 transition-all ${
              item.active
                ? `border-${item.color} bg-${item.color}/5`
                : 'border-gray-200 bg-gray-50 opacity-50'
            }`}
          >
            <div className="text-center">
              <div className="text-3xl mb-2">{item.icon}</div>
              <p className="text-xs font-medium text-barnes-dark-violet">{item.label}</p>
              <div className="mt-2">
                {item.active ? (
                  <span className="inline-flex items-center gap-1 text-xs text-barnes-violet">
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    Inbegrepen
                  </span>
                ) : (
                  <span className="text-xs text-gray-400">Niet beschikbaar</span>
                )}
              </div>
            </div>
            {item.tooltip && item.active && (
              <div className="absolute -top-2 -right-2 w-4 h-4 bg-barnes-orange rounded-full flex items-center justify-center cursor-help group">
                <span className="text-[8px] text-white">i</span>
                <div className="absolute bottom-full right-0 mb-2 w-64 p-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                  {item.tooltip}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Personas Section */}
      <div className="border-t border-gray-200 pt-4">
        <p className="text-sm font-medium text-barnes-dark-gray mb-3">
          Digitale Werknemers die de kandidaat beoordelen:
        </p>
        {personas.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {personas.map((persona, idx) => (
              <span
                key={idx}
                className="px-3 py-1.5 rounded-full bg-barnes-violet/10 text-barnes-violet text-xs font-medium"
              >
                {persona}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-400">Nog geen evaluaties uitgevoerd</p>
        )}
      </div>
    </div>
  );
}


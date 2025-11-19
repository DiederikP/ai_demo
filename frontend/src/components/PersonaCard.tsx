'use client';

interface Persona {
  id: string;
  name: string;
  display_name: string;
  system_prompt: string;
  is_active: boolean;
  created_at: string;
}

interface PersonaCardProps {
  persona: Persona;
  isSelected: boolean;
  onSelect: (personaName: string) => void;
}

export default function PersonaCard({ persona, isSelected, onSelect }: PersonaCardProps) {
  const iconMap: { [key: string]: string } = {
    'finance': '💰',
    'hiring_manager': '👥',
    'tech_lead': '⚙️',
    'hr_specialist': '👤'
  };
  
  const colorMap: { [key: string]: string } = {
    'finance': 'border-barnes-orange bg-barnes-orange/5',
    'hiring_manager': 'border-barnes-violet bg-barnes-violet/5',
    'tech_lead': 'border-barnes-orange-red bg-barnes-orange-red/5',
    'hr_specialist': 'border-barnes-dark-violet bg-barnes-dark-violet/5'
  };

  return (
    <button
      onClick={() => onSelect(persona.name)}
      className={`p-6 rounded-2xl border-2 transition-all duration-200 hover:scale-105 ${
        isSelected
          ? `${colorMap[persona.name]} shadow-lg border-opacity-100`
          : 'border-gray-200 bg-white hover:border-gray-300 border-opacity-50'
      }`}
    >
      <div className="text-3xl mb-4">{iconMap[persona.name] || '👤'}</div>
      <div className="font-semibold text-barnes-dark-violet mb-2">{persona.display_name}</div>
      <p className="text-sm text-barnes-dark-gray text-left">
        {persona.system_prompt.substring(0, 100)}...
      </p>
    </button>
  );
}

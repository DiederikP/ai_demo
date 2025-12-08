'use client';

import { CurrencyDollarIcon, UsersIcon, CogIcon, UserIcon } from './Icons';

interface Persona {
  id: string;
  name: string;
  display_name: string;
  system_prompt: string;
  is_active: boolean;
  created_at: string;
}

interface MultiSelectPersonaCardProps {
  persona: Persona;
  isSelected: boolean;
  onToggle: (personaName: string) => void;
}

export default function MultiSelectPersonaCard({ persona, isSelected, onToggle }: MultiSelectPersonaCardProps) {
  const iconMap: { [key: string]: React.ComponentType<{ className?: string }> } = {
    'finance': CurrencyDollarIcon,
    'hiring_manager': UsersIcon,
    'tech_lead': CogIcon,
    'hr_specialist': UserIcon
  };
  
  const colorMap: { [key: string]: string } = {
    'finance': 'border-barnes-orange bg-barnes-orange/5',
    'hiring_manager': 'border-barnes-violet bg-barnes-violet/5',
    'tech_lead': 'border-barnes-blue bg-barnes-blue/5',
    'hr_specialist': 'border-barnes-dark-violet bg-barnes-dark-violet/5'
  };

  const IconComponent = iconMap[persona.name] || UserIcon;

  return (
    <button
      onClick={() => onToggle(persona.name)}
      className={`p-4 rounded-xl border-2 transition-all duration-200 hover:scale-105 relative text-left ${
        isSelected
          ? `${colorMap[persona.name]} shadow-lg border-opacity-100`
          : 'border-gray-200 bg-white hover:border-gray-300 border-opacity-50'
      }`}
    >
      {/* Selection indicator */}
      <div className={`absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center ${
        isSelected ? 'bg-barnes-violet text-white' : 'bg-gray-200'
      }`}>
        {isSelected && (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
        )}
      </div>

      <div className="mb-3">
        <IconComponent className={`w-8 h-8 ${isSelected ? 'text-barnes-violet' : 'text-barnes-dark-gray'}`} />
      </div>
      <div className="font-semibold text-barnes-dark-violet mb-2">{persona.display_name}</div>
      <p className="text-sm text-barnes-dark-gray leading-relaxed line-clamp-4">
        {persona.system_prompt}
      </p>
    </button>
  );
}

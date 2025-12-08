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

interface PersonaCardProps {
  persona: Persona;
  isSelected: boolean;
  onSelect: (personaName: string) => void;
}

export default function PersonaCard({ persona, isSelected, onSelect }: PersonaCardProps) {
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
      onClick={() => onSelect(persona.name)}
      className={`p-6 rounded-2xl border-2 transition-all duration-200 hover:scale-105 ${
        isSelected
          ? `${colorMap[persona.name]} shadow-lg border-opacity-100`
          : 'border-gray-200 bg-white hover:border-gray-300 border-opacity-50'
      }`}
    >
      <div className="mb-4">
        <IconComponent className={`w-8 h-8 ${isSelected ? 'text-barnes-violet' : 'text-barnes-dark-gray'}`} />
      </div>
      <div className="font-semibold text-barnes-dark-violet mb-2">{persona.display_name}</div>
      <p className="text-sm text-barnes-dark-gray text-left">
        {persona.system_prompt.substring(0, 100)}...
      </p>
    </button>
  );
}

'use client';

interface FeatureCardProps {
  title: string;
  desc: string;
  icon?: string;
  color?: 'orange' | 'violet' | 'blue';
}

export default function FeatureCard({ title, desc, icon = '✨', color = 'orange' }: FeatureCardProps) {
  const colorClasses = {
    orange: 'border-barnes-orange bg-barnes-orange/5',
    violet: 'border-barnes-violet bg-barnes-violet/5',
    blue: 'border-barnes-600 bg-barnes-600/5'
  };

  return (
    <div className={`card hover:scale-105 transition-transform duration-200 ${colorClasses[color]}`}>
      <div className="text-3xl mb-4">{icon}</div>
      <div className="text-xl font-semibold text-barnes-dark-violet mb-3">{title}</div>
      <p className="text-sm text-barnes-dark-gray leading-relaxed">{desc}</p>
    </div>
  );
}

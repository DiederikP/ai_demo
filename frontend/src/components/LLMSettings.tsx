'use client';

import { useState, useEffect } from 'react';

interface LLMSettings {
  max_tokens_evaluation: number;
  max_tokens_debate: number;
  max_tokens_job_analysis: number;
  truncation_enabled: boolean;
  truncation_disabled: boolean;
  prompt_density_multiplier: number;
}

/**
 * LLM Settings Component
 * Control truncation without reverting to expensive models
 * Increase information density of prompt before ingestion into next LLM functionality
 */
export default function LLMSettings() {
  const [settings, setSettings] = useState<LLMSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [disableTruncation, setDisableTruncation] = useState(false);
  const [promptDensity, setPromptDensity] = useState(1.0);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const response = await fetch('/api/llm-settings');
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.settings) {
          setSettings(data.settings);
          setDisableTruncation(data.settings.truncation_disabled || false);
          setPromptDensity(data.settings.prompt_density_multiplier || 1.0);
        }
      }
    } catch (error) {
      console.error('Error loading LLM settings:', error);
      setMessage('Fout bij laden van instellingen');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setMessage(null);
    
    try {
      const formData = new FormData();
      formData.append('disable_truncation', disableTruncation.toString());
      formData.append('prompt_density_multiplier', promptDensity.toString());

      const response = await fetch('/api/llm-settings/truncation', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        let errorMessage = 'Failed to save settings';
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
      if (data.success) {
        setMessage('✅ Instellingen opgeslagen');
        setTimeout(() => setMessage(null), 5000);
        // Reload settings
        await loadSettings();
      } else {
        throw new Error('Failed to save settings');
      }
    } catch (error: any) {
      setMessage(`❌ Fout: ${error.message}`);
      setTimeout(() => setMessage(null), 5000);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="bg-surface rounded-xl border border-border p-6 notion-block">
        <p className="text-secondary">Laden...</p>
      </div>
    );
  }

  return (
    <div className="bg-surface rounded-xl border border-border p-6 notion-block">
      <h3 className="text-lg font-semibold text-primary mb-4">⚙️ LLM Instellingen</h3>

      {message && (
        <div className={`mb-4 p-3 rounded-lg text-sm border ${
          message.includes('❌') 
            ? 'bg-red-50 border-red-200 text-red-700'
            : 'bg-green-50 border-green-200 text-green-700'
        }`}>
          {message}
        </div>
      )}

      <div className="space-y-4">
        {/* Truncation Control */}
        <div className="p-4 bg-surface-alt rounded-lg border border-border">
          <div className="flex items-center justify-between mb-2">
            <div className="flex-1">
              <div className="text-sm font-medium text-primary">Truncatie Uitschakelen</div>
              <div className="text-xs text-secondary mt-1">
                Voorkomt dat tekst wordt afgekapt zonder over te stappen op duurdere modellen
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer ml-4">
              <input
                type="checkbox"
                checked={disableTruncation}
                onChange={(e) => setDisableTruncation(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-border peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-barnes-violet/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-border after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-barnes-violet"></div>
            </label>
          </div>
          {disableTruncation && (
            <div className="mt-2 text-xs text-yellow-700 bg-yellow-50 p-2 rounded border border-yellow-200">
              ⚠️ Truncatie uitgeschakeld - dit kan leiden tot hogere token kosten
            </div>
          )}
        </div>

        {/* Prompt Density */}
        <div className="p-4 bg-surface-alt rounded-lg border border-border">
          <div className="mb-3">
            <div className="text-sm font-medium text-primary mb-1">
              Prompt Informatiedichtheid
            </div>
            <div className="text-xs text-secondary">
              Verhoog de informatiedichtheid van de prompt voordat deze naar de volgende LLM functionaliteit wordt gestuurd
            </div>
          </div>
          <div className="flex items-center gap-4 mb-2">
            <input
              type="range"
              min="0.5"
              max="2.0"
              step="0.1"
              value={promptDensity}
              onChange={(e) => setPromptDensity(Number(e.target.value))}
              className="flex-1 h-2 bg-border rounded-lg appearance-none cursor-pointer"
            />
            <span className="text-sm font-medium text-primary w-16 text-right">
              {promptDensity.toFixed(1)}x
            </span>
          </div>
          <div className="text-xs text-secondary">
            {promptDensity < 1.0 && '🔽 Lager: Minder informatie per prompt (lagere kosten)'}
            {promptDensity === 1.0 && '➡️ Standaard: Normale informatiedichtheid'}
            {promptDensity > 1.0 && '🔼 Hoger: Meer informatie per prompt (kan kosten verhogen, maar betere resultaten)'}
          </div>
        </div>

        {/* Current Settings Display */}
        {settings && (
          <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
            <div className="text-sm font-medium text-primary mb-2">Huidige Token Limieten</div>
            <div className="grid grid-cols-3 gap-3 text-xs">
              <div>
                <div className="text-secondary mb-1">Evaluatie</div>
                <div className="font-medium text-primary">{settings.max_tokens_evaluation}</div>
              </div>
              <div>
                <div className="text-secondary mb-1">Debat</div>
                <div className="font-medium text-primary">{settings.max_tokens_debate}</div>
              </div>
              <div>
                <div className="text-secondary mb-1">Job Analyse</div>
                <div className="font-medium text-primary">{settings.max_tokens_job_analysis}</div>
              </div>
            </div>
          </div>
        )}

        {/* Save Button */}
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="w-full px-4 py-2 bg-barnes-violet text-white rounded-lg hover:bg-barnes-dark-violet disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-120 font-medium"
        >
          {isSaving ? 'Opslaan...' : '💾 Instellingen Opslaan'}
        </button>
      </div>
    </div>
  );
}

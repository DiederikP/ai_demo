'use client';

import { useState } from 'react';

interface Persona {
  id: string;
  name: string;
  display_name: string;
  system_prompt: string;
  is_active: boolean;
  created_at: string;
}

interface PersonaManagerProps {
  personas: Persona[];
  onPersonasChange: () => void;
}

export default function PersonaManager({ personas, onPersonasChange }: PersonaManagerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [editingPersona, setEditingPersona] = useState<Persona | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    display_name: '',
    system_prompt: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const response = await fetch('/api/personas', {
        method: editingPersona ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          ...(editingPersona && { id: editingPersona.id })
        })
      });

      if (response.ok) {
        onPersonasChange();
        setIsOpen(false);
        setEditingPersona(null);
        setFormData({ name: '', display_name: '', system_prompt: '' });
      }
    } catch (error) {
      console.error('Error saving persona:', error);
    }
  };

  const handleDelete = async (personaId: string) => {
    if (!confirm('Are you sure you want to delete this persona?')) return;
    
    try {
      const response = await fetch(`/api/personas?id=${personaId}`, { method: 'DELETE' });
      if (response.ok) {
        onPersonasChange();
      }
    } catch (error) {
      console.error('Error deleting persona:', error);
    }
  };

  const handleEdit = (persona: Persona) => {
    setEditingPersona(persona);
    setFormData({
      name: persona.name,
      display_name: persona.display_name,
      system_prompt: persona.system_prompt
    });
    setIsOpen(true);
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="btn-secondary text-sm"
      >
        Manage Personas
      </button>

      {isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setIsOpen(false);
              setEditingPersona(null);
              setFormData({ name: '', display_name: '', system_prompt: '' });
            }
          }}
        >
          <div
            className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-xl font-semibold text-barnes-dark-violet">
                {editingPersona ? 'Edit Persona' : 'Create Persona'}
              </h3>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto max-h-[60vh]">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2 text-barnes-dark-violet">Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="input-field"
                    placeholder="e.g., finance, tech_lead"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2 text-barnes-dark-violet">Display Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.display_name}
                    onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                    className="input-field"
                    placeholder="e.g., Finance Director"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2 text-barnes-dark-violet">System Prompt *</label>
                <textarea
                  required
                  rows={8}
                  value={formData.system_prompt}
                  onChange={(e) => setFormData({ ...formData, system_prompt: e.target.value })}
                  className="input-field"
                  placeholder="Define the persona's evaluation approach..."
                />
              </div>
              
              <div className="flex gap-4 pt-4">
                <button type="submit" className="btn-primary flex-1">
                  {editingPersona ? 'Update Persona' : 'Create Persona'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    setEditingPersona(null);
                    setFormData({ name: '', display_name: '', system_prompt: '' });
                  }}
                  className="btn-secondary flex-1"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Personas List */}
      <div className="mt-6 space-y-3">
        {personas.map((persona) => (
          <div key={persona.id} className="card flex items-start justify-between">
            <div className="flex-1 pr-4">
              <h4 className="font-semibold text-barnes-dark-violet">{persona.display_name}</h4>
              <p className="text-sm text-barnes-dark-gray">{persona.name}</p>
              <p className="text-xs text-gray-500 mt-1 line-clamp-2">{persona.system_prompt}</p>
            </div>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => handleEdit(persona)}
                className="px-3 py-1 text-xs bg-barnes-violet text-white rounded-lg hover:bg-barnes-dark-violet transition-colors duration-200"
              >
                Edit
              </button>
              <button
                onClick={() => handleDelete(persona.id)}
                className="px-3 py-1 text-xs bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors duration-200"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

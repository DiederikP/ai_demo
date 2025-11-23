'use client';

import { useState } from 'react';

interface DuplicateCandidateModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingCandidate: {
    id: string;
    name: string;
    email: string;
    source_name?: string;
  };
  onOverwrite: () => void;
  onInterrupt: () => void;
  onForceAdd: () => void;
}

export default function DuplicateCandidateModal({
  isOpen,
  onClose,
  existingCandidate,
  onOverwrite,
  onInterrupt,
  onForceAdd,
}: DuplicateCandidateModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl p-6 max-w-md w-full mx-4">
        <h2 className="text-2xl font-bold text-barnes-dark-violet mb-4">
          Kandidaat bestaat al
        </h2>
        
        <div className="mb-6">
          <p className="text-barnes-dark-gray mb-4">
            Deze kandidaat is al eerder ingediend{existingCandidate.source_name ? ` door ${existingCandidate.source_name}` : ''}.
          </p>
          
          <div className="bg-barnes-light-gray rounded-lg p-4 mb-4">
            <p className="text-sm font-medium text-barnes-dark-violet mb-2">Bestaande kandidaat:</p>
            <p className="text-sm text-barnes-dark-gray">{existingCandidate.name}</p>
            {existingCandidate.email && (
              <p className="text-sm text-barnes-dark-gray">{existingCandidate.email}</p>
            )}
          </div>
          
          <p className="text-sm text-barnes-dark-gray mb-4">
            Wat wil je doen?
          </p>
        </div>

        <div className="space-y-3">
          <button
            onClick={() => {
              onOverwrite();
              onClose();
            }}
            className="w-full px-4 py-2 bg-barnes-violet text-white rounded-lg hover:bg-barnes-dark-violet transition-colors"
          >
            Overschrijven
          </button>
          
          <button
            onClick={() => {
              onInterrupt();
              onClose();
            }}
            className="w-full px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-colors"
          >
            Onderbreken
          </button>
          
          <button
            onClick={() => {
              onForceAdd();
              onClose();
            }}
            className="w-full px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
          >
            Toch toevoegen
          </button>
          
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
          >
            Annuleren
          </button>
        </div>
      </div>
    </div>
  );
}


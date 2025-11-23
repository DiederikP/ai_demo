'use client';

import { useState, useEffect } from 'react';

interface UserCompany {
  id: string;
  name: string;
  primary_domain?: string | null;
  plan?: string | null;
}

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  company?: UserCompany | null;
}

interface UserSelectorProps {
  selectedUserIds: string[];
  onChange: (userIds: string[]) => void;
  label?: string;
  placeholder?: string;
}

export default function UserSelector({
  selectedUserIds,
  onChange,
  label = "Selecteer gebruikers",
  placeholder = "Zoek gebruikers..."
}: UserSelectorProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/users');
      const data = await response.json();
      if (data.success) {
        setUsers(data.users || []);
      }
    } catch (error) {
      console.error('Error loading users:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredUsers = users.filter(user =>
    user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const selectedUsers = users.filter(u => selectedUserIds.includes(u.id));

  const toggleUser = (userId: string) => {
    if (selectedUserIds.includes(userId)) {
      onChange(selectedUserIds.filter(id => id !== userId));
    } else {
      onChange([...selectedUserIds, userId]);
    }
  };

  const removeUser = (userId: string) => {
    onChange(selectedUserIds.filter(id => id !== userId));
  };

  return (
    <div className="relative">
      <label className="block text-sm font-medium text-barnes-dark-gray mb-2">
        {label}
      </label>
      
      {/* Selected Users */}
      {selectedUsers.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {selectedUsers.map(user => (
            <span
              key={user.id}
              className="inline-flex items-center gap-1 px-3 py-1 bg-barnes-violet/10 text-barnes-violet rounded-full text-sm"
            >
              {user.name}
              <button
                onClick={() => removeUser(user.id)}
                className="hover:text-barnes-dark-violet"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Dropdown */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg text-left flex items-center justify-between hover:border-barnes-violet transition-colors"
        >
          <span className={selectedUserIds.length === 0 ? 'text-gray-400' : 'text-barnes-dark-violet'}>
            {selectedUserIds.length === 0 ? placeholder : `${selectedUserIds.length} geselecteerd`}
          </span>
          <svg
            className={`w-5 h-5 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {isOpen && (
          <>
            <div
              className="fixed inset-0 z-10"
              onClick={() => setIsOpen(false)}
            />
            <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-hidden">
              {/* Search */}
              <div className="p-2 border-b border-gray-200">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Zoek gebruikers..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-barnes-violet focus:border-transparent"
                  onClick={(e) => e.stopPropagation()}
                />
              </div>

              {/* Users List */}
              <div className="max-h-48 overflow-y-auto">
                {isLoading ? (
                  <div className="p-4 text-center text-sm text-barnes-dark-gray">
                    Laden...
                  </div>
                ) : filteredUsers.length === 0 ? (
                  <div className="p-4 text-center text-sm text-barnes-dark-gray">
                    Geen gebruikers gevonden
                  </div>
                ) : (
                  filteredUsers.map(user => (
                    <label
                      key={user.id}
                      className="flex items-center gap-3 p-3 hover:bg-gray-50 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedUserIds.includes(user.id)}
                        onChange={() => toggleUser(user.id)}
                        className="w-4 h-4 text-barnes-violet border-gray-300 rounded focus:ring-barnes-violet"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-barnes-dark-violet">{user.name}</p>
                        <p className="text-xs text-barnes-dark-gray">
                          {user.email}
                          {user.company?.name && (
                            <span className="ml-1 text-barnes-violet">
                              • {user.company.name}
                            </span>
                          )}
                        </p>
                      </div>
                      {user.role && (
                        <span className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded">
                          {user.role}
                        </span>
                      )}
                    </label>
                  ))
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}


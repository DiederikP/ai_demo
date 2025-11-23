'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, login as loginApi, logout as logoutApi, getCurrentUser, getStoredUser, isAuthenticated as checkAuth, getAuthToken } from '../lib/auth';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load user on mount
  useEffect(() => {
    const loadUser = async () => {
      setIsLoading(true);
      
      // First check stored user
      const storedUser = getStoredUser();
      if (storedUser && checkAuth()) {
        setUser(storedUser);
        // Verify token is still valid by fetching current user
        try {
          const currentUser = await getCurrentUser();
          setUser(currentUser);
        } catch (error) {
          console.error('Failed to verify user:', error);
          setUser(null);
        }
      }
      
      setIsLoading(false);
    };
    
    loadUser();
  }, []);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      console.log('[AuthContext] Calling loginApi...');
      const response = await loginApi(email, password);
      console.log('[AuthContext] Login successful, setting user:', response.user);
      setUser(response.user);
    } catch (error: any) {
      console.error('[AuthContext] Login error:', error);
      console.error('[AuthContext] Error details:', {
        message: error?.message,
        error: error?.error,
        detail: error?.detail,
        name: error?.name,
        stack: error?.stack
      });
      // Re-throw the error so the login page can handle it
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    logoutApi();
    setUser(null);
  };

  const refreshUser = async () => {
    setIsLoading(true);
    try {
      const currentUser = await getCurrentUser();
      setUser(currentUser);
    } catch (error) {
      console.error('Failed to refresh user:', error);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user && checkAuth(),
        login,
        logout,
        refreshUser
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}


'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuth } from './AuthContext';

interface Company {
  id: string;
  name: string;
  slug: string;
  primary_domain?: string | null;
  plan?: string | null;
  status?: string | null;
}

interface CompanyContextType {
  selectedCompany: Company | null;
  companies: Company[];
  isLoading: boolean;
  setSelectedCompany: (company: Company | null) => void;
  loadCompanies: () => Promise<void>;
}

const CompanyContext = createContext<CompanyContextType | undefined>(undefined);

export function CompanyProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [selectedCompany, setSelectedCompanyState] = useState<Company | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadCompanies = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/companies');
      if (response.ok) {
        const data = await response.json();
        setCompanies(data.companies || []);
        
        // If user has a company_id, select that company
        if (user?.company_id && !selectedCompany) {
          const userCompany = (data.companies || []).find((c: Company) => c.id === user.company_id);
          if (userCompany) {
            setSelectedCompanyState(userCompany);
            localStorage.setItem('selected_company_id', userCompany.id);
          }
        } else if (!selectedCompany && data.companies && data.companies.length > 0) {
          // Otherwise select first company or previously selected
          const storedCompanyId = localStorage.getItem('selected_company_id');
          const company = storedCompanyId 
            ? data.companies.find((c: Company) => c.id === storedCompanyId)
            : data.companies[0];
          if (company) {
            setSelectedCompanyState(company);
            localStorage.setItem('selected_company_id', company.id);
          }
        }
      }
    } catch (error) {
      console.error('Error loading companies:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const setSelectedCompany = (company: Company | null) => {
    setSelectedCompanyState(company);
    if (company) {
      localStorage.setItem('selected_company_id', company.id);
    } else {
      localStorage.removeItem('selected_company_id');
    }
  };

  useEffect(() => {
    loadCompanies();
  }, [user?.company_id]);

  // Load previously selected company on mount
  useEffect(() => {
    const storedCompanyId = localStorage.getItem('selected_company_id');
    if (storedCompanyId && companies.length > 0 && !selectedCompany) {
      const company = companies.find(c => c.id === storedCompanyId);
      if (company) {
        setSelectedCompanyState(company);
      }
    }
  }, [companies]);

  return (
    <CompanyContext.Provider
      value={{
        selectedCompany,
        companies,
        isLoading,
        setSelectedCompany,
        loadCompanies
      }}
    >
      {children}
    </CompanyContext.Provider>
  );
}

export function useCompany() {
  const context = useContext(CompanyContext);
  if (context === undefined) {
    throw new Error('useCompany must be used within a CompanyProvider');
  }
  return context;
}


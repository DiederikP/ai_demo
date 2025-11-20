'use client';

import { useCompany } from '../contexts/CompanyContext';

/**
 * Hook to get company_id for API filtering
 * Returns company_id parameter for use in API calls
 */
export function useCompanyFilter() {
  const { selectedCompany } = useCompany();
  
  const getCompanyParam = (): string => {
    if (selectedCompany?.id) {
      return `company_id=${selectedCompany.id}`;
    }
    return '';
  };
  
  const getCompanyId = (): string | null => {
    return selectedCompany?.id || null;
  };
  
  const appendCompanyParam = (url: string): string => {
    const companyId = selectedCompany?.id;
    if (!companyId) return url;
    
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}company_id=${companyId}`;
  };
  
  return {
    selectedCompany,
    companyId: selectedCompany?.id || null,
    getCompanyParam,
    getCompanyId,
    appendCompanyParam
  };
}


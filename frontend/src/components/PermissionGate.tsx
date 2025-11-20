'use client';

import { ReactNode } from 'react';
import { usePermissions } from '../hooks/usePermissions';

interface PermissionGateProps {
  resource: string;
  action?: string;
  fallback?: ReactNode;
  children: ReactNode;
}

/**
 * Component that conditionally renders children based on user permissions
 */
export default function PermissionGate({
  resource,
  action = 'read',
  fallback = null,
  children
}: PermissionGateProps) {
  const { hasPermission } = usePermissions();
  
  if (!hasPermission(resource, action)) {
    return <>{fallback}</>;
  }
  
  return <>{children}</>;
}


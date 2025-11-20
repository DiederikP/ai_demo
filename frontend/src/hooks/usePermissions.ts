'use client';

import { useAuth } from '../contexts/AuthContext';
import {
  hasPermission,
  canWrite,
  canDelete,
  canCreate,
  canUpdate,
  isAdmin,
  isRecruiterOrHigher,
  UserRole
} from '../lib/permissions';

/**
 * Hook for checking permissions based on current user role
 */
export function usePermissions() {
  const { user } = useAuth();
  const role = (user?.role || 'user') as UserRole;

  return {
    role,
    hasPermission: (resource: string, action: string = 'read') => 
      hasPermission(role, resource, action),
    canWrite: (resource: string) => canWrite(role, resource),
    canDelete: (resource: string) => canDelete(role, resource),
    canCreate: (resource: string) => canCreate(role, resource),
    canUpdate: (resource: string) => canUpdate(role, resource),
    isAdmin: () => isAdmin(role),
    isRecruiterOrHigher: () => isRecruiterOrHigher(role),
  };
}


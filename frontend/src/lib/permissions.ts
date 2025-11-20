/**
 * Permission system for role-based access control
 */

export type UserRole = 'admin' | 'recruiter' | 'viewer' | 'user';

export interface Permission {
  resource: string;
  action: string;
}

/**
 * Permission definitions by role
 */
const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  admin: [
    // Full access to everything
    { resource: '*', action: '*' },
  ],
  recruiter: [
    // Can manage candidates
    { resource: 'candidates', action: '*' },
    // Can manage jobs
    { resource: 'jobs', action: '*' },
    // Can create evaluations
    { resource: 'evaluations', action: 'create' },
    { resource: 'evaluations', action: 'read' },
    // Can create debates
    { resource: 'debates', action: 'create' },
    { resource: 'debates', action: 'read' },
    // Can view results
    { resource: 'results', action: 'read' },
    // Can view personas
    { resource: 'personas', action: 'read' },
    // Cannot manage personas (only admins can)
    // Cannot manage users (only admins can)
  ],
  viewer: [
    // Read-only access
    { resource: 'candidates', action: 'read' },
    { resource: 'jobs', action: 'read' },
    { resource: 'evaluations', action: 'read' },
    { resource: 'debates', action: 'read' },
    { resource: 'results', action: 'read' },
    { resource: 'personas', action: 'read' },
  ],
  user: [
    // Default user role - same as viewer
    { resource: 'candidates', action: 'read' },
    { resource: 'jobs', action: 'read' },
    { resource: 'evaluations', action: 'read' },
    { resource: 'debates', action: 'read' },
    { resource: 'results', action: 'read' },
    { resource: 'personas', action: 'read' },
  ],
};

/**
 * Check if a role has permission for a specific resource and action
 */
export function hasPermission(
  role: UserRole | string | undefined | null,
  resource: string,
  action: string = 'read'
): boolean {
  if (!role) return false;
  
  const normalizedRole = role.toLowerCase() as UserRole;
  const permissions = ROLE_PERMISSIONS[normalizedRole] || ROLE_PERMISSIONS.user;
  
  // Check for admin (full access)
  if (permissions.some(p => p.resource === '*' && p.action === '*')) {
    return true;
  }
  
  // Check for exact match
  if (permissions.some(p => p.resource === resource && p.action === action)) {
    return true;
  }
  
  // Check for wildcard resource
  if (permissions.some(p => p.resource === resource && p.action === '*')) {
    return true;
  }
  
  // Check for wildcard action on resource
  if (permissions.some(p => p.resource === '*' && p.action === action)) {
    return true;
  }
  
  return false;
}

/**
 * Check if role can perform write operations (create, update, delete)
 */
export function canWrite(role: UserRole | string | undefined | null, resource: string): boolean {
  return hasPermission(role, resource, 'create') || 
         hasPermission(role, resource, 'update') || 
         hasPermission(role, resource, 'delete');
}

/**
 * Check if role can delete
 */
export function canDelete(role: UserRole | string | undefined | null, resource: string): boolean {
  return hasPermission(role, resource, 'delete') || hasPermission(role, resource, '*');
}

/**
 * Check if role can create
 */
export function canCreate(role: UserRole | string | undefined | null, resource: string): boolean {
  return hasPermission(role, resource, 'create') || hasPermission(role, resource, '*');
}

/**
 * Check if role can update
 */
export function canUpdate(role: UserRole | string | undefined | null, resource: string): boolean {
  return hasPermission(role, resource, 'update') || hasPermission(role, resource, '*');
}

/**
 * Check if role is admin
 */
export function isAdmin(role: UserRole | string | undefined | null): boolean {
  return role?.toLowerCase() === 'admin';
}

/**
 * Check if role is recruiter or higher
 */
export function isRecruiterOrHigher(role: UserRole | string | undefined | null): boolean {
  const normalizedRole = role?.toLowerCase();
  return normalizedRole === 'admin' || normalizedRole === 'recruiter';
}


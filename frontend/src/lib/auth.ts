/**
 * Authentication utilities for managing user sessions and tokens
 */

export interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  company_id?: string | null;
  is_active?: boolean;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: User;
}

const TOKEN_KEY = 'auth_token';
const USER_KEY = 'auth_user';

/**
 * Get the stored authentication token
 */
export function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

/**
 * Store authentication token
 */
export function setAuthToken(token: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(TOKEN_KEY, token);
}

/**
 * Remove authentication token
 */
export function removeAuthToken(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

/**
 * Get the stored user data
 */
export function getStoredUser(): User | null {
  if (typeof window === 'undefined') return null;
  const userStr = localStorage.getItem(USER_KEY);
  if (!userStr) return null;
  try {
    return JSON.parse(userStr);
  } catch {
    return null;
  }
}

/**
 * Store user data
 */
export function setStoredUser(user: User): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

/**
 * Check if user is authenticated
 */
export function isAuthenticated(): boolean {
  return !!getAuthToken();
}

/**
 * Get authorization header for API requests
 */
export function getAuthHeader(): { Authorization: string } | {} {
  const token = getAuthToken();
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}

/**
 * Get headers with authentication for API requests
 */
export function getAuthHeaders(additionalHeaders: Record<string, string> = {}): HeadersInit {
  const token = getAuthToken();
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...additionalHeaders
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

/**
 * Get auth headers without Content-Type (for FormData requests)
 * Browser will automatically set Content-Type with boundary for FormData
 */
export function getAuthHeadersForFormData(): HeadersInit {
  const token = getAuthToken();
  const headers: HeadersInit = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

/**
 * Login function - call the API and store tokens
 */
export async function login(email: string, password: string): Promise<AuthResponse> {
  // Normalize email to lowercase (backend stores emails in lowercase)
  const normalizedEmail = email.toLowerCase().trim();
  
  console.log(`[Auth] Attempting login for: ${normalizedEmail}`);
  console.log(`[Auth] Using Next.js API route for login`);
  
  try {
    // Use Next.js API route instead of calling backend directly
    // This avoids CORS issues and allows better error handling
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: normalizedEmail, password })
    });

    console.log(`[Auth] Login response status: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      let errorDetail = 'Login failed';
      try {
        const error = await response.json();
        errorDetail = error.error || error.detail || errorDetail;
        console.error(`[Auth] Login error response:`, error);
      } catch (e) {
        const errorText = await response.text().catch(() => 'Unknown error');
        console.error(`[Auth] Login error (non-JSON):`, errorText);
        errorDetail = errorText || `HTTP ${response.status}: ${response.statusText}`;
      }
      throw new Error(errorDetail);
    }

    const data: AuthResponse = await response.json();
    console.log(`[Auth] Login successful for user:`, data.user.email);
    
    // Store token and user data
    setAuthToken(data.access_token);
    setStoredUser(data.user);
    
    return data;
  } catch (error: any) {
    console.error(`[Auth] Login error caught:`, error);
    console.error(`[Auth] Error type:`, error?.name);
    console.error(`[Auth] Error message:`, error?.message);
    console.error(`[Auth] Error stack:`, error?.stack);
    
    // Extract meaningful error message
    let errorMessage = 'Login failed';
    
    if (error?.message) {
      errorMessage = error.message;
    } else if (error?.error) {
      errorMessage = error.error;
    } else if (error?.detail) {
      errorMessage = error.detail;
    } else if (typeof error === 'string') {
      errorMessage = error;
    } else if (error?.toString && error.toString() !== '[object Object]') {
      errorMessage = error.toString();
    }
    
    // Create a new error with the extracted message
    const loginError = new Error(errorMessage);
    (loginError as any).originalError = error;
    throw loginError;
  }
}

/**
 * Logout function - clear stored tokens
 */
export function logout(): void {
  removeAuthToken();
  if (typeof window !== 'undefined') {
    window.location.href = '/company/login';
  }
}

/**
 * Get current user - fetch from API with stored token
 */
export async function getCurrentUser(): Promise<User | null> {
  const token = getAuthToken();
  if (!token) return null;

  const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
  
  try {
    const response = await fetch(`${BACKEND_URL}/auth/me`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      removeAuthToken();
      return null;
    }

    const user: User = await response.json();
    setStoredUser(user);
    return user;
  } catch (error) {
    console.error('Error fetching current user:', error);
    removeAuthToken();
    return null;
  }
}


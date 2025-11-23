import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    // Normalize email to lowercase (backend stores emails in lowercase)
    const normalizedEmail = email.toLowerCase().trim();

    console.log(`[API /auth/login] ========== LOGIN REQUEST ==========`);
    console.log(`[API /auth/login] Email: ${normalizedEmail}`);
    console.log(`[API /auth/login] Backend URL: ${BACKEND_URL}`);
    console.log(`[API /auth/login] Attempting login...`);

    let response;
    try {
      response = await fetch(`${BACKEND_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          email: normalizedEmail, 
          password 
        })
      });

      console.log(`[API /auth/login] Response status: ${response.status} ${response.statusText}`);
    } catch (fetchError: any) {
      console.error(`[API /auth/login] ========== FETCH ERROR ==========`);
      console.error(`[API /auth/login] Error type:`, fetchError.name);
      console.error(`[API /auth/login] Error message:`, fetchError.message);
      console.error(`[API /auth/login] Error cause:`, fetchError.cause);
      console.error(`[API /auth/login] ===================================`);

      const errorMsg = fetchError.message || fetchError.toString() || 'Unknown error';

      if (errorMsg.includes('fetch') || 
          errorMsg.includes('ECONNREFUSED') || 
          errorMsg.includes('NetworkError') ||
          errorMsg.includes('Failed to fetch') ||
          fetchError.code === 'ECONNREFUSED') {
        return NextResponse.json(
          { 
            error: `Cannot connect to backend server at ${BACKEND_URL}. Please ensure the backend is running.`,
            details: errorMsg,
            backend_url: BACKEND_URL
          },
          { status: 503 }
        );
      }

      return NextResponse.json(
        { error: `Failed to connect to backend: ${errorMsg}`, details: errorMsg },
        { status: 500 }
      );
    }

    if (!response.ok) {
      let errorDetail = 'Login failed';
      let errorObj: any = null;
      
      try {
        errorObj = await response.json();
        // Extract error message from various possible fields
        errorDetail = errorObj.detail || errorObj.error || errorObj.message || errorDetail;
        
        // If errorDetail is still generic, try to extract from nested objects
        if (errorDetail === 'Login failed' && errorObj) {
          if (typeof errorObj === 'string') {
            errorDetail = errorObj;
          } else if (errorObj.error && typeof errorObj.error === 'string') {
            errorDetail = errorObj.error;
          } else if (errorObj.detail && typeof errorObj.detail === 'string') {
            errorDetail = errorObj.detail;
          }
        }
        
        console.error(`[API /auth/login] Backend returned error:`, JSON.stringify(errorObj, null, 2));
      } catch (e) {
        const errorText = await response.text().catch(() => 'Unknown error');
        console.error(`[API /auth/login] Backend error (non-JSON):`, errorText);
        errorDetail = errorText || `HTTP ${response.status}: ${response.statusText}`;
      }

      // Ensure errorDetail is always a string
      if (typeof errorDetail !== 'string' || errorDetail === '[object Object]') {
        errorDetail = `Login failed: ${response.status} ${response.statusText}`;
      }

      return NextResponse.json(
        { error: errorDetail },
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log(`[API /auth/login] ========== LOGIN SUCCESS ==========`);
    console.log(`[API /auth/login] User: ${data.user?.email || 'Unknown'}`);
    
    return NextResponse.json(data);
  } catch (error: any) {
    console.error(`[API /auth/login] ========== UNEXPECTED ERROR ==========`);
    console.error(`[API /auth/login] Error:`, error);
    console.error(`[API /auth/login] Error type:`, error?.name);
    console.error(`[API /auth/login] Message:`, error?.message);
    console.error(`[API /auth/login] Stack:`, error?.stack);
    console.error(`[API /auth/login] Full error:`, JSON.stringify(error, Object.getOwnPropertyNames(error)));
    console.error(`[API /auth/login] ======================================`);

    // Extract meaningful error message
    let errorMessage = 'Login failed';
    let errorDetails = 'Unknown error';
    
    if (error?.message) {
      errorMessage = error.message;
      errorDetails = error.message;
    } else if (error?.error) {
      errorMessage = error.error;
      errorDetails = error.error;
    } else if (typeof error === 'string') {
      errorMessage = error;
      errorDetails = error;
    } else {
      errorDetails = error?.toString() || JSON.stringify(error);
    }

    return NextResponse.json(
      { 
        error: errorMessage, 
        details: errorDetails,
        type: error?.name || 'UnknownError'
      },
      { status: 500 }
    );
  }
}


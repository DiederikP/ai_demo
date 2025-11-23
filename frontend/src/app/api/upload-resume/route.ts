import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    
    // Get authorization header and forward it to backend
    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
    
    // Don't set Content-Type header - browser will set it automatically with boundary for FormData
    // Setting it manually can cause issues with multipart/form-data
    const headers: HeadersInit = {};
    if (authHeader) {
      headers['Authorization'] = authHeader;
    }
    
    // The backend will extract company_id from the authenticated user
    // If user is a recruiter, it will automatically set submitted_by_company_id
    
    const backendResponse = await fetch(`${BACKEND_URL}/upload-resume`, {
      method: 'POST',
      headers,
      body: formData, // FormData will set Content-Type automatically with boundary
    });

    if (!backendResponse.ok) {
      const errorText = await backendResponse.text();
      let errorData: any = { error: errorText || 'Failed to upload resume' };
      
      try {
        errorData = JSON.parse(errorText);
      } catch {
        // Not JSON, use text as error message
        errorData = { 
          error: errorText || `Server error: ${backendResponse.status} ${backendResponse.statusText}`,
          detail: errorText 
        };
      }
      
      console.error('[upload-resume API] Backend error:', {
        status: backendResponse.status,
        statusText: backendResponse.statusText,
        errorData,
        errorText: errorText.substring(0, 500)
      });
      
      return NextResponse.json(
        errorData,
        { status: backendResponse.status }
      );
    }

    const result = await backendResponse.json();
    return NextResponse.json(result);

  } catch (error: any) {
    console.error('Error in /api/upload-resume:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}


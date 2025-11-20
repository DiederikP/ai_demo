import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get('job_id');
    
    // Get authorization header from the incoming request
    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
    
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    
    // Forward authorization header if present
    if (authHeader) {
      headers['Authorization'] = authHeader;
    }
    
    const url = jobId 
      ? `${BACKEND_URL}/recruiter/candidates?job_id=${jobId}`
      : `${BACKEND_URL}/recruiter/candidates`;
    
    console.log(`[API /recruiter/candidates] ========== REQUEST START ==========`);
    console.log(`[API /recruiter/candidates] BACKEND_URL: ${BACKEND_URL}`);
    console.log(`[API /recruiter/candidates] Auth header present:`, !!authHeader);
    console.log(`[API /recruiter/candidates] Target URL: ${url}`);
    
    let response;
    try {
      console.log(`[API /recruiter/candidates] Starting fetch...`);
      response = await fetch(url, {
        method: 'GET',
        headers
      });
      console.log(`[API /recruiter/candidates] Fetch completed with status: ${response.status} ${response.statusText}`);
    } catch (fetchError: any) {
      console.error(`[API /recruiter/candidates] ========== FETCH ERROR ==========`);
      console.error(`[API /recruiter/candidates] Error type:`, fetchError.name);
      console.error(`[API /recruiter/candidates] Error message:`, fetchError.message);
      console.error(`[API /recruiter/candidates] Error cause:`, fetchError.cause);
      console.error(`[API /recruiter/candidates] ===================================`);
      
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
        { error: `Failed to fetch from backend: ${errorMsg}`, details: errorMsg },
        { status: 500 }
      );
    }

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      console.error(`[API /recruiter/candidates] Backend returned error status ${response.status}:`, errorText);
      return NextResponse.json(
        { error: errorText || `Backend returned ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log(`[API /recruiter/candidates] ========== REQUEST SUCCESS ==========`);
    return NextResponse.json(data);
  } catch (error: any) {
    console.error(`[API /recruiter/candidates] ========== UNEXPECTED ERROR ==========`);
    console.error(`[API /recruiter/candidates] Error:`, error);
    console.error(`[API /recruiter/candidates] Message:`, error.message);
    console.error(`[API /recruiter/candidates] ======================================`);
    
    return NextResponse.json(
      { error: error.message || 'Failed to fetch recruiter candidates', details: error.toString() },
      { status: 500 }
    );
  }
}

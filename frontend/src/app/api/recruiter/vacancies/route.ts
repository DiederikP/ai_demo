import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';

export async function GET(request: NextRequest) {
  try {
    // Get authorization header from the incoming request (try both lowercase and capitalized)
    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
    
    // Get include_new parameter from query string
    const searchParams = request.nextUrl.searchParams;
    const includeNew = searchParams.get('include_new') === 'true';
    
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    
    // Forward authorization header if present
    if (authHeader) {
      headers['Authorization'] = authHeader;
    }
    
    // Build URL with query parameter
    const url = `${BACKEND_URL}/recruiter/vacancies${includeNew ? '?include_new=true' : ''}`;
    
    // Log all headers for debugging
    const allHeaders: Record<string, string> = {};
    request.headers.forEach((value, key) => {
      allHeaders[key] = value;
    });
    
    console.log(`[API /recruiter/vacancies] ========== REQUEST START ==========`);
    console.log(`[API /recruiter/vacancies] BACKEND_URL: ${BACKEND_URL}`);
    console.log(`[API /recruiter/vacancies] include_new: ${includeNew}`);
    console.log(`[API /recruiter/vacancies] Request headers keys:`, Object.keys(allHeaders));
    console.log(`[API /recruiter/vacancies] Auth header present:`, !!authHeader);
    console.log(`[API /recruiter/vacancies] Target URL: ${url}`);
    console.log(`[API /recruiter/vacancies] Forwarding headers:`, JSON.stringify(headers, null, 2));
    
    let response;
    try {
      console.log(`[API /recruiter/vacancies] Starting fetch...`);
      response = await fetch(url, {
        method: 'GET',
        headers
      });
      console.log(`[API /recruiter/vacancies] Fetch completed with status: ${response.status} ${response.statusText}`);
    } catch (fetchError: any) {
      console.error(`[API /recruiter/vacancies] ========== FETCH ERROR ==========`);
      console.error(`[API /recruiter/vacancies] Error type:`, fetchError.name);
      console.error(`[API /recruiter/vacancies] Error message:`, fetchError.message);
      console.error(`[API /recruiter/vacancies] Error cause:`, fetchError.cause);
      console.error(`[API /recruiter/vacancies] Stack (first 1000 chars):`, fetchError.stack?.substring(0, 1000));
      console.error(`[API /recruiter/vacancies] ===================================`);
      
      // Check error types
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
            backend_url: BACKEND_URL,
            error_type: fetchError.name || 'NetworkError'
          },
          { status: 503 }
        );
      }
      
      return NextResponse.json(
        { 
          error: `Failed to fetch from backend: ${errorMsg}`,
          details: errorMsg,
          error_type: fetchError.name || 'UnknownError'
        },
        { status: 500 }
      );
    }

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      console.error(`[API /recruiter/vacancies] Backend returned error status ${response.status}:`, errorText);
      return NextResponse.json(
        { error: errorText || `Backend returned ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log(`[API /recruiter/vacancies] ========== REQUEST SUCCESS ==========`);
    return NextResponse.json(data);
  } catch (error: any) {
    console.error(`[API /recruiter/vacancies] ========== UNEXPECTED ERROR ==========`);
    console.error(`[API /recruiter/vacancies] Error:`, error);
    console.error(`[API /recruiter/vacancies] Message:`, error.message);
    console.error(`[API /recruiter/vacancies] Stack:`, error.stack?.substring(0, 1000));
    console.error(`[API /recruiter/vacancies] ======================================`);
    
    const errorMessage = error.message || 'Failed to fetch recruiter vacancies';
    
    return NextResponse.json(
      { error: errorMessage, details: error.toString() },
      { status: 500 }
    );
  }
}

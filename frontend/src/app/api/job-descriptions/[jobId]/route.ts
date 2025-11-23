import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const resolvedParams = await params;
    const jobId = resolvedParams.jobId;
    
    // Get authorization header from the incoming request
    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
    
    // Check content type to handle both JSON and FormData
    const contentType = request.headers.get('content-type') || '';
    
    let body: BodyInit;
    let headers: HeadersInit = {};
    
    if (contentType.includes('application/json')) {
      // Handle JSON request
      const jsonData = await request.json();
      body = JSON.stringify(jsonData);
      headers['Content-Type'] = 'application/json';
    } else {
      // Handle FormData request
      const formData = await request.formData();
      body = formData;
      // Don't set Content-Type for FormData - browser will set it with boundary
    }
    
    // Forward authorization header if present
    if (authHeader) {
      headers['Authorization'] = authHeader;
    }
    
    // Forward to backend
    const backendResponse = await fetch(`${BACKEND_URL}/job-descriptions/${jobId}`, {
      method: 'PUT',
      headers,
      body,
    });
    
    if (!backendResponse.ok) {
      const errorText = await backendResponse.text();
      let error;
      try {
        error = JSON.parse(errorText);
      } catch {
        error = { detail: errorText || 'Unknown error' };
      }
      console.error('Backend update job error:', error);
      return NextResponse.json(
        { success: false, error: error.detail || 'Failed to update job' },
        { status: backendResponse.status }
      );
    }
    
    const data = await backendResponse.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error updating job:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update job' },
      { status: 500 }
    );
  }
}


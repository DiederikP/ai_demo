import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const jobId = formData.get('job_id') as string;
    const limit = formData.get('limit') ? parseInt(formData.get('limit') as string) : 10;

    // Get authorization header from the incoming request
    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
    
    const headers: HeadersInit = {
      // Don't set Content-Type - FormData will set it with boundary
    };
    
    // Forward authorization header if present
    if (authHeader) {
      headers['Authorization'] = authHeader;
    }

    const backendFormData = new FormData();
    backendFormData.append('job_id', jobId);
    backendFormData.append('limit', limit.toString());

    const response = await fetch(`${BACKEND_URL}/match-candidates`, {
      method: 'POST',
      headers,
      body: backendFormData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: errorText || 'Failed to match candidates' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error matching candidates:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to match candidates' },
      { status: 500 }
    );
  }
}

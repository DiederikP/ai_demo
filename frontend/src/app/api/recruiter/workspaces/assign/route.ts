import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { job_id, recruiter_id } = body;

    if (!job_id || !recruiter_id) {
      return NextResponse.json(
        { error: 'job_id and recruiter_id are required' },
        { status: 400 }
      );
    }

    // Get authorization header from the incoming request
    const authHeader = request.headers.get('authorization');
    
    const headers: HeadersInit = {};
    
    // Forward authorization header if present
    if (authHeader) {
      headers['Authorization'] = authHeader;
    }
    
    const formData = new FormData();
    formData.append('job_id', job_id);
    formData.append('recruiter_id', recruiter_id);

    const response = await fetch(`${BACKEND_URL}/recruiter/workspaces/assign`, {
      method: 'POST',
      headers,
      body: formData
    });

    if (!response.ok) {
      const error = await response.text();
      return NextResponse.json(
        { error: error || 'Failed to assign workspace' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error assigning workspace:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to assign workspace' },
      { status: 500 }
    );
  }
}


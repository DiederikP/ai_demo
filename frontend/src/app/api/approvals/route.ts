import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const candidateId = searchParams.get('candidate_id');
    const jobId = searchParams.get('job_id');
    const resultId = searchParams.get('result_id');
    const approvalType = searchParams.get('approval_type');
    const userId = searchParams.get('user_id');
    
    const params = new URLSearchParams();
    if (candidateId) params.append('candidate_id', candidateId);
    if (jobId) params.append('job_id', jobId);
    if (resultId) params.append('result_id', resultId);
    if (approvalType) params.append('approval_type', approvalType);
    if (userId) params.append('user_id', userId);
    
    // Get authorization header from the incoming request
    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
    
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    
    // Forward authorization header if present
    if (authHeader) {
      headers['Authorization'] = authHeader;
    }
    
    const response = await fetch(`${BACKEND_URL}/approvals?${params.toString()}`, {
      method: 'GET',
      headers,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Backend approvals error:', errorText);
      return NextResponse.json(
        { error: 'Failed to fetch approvals' },
        { status: response.status }
      );
    }

    const result = await response.json();
    return NextResponse.json(result);

  } catch (error) {
    console.error('Error in /api/approvals:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Get authorization header from the incoming request
    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
    
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    
    // Forward authorization header if present
    if (authHeader) {
      headers['Authorization'] = authHeader;
    }
    
    // Check if it's JSON or FormData
    const contentType = request.headers.get('content-type') || '';
    let body: any;
    
    if (contentType.includes('application/json')) {
      body = await request.json();
    } else {
      // Handle FormData
      const formData = await request.formData();
      body = Object.fromEntries(formData.entries());
    }
    
    const response = await fetch(`${BACKEND_URL}/approvals`, {
      method: 'POST',
      headers,
      body: contentType.includes('application/json') ? JSON.stringify(body) : body,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Backend create approval error:', errorText);
      return NextResponse.json(
        { error: 'Failed to create approval' },
        { status: response.status }
      );
    }

    const result = await response.json();
    return NextResponse.json(result);

  } catch (error) {
    console.error('Error in /api/approvals POST:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

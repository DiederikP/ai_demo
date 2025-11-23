import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const candidateId = searchParams.get('candidate_id');
    const jobId = searchParams.get('job_id');
    const resultType = searchParams.get('result_type');
    const companyId = searchParams.get('company_id');

    let url = `${BACKEND_URL}/evaluation-results`;
    const params = new URLSearchParams();
    if (candidateId) params.append('candidate_id', candidateId);
    if (jobId) params.append('job_id', jobId);
    if (resultType) params.append('result_type', resultType);
    if (companyId) params.append('company_id', companyId);
    
    if (params.toString()) {
      url += '?' + params.toString();
    }

    // Get authorization header from the incoming request
    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
    
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    
    // Forward authorization header if present
    if (authHeader) {
      headers['Authorization'] = authHeader;
    }

    const response = await fetch(url, {
      method: 'GET',
      headers,
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: errorText || 'Failed to fetch evaluation results' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error fetching evaluation results:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch evaluation results' },
      { status: 500 }
    );
  }
}


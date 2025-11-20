import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const jobId = searchParams.get('job_id');
    const companyId = searchParams.get('company_id');

    let url = `${BACKEND_URL}/candidates`;
    const params = new URLSearchParams();
    if (jobId) params.append('job_id', jobId);
    if (companyId) params.append('company_id', companyId);
    
    if (params.toString()) {
      url += `?${params.toString()}`;
    }

    // Get auth headers to forward to backend
    const authHeader = request.headers.get('authorization');
    
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
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
        { error: errorText || 'Failed to fetch candidates' },
        { status: response.status }
      );
    }

    const data = await response.json();
    
    // Transform data to include job_title for easier display
    const candidates = (data.candidates || []).map((candidate: any) => ({
      ...candidate,
      job_title: candidate.job?.title || null,
    }));

    return NextResponse.json({ candidates });
  } catch (error: any) {
    console.error('Error fetching candidates:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch candidates' },
      { status: 500 }
    );
  }
}


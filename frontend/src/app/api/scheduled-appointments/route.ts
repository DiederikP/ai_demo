import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';

export async function POST(request: NextRequest) {
  try {
    const { getAuthHeaders } = await import('../../../lib/auth');
    const headers = getAuthHeaders();
    
    const body = await request.json();
    
    const formData = new FormData();
    formData.append('candidate_id', body.candidate_id);
    formData.append('job_id', body.job_id);
    formData.append('scheduled_at', body.scheduled_at);
    formData.append('type', body.type);
    if (body.location) formData.append('location', body.location);
    if (body.notes) formData.append('notes', body.notes);
    if (body.conversation_id) formData.append('conversation_id', body.conversation_id);
    
    // Remove Content-Type when using FormData - browser will set it with boundary
    const { 'Content-Type': _, ...headersWithoutContentType } = headers as Record<string, string>;
    const authHeader = headers['Authorization'] || headers['authorization'];
    const formDataHeaders: HeadersInit = {};
    if (authHeader) {
      formDataHeaders['Authorization'] = authHeader as string;
    }
    const response = await fetch(`${BACKEND_URL}/scheduled-appointments`, {
      method: 'POST',
      headers: formDataHeaders,
      body: formData,
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Backend scheduled appointment error:', errorText);
      return NextResponse.json(
        { success: false, error: errorText || 'Failed to create scheduled appointment' },
        { status: response.status }
      );
    }
    
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error creating scheduled appointment:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { getAuthHeaders } = await import('../../../lib/auth');
    const headers = getAuthHeaders();
    
    const searchParams = request.nextUrl.searchParams;
    const candidateId = searchParams.get('candidate_id');
    const jobId = searchParams.get('job_id');
    
    let url = `${BACKEND_URL}/scheduled-appointments`;
    const params = new URLSearchParams();
    if (candidateId) params.append('candidate_id', candidateId);
    if (jobId) params.append('job_id', jobId);
    if (params.toString()) {
      url += '?' + params.toString();
    }
    
    const response = await fetch(url, { headers });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Backend get appointments error:', errorText);
      return NextResponse.json(
        { success: false, error: errorText || 'Failed to get scheduled appointments' },
        { status: response.status }
      );
    }
    
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error getting scheduled appointments:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}


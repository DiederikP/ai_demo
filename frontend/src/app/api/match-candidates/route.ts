import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const jobId = formData.get('job_id') as string;
    const limit = formData.get('limit') ? parseInt(formData.get('limit') as string) : 10;

    if (!jobId) {
      return NextResponse.json(
        { error: 'job_id is required' },
        { status: 400 }
      );
    }

    const backendFormData = new FormData();
    backendFormData.append('job_id', jobId);
    if (limit) {
      backendFormData.append('limit', limit.toString());
    }

    const response = await fetch(`${BACKEND_URL}/match-candidates`, {
      method: 'POST',
      body: backendFormData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Backend error:', errorText);
      return NextResponse.json(
        { error: 'Failed to match candidates', details: errorText },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error matching candidates:', error);
    return NextResponse.json(
      { error: 'Failed to match candidates', details: error.message },
      { status: 500 }
    );
  }
}


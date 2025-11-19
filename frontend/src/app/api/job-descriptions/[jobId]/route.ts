import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const resolvedParams = await params;
    const jobId = resolvedParams.jobId;
    const formData = await request.formData();
    
    // Forward to backend
    const backendResponse = await fetch(`${BACKEND_URL}/job-descriptions/${jobId}`, {
      method: 'PUT',
      body: formData,
    });
    
    if (!backendResponse.ok) {
      const error = await backendResponse.json().catch(() => ({ detail: 'Unknown error' }));
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


import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ candidateId: string }> }
) {
  try {
    const { candidateId } = await params;
    const response = await fetch(`${BACKEND_URL}/candidates/${candidateId}`);
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error: any) {
    console.error('Error fetching candidate detail:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch candidate detail' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ candidateId: string }> }
) {
  try {
    const { candidateId } = await params;
    
    const response = await fetch(`${BACKEND_URL}/candidates/${candidateId}`, {
      method: 'DELETE',
    });

    const data = await response.json().catch(() => ({}));
    return NextResponse.json(data, { status: response.status });
  } catch (error: any) {
    console.error('Error deleting candidate:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete candidate' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ candidateId: string }> }
) {
  try {
    const { candidateId } = await params;
    const body = await request.json();
    const { job_ids } = body;
    
    if (!job_ids || !Array.isArray(job_ids)) {
      return NextResponse.json(
        { error: 'job_ids array is required' },
        { status: 400 }
      );
    }

    const formData = new FormData();
    job_ids.forEach((jobId: string) => {
      formData.append('job_ids', jobId);
    });

    const response = await fetch(`${BACKEND_URL}/candidates/${candidateId}/assign-jobs`, {
      method: 'PUT',
      body: formData,
    });

    const data = await response.json().catch(() => ({}));
    return NextResponse.json(data, { status: response.status });
  } catch (error: any) {
    console.error('Error assigning jobs:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to assign jobs' },
      { status: 500 }
    );
  }
}


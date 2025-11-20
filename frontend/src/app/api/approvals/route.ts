import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
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

    const response = await fetch(`${BACKEND_URL}/approvals?${params.toString()}`);
    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: 'Failed to fetch approvals', details: errorText },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error fetching approvals:', error);
    return NextResponse.json(
      { error: 'Failed to fetch approvals', details: error.message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    
    const backendFormData = new FormData();
    backendFormData.append('user_id', formData.get('user_id') as string);
    backendFormData.append('approval_type', formData.get('approval_type') as string);
    backendFormData.append('status', formData.get('status') as string);
    
    if (formData.get('candidate_id')) {
      backendFormData.append('candidate_id', formData.get('candidate_id') as string);
    }
    if (formData.get('job_id')) {
      backendFormData.append('job_id', formData.get('job_id') as string);
    }
    if (formData.get('result_id')) {
      backendFormData.append('result_id', formData.get('result_id') as string);
    }
    if (formData.get('comment')) {
      backendFormData.append('comment', formData.get('comment') as string);
    }

    const response = await fetch(`${BACKEND_URL}/approvals`, {
      method: 'POST',
      body: backendFormData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: 'Failed to create approval', details: errorText },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error creating approval:', error);
    return NextResponse.json(
      { error: 'Failed to create approval', details: error.message },
      { status: 500 }
    );
  }
}


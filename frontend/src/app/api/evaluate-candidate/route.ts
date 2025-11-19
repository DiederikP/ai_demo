import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const candidateId = formData.get('candidate_id') as string;
    const companyNote = formData.get('company_note') as string;
    const forceRefresh = formData.get('force_refresh') === 'true';

    if (!candidateId) {
      return NextResponse.json(
        { error: 'candidate_id is required' },
        { status: 400 }
      );
    }

    // Build form data for backend
    const backendFormData = new FormData();
    backendFormData.append('candidate_id', candidateId);
    if (companyNote) {
      backendFormData.append('company_note', companyNote);
    }
    if (forceRefresh) {
      backendFormData.append('force_refresh', 'true');
    }

    // Add persona prompts dynamically
    for (const [key, value] of formData.entries()) {
      if (key.endsWith('_prompt')) {
        backendFormData.append(key, value as string);
      }
    }

    const response = await fetch(`${BACKEND_URL}/evaluate-candidate`, {
      method: 'POST',
      body: backendFormData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Evaluation error:', errorText);
      return NextResponse.json(
        { error: errorText || 'Evaluation failed' },
        { status: response.status }
      );
    }

    const result = await response.json();
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error in evaluate-candidate API:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to evaluate candidate' },
      { status: 500 }
    );
  }
}


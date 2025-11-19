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

    // Add persona prompts dynamically - backend expects {persona_name}_prompt format
    for (const [key, value] of formData.entries()) {
      if (key.endsWith('_prompt')) {
        backendFormData.append(key, value as string);
      }
    }

    const response = await fetch(`${BACKEND_URL}/debate-candidate`, {
      method: 'POST',
      body: backendFormData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Debate error:', errorText);
      return NextResponse.json(
        { error: errorText || 'Debate failed' },
        { status: response.status }
      );
    }

    const result = await response.json();
    
    // Transform the backend response to match frontend expectations
    if (result.success && result.debate) {
      return NextResponse.json({
        success: true,
        transcript: result.debate,
        full_prompt: result.full_prompt || '',
      });
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error in debate-candidate API:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to run debate' },
      { status: 500 }
    );
  }
}


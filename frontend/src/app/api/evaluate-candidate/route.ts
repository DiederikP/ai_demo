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
      let errorMessage = 'Evaluation failed';
      let errorDetails: any = null;
      try {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const errorJson = await response.json();
          errorDetails = errorJson;
          errorMessage = errorJson.detail || errorJson.error || errorJson.message || errorMessage;
        } else {
          const errorText = await response.text();
          errorMessage = errorText || errorMessage;
        }
      } catch (parseError) {
        console.error('Error parsing error response:', parseError);
        errorMessage = `Backend error: ${response.status} ${response.statusText}`;
      }
      // Log detailed error for debugging
      console.error('Evaluation API error:', {
        status: response.status,
        statusText: response.statusText,
        errorMessage,
        errorDetails,
        url: response.url
      });
      return NextResponse.json(
        { error: errorMessage, success: false, details: errorDetails },
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


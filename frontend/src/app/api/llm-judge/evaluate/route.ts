import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';

/**
 * LLM Judge Evaluate API Route
 * Proxies judge evaluation requests to backend
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const resultId = formData.get('result_id') as string;

    if (!resultId) {
      return NextResponse.json(
        { error: 'result_id is required' },
        { status: 400 }
      );
    }

    const backendFormData = new FormData();
    backendFormData.append('result_id', resultId);

    const response = await fetch(`${BACKEND_URL}/llm-judge/evaluate`, {
      method: 'POST',
      body: backendFormData,
    });

    if (!response.ok) {
      let errorMessage = 'Judge evaluation failed';
      try {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const errorData = await response.json();
          errorMessage = errorData.detail || errorData.error || errorMessage;
        } else {
          const errorText = await response.text();
          errorMessage = errorText || errorMessage;
        }
      } catch {
        // Ignore parsing errors
      }
      
      return NextResponse.json(
        { error: errorMessage, success: false },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);

  } catch (error: any) {
    console.error('Error in /api/llm-judge/evaluate:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error', success: false },
      { status: 500 }
    );
  }
}

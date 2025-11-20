import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';

/**
 * LLM Settings Truncation API Route
 * Update truncation and prompt density settings
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const disableTruncation = formData.get('disable_truncation') === 'true';
    const promptDensity = parseFloat(formData.get('prompt_density_multiplier') as string) || 1.0;

    // Validate prompt density
    if (promptDensity < 0.5 || promptDensity > 2.0) {
      return NextResponse.json(
        { error: 'prompt_density_multiplier must be between 0.5 and 2.0', success: false },
        { status: 400 }
      );
    }

    const backendFormData = new FormData();
    backendFormData.append('disable_truncation', disableTruncation.toString());
    backendFormData.append('prompt_density_multiplier', promptDensity.toString());

    const response = await fetch(`${BACKEND_URL}/llm-settings/truncation`, {
      method: 'POST',
      body: backendFormData,
    });

    if (!response.ok) {
      let errorMessage = 'Failed to update settings';
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
    console.error('Error in /api/llm-settings/truncation:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error', success: false },
      { status: 500 }
    );
  }
}

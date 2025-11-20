import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';

/**
 * LLM Settings API Route
 * Get current LLM settings from backend
 */
export async function GET() {
  try {
    const response = await fetch(`${BACKEND_URL}/llm-settings`, {
      method: 'GET',
    });

    if (!response.ok) {
      let errorMessage = 'Failed to fetch settings';
      try {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const errorData = await response.json();
          errorMessage = errorData.detail || errorData.error || errorMessage;
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
    console.error('Error in /api/llm-settings:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error', success: false },
      { status: 500 }
    );
  }
}

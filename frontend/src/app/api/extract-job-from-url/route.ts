import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json();

    if (!url || !url.trim()) {
      return NextResponse.json(
        { error: 'URL is required' },
        { status: 400 }
      );
    }

    // Proxy to backend
    const response = await fetch('http://localhost:8000/extract-job-from-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: url.trim() })
    });

    if (!response.ok) {
      let errorDetail = 'Failed to extract job posting from URL';
      try {
        const errorData = await response.json();
        errorDetail = errorData.detail || errorData.error || errorDetail;
      } catch {
        const errorText = await response.text();
        errorDetail = errorText || errorDetail;
      }
      console.error('Backend error:', errorDetail);
      return NextResponse.json(
        { success: false, error: errorDetail },
        { status: response.status }
      );
    }

    const result = await response.json();
    return NextResponse.json(result);

  } catch (error) {
    console.error('Error in /api/extract-job-from-url:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}


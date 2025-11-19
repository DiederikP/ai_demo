import { NextResponse } from 'next/server';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';

export async function GET() {
  try {
    // First, try to wake up the backend by calling health endpoint
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000); // 2 second timeout
      
      await fetch(`${BACKEND_URL}/health`, {
        method: 'GET',
        signal: controller.signal,
      }).catch(() => {
        // Ignore errors - backend might be sleeping
      });
      
      clearTimeout(timeoutId);
    } catch {
      // Ignore wake-up errors
    }

    // Then fetch the config
    const response = await fetch(`${BACKEND_URL}/config`);
    
    if (!response.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch config' },
        { status: response.status }
      );
    }

    const config = await response.json();
    return NextResponse.json(config);

  } catch (error) {
    console.error('Error fetching config:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const response = await fetch('http://localhost:8000/config');
    
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

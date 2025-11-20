import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ candidateId: string }> }
) {
  try {
    const { candidateId } = await params;
    const body = await request.json();
    
    const response = await fetch(`${BACKEND_URL}/candidates/${candidateId}/pipeline`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Backend pipeline update error:', errorText);
      return NextResponse.json(
        { error: errorText || 'Failed to update candidate pipeline' },
        { status: response.status }
      );
    }
    
    const result = await response.json();
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error in /api/candidates/[candidateId]/pipeline:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}


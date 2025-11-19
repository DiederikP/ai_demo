import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Build request body - only include persona_name if it's not null/undefined
    const requestBody: any = {
      result_id: body.resultId,
      question: body.question,
    };
    
    // Only add persona_name if it's provided and not null
    if (body.personaName && body.personaName !== 'all' && body.personaName !== null) {
      requestBody.persona_name = body.personaName;
    }
    
    const response = await fetch(`${BACKEND_URL}/debate-chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      let errorText = '';
      try {
        const errorData = await response.json();
        errorText = errorData.detail || errorData.error || 'Failed to chat with personas';
      } catch {
        errorText = await response.text() || 'Failed to chat with personas';
      }
      
      console.error('Debate chat error:', response.status, errorText);
      return NextResponse.json(
        { error: errorText },
        { status: response.status },
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error in /api/debate-chat:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 },
    );
  }
}



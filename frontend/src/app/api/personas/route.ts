import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const companyId = searchParams.get('company_id');
    
    let url = `${BACKEND_URL}/personas`;
    if (companyId) {
      url += `?company_id=${companyId}`;
    }

    const backendResponse = await fetch(url);

    if (!backendResponse.ok) {
      const errorText = await backendResponse.text();
      console.error('Backend personas error:', errorText);
      return NextResponse.json(
        { error: 'Failed to fetch personas' },
        { status: backendResponse.status }
      );
    }

    const result = await backendResponse.json();
    return NextResponse.json(result);

  } catch (error) {
    console.error('Error in /api/personas:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const backendResponse = await fetch(`${BACKEND_URL}/personas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (!backendResponse.ok) {
      const errorText = await backendResponse.text();
      console.error('Backend create persona error:', errorText);
      return NextResponse.json(
        { error: 'Failed to create persona' },
        { status: backendResponse.status }
      );
    }

    const result = await backendResponse.json();
    return NextResponse.json(result);

  } catch (error) {
    console.error('Error in /api/personas POST:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const backendResponse = await fetch(`${BACKEND_URL}/personas/${body.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (!backendResponse.ok) {
      const errorText = await backendResponse.text();
      console.error('Backend update persona error:', errorText);
      return NextResponse.json(
        { error: 'Failed to update persona' },
        { status: backendResponse.status }
      );
    }

    const result = await backendResponse.json();
    return NextResponse.json(result);

  } catch (error) {
    console.error('Error in /api/personas PUT:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json(
        { error: 'Persona ID is required' },
        { status: 400 }
      );
    }

    const backendResponse = await fetch(`${BACKEND_URL}/personas/${id}`, {
      method: 'DELETE'
    });

    if (!backendResponse.ok) {
      let errorMessage = 'Failed to delete persona';
      try {
        const errorData = await backendResponse.json();
        errorMessage = errorData.detail || errorData.error || errorMessage;
      } catch {
        const errorText = await backendResponse.text();
        if (errorText) {
          try {
            const parsed = JSON.parse(errorText);
            errorMessage = parsed.detail || parsed.error || errorMessage;
          } catch {
            errorMessage = errorText || errorMessage;
          }
        }
      }
      console.error('Backend delete persona error:', errorMessage);
      return NextResponse.json(
        { error: errorMessage, detail: errorMessage },
        { status: backendResponse.status }
      );
    }

    const result = await backendResponse.json();
    return NextResponse.json(result);

  } catch (error) {
    console.error('Error in /api/personas DELETE:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

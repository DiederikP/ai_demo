import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';

export async function GET(request: NextRequest) {
  try {
    const backendResponse = await fetch(`${BACKEND_URL}/job-descriptions`);

    if (!backendResponse.ok) {
      const errorText = await backendResponse.text();
      console.error('Backend job descriptions error:', errorText);
      return NextResponse.json(
        { error: 'Failed to fetch job descriptions' },
        { status: backendResponse.status }
      );
    }

    const result = await backendResponse.json();
    return NextResponse.json(result);

  } catch (error) {
    console.error('Error in /api/upload-job GET:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Get authorization header from the incoming request
    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
    
    console.log('[upload-job API] Auth header present:', !!authHeader);
    
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    
    // Forward authorization header if present
    if (authHeader) {
      headers['Authorization'] = authHeader;
      console.log('[upload-job API] Forwarding auth header to backend');
    } else {
      console.warn('[upload-job API] No auth header found in request');
    }
    
    const backendResponse = await fetch(`${BACKEND_URL}/upload-job-description`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body)
    });

    if (!backendResponse.ok) {
      const errorText = await backendResponse.text();
      console.error('Backend create job error:', errorText);
      return NextResponse.json(
        { error: 'Failed to create job description' },
        { status: backendResponse.status }
      );
    }

    const result = await backendResponse.json();
    return NextResponse.json(result);

  } catch (error) {
    console.error('Error in /api/upload-job POST:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const backendResponse = await fetch(`${BACKEND_URL}/job-descriptions/${body.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (!backendResponse.ok) {
      const errorText = await backendResponse.text();
      console.error('Backend update job error:', errorText);
      return NextResponse.json(
        { error: 'Failed to update job description' },
        { status: backendResponse.status }
      );
    }

    const result = await backendResponse.json();
    return NextResponse.json(result);

  } catch (error) {
    console.error('Error in /api/upload-job PUT:', error);
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
        { error: 'Job ID is required' },
        { status: 400 }
      );
    }

    const backendResponse = await fetch(`${BACKEND_URL}/job-descriptions/${id}`, {
      method: 'DELETE'
    });

    if (!backendResponse.ok) {
      const errorText = await backendResponse.text();
      console.error('Backend delete job error:', errorText);
      return NextResponse.json(
        { error: 'Failed to delete job description' },
        { status: backendResponse.status }
      );
    }

    const result = await backendResponse.json();
    return NextResponse.json(result);

  } catch (error) {
    console.error('Error in /api/upload-job DELETE:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
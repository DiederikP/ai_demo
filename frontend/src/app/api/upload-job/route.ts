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
    const backendResponse = await fetch(`${BACKEND_URL}/upload-job-description`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
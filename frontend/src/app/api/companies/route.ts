import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams.toString();
    const url = searchParams ? `${BACKEND_URL}/companies?${searchParams}` : `${BACKEND_URL}/companies`;
    const response = await fetch(url);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Backend companies error:', errorText);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch companies' },
        { status: response.status }
      );
    }
    
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error fetching companies:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const response = await fetch(`${BACKEND_URL}/companies`, {
      method: 'POST',
      body: formData,
    });
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error creating company:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}


import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams.toString();
    const url = searchParams ? `${BACKEND_URL}/users?${searchParams}` : `${BACKEND_URL}/users`;
    const response = await fetch(url);
    
    // Check if response is ok and content-type is JSON
    if (!response.ok) {
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const errorData = await response.json();
        return NextResponse.json(
          { success: false, error: errorData.detail || errorData.message || 'Failed to fetch users' },
          { status: response.status }
        );
      } else {
        const text = await response.text();
        return NextResponse.json(
          { success: false, error: `Backend error: ${response.status} ${response.statusText}` },
          { status: response.status }
        );
      }
    }
    
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      const text = await response.text();
      console.error('Non-JSON response from backend:', text.substring(0, 200));
      return NextResponse.json(
        { success: false, error: 'Backend returned non-JSON response' },
        { status: 500 }
      );
    }
    
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error fetching users:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch users' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const response = await fetch(`${BACKEND_URL}/users`, {
      method: 'POST',
      body: formData,
    });

    // Check if response is ok and content-type is JSON
    if (!response.ok) {
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const errorData = await response.json();
        return NextResponse.json(
          { success: false, error: errorData.detail || errorData.message || 'Failed to create user' },
          { status: response.status }
        );
      } else {
        const text = await response.text();
        return NextResponse.json(
          { success: false, error: `Backend error: ${response.status} ${response.statusText}` },
          { status: response.status }
        );
      }
    }
    
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      const text = await response.text();
      console.error('Non-JSON response from backend:', text.substring(0, 200));
      return NextResponse.json(
        { success: false, error: 'Backend returned non-JSON response' },
        { status: 500 }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error creating user:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to create user' },
      { status: 500 }
    );
  }
}


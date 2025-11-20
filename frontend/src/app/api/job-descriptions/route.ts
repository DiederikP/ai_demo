import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const companyId = searchParams.get('company_id');
    
    // Get authorization header from request (client sends it in headers)
    const authHeader = request.headers.get('authorization');
    
    let url = `${BACKEND_URL}/job-descriptions`;
    if (companyId) {
      url += `?company_id=${companyId}`;
    }
    
    // Build headers - include auth if present
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    if (authHeader) {
      headers['Authorization'] = authHeader;
    }
    
    // Also try to get token from cookies as fallback (if client stores it there)
    const cookies = request.cookies;
    const tokenFromCookie = cookies.get('auth_token')?.value;
    if (!authHeader && tokenFromCookie) {
      headers['Authorization'] = `Bearer ${tokenFromCookie}`;
    }
    
    const response = await fetch(url, {
      method: 'GET',
      headers,
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: errorText || 'Failed to fetch job descriptions' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error fetching job descriptions:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch job descriptions' },
      { status: 500 }
    );
  }
}


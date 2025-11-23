import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const id = searchParams.get('id');

    if (!type || !id) {
      return NextResponse.json(
        { error: 'Type and id are required' },
        { status: 400 }
      );
    }

    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');

    if (!authHeader) {
      return NextResponse.json(
        { error: 'Authorization required' },
        { status: 401 }
      );
    }

    let url = '';
    switch (type) {
      case 'candidate':
        url = `${BACKEND_URL}/candidates/${id}`;
        break;
      case 'job':
        url = `${BACKEND_URL}/job-descriptions/${id}`;
        break;
      case 'user':
        url = `${BACKEND_URL}/users/${id}`;
        break;
      default:
        return NextResponse.json(
          { error: `Unknown type: ${type}` },
          { status: 400 }
        );
    }

    const response = await fetch(url, {
      method: 'DELETE',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorData: any = { error: errorText || 'Failed to delete record' };
      try {
        errorData = JSON.parse(errorText);
      } catch {
        // Not JSON, use text as error
      }
      return NextResponse.json(
        errorData,
        { status: response.status }
      );
    }

    const data = await response.json().catch(() => ({ success: true }));
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error in /api/admin/delete-record:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete record' },
      { status: 500 }
    );
  }
}


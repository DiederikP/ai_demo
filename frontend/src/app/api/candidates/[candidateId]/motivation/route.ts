import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ candidateId: string }> }) {
  try {
    const { candidateId } = await params;
    const authHeader = _.headers.get('authorization') || _.headers.get('Authorization');

    const headers: HeadersInit = {};
    if (authHeader) {
      headers['Authorization'] = authHeader;
    }

    const response = await fetch(`${BACKEND_URL}/candidates/${candidateId}/motivation`, {
      method: 'DELETE',
      headers,
    });
    const data = await response.json().catch(() => ({}));
    return NextResponse.json(data, { status: response.status });
  } catch (error: any) {
    console.error('Error deleting motivation letter:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}



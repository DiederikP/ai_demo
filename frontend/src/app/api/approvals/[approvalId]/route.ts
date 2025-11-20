import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ approvalId: string }> }
) {
  try {
    const { approvalId } = await params;
    const formData = await request.formData();
    
    const backendFormData = new FormData();
    if (formData.get('status')) {
      backendFormData.append('status', formData.get('status') as string);
    }
    if (formData.get('comment')) {
      backendFormData.append('comment', formData.get('comment') as string);
    }

    const response = await fetch(`${BACKEND_URL}/approvals/${approvalId}`, {
      method: 'PUT',
      body: backendFormData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: 'Failed to update approval', details: errorText },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error updating approval:', error);
    return NextResponse.json(
      { error: 'Failed to update approval', details: error.message },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ approvalId: string }> }
) {
  try {
    const { approvalId } = await params;

    const response = await fetch(`${BACKEND_URL}/approvals/${approvalId}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: 'Failed to delete approval', details: errorText },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error deleting approval:', error);
    return NextResponse.json(
      { error: 'Failed to delete approval', details: error.message },
      { status: 500 }
    );
  }
}


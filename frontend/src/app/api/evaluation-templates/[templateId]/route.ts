import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ templateId: string }> }
) {
  try {
    const resolvedParams = await params;
    const templateId = resolvedParams.templateId;
    
    const response = await fetch(`${BACKEND_URL}/evaluation-templates/${templateId}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
      return NextResponse.json(
        { success: false, error: error.detail || 'Failed to delete template' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error deleting evaluation template:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to delete template' },
      { status: 500 }
    );
  }
}


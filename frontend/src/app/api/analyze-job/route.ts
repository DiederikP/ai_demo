import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { job_id } = body;

    console.log('API route received job_id:', job_id, 'Type:', typeof job_id);

    if (!job_id) {
      return NextResponse.json(
        { error: 'Job ID is required', success: false },
        { status: 400 }
      );
    }

    // Ensure job_id is a string and remove any whitespace
    const jobIdString = String(job_id).trim();
    console.log('Frontend API route - Received job_id:', job_id);
    console.log('Frontend API route - Normalized job_id:', jobIdString);
    console.log('Frontend API route - job_id length:', jobIdString.length);

    const formData = new FormData();
    formData.append('job_id', jobIdString);
    
    console.log('Frontend API route - FormData job_id:', formData.get('job_id'));

    const backendResponse = await fetch(`${BACKEND_URL}/analyze-job`, {
      method: 'POST',
      body: formData,
    });

    if (!backendResponse.ok) {
      let errorDetail = 'Failed to analyze job posting';
      let userFriendlyMessage = 'Unable to analyze the job posting at this time.';
      
      try {
        const errorData = await backendResponse.json();
        errorDetail = errorData.detail || errorData.error || errorDetail;
        
        // Create user-friendly messages based on status codes
        if (backendResponse.status === 404) {
          if (errorDetail.includes('No job postings found')) {
            userFriendlyMessage = 'No job postings found. Please create a job posting first.';
          } else if (errorDetail.includes('not found')) {
            userFriendlyMessage = 'The selected job posting was not found. It may have been deleted. Please select a different job posting.';
          } else {
            userFriendlyMessage = 'Job posting not found. Please select a valid job posting from the list.';
          }
        } else if (backendResponse.status === 400) {
          userFriendlyMessage = errorDetail.includes('required') 
            ? 'Please select a job posting before analyzing.' 
            : 'Invalid request. Please ensure a job posting is selected.';
        } else if (backendResponse.status === 503) {
          userFriendlyMessage = 'AI service is temporarily unavailable. Please check your API configuration and try again.';
        } else if (backendResponse.status === 500) {
          userFriendlyMessage = 'An error occurred while analyzing the job. Please try again.';
        } else {
          userFriendlyMessage = errorDetail;
        }
        
        console.error('Backend job analysis error:', errorDetail);
      } catch (e) {
        const errorText = await backendResponse.text();
        console.error('Backend job analysis error (text):', errorText);
        errorDetail = errorText || errorDetail;
        
        // Handle plain text errors
        if (backendResponse.status === 404) {
          userFriendlyMessage = 'Job posting not found. Please select a valid job posting.';
        }
      }
      
      return NextResponse.json(
        { 
          error: userFriendlyMessage, 
          errorDetail: errorDetail,
          success: false 
        },
        { status: backendResponse.status }
      );
    }

    const result = await backendResponse.json();
    
    // Ensure success flag is set
    if (result.success === undefined) {
      result.success = true;
    }
    
    return NextResponse.json(result);

  } catch (error: any) {
    console.error('Error in /api/analyze-job:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error', success: false },
      { status: 500 }
    );
  }
}

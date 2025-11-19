import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const job_id = formData.get('job_id') as string;
    const motivationFile = formData.get('motivation_file') as File;
    const companyNote = formData.get('company_note') as string;
    const companyNoteFile = formData.get('company_note_file') as File;
    const handlerId = formData.get('handler_id') as string;

    if (!file || !job_id) {
      return NextResponse.json(
        { error: 'Missing required fields: file and job_id are required' },
        { status: 400 }
      );
    }

    // Step 1: Upload the file to backend
    const uploadFormData = new FormData();
    uploadFormData.append('file', file);
    uploadFormData.append('name', 'Frontend Upload');
    uploadFormData.append('email', 'frontend@example.com');
    uploadFormData.append('experience_years', '5');
    uploadFormData.append('skills', 'Various');
    uploadFormData.append('education', 'Various');
    uploadFormData.append('job_id', job_id);
    
    // Add motivation file if provided
    if (motivationFile) {
      uploadFormData.append('motivation_file', motivationFile);
    }
    
    // Add company note file if provided
    if (companyNoteFile) {
      uploadFormData.append('company_note_file', companyNoteFile);
    }
    
    // Add company note text if provided (only if no file)
    if (companyNote && !companyNoteFile) {
      uploadFormData.append('company_note', companyNote);
    }

    const uploadResponse = await fetch(`${BACKEND_URL}/upload-resume`, {
      method: 'POST',
      body: uploadFormData,
    });

    if (!uploadResponse.ok) {
      let errorDetail = 'File upload failed';
      try {
        const errorJson = await uploadResponse.json();
        errorDetail = errorJson.detail || errorJson.error || errorDetail;
      } catch {
        const errorText = await uploadResponse.text();
        errorDetail = errorText || errorDetail;
      }
      console.error('Upload error:', errorDetail);
      return NextResponse.json(
        { error: errorDetail, errorDetail: errorDetail },
        { status: uploadResponse.status }
      );
    }

    const uploadResult = await uploadResponse.json();
    const candidateId = uploadResult.candidate_id;
    
    if (!candidateId) {
      console.error('Upload response missing candidate_id:', uploadResult);
      return NextResponse.json(
        { error: 'Upload succeeded but no candidate_id returned', errorDetail: 'Backend response missing candidate_id' },
        { status: 500 }
      );
    }
    
    const azureUsed = uploadResult.azure_used || false;
    const extractionMethod = uploadResult.extraction_method || 'Unknown';

    // Step 2: Evaluate the candidate (using selected personas)
    const evalFormData = new FormData();
    evalFormData.append('candidate_id', candidateId);
    evalFormData.append('strictness', 'medium');
    
    // Extract persona prompts from form data
    const personaPrompts: { [key: string]: string } = {};
    for (const [key, value] of formData.entries()) {
      if (key.endsWith('_prompt') && value instanceof File === false) {
        const personaName = key.replace('_prompt', '');
        personaPrompts[personaName] = value as string;
        evalFormData.append(key, value as string);
      }
    }
    
    if (Object.keys(personaPrompts).length === 0) {
      return NextResponse.json(
        { error: 'At least one persona must be selected for evaluation' },
        { status: 400 }
      );
    }

    const evalResponse = await fetch(`${BACKEND_URL}/evaluate-candidate`, {
      method: 'POST',
      body: evalFormData,
    });

    if (!evalResponse.ok) {
      let errorDetail = 'Evaluation failed';
      try {
        const contentType = evalResponse.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const errorJson = await evalResponse.json();
          errorDetail = errorJson.detail || errorJson.error || errorDetail;
        } else {
          const errorText = await evalResponse.text();
          errorDetail = errorText || errorDetail;
        }
      } catch (parseError) {
        console.error('Error parsing error response:', parseError);
        errorDetail = `Backend error: ${evalResponse.status} ${evalResponse.statusText}`;
      }
      console.error('Evaluation error:', errorDetail);
      return NextResponse.json(
        { error: errorDetail, errorDetail: errorDetail },
        { status: evalResponse.status }
      );
    }

    const evalResult = await evalResponse.json();
    
    // Transform the backend response to match frontend expectations
    if (evalResult.success && evalResult.evaluations) {
      // Return evaluations from all personas
      return NextResponse.json({
        evaluations: evalResult.evaluations, // Dictionary of persona_name -> evaluation
        persona_count: evalResult.persona_count || Object.keys(evalResult.evaluations).length,
        azure_used: azureUsed,
        extraction_method: extractionMethod,
        combined_analysis: evalResult.combined_analysis,
        combined_recommendation: evalResult.combined_recommendation,
        combined_score: evalResult.combined_score,
        full_prompt: evalResult.full_prompt
      });
    } else {
      const errorMsg = evalResult.error || 'Evaluation failed - no evaluations returned';
      console.error('Evaluation result missing data:', evalResult);
      return NextResponse.json(
        { error: errorMsg, errorDetail: errorMsg },
        { status: 500 }
      );
    }

  } catch (error: any) {
    console.error('Error in /api/review:', error);
    const errorMessage = error?.message || 'Internal server error';
    return NextResponse.json(
      { error: errorMessage, errorDetail: errorMessage },
      { status: 500 }
    );
  }
}

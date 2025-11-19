import { NextRequest, NextResponse } from 'next/server';

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

    const uploadResponse = await fetch('http://localhost:8000/upload-resume', {
      method: 'POST',
      body: uploadFormData,
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      console.error('Upload error:', errorText);
      return NextResponse.json(
        { error: 'File upload failed' },
        { status: uploadResponse.status }
      );
    }

    const uploadResult = await uploadResponse.json();
    const candidateId = uploadResult.candidate_id;
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

    const evalResponse = await fetch('http://localhost:8000/evaluate-candidate', {
      method: 'POST',
      body: evalFormData,
    });

    if (!evalResponse.ok) {
      let errorDetail = 'Evaluation failed';
      try {
        const errorJson = await evalResponse.json();
        errorDetail = errorJson.detail || errorJson.error || errorDetail;
      } catch {
        const errorText = await evalResponse.text();
        errorDetail = errorText || errorDetail;
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
        combined_recommendation: evalResult.combined_recommendation
      });
    } else {
      return NextResponse.json(
        { error: evalResult.error || 'Evaluation failed', errorDetail: evalResult.error || 'Unknown error' },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('Error in /api/review:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const job_id = formData.get('job_id') as string;
    const motivationFile = formData.get('motivation_file') as File;
    const companyNote = formData.get('company_note') as string;
    const companyNoteFile = formData.get('company_note_file') as File;

    // Get all persona prompts dynamically
    const personaPrompts: { [key: string]: string } = {};
    for (const [key, value] of formData.entries()) {
      if (key.endsWith('_prompt')) {
        personaPrompts[key] = value as string;
      }
    }
    
    console.log('Frontend API - Persona prompts:', personaPrompts);

    if (!file || !job_id || Object.keys(personaPrompts).length === 0) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Step 1: Upload the file to backend
    const uploadFormData = new FormData();
    uploadFormData.append('file', file);
    uploadFormData.append('name', 'Frontend Debate Upload');
    uploadFormData.append('email', 'frontend@example.com');
    uploadFormData.append('experience_years', '5');
    uploadFormData.append('skills', 'Various');
    uploadFormData.append('education', 'Various');
    uploadFormData.append('job_id', job_id);
    
    // Add motivation file if provided
    if (motivationFile) {
      uploadFormData.append('motivation_file', motivationFile);
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

    // Step 2: Run the debate
    const debateFormData = new FormData();
    debateFormData.append('candidate_id', candidateId);
    
    // Add all persona prompts dynamically
    for (const [key, prompt] of Object.entries(personaPrompts)) {
      debateFormData.append(key, prompt);
    }
    
    if (companyNote) {
      debateFormData.append('company_note', companyNote);
    }
    
    if (companyNoteFile) {
      debateFormData.append('company_note_file', companyNoteFile);
    }
    
    console.log('Frontend API - Sending debate request with:', Object.fromEntries(debateFormData.entries()));

    const debateResponse = await fetch('http://localhost:8000/debate-candidate', {
      method: 'POST',
      body: debateFormData,
    });

    if (!debateResponse.ok) {
      const errorText = await debateResponse.text();
      console.error('Debate error:', errorText);
      return NextResponse.json(
        { error: 'Debate failed' },
        { status: debateResponse.status }
      );
    }

    const debateResult = await debateResponse.json();
    
    // Transform the backend response to match frontend expectations
    if (debateResult.success && debateResult.debate) {
      return NextResponse.json({
        transcript: debateResult.debate,
        full_prompt: debateResult.full_prompt || '',
        azure_used: azureUsed,
        extraction_method: extractionMethod
      });
    } else {
      return NextResponse.json(
        { error: debateResult.error || 'Debate failed' },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('Error in /api/debate:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

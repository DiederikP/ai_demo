"""
Test script for expert debate functionality
Tests the debate endpoint with a sample candidate
"""

import requests
import json
import os
from pathlib import Path

# Backend URL
BACKEND_URL = "http://localhost:8000"

def test_debate():
    """Test the debate endpoint"""
    print("=" * 60)
    print("TESTING EXPERT DEBATE")
    print("=" * 60)
    
    # Step 1: Check if backend is running
    print("\n1. Checking if backend is running...")
    try:
        response = requests.get(f"{BACKEND_URL}/job-descriptions", timeout=5)
        if response.status_code == 200:
            print("✓ Backend is running")
        else:
            print(f"✗ Backend returned status {response.status_code}")
            return
    except requests.exceptions.ConnectionError:
        print("✗ Backend is not running. Please start it first.")
        return
    except Exception as e:
        print(f"✗ Error connecting to backend: {e}")
        return
    
    # Step 2: Get job descriptions
    print("\n2. Getting job descriptions...")
    try:
        response = requests.get(f"{BACKEND_URL}/job-descriptions")
        jobs = response.json().get("jobs", [])
        if not jobs:
            print("✗ No job descriptions found. Please create one first.")
            return
        job = jobs[0]
        job_id = job["id"]
        print(f"✓ Using job: {job['title']} at {job['company']}")
    except Exception as e:
        print(f"✗ Error getting job descriptions: {e}")
        return
    
    # Step 3: Get personas
    print("\n3. Getting personas...")
    try:
        response = requests.get(f"{BACKEND_URL}/personas")
        personas_data = response.json()
        personas = personas_data.get("personas", [])
        if len(personas) < 2:
            print("✗ Need at least 2 personas for debate. Found:", len(personas))
            return
        print(f"✓ Found {len(personas)} personas")
        # Use first 3 personas
        selected_personas = personas[:3]
        for p in selected_personas:
            print(f"  - {p['display_name']}")
    except Exception as e:
        print(f"✗ Error getting personas: {e}")
        return
    
    # Step 4: Upload a test candidate (using a dummy PDF or text)
    print("\n4. Uploading test candidate...")
    try:
        # Create a simple test CV text file
        test_cv_text = """
        Joeri van der Berg
        IT Support Specialist
        
        Ervaring:
        - IT On-site Support Analyst bij Danone (maart 2023 - heden)
        - Eerste- en tweedelijns support
        - CMDB beheer in ServiceNow
        - Microsoft Certified: Azure
        
        Vaardigheden:
        - Windows, Office 365, ServiceNow
        - Klantgericht, stressbestendig
        """
        
        # Create a temporary text file
        import tempfile
        with tempfile.NamedTemporaryFile(mode='w', suffix='.txt', delete=False) as f:
            f.write(test_cv_text)
            temp_file_path = f.name
        
        try:
            # Upload the file
            upload_data = {
                'name': 'Joeri van der Berg',
                'email': 'joeri@test.nl',
                'experience_years': '5',
                'skills': 'IT Support, ServiceNow, Azure',
                'education': 'HBO ICT',
                'job_id': job_id
            }
            
            with open(temp_file_path, 'rb') as f:
                files = {'file': ('test_cv.txt', f, 'text/plain')}
                response = requests.post(
                    f"{BACKEND_URL}/upload-resume",
                    data=upload_data,
                    files=files
                )
            
            if response.status_code != 200:
                print(f"✗ Upload failed: {response.status_code}")
                print(f"  Response: {response.text[:200]}")
                return
            
            upload_result = response.json()
            candidate_id = upload_result.get("candidate_id")
            if not candidate_id:
                print("✗ No candidate_id returned")
                print(f"  Response: {upload_result}")
                return
            
            print(f"✓ Candidate uploaded: {candidate_id}")
        finally:
            # Clean up temp file
            os.unlink(temp_file_path)
            
    except Exception as e:
        print(f"✗ Error uploading candidate: {e}")
        import traceback
        traceback.print_exc()
        return
    
    # Step 5: Run the debate
    print("\n5. Running expert debate...")
    try:
        debate_data = {
            'candidate_id': candidate_id,
            'company_note': 'Salarisindicatie: €4000. Beschikbaar vanaf 1 maand. Zeer gemotiveerd.'
        }
        
        # Add persona prompts - backend expects format: {persona_name}_prompt
        for persona in selected_personas:
            prompt_key = f"{persona['name']}_prompt"
            debate_data[prompt_key] = persona['system_prompt']
            print(f"  Added prompt for: {persona['display_name']}")
        
        response = requests.post(
            f"{BACKEND_URL}/debate-candidate",
            data=debate_data
        )
        
        if response.status_code != 200:
            print(f"✗ Debate failed: {response.status_code}")
            print(f"  Response: {response.text[:500]}")
            return
        
        debate_result = response.json()
        
        if not debate_result.get("success"):
            print(f"✗ Debate returned success=False")
            print(f"  Error: {debate_result.get('error', 'Unknown error')}")
            return
        
        debate_transcript = debate_result.get("debate", "")
        
        if not debate_transcript:
            print("✗ No debate transcript returned")
            return
        
        print(f"✓ Debate completed")
        print(f"  Transcript length: {len(debate_transcript)} characters")
        
        # Step 6: Validate JSON format
        print("\n6. Validating JSON format...")
        try:
            conversation = json.loads(debate_transcript)
            
            if not isinstance(conversation, list):
                print(f"✗ Transcript is not a JSON array")
                print(f"  Type: {type(conversation)}")
                return
            
            print(f"✓ Valid JSON array with {len(conversation)} messages")
            
            # Validate each message
            print("\n7. Validating message structure...")
            valid_messages = 0
            invalid_messages = []
            
            for idx, msg in enumerate(conversation):
                if not isinstance(msg, dict):
                    invalid_messages.append(f"Message {idx}: Not a dict")
                    continue
                
                role = msg.get("role")
                content = msg.get("content")
                
                if not role:
                    invalid_messages.append(f"Message {idx}: Missing 'role'")
                    continue
                
                if not content or not content.strip():
                    invalid_messages.append(f"Message {idx}: Missing or empty 'content'")
                    continue
                
                valid_messages += 1
                print(f"  ✓ Message {idx + 1}: {role} ({len(content)} chars)")
            
            if invalid_messages:
                print(f"\n✗ Found {len(invalid_messages)} invalid messages:")
                for error in invalid_messages:
                    print(f"  - {error}")
                return
            
            print(f"\n✓ All {valid_messages} messages are valid")
            
            # Show sample messages
            print("\n8. Sample messages:")
            for idx, msg in enumerate(conversation[:5]):
                role = msg.get("role", "Unknown")
                content = msg.get("content", "")[:100]
                print(f"  [{idx + 1}] {role}: {content}...")
            
            if len(conversation) > 5:
                print(f"  ... and {len(conversation) - 5} more messages")
            
            print("\n" + "=" * 60)
            print("✓ TEST PASSED - Debate is working correctly!")
            print("=" * 60)
            return True
            
        except json.JSONDecodeError as e:
            print(f"✗ Transcript is not valid JSON: {e}")
            print(f"  First 200 chars: {debate_transcript[:200]}")
            return False
        
    except Exception as e:
        print(f"✗ Error running debate: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    test_debate()


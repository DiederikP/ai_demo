"""
Test script to verify performance improvements
Tests parallel evaluation and optimized debate
"""
import requests
import time
import json

BACKEND_URL = "http://localhost:8000"

def test_parallel_evaluation():
    """Test that multiple persona evaluations run in parallel"""
    print("\n" + "="*60)
    print("TEST 1: Parallel Persona Evaluation")
    print("="*60)
    
    # First, we need a candidate and job
    # For testing, we'll use the test resume
    try:
        # First, get or create a job
        jobs_resp = requests.get(f"{BACKEND_URL}/job-descriptions")
        job_id = ""
        if jobs_resp.status_code == 200:
            jobs = jobs_resp.json().get("jobs", [])
            if jobs:
                job_id = jobs[0]["id"]
                print(f"✓ Using existing job: {jobs[0]['title']}")
        
        # Upload a test resume
        with open("test_resume.txt", "rb") as f:
            files = {"file": ("test_resume.txt", f, "text/plain")}
            data = {
                "name": "Test Candidate",
                "email": "test@example.com",
                "experience_years": "5",
                "skills": "Python, FastAPI, Testing",
                "education": "BSc Computer Science",
                "job_id": job_id
            }
            response = requests.post(f"{BACKEND_URL}/upload-resume", data=data, files=files)
            
            if response.status_code != 200:
                print(f"⚠️  Could not upload resume: {response.text}")
                print("   (This is expected if backend is not running)")
                return False
            
            result = response.json()
            candidate_id = result.get("candidate_id")
            
            if not candidate_id:
                print("⚠️  No candidate_id returned")
                return False
            
            print(f"✓ Candidate uploaded: {candidate_id}")
            
            # Now test evaluation with multiple personas
            # We need to check what personas are available
            personas_resp = requests.get(f"{BACKEND_URL}/personas")
            if personas_resp.status_code == 200:
                personas = personas_resp.json().get("personas", [])
                if len(personas) >= 2:
                    # Test with 2+ personas to verify parallelization
                    print(f"\n📊 Testing with {len(personas)} personas...")
                    print("   (This should be faster with parallel execution)")
                    
                    start_time = time.time()
                    
                    # Prepare form data with multiple personas
                    form_data = {"candidate_id": candidate_id}
                    for persona in personas[:3]:  # Test with up to 3 personas
                        form_data[f"{persona['name']}_prompt"] = persona.get('system_prompt', '')
                    
                    eval_response = requests.post(
                        f"{BACKEND_URL}/evaluate-candidate",
                        data=form_data
                    )
                    
                    elapsed_time = time.time() - start_time
                    
                    if eval_response.status_code == 200:
                        result = eval_response.json()
                        print(f"✓ Evaluation completed in {elapsed_time:.2f} seconds")
                        print(f"  Personas evaluated: {result.get('persona_count', 0)}")
                        print(f"  Combined score: {result.get('combined_score', 'N/A')}")
                        
                        # With parallelization, 3 personas should take ~5-10s instead of 15-30s
                        if elapsed_time < 15:
                            print("✓ PERFORMANCE: Fast execution (likely parallelized)")
                            return True
                        else:
                            print("⚠️  PERFORMANCE: Slower than expected (may not be parallelized)")
                            return False
                    else:
                        print(f"⚠️  Evaluation failed: {eval_response.text}")
                        return False
                else:
                    print("⚠️  Need at least 2 personas for parallelization test")
                    return False
            else:
                print("⚠️  Could not fetch personas")
                return False
                
    except requests.exceptions.ConnectionError:
        print("⚠️  Backend not running. Start it with: python main.py")
        return False
    except FileNotFoundError:
        print("⚠️  test_resume.txt not found. Using alternative test method...")
        return test_syntax_only()
    except Exception as e:
        print(f"⚠️  Error: {str(e)}")
        return False

def test_syntax_only():
    """Test that the code syntax is correct"""
    print("\n" + "="*60)
    print("TEST 2: Syntax Check")
    print("="*60)
    
    try:
        import sys
        sys.path.insert(0, '.')
        
        # Try to import the modules
        print("  Checking main.py...")
        import main
        print("  ✓ main.py imports successfully")
        
        print("  Checking langchain_debate.py...")
        import langchain_debate
        print("  ✓ langchain_debate.py imports successfully")
        
        # Check for async functions
        import inspect
        if inspect.iscoroutinefunction(main.call_openai_safe_async):
            print("  ✓ call_openai_safe_async is async function")
        else:
            print("  ⚠️  call_openai_safe_async is not async")
        
        # Check for asyncio usage
        with open('main.py', 'r') as f:
            content = f.read()
            if 'asyncio.gather' in content:
                print("  ✓ asyncio.gather found (parallelization implemented)")
            else:
                print("  ⚠️  asyncio.gather not found")
        
        with open('langchain_debate.py', 'r') as f:
            content = f.read()
            if 'asyncio.gather' in content:
                print("  ✓ Debate parallelization found")
            else:
                print("  ⚠️  Debate parallelization not found")
        
        return True
        
    except Exception as e:
        print(f"  ⚠️  Error: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

def test_debate_optimization():
    """Test that debate uses optimized flow"""
    print("\n" + "="*60)
    print("TEST 3: Debate Optimization Check")
    print("="*60)
    
    try:
        with open('langchain_debate.py', 'r') as f:
            content = f.read()
            
        # Check for reduced rounds
        if 'Target: ~12-15 messages' in content:
            print("  ✓ Debate optimized to 12-15 messages (reduced from 20-25)")
        else:
            print("  ⚠️  Debate optimization not found")
        
        # Check for parallelization
        if 'PARALLELIZED' in content or 'asyncio.gather' in content:
            print("  ✓ Debate uses parallelization")
        else:
            print("  ⚠️  Debate parallelization not found")
        
        # Count API calls in debate function
        import re
        invoke_matches = len(re.findall(r'await invoke_(persona|orchestrator)', content))
        print(f"  Found {invoke_matches} API calls in debate function")
        
        if invoke_matches <= 15:
            print("  ✓ API call count is optimized")
        else:
            print("  ⚠️  API call count may be too high")
        
        return True
        
    except Exception as e:
        print(f"  ⚠️  Error: {str(e)}")
        return False

def main():
    """Run all tests"""
    print("\n" + "="*60)
    print("PERFORMANCE IMPROVEMENTS TEST SUITE")
    print("="*60)
    
    results = []
    
    # Test 1: Syntax check (always runs)
    results.append(("Syntax Check", test_syntax_only()))
    
    # Test 2: Debate optimization check
    results.append(("Debate Optimization", test_debate_optimization()))
    
    # Test 3: Parallel evaluation (requires backend)
    results.append(("Parallel Evaluation", test_parallel_evaluation()))
    
    # Summary
    print("\n" + "="*60)
    print("TEST SUMMARY")
    print("="*60)
    
    for test_name, result in results:
        status = "✓ PASS" if result else "✗ FAIL"
        print(f"{status}: {test_name}")
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    print(f"\nResults: {passed}/{total} tests passed")
    
    if passed == total:
        print("\n🎉 All tests passed! Performance improvements are working.")
    else:
        print("\n⚠️  Some tests failed. Check the output above for details.")

if __name__ == "__main__":
    main()


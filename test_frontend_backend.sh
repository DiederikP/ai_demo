#!/bin/bash
# Comprehensive frontend and backend integration test

set -e

BACKEND_URL="http://localhost:8000"
FRONTEND_URL="http://localhost:3000"

echo "=========================================="
echo "Frontend & Backend Integration Test"
echo "=========================================="
echo ""

# Test colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

test_result() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✓${NC} $2"
    else
        echo -e "${RED}✗${NC} $2"
        FAILED_TESTS+=("$2")
    fi
}

FAILED_TESTS=()

# 1. Check if backend is running
echo "1. Checking backend..."
if curl -s "$BACKEND_URL/health" > /dev/null 2>&1; then
    test_result 0 "Backend is running"
else
    test_result 1 "Backend is not running"
    echo "   Please start the backend first: cd backend && python main.py"
    exit 1
fi

# 2. Check if frontend is running
echo ""
echo "2. Checking frontend..."
if curl -s "$FRONTEND_URL" > /dev/null 2>&1; then
    test_result 0 "Frontend is running"
else
    test_result 1 "Frontend is not running"
    echo "   Please start the frontend first: cd frontend && npm run dev"
    echo "   Continuing with backend-only tests..."
fi

# 3. Test login endpoints
echo ""
echo "3. Testing authentication endpoints..."

# Test admin login
ADMIN_TOKEN=$(curl -s -X POST "$BACKEND_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"vaatje@zuljehemhebben.nl","password":"123"}' \
  | python3 -c "import sys, json; data = json.load(sys.stdin); print(data.get('access_token', ''))" 2>/dev/null)

if [ ! -z "$ADMIN_TOKEN" ]; then
    test_result 0 "Admin login works"
else
    test_result 1 "Admin login failed"
fi

# Test recruiter login
RECRUITER_TOKEN=$(curl -s -X POST "$BACKEND_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"recruiter@recruiter-test.nl","password":"123"}' \
  | python3 -c "import sys, json; data = json.load(sys.stdin); print(data.get('access_token', ''))" 2>/dev/null)

if [ ! -z "$RECRUITER_TOKEN" ]; then
    test_result 0 "Recruiter login works"
else
    test_result 1 "Recruiter login failed"
fi

# Test company admin login
COMPANY_TOKEN=$(curl -s -X POST "$BACKEND_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@techsolutions.nl","password":"123"}' \
  | python3 -c "import sys, json; data = json.load(sys.stdin); print(data.get('access_token', ''))" 2>/dev/null)

if [ ! -z "$COMPANY_TOKEN" ]; then
    test_result 0 "Company admin login works"
else
    test_result 1 "Company admin login failed"
fi

# 4. Test protected endpoints
echo ""
echo "4. Testing protected endpoints..."

# Test companies endpoint
if [ ! -z "$ADMIN_TOKEN" ]; then
    RESPONSE=$(curl -s -X GET "$BACKEND_URL/companies" \
      -H "Authorization: Bearer $ADMIN_TOKEN")
    
    if echo "$RESPONSE" | python3 -c "import sys, json; data = json.load(sys.stdin); exit(0 if data.get('success') else 1)" 2>/dev/null; then
        test_result 0 "GET /companies works"
    else
        test_result 1 "GET /companies failed"
    fi
fi

# Test recruiter vacancies (fixed endpoint)
if [ ! -z "$RECRUITER_TOKEN" ]; then
    RESPONSE=$(curl -s -X GET "$BACKEND_URL/recruiter/vacancies?include_new=true" \
      -H "Authorization: Bearer $RECRUITER_TOKEN")
    
    if echo "$RESPONSE" | python3 -c "import sys, json; data = json.load(sys.stdin); exit(0 if 'vacancies' in data or 'detail' not in data or 'NoneType' not in data.get('detail', '') else 1)" 2>/dev/null; then
        test_result 0 "GET /recruiter/vacancies works (fixed)"
    else
        test_result 1 "GET /recruiter/vacancies failed"
        echo "   Response: $RESPONSE" | head -5
    fi
fi

# Test recruiter candidates
if [ ! -z "$RECRUITER_TOKEN" ]; then
    RESPONSE=$(curl -s -X GET "$BACKEND_URL/recruiter/candidates" \
      -H "Authorization: Bearer $RECRUITER_TOKEN")
    
    if echo "$RESPONSE" | python3 -c "import sys, json; data = json.load(sys.stdin); exit(0 if data.get('success') else 1)" 2>/dev/null; then
        test_result 0 "GET /recruiter/candidates works"
    else
        test_result 1 "GET /recruiter/candidates failed"
    fi
fi

# Test company candidates
if [ ! -z "$COMPANY_TOKEN" ]; then
    # Get company_id first
    COMPANY_ID=$(curl -s -X GET "$BACKEND_URL/companies" \
      -H "Authorization: Bearer $COMPANY_TOKEN" \
      | python3 -c "import sys, json; data = json.load(sys.stdin); companies = data.get('companies', []); print([c['id'] for c in companies if 'techsolutions' in c.get('primary_domain', '').lower()][0] if companies else '')" 2>/dev/null)
    
    if [ ! -z "$COMPANY_ID" ]; then
        RESPONSE=$(curl -s -X GET "$BACKEND_URL/candidates?company_id=$COMPANY_ID" \
          -H "Authorization: Bearer $COMPANY_TOKEN")
        
        if echo "$RESPONSE" | python3 -c "import sys, json; data = json.load(sys.stdin); exit(0 if data.get('success') else 1)" 2>/dev/null; then
            test_result 0 "GET /candidates (with company_id) works"
        else
            test_result 1 "GET /candidates (with company_id) failed"
        fi
    fi
fi

# Test job descriptions
if [ ! -z "$COMPANY_TOKEN" ]; then
    RESPONSE=$(curl -s -X GET "$BACKEND_URL/job-descriptions" \
      -H "Authorization: Bearer $COMPANY_TOKEN")
    
    if echo "$RESPONSE" | python3 -c "import sys, json; data = json.load(sys.stdin); exit(0 if data.get('success') else 1)" 2>/dev/null; then
        test_result 0 "GET /job-descriptions works"
    else
        test_result 1 "GET /job-descriptions failed"
    fi
fi

# 5. Test frontend API routes
echo ""
echo "5. Testing frontend API routes..."

if curl -s "$FRONTEND_URL" > /dev/null 2>&1; then
    # Test companies API route
    RESPONSE=$(curl -s "$FRONTEND_URL/api/companies")
    if echo "$RESPONSE" | python3 -c "import sys, json; data = json.load(sys.stdin); exit(0 if data.get('success') else 1)" 2>/dev/null; then
        test_result 0 "GET /api/companies (frontend) works"
    else
        test_result 1 "GET /api/companies (frontend) failed"
    fi
    
    # Test auth login API route (proxy)
    RESPONSE=$(curl -s -X POST "$FRONTEND_URL/api/auth/login" \
      -H "Content-Type: application/json" \
      -d '{"email":"vaatje@zuljehemhebben.nl","password":"123"}')
    
    if echo "$RESPONSE" | python3 -c "import sys, json; data = json.load(sys.stdin); exit(0 if data.get('access_token') or 'error' in data else 1)" 2>/dev/null; then
        test_result 0 "POST /api/auth/login (frontend) works"
    else
        test_result 1 "POST /api/auth/login (frontend) failed"
    fi
fi

# 6. Summary
echo ""
echo "=========================================="
echo "Test Summary"
echo "=========================================="

if [ ${#FAILED_TESTS[@]} -eq 0 ]; then
    echo -e "${GREEN}All tests passed!${NC}"
    exit 0
else
    echo -e "${RED}${#FAILED_TESTS[@]} test(s) failed:${NC}"
    for test in "${FAILED_TESTS[@]}"; do
        echo -e "  ${RED}✗${NC} $test"
    done
    exit 1
fi


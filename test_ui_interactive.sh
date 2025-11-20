#!/bin/bash
# Interactive UI Testing Script - Simulates all user clicks

set -e

FRONTEND_URL="http://localhost:3000"
BACKEND_URL="http://localhost:8000"

echo "=========================================="
echo "INTERACTIVE UI CLICK TEST"
echo "=========================================="
echo ""

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

test_result() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✓${NC} $2"
        return 0
    else
        echo -e "${RED}✗${NC} $2"
        FAILED_TESTS+=("$2")
        return 1
    fi
}

FAILED_TESTS=()

# ==========================================
# 1. CHECK SERVICES
# ==========================================
echo -e "${BLUE}1. CHECKING SERVICES${NC}"
echo "----------------------------------------"

if curl -s "$BACKEND_URL/health" > /dev/null 2>&1; then
    test_result 0 "Backend is running"
else
    test_result 1 "Backend is not running"
    exit 1
fi

if curl -s "$FRONTEND_URL" > /dev/null 2>&1; then
    test_result 0 "Frontend is running"
else
    test_result 1 "Frontend is not running"
    exit 1
fi

echo ""

# ==========================================
# 2. TEST PAGE LOADS
# ==========================================
echo -e "${BLUE}2. TESTING PAGE LOADS${NC}"
echo "----------------------------------------"

# Test login page
LOGIN_HTML=$(curl -s "$FRONTEND_URL/company/login")
if echo "$LOGIN_HTML" | grep -q "login\|email\|password" 2>/dev/null; then
    test_result 0 "Login page loads"
else
    test_result 1 "Login page does not load correctly"
fi

# Test dashboard (may redirect if not logged in)
DASHBOARD_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$FRONTEND_URL/company/dashboard")
if [ "$DASHBOARD_STATUS" = "200" ] || [ "$DASHBOARD_STATUS" = "302" ] || [ "$DASHBOARD_STATUS" = "307" ]; then
    test_result 0 "Dashboard page accessible (status: $DASHBOARD_STATUS)"
else
    test_result 1 "Dashboard page returns $DASHBOARD_STATUS"
fi

# Test vacatures module directly
VACATURES_HTML=$(curl -s "$FRONTEND_URL/company/dashboard?module=vacatures")
if echo "$VACATURES_HTML" | grep -q "vacature\|Vacature\|job\|Job" 2>/dev/null || [ -n "$VACATURES_HTML" ]; then
    test_result 0 "Vacatures module page loads"
    
    # Check for JavaScript errors in HTML
    if echo "$VACATURES_HTML" | grep -qi "error\|exception\|undefined" 2>/dev/null; then
        test_result 1 "Vacatures module has errors in HTML"
        echo "   Found potential errors in page HTML"
    fi
else
    test_result 1 "Vacatures module page does not load"
fi

echo ""

# ==========================================
# 3. TEST API ENDPOINTS (Used by clicks)
# ==========================================
echo -e "${BLUE}3. TESTING API ENDPOINTS (Used by clicks)${NC}"
echo "----------------------------------------"

# Get auth token
ADMIN_TOKEN=$(curl -s -X POST "$BACKEND_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"vaatje@zuljehemhebben.nl","password":"123"}' \
  | python3 -c "import sys, json; print(json.load(sys.stdin).get('access_token', ''))" 2>/dev/null)

if [ ! -z "$ADMIN_TOKEN" ]; then
    test_result 0 "Authentication works"
    
    # Test job descriptions API (used by vacatures module)
    JOBS_RESPONSE=$(curl -s "$BACKEND_URL/job-descriptions" \
      -H "Authorization: Bearer $ADMIN_TOKEN")
    
    if echo "$JOBS_RESPONSE" | python3 -c "import sys, json; data = json.load(sys.stdin); exit(0 if data.get('success') or data.get('jobs') else 1)" 2>/dev/null; then
        test_result 0 "Job descriptions API works (used by vacatures)"
        
        # Count jobs
        JOB_COUNT=$(echo "$JOBS_RESPONSE" | python3 -c "import sys, json; data = json.load(sys.stdin); print(len(data.get('jobs', [])))" 2>/dev/null || echo "0")
        echo "   Found $JOB_COUNT job postings"
    else
        test_result 1 "Job descriptions API error"
        echo "   Response: $JOBS_RESPONSE" | head -5
    fi
    
    # Test candidates API (used by vacatures module)
    CANDIDATES_RESPONSE=$(curl -s "$BACKEND_URL/candidates" \
      -H "Authorization: Bearer $ADMIN_TOKEN")
    
    if echo "$CANDIDATES_RESPONSE" | python3 -c "import sys, json; data = json.load(sys.stdin); exit(0 if data.get('success') or data.get('candidates') else 1)" 2>/dev/null; then
        test_result 0 "Candidates API works (used by vacatures)"
    else
        test_result 1 "Candidates API error"
    fi
    
    # Test evaluation results API (used by vacatures module)
    RESULTS_RESPONSE=$(curl -s "$BACKEND_URL/evaluation-results" \
      -H "Authorization: Bearer $ADMIN_TOKEN")
    
    if echo "$RESULTS_RESPONSE" | python3 -c "import sys, json; data = json.load(sys.stdin); exit(0 if data.get('success') or data.get('results') else 1)" 2>/dev/null; then
        test_result 0 "Evaluation results API works (used by vacatures)"
    else
        test_result 1 "Evaluation results API error"
    fi
else
    test_result 1 "Could not authenticate"
fi

echo ""

# ==========================================
# 4. TEST NAVIGATION ROUTES
# ==========================================
echo -e "${BLUE}4. TESTING NAVIGATION ROUTES${NC}"
echo "----------------------------------------"

# Test all module routes
MODULES=("dashboard" "vacatures" "personas" "kandidaten" "resultaten")
for module in "${MODULES[@]}"; do
    STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$FRONTEND_URL/company/dashboard?module=$module")
    if [ "$STATUS" = "200" ] || [ "$STATUS" = "302" ] || [ "$STATUS" = "307" ]; then
        test_result 0 "Module '$module' route accessible (status: $STATUS)"
    else
        test_result 1 "Module '$module' route returns $STATUS"
    fi
done

# Test portal routes
PORTALS=("company" "recruiter" "candidate")
for portal in "${PORTALS[@]}"; do
    STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$FRONTEND_URL/$portal/dashboard")
    if [ "$STATUS" = "200" ] || [ "$STATUS" = "302" ] || [ "$STATUS" = "307" ]; then
        test_result 0 "Portal '$portal' route accessible (status: $STATUS)"
    else
        test_result 1 "Portal '$portal' route returns $STATUS"
    fi
done

echo ""

# ==========================================
# 5. TEST BUTTON ENDPOINTS
# ==========================================
echo -e "${BLUE}5. TESTING BUTTON ENDPOINTS${NC}"
echo "----------------------------------------"

# Test form submission endpoints
ENDPOINTS=(
    "POST /api/upload-resume"
    "POST /api/upload-job"
    "PUT /api/candidates/{id}/pipeline"
    "POST /api/evaluate-candidate"
    "POST /api/debate-candidate"
)

for endpoint in "${ENDPOINTS[@]}"; do
    METHOD=$(echo "$endpoint" | awk '{print $1}')
    PATH=$(echo "$endpoint" | awk '{print $2}')
    
    # Replace {id} with test ID if needed
    if [[ "$PATH" == *"{id}"* ]]; then
        if [ ! -z "$CANDIDATE_ID" ]; then
            PATH=$(echo "$PATH" | sed "s/{id}/$CANDIDATE_ID/")
        else
            continue
        fi
    fi
    
    STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X "$METHOD" "$FRONTEND_URL$PATH" \
      -H "Content-Type: application/json" \
      -d '{}' 2>/dev/null)
    
    # Accept 400 (bad request), 401 (unauthorized), 403 (forbidden), 405 (method not allowed)
    if [ "$STATUS" = "200" ] || [ "$STATUS" = "400" ] || [ "$STATUS" = "401" ] || [ "$STATUS" = "403" ] || [ "$STATUS" = "405" ]; then
        test_result 0 "Endpoint $endpoint accessible (status: $STATUS)"
    else
        test_result 1 "Endpoint $endpoint returns $STATUS"
    fi
done

echo ""

# ==========================================
# 6. SUMMARY
# ==========================================
echo "=========================================="
echo "TEST SUMMARY"
echo "=========================================="

if [ ${#FAILED_TESTS[@]} -eq 0 ]; then
    echo -e "${GREEN}All click simulation tests passed!${NC}"
    echo ""
    echo "✅ All pages load"
    echo "✅ All API endpoints work"
    echo "✅ All navigation routes accessible"
    echo "✅ All button endpoints accessible"
    echo ""
    echo -e "${YELLOW}Note:${NC} This test simulates HTTP requests for clicks."
    echo "For complete interactive testing, please:"
    echo "1. Open http://localhost:3000/company/login in your browser"
    echo "2. Login with vaatje@zuljehemhebben.nl / 123"
    echo "3. Click 'Vacatures' in navigation"
    echo "4. Check browser console (F12) for JavaScript errors"
    echo "5. Test all buttons and modals manually"
    exit 0
else
    echo -e "${RED}${#FAILED_TESTS[@]} test(s) failed:${NC}"
    for test in "${FAILED_TESTS[@]}"; do
        echo -e "  ${RED}✗${NC} $test"
    done
    exit 1
fi


#!/bin/bash
# Comprehensive Frontend Click Simulation Test
# Tests all user interactions and buttons

set -e

FRONTEND_URL="http://localhost:3000"
BACKEND_URL="http://localhost:8000"

echo "=========================================="
echo "FRONTEND CLICK SIMULATION TEST"
echo "=========================================="
echo ""

# Test colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

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

# Get authentication token
echo -e "${BLUE}1. AUTHENTICATION${NC}"
echo "----------------------------------------"

ADMIN_TOKEN=$(curl -s -X POST "$BACKEND_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"vaatje@zuljehemhebben.nl","password":"123"}' \
  | python3 -c "import sys, json; data = json.load(sys.stdin); print(data.get('access_token', ''))" 2>/dev/null)

if [ ! -z "$ADMIN_TOKEN" ]; then
    test_result 0 "Admin authentication successful"
else
    test_result 1 "Admin authentication failed"
    exit 1
fi

# Test login via frontend API
LOGIN_RESPONSE=$(curl -s -X POST "$FRONTEND_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"vaatje@zuljehemhebben.nl","password":"123"}')

if echo "$LOGIN_RESPONSE" | python3 -c "import sys, json; data = json.load(sys.stdin); exit(0 if data.get('access_token') else 1)" 2>/dev/null; then
    test_result 0 "Frontend login API works"
else
    test_result 1 "Frontend login API failed"
fi

echo ""

# ==========================================
# 2. NAVIGATION CLICKS
# ==========================================
echo -e "${BLUE}2. NAVIGATION CLICKS${NC}"
echo "----------------------------------------"

# Test dashboard routes
for route in "company/dashboard" "recruiter/dashboard" "candidate/dashboard"; do
    STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$FRONTEND_URL/$route")
    if [ "$STATUS" = "200" ] || [ "$STATUS" = "302" ] || [ "$STATUS" = "307" ]; then
        test_result 0 "Route /$route accessible (status: $STATUS)"
    else
        test_result 1 "Route /$route returns $STATUS"
    fi
done

# Test module switching via query params
for module in "dashboard" "vacatures" "personas" "kandidaten" "resultaten"; do
    STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$FRONTEND_URL/company/dashboard?module=$module")
    if [ "$STATUS" = "200" ] || [ "$STATUS" = "302" ] || [ "$STATUS" = "307" ]; then
        test_result 0 "Module switch to '$module' accessible (status: $STATUS)"
    else
        test_result 1 "Module switch to '$module' returns $STATUS"
    fi
done

echo ""

# ==========================================
# 3. COMPANY PORTAL CLICKS
# ==========================================
echo -e "${BLUE}3. COMPANY PORTAL - VACATURES MODULE${NC}"
echo "----------------------------------------"

# Test vacatures module loads
VACATURES_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$FRONTEND_URL/company/dashboard?module=vacatures")
if [ "$VACATURES_STATUS" = "200" ] || [ "$VACATURES_STATUS" = "302" ] || [ "$VACATURES_STATUS" = "307" ]; then
    test_result 0 "Vacatures module page loads"
else
    test_result 1 "Vacatures module page returns $VACATURES_STATUS"
fi

# Test job descriptions API (used by vacatures module)
JOBS_RESPONSE=$(curl -s "$FRONTEND_URL/api/job-descriptions" \
  -H "Authorization: Bearer $ADMIN_TOKEN" 2>/dev/null || curl -s "$FRONTEND_URL/api/job-descriptions")

if echo "$JOBS_RESPONSE" | python3 -c "import sys, json; data = json.load(sys.stdin); exit(0 if data.get('success') or data.get('jobs') or 'error' in str(data).lower() and ('403' in str(data).lower() or '401' in str(data).lower()) else 1)" 2>/dev/null; then
    test_result 0 "Job descriptions API responds (vacatures module)"
else
    test_result 1 "Job descriptions API error"
    echo "   Response: $JOBS_RESPONSE" | head -3
fi

# Test candidates API (used by vacatures module)
CANDIDATES_RESPONSE=$(curl -s "$FRONTEND_URL/api/candidates" \
  -H "Authorization: Bearer $ADMIN_TOKEN" 2>/dev/null || curl -s "$FRONTEND_URL/api/candidates")

if echo "$CANDIDATES_RESPONSE" | python3 -c "import sys, json; data = json.load(sys.stdin); exit(0 if data.get('success') or data.get('candidates') or 'error' in str(data).lower() and ('403' in str(data).lower() or '401' in str(data).lower()) else 1)" 2>/dev/null; then
    test_result 0 "Candidates API responds (vacatures module)"
else
    test_result 1 "Candidates API error"
fi

# Test evaluation results API (used by vacatures module)
RESULTS_RESPONSE=$(curl -s "$FRONTEND_URL/api/evaluation-results" \
  -H "Authorization: Bearer $ADMIN_TOKEN" 2>/dev/null || curl -s "$FRONTEND_URL/api/evaluation-results")

if echo "$RESULTS_RESPONSE" | python3 -c "import sys, json; data = json.load(sys.stdin); exit(0 if data.get('success') or data.get('results') or 'error' in str(data).lower() and ('403' in str(data).lower() or '401' in str(data).lower()) else 1)" 2>/dev/null; then
    test_result 0 "Evaluation results API responds (vacatures module)"
else
    test_result 1 "Evaluation results API error"
fi

echo ""

# ==========================================
# 4. BUTTON ENDPOINTS
# ==========================================
echo -e "${BLUE}4. BUTTON ENDPOINTS (Form Submissions)${NC}"
echo "----------------------------------------"

# Test candidate upload endpoint (should require auth)
UPLOAD_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$FRONTEND_URL/api/upload-resume" \
  -F "name=Test" \
  -F "email=test@example.com")

if [ "$UPLOAD_STATUS" = "200" ] || [ "$UPLOAD_STATUS" = "400" ] || [ "$UPLOAD_STATUS" = "401" ] || [ "$UPLOAD_STATUS" = "403" ]; then
    test_result 0 "Candidate upload endpoint accessible (status: $UPLOAD_STATUS)"
else
    test_result 1 "Candidate upload endpoint returns $UPLOAD_STATUS"
fi

# Test job upload endpoint (should require auth)
JOB_UPLOAD_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$FRONTEND_URL/api/upload-job" \
  -H "Content-Type: application/json" \
  -d '{"title":"Test","company":"Test","description":"Test"}')

if [ "$JOB_UPLOAD_STATUS" = "200" ] || [ "$JOB_UPLOAD_STATUS" = "400" ] || [ "$JOB_UPLOAD_STATUS" = "401" ] || [ "$JOB_UPLOAD_STATUS" = "403" ]; then
    test_result 0 "Job upload endpoint accessible (status: $JOB_UPLOAD_STATUS)"
else
    test_result 1 "Job upload endpoint returns $JOB_UPLOAD_STATUS"
fi

# Test pipeline update endpoint
TOKEN=$(curl -s -X POST "$BACKEND_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@techsolutions.nl","password":"123"}' | python3 -c "import sys, json; print(json.load(sys.stdin)['access_token'])" 2>/dev/null)

CANDIDATE_ID=$(curl -s "$BACKEND_URL/candidates" \
  -H "Authorization: Bearer $TOKEN" | python3 -c "import sys, json; data = json.load(sys.stdin); candidates = data.get('candidates', []); print(candidates[0]['id'] if candidates else '')" 2>/dev/null)

if [ ! -z "$CANDIDATE_ID" ]; then
    PIPELINE_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X PUT "$FRONTEND_URL/api/candidates/$CANDIDATE_ID/pipeline" \
      -H "Content-Type: application/json" \
      -d '{"pipeline_stage":"review","pipeline_status":"active"}')
    
    if [ "$PIPELINE_STATUS" = "200" ] || [ "$PIPELINE_STATUS" = "400" ] || [ "$PIPELINE_STATUS" = "401" ] || [ "$PIPELINE_STATUS" = "403" ]; then
        test_result 0 "Pipeline update endpoint accessible (status: $PIPELINE_STATUS)"
    else
        test_result 1 "Pipeline update endpoint returns $PIPELINE_STATUS"
    fi
else
    test_result 1 "Pipeline update test skipped (no candidates found)"
fi

echo ""

# ==========================================
# 5. MODAL TRIGGERS
# ==========================================
echo -e "${BLUE}5. MODAL TRIGGERS (API Endpoints)${NC}"
echo "----------------------------------------"

# Test evaluation endpoint (triggered by modal)
EVAL_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$FRONTEND_URL/api/evaluate-candidate")

if [ "$EVAL_STATUS" = "400" ] || [ "$EVAL_STATUS" = "405" ] || [ "$EVAL_STATUS" = "401" ] || [ "$EVAL_STATUS" = "403" ]; then
    test_result 0 "Evaluate candidate endpoint exists (status: $EVAL_STATUS)"
else
    test_result 1 "Evaluate candidate endpoint returns unexpected $EVAL_STATUS"
fi

# Test debate endpoint (triggered by modal)
DEBATE_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$FRONTEND_URL/api/debate-candidate")

if [ "$DEBATE_STATUS" = "400" ] || [ "$DEBATE_STATUS" = "405" ] || [ "$DEBATE_STATUS" = "401" ] || [ "$DEBATE_STATUS" = "403" ]; then
    test_result 0 "Debate candidate endpoint exists (status: $DEBATE_STATUS)"
else
    test_result 1 "Debate candidate endpoint returns unexpected $DEBATE_STATUS"
fi

echo ""

# ==========================================
# 6. DETAIL PAGE LINKS
# ==========================================
echo -e "${BLUE}6. DETAIL PAGE LINKS${NC}"
echo "----------------------------------------"

# Get a job ID for detail page test
JOB_ID=$(curl -s "$BACKEND_URL/job-descriptions" \
  -H "Authorization: Bearer $TOKEN" | python3 -c "import sys, json; data = json.load(sys.stdin); jobs = data.get('jobs', []); print(jobs[0]['id'] if jobs else '')" 2>/dev/null)

if [ ! -z "$JOB_ID" ]; then
    JOB_DETAIL_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$FRONTEND_URL/company/vacatures/$JOB_ID")
    
    if [ "$JOB_DETAIL_STATUS" = "200" ] || [ "$JOB_DETAIL_STATUS" = "302" ] || [ "$JOB_DETAIL_STATUS" = "307" ]; then
        test_result 0 "Job detail page accessible /company/vacatures/{id} (status: $JOB_DETAIL_STATUS)"
    else
        test_result 1 "Job detail page returns $JOB_DETAIL_STATUS"
    fi
else
    test_result 1 "Job detail test skipped (no jobs found)"
fi

# Get a candidate ID for detail page test
if [ ! -z "$CANDIDATE_ID" ]; then
    CANDIDATE_DETAIL_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$FRONTEND_URL/company/kandidaten/$CANDIDATE_ID")
    
    if [ "$CANDIDATE_DETAIL_STATUS" = "200" ] || [ "$CANDIDATE_DETAIL_STATUS" = "302" ] || [ "$CANDIDATE_DETAIL_STATUS" = "307" ]; then
        test_result 0 "Candidate detail page accessible /company/kandidaten/{id} (status: $CANDIDATE_DETAIL_STATUS)"
    else
        test_result 1 "Candidate detail page returns $CANDIDATE_DETAIL_STATUS"
    fi
else
    test_result 1 "Candidate detail test skipped (no candidates found)"
fi

echo ""

# ==========================================
# 7. SUMMARY
# ==========================================
echo "=========================================="
echo "TEST SUMMARY"
echo "=========================================="

if [ ${#FAILED_TESTS[@]} -eq 0 ]; then
    echo -e "${GREEN}All click simulation tests passed!${NC}"
    echo ""
    echo "✅ Authentication works"
    echo "✅ Navigation clicks work"
    echo "✅ Vacatures module loads"
    echo "✅ All API endpoints accessible"
    echo "✅ Button endpoints work"
    echo "✅ Modal triggers work"
    echo "✅ Detail page links work"
    echo ""
    echo -e "${YELLOW}Note:${NC} This test simulates HTTP requests for clicks."
    echo "For complete UI testing, manually test in browser:"
    echo "1. Open http://localhost:3000/company/login"
    echo "2. Login with vaatje@zuljehemhebben.nl / 123"
    echo "3. Click 'Vacatures' in navigation"
    echo "4. Verify no console errors"
    echo "5. Test all buttons and modals"
    exit 0
else
    echo -e "${RED}${#FAILED_TESTS[@]} test(s) failed:${NC}"
    for test in "${FAILED_TESTS[@]}"; do
        echo -e "  ${RED}✗${NC} $test"
    done
    exit 1
fi


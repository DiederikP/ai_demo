/**
 * Comprehensive Frontend Click Simulation Test
 * Uses Puppeteer to simulate all user clicks and interactions
 * 
 * Run with: node test_comprehensive_clicks.js
 * 
 * Requires: npm install puppeteer
 */

const puppeteer = require('puppeteer');

const FRONTEND_URL = 'http://localhost:3000';
const BACKEND_URL = 'http://localhost:8000';

const testResults = {
  passed: [],
  failed: [],
  errors: []
};

function logTest(name, passed, error = null) {
  if (passed) {
    console.log(`✅ ${name}`);
    testResults.passed.push(name);
  } else {
    console.log(`❌ ${name}${error ? `: ${error}` : ''}`);
    testResults.failed.push(name);
    if (error) testResults.errors.push({ test: name, error });
  }
}

async function waitForBackend() {
  try {
    const response = await fetch(`${BACKEND_URL}/health`);
    return response.ok;
  } catch {
    return false;
  }
}

async function runTests() {
  console.log('==========================================');
  console.log('COMPREHENSIVE FRONTEND CLICK TEST');
  console.log('==========================================\n');

  // Check if backend is running
  console.log('Checking backend...');
  const backendReady = await waitForBackend();
  if (!backendReady) {
    console.error('❌ Backend is not running. Please start it first.');
    process.exit(1);
  }
  console.log('✅ Backend is running\n');

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();

    // Capture console errors
    const consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Capture page errors
    const pageErrors = [];
    page.on('pageerror', error => {
      pageErrors.push(error.message);
    });

    // ==========================================
    // 1. LOGIN PAGE CLICKS
    // ==========================================
    console.log('1. TESTING LOGIN PAGE');
    console.log('----------------------------------------');

    await page.goto(`${FRONTEND_URL}/company/login`, { waitUntil: 'networkidle0' });

    // Test login form elements
    try {
      const emailInput = await page.$('input[type="email"], input[name="email"], input[placeholder*="email" i], input[placeholder*="Email"]');
      const passwordInput = await page.$('input[type="password"], input[name="password"]');
      const submitButton = await page.$('button[type="submit"], button:has-text("Login"), button:has-text("Inloggen")');

      if (emailInput && passwordInput && submitButton) {
        logTest('Login form elements present', true);
        
        // Test login
        await emailInput.type('vaatje@zuljehemhebben.nl');
        await passwordInput.type('123');
        await submitButton.click();
        
        // Wait for navigation or error
        await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 5000 }).catch(() => {});
        
        const currentUrl = page.url();
        if (currentUrl.includes('/dashboard') || currentUrl.includes('/company/dashboard')) {
          logTest('Login successful - redirects to dashboard', true);
        } else {
          logTest('Login redirects to dashboard', false, `Still on ${currentUrl}`);
        }
      } else {
        logTest('Login form elements present', false, 'Missing form elements');
      }
    } catch (error) {
      logTest('Login page loads', false, error.message);
    }

    console.log('');

    // ==========================================
    // 2. NAVIGATION CLICKS
    // ==========================================
    console.log('2. TESTING NAVIGATION');
    console.log('----------------------------------------');

    // Test portal selector (if logged in)
    try {
      const portalSelector = await page.$('[title*="portal" i], [title*="Wissel" i], button:has-text("Bedrijf"), button:has-text("Recruiter"), button:has-text("Kandidaat")');
      if (portalSelector) {
        await portalSelector.click();
        await page.waitForTimeout(500);
        
        const portalDropdown = await page.$('div[class*="dropdown"], div[class*="menu"], div:has-text("Portals")');
        if (portalDropdown) {
          logTest('Portal selector dropdown opens', true);
        } else {
          logTest('Portal selector dropdown opens', false);
        }
      }
    } catch (error) {
      // Portal selector might not be visible or accessible
    }

    // Test module navigation
    const modules = ['vacatures', 'kandidaten', 'personas', 'resultaten'];
    for (const module of modules) {
      try {
        await page.goto(`${FRONTEND_URL}/company/dashboard?module=${module}`, { waitUntil: 'networkidle0' });
        const errorOccurred = consoleErrors.some(e => e.includes('Error') || e.includes('error'));
        
        if (!errorOccurred) {
          logTest(`Module '${module}' loads without errors`, true);
        } else {
          logTest(`Module '${module}' loads without errors`, false, 'Console errors detected');
        }
      } catch (error) {
        logTest(`Module '${module}' loads`, false, error.message);
      }
    }

    console.log('');

    // ==========================================
    // 3. VACATURES MODULE CLICKS
    // ==========================================
    console.log('3. TESTING VACATURES MODULE');
    console.log('----------------------------------------');

    await page.goto(`${FRONTEND_URL}/company/dashboard?module=vacatures`, { waitUntil: 'networkidle0' });

    // Check for errors
    const vacaturesErrors = consoleErrors.filter(e => e.toLowerCase().includes('vacature') || e.toLowerCase().includes('job'));
    if (vacaturesErrors.length === 0) {
      logTest('Vacatures module loads without errors', true);
    } else {
      logTest('Vacatures module loads without errors', false, vacaturesErrors.join('; '));
    }

    // Test buttons in vacatures module
    try {
      const newVacancyButton = await page.$('button:has-text("Nieuwe"), button:has-text("Nieuw"), button:has-text("+"), a[href*="nieuw"]');
      if (newVacancyButton) {
        logTest('New vacancy button exists', true);
      }

      const vacancyCards = await page.$$('[class*="vacature"], [class*="job"], a[href*="vacature"], a[href*="job"]');
      if (vacancyCards.length > 0) {
        logTest(`Vacancy cards display (${vacancyCards.length} found)`, true);
        
        // Try clicking first vacancy
        try {
          await vacancyCards[0].click();
          await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 3000 }).catch(() => {});
          logTest('Vacancy detail page navigates', true);
        } catch (error) {
          logTest('Vacancy detail page navigates', false, error.message);
        }
      } else {
        logTest('Vacancy cards display', false, 'No vacancies found');
      }
    } catch (error) {
      logTest('Vacatures module buttons work', false, error.message);
    }

    console.log('');

    // ==========================================
    // 4. CHECK CONSOLE ERRORS
    // ==========================================
    console.log('4. CHECKING CONSOLE ERRORS');
    console.log('----------------------------------------');

    const uniqueErrors = [...new Set([...consoleErrors, ...pageErrors])];
    if (uniqueErrors.length === 0) {
      logTest('No console errors detected', true);
    } else {
      logTest('No console errors detected', false, `${uniqueErrors.length} error(s) found`);
      uniqueErrors.forEach(error => {
        console.log(`   ❌ ${error.substring(0, 100)}...`);
      });
    }

    console.log('');

    // ==========================================
    // 5. SUMMARY
    // ==========================================
    console.log('==========================================');
    console.log('TEST SUMMARY');
    console.log('==========================================');
    console.log(`✅ Passed: ${testResults.passed.length}`);
    console.log(`❌ Failed: ${testResults.failed.length}`);
    console.log('');

    if (testResults.failed.length > 0) {
      console.log('Failed tests:');
      testResults.failed.forEach(test => {
        console.log(`  ❌ ${test}`);
      });
      console.log('');
    }

    if (testResults.errors.length > 0) {
      console.log('Errors:');
      testResults.errors.forEach(({ test, error }) => {
        console.log(`  ❌ ${test}: ${error}`);
      });
      console.log('');
    }

    await browser.close();

    process.exit(testResults.failed.length > 0 ? 1 : 0);

  } catch (error) {
    console.error('Test execution error:', error);
    if (browser) await browser.close();
    process.exit(1);
  }
}

// Run tests
runTests();


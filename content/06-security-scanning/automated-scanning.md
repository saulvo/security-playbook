---
title: "Automated Security Scanning"
description: ""
date: "2026-04-24"
author: "Saul Vo"
tags: ["security","scanning","testing","vulnerability"]
readingTime: "5 min"
order: 1
slug: "automated-scanning"
category: "security-scanning"
---

# Automated Security Scanning

## Mục lục
1. [SAST Tools](#1-sast-tools)
2. [DAST Tools](#2-dast-tools)
3. [Dependency Scanning](#3-dependency-scanning)
4. [CI/CD Integration](#4-cicd-integration)
5. [Custom Security Tests](#5-custom-security-tests)
6. [Reporting & Metrics](#6-reporting--metrics)

---

## 1. SAST Tools

### JavaScript/TypeScript Security Scanners

```bash
# ESLint Security Plugin
npm install --save-dev eslint-plugin-security

# .eslintrc configuration
{
  "extends": ["plugin:security/recommended"],
  "plugins": ["security"],
  "rules": {
    "security/detect-object-injection": "error",
    "security/detect-non-literal-regexp": "error",
    "security/detect-non-literal-fs-filename": "error",
    "security/detect-possible-timing-attacks": "error",
    "security/detect-unsafe-regex": "error",
    "security/detect-non-literal-fontloader-callback": "warn",
    "security/detect-new-buffer": "warn"
  }
}
```

```bash
# Run security scan
npx eslint --ext .ts,.tsx,.js,.jsx src/

# Output example:
# /src/utils/crypto.js
#   2:8  warning  security/detect-possible-timing-attacks  Potential timing attack
```

### DOM XSS Scanner

```bash
# eslint-plugin-no-unsanitized
npm install --save-dev eslint-plugin-no-unsanitized

# Configure
{
  "rules": {
    "no-unsanitized/method": "error",
    "no-unsanitized/property": "error",
    "no-unsanitized/DOMParser": "error"
  }
}
```

### Secret Scanning

```bash
# GitLeaks - scan for secrets in git
brew install gitleaks
gitleaks detect --source . --verbose

# GitRob - scan for sensitive files
gitrob commit

# Detect-Secrets (for CI/CD)
npm install --save-dev detect-secrets
npx detect-secrets scan --verbose

# Custom patterns for your secrets
detect-secrets scan --exclude-files '^tests/.*$' \
  --word-list custom-secrets.txt
```

### Complete SAST Setup

```bash
# package.json scripts
{
  "scripts": {
    "security:lint": "eslint --ext .ts,.tsx,.js,.jsx src/",
    "security:scan": "npm run security:lint && npm run security:deps",
    "security:deps": "npm audit --audit-level=high",
    "security:secrets": "detect-secrets scan --baseline .secrets.baseline"
  }
}
```

---

## 2. DAST Tools

### OWASP ZAP

```bash
# Install OWASP ZAP
# Download from https://www.zaproxy.org/download/

# Docker run
docker run -v $(pwd):/zap/wrk:rw \
  -w /zap/wrk \
  owasp/zap2docker-stable zap-api-scan.py \
  -t https://yourapp.com/api/openapi.json \
  -f json

# Active scan via CI
docker run -v $(pwd):/zap/wrk:rw \
  owasp/zap2docker-stable zap-baseline.py \
  -t https://yourapp.com \
  -c zap-baseline.conf
```

### ZAP Configuration

```yaml
# zap-config.yaml
zap:
  api:
    key: your-api-key
    baseurl: http://localhost:8080
  
  spider:
    maxDuration: 5
    maxResources: 1000

  activeScan:
    maxScanDuration: 10
    maxRules: 10
    threads: 10

  alerts:
    mediumPlus: true
    waffleUrl: https://waffle.io/your-org

  reporting:
    format: json
    output: zap-report.json
```

### Burp Suite Scanner

```bash
# Burp Suite Professional features:
# • Automated vulnerability scanning
# • On-demand XSS scanner
# • SQL injection detection
# • CSRF detection
# • JWT vulnerability checks

# Integration with CI/CD via CLI
java -jar burpsuite_pro_cli.jar \
  --project-file=your-project.bup \
  --config=burp-config.json \
  --scan-profile=audit-checks-to-perform.txt
```

### Playwright Security Testing

```typescript
// e2e-security.test.ts
import { test, expect } from '@playwright/test';

test.describe('Security Tests', () => {
  test('XSS in search parameter', async ({ page }) => {
    const xssPayload = '<script>alert(1)</script>';
    await page.goto(`/search?q=${encodeURIComponent(xssPayload)}`);

    // Script should not execute
    await expect(page.locator('script')).toHaveCount(0);
  });

  test('Authentication token not in URL', async ({ page }) => {
    await page.goto('/dashboard');

    // URL should not contain token
    expect(page.url()).not.toContain('token=');
    expect(page.url()).not.toContain('access_token=');
  });

  test('CSP header present', async ({ page }) => {
    const response = await page.goto('/');
    const csp = response?.headers()['content-security-policy'];

    expect(csp).toBeDefined();
    expect(csp).toContain("default-src 'self'");
  });

  test('Secure cookie flags', async ({ page }) => {
    await page.goto('/login');
    await page.fill('[name="email"]', 'test@example.com');
    await page.fill('[name="password"]', 'password');
    await page.click('[type="submit"]');

    const cookies = await page.context().cookies();
    const sessionCookie = cookies.find(c => c.name.includes('session'));

    expect(sessionCookie?.httpOnly).toBe(true);
    expect(sessionCookie?.secure).toBe(true);
  });

  test('CORS headers configured', async ({ page }) => {
    const response = await page.goto('/api/user');
    const cors = response?.headers()['access-control-allow-origin'];

    // Should be specific origin, not '*'
    expect(cors).not.toBe('*');
  });
});
```

---

## 3. Dependency Scanning

### NPM Audit

```bash
# Basic audit
npm audit

# Audit with JSON output for CI
npm audit --json > audit-report.json

# Audit with exit code based on severity
npm audit --audit-level=high

# Fix automatically where possible
npm audit fix

# Force fix (may have breaking changes)
npm audit fix --force
```

### Snyk Integration

```bash
# Install Snyk CLI
npm install -g snyk

# Authenticate
snyk auth

# Test for vulnerabilities
snyk test

# Test specific package
snyk test package@version

# Monitor project
snyk monitor

# Protect against vulnerabilities
snyk protect
```

### GitHub Dependabot

```yaml
# .github/dependabot.yml
version: 2
updates:
  - package-ecosystem: "npm"
    directory: "/"
    schedule:
      interval: "weekly"
    open-pull-requests-limit: 10
    groups:
      production-dependencies:
        dependency-type: "production"
      development-dependencies:
        dependency-type: "development"
    labels:
      - "dependencies"
      - "security"

  # Also check GitHub Actions
  - package-ecosystem: "github-actions"
    directory: "/.github/workflows"
    schedule:
      interval: "weekly"
```

### Retire.js

```bash
# Install retire.js
npm install -g retire

# Scan dependencies
retire --path ./node_modules --outputformat text --summary

# Output specific formats
retire --path ./node_modules --outputformat json --jsonfile retire-report.json
retire --path ./node_modules --outputformatsarif --sarfile retire-report.sarif
```

---

## 4. CI/CD Integration

### GitHub Actions Security Pipeline

```yaml
# .github/workflows/security.yml
name: Security Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  security-scan:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      # SAST: ESLint Security
      - name: Run ESLint Security
        run: npm run security:lint || true

      # Dependency scanning
      - name: Audit dependencies
        run: npm audit --audit-level=high
        continue-on-error: ${{ github.event_name != 'pull_request' }}

      # Secret scanning
      - name: Detect secrets
        run: |
          npm install -g detect-secrets
          detect-secrets scan --baseline .secrets.baseline
          detect-secrets scan --baseline .secrets.baseline | \
            grep -v "No secrets found" && exit 1 || true

  # DAST: ZAP Scan (on PR only)
  zap-scan:
    runs-on: ubuntu-latest
    if: github.event_name == 'pull_request'
    
    steps:
      - uses: actions/checkout@v3

      - name: Run ZAP Scan
        uses: zaproxy/action-baseline@v0.3.0
        with:
          target: 'https://yourapp.com'
          fail_mode: medium

  # Build-time security check
  build-security:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3

      - name: Build application
        run: npm ci && npm run build

      - name: Check for exposed secrets in build output
        run: |
          if grep -r "api[_-]key\|password\|secret" dist/ 2>/dev/null; then
            echo "Secrets found in build output!"
            exit 1
          fi
```

### GitLab CI Security Pipeline

```yaml
# .gitlab-ci.yml
security:lint:
  stage: security
  image: node:20
  script:
    - npm ci
    - npm run security:lint
  allow_failure: true

security:npm-audit:
  stage: security
  image: node:20
  script:
    - npm ci
    - npm audit --audit-level=high
  allow_failure: true

security:snyk:
  stage: security
  image: node:20
  before_script:
    - npm install -g snyk
    - snyk auth $SNYK_TOKEN
  script:
    - snyk test --severity-threshold=high
  allow_failure: true

dast:
  stage: security
  image: owasp/zap2docker-stable
  script:
    - zap-api-scan.py -t https://yourapp.com/api/openapi.json -f json
  artifacts:
    reports:
      zap: zap-report.json
  allow_failure: true
```

### Jenkins Security Pipeline

```groovy
// Jenkinsfile
pipeline {
  agent any

  stages {
    stage('Security: SAST') {
      steps {
        sh 'npm ci'
        sh 'npm run security:lint || true'
      }
    }

    stage('Security: Dependencies') {
      steps {
        sh 'npm audit --audit-level=high || true'
        sh 'npx snyk test --severity-threshold=high || true'
      }
    }

    stage('Security: DAST') {
      when { branch 'main' }
      steps {
        sh '''
          docker run -v $(pwd):/zap/wrk:rw \
            owasp/zap2docker-stable zap-baseline.py \
            -t https://yourapp.com \
            -r zap-report.html
        '''
      }
      post {
        always {
          publishHTML target: [
            reportDir: '.',
            reportFiles: 'zap-report.html',
            reportName: 'ZAP Security Report'
          ]
        }
      }
    }
  }

  post {
    always {
      junit '**/test-results/*.xml'
    }
  }
}
```

---

## 5. Custom Security Tests

### Security Test Suite

```typescript
// tests/security.test.ts
import { test, expect, request } from '@playwright/test';

test.describe('Authentication Security', () => {
  test('JWT tokens expire correctly', async ({ page }) => {
    // Login and get token
    const response = await page.request.post('/api/auth/login', {
      data: { email: 'test@example.com', password: 'password' }
    });

    const { accessToken, expiresIn } = await response.json();
    expect(accessToken).toBeDefined();

    // Wait for token to expire (or test with very short expiry)
    // For testing, use a test account with 1-second expiry
    await page.waitForTimeout(expiresIn * 1000 + 100);

    // Try to use expired token
    const expiredResponse = await page.request.get('/api/user', {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    expect(expiredResponse.status()).toBe(401);
  });

  test('Refresh tokens rotate on use', async ({ page }) => {
    const loginResponse = await page.request.post('/api/auth/login', {
      data: { email: 'test@example.com', password: 'password' }
    });

    const refreshToken = loginResponse.headers()['set-cookie']
      .find(c => c.includes('refresh_token'))
      ?.split('=')[1]?.split(';')[0];

    // Use refresh token
    await page.request.post('/api/auth/refresh', {
      headers: { Cookie: `refresh_token=${refreshToken}` }
    });

    // Old refresh token should be invalidated
    const reUseResponse = await page.request.post('/api/auth/refresh', {
      headers: { Cookie: `refresh_token=${refreshToken}` }
    });

    expect(reUseResponse.status()).toBe(401);
  });
});

test.describe('Authorization Security', () => {
  test('cannot access other users resources', async ({ page }) => {
    // Login as user1
    const login1 = await page.request.post('/api/auth/login', {
      data: { email: 'user1@example.com', password: 'password' }
    });
    const token1 = await login1.json();

    // Login as user2
    const login2 = await page.request.post('/api/auth/login', {
      data: { email: 'user2@example.com', password: 'password' }
    });
    const token2 = await login2.json();

    // User1 creates a resource
    const createResponse = await page.request.post('/api/resources', {
      headers: { Authorization: `Bearer ${token1.accessToken}` },
      data: { name: 'User1 Resource', content: 'Secret data' }
    });

    expect(createResponse.status()).toBe(201);
    const resourceId = (await createResponse.json()).id;

    // User2 tries to access User1's resource
    const accessResponse = await page.request.get(`/api/resources/${resourceId}`, {
      headers: { Authorization: `Bearer ${token2.accessToken}` }
    });

    expect(accessResponse.status()).toBe(403);
  });
});

test.describe('XSS Prevention', () => {
  test('stored XSS is sanitized', async ({ page }) => {
    const login = await page.request.post('/api/auth/login', {
      data: { email: 'test@example.com', password: 'password' }
    });
    const token = (await login.json()).accessToken;

    const xssPayload = '<script>alert("XSS")</script>';

    // Post message with XSS
    const postResponse = await page.request.post('/api/messages', {
      headers: { Authorization: `Bearer ${token}` },
      data: { content: xssPayload }
    });

    expect(postResponse.status()).toBe(201);

    // Message should be sanitized
    const message = await postResponse.json();
    expect(message.content).not.toContain('<script>');
  });

  test('XSS in URL parameters is not reflected unsanitized', async ({ page }) => {
    const xssPayload = '<script>alert(1)</script>';
    await page.goto(`/search?q=${encodeURIComponent(xssPayload)}`);

    // Check that script doesn't execute
    await expect(page.locator('script')).toHaveCount(0);

    // Check page doesn't contain raw script tag
    const pageContent = await page.content();
    expect(pageContent).not.toContain('<script>alert');
  });
});

test.describe('Security Headers', () => {
  test('all security headers present', async ({ page }) => {
    const response = await page.request.get('/');

    const headers = response.headers();

    // Required security headers
    expect(headers['x-content-type-options']).toBe('nosniff');
    expect(headers['x-frame-options']).toMatch(/^(DENY|SAMEORIGIN)$/);
    expect(headers['referrer-policy']).toBeDefined();

    // CSP header (if present)
    if (headers['content-security-policy']) {
      expect(headers['content-security-policy']).toContain("default-src 'self'");
    }
  });
});
```

---

## 6. Reporting & Metrics

### Security Metrics Dashboard

```typescript
// Security metrics to track
interface SecurityMetrics {
  // Vulnerability counts by severity
  critical: number;
  high: number;
  medium: number;
  low: number;

  // Vulnerability categories
  xss: number;
  csrf: number;
  injection: number;
  auth: number;
  config: number;

  // Scan coverage
  filesScanned: number;
  coveragePercent: number;

  // Dependency health
  vulnerabilitiesInDependencies: number;
  outdatedDependencies: number;

  // Security test coverage
  securityTestsPassed: number;
  securityTestsFailed: number;
  securityTestsTotal: number;
}

// Weekly security report
async function generateSecurityReport(metrics: SecurityMetrics) {
  const report = {
    title: 'Weekly Security Report',
    generatedAt: new Date().toISOString(),
    summary: {
      totalVulnerabilities: metrics.critical + metrics.high + metrics.medium + metrics.low,
      openCritical: metrics.critical,
      openHigh: metrics.high
    },
    trends: {
      criticalChange: calculateTrend('critical'),
      highChange: calculateTrend('high'),
      coverageChange: calculateTrend('coverage')
    },
    topVulnerabilities: await getTopVulnerabilities(5),
    recommendations: generateRecommendations(metrics)
  };

  return report;
}
```

### Security Report Template

```markdown
# Security Assessment Report

## Executive Summary
- Total vulnerabilities found: X
- Critical: X | High: X | Medium: X | Low: X
- Coverage: X%
- Risk Score: X/10

## Vulnerabilities by Severity

### Critical
| ID | Vulnerability | Location | Status |
|----|---------------|----------|--------|
| SEC-001 | [Name] | [File:Line] | Open |

### High
...

## Vulnerabilities by Category
- XSS: X
- CSRF: X
- Auth: X
- Config: X

## Recommendations
1. [Priority 1 action]
2. [Priority 2 action]

## Timeline
- Assessment Date: YYYY-MM-DD
- Next Assessment: YYYY-MM-DD
```

---

## OWASP References

- [SAST Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Static_Content_Security_Prevention_Cheat_Sheet.html)
- [Dependency Confusion](https://cheatsheetseries.owasp.org/cheatsheets/Denial_of_Service_Cheat_Sheet.html)
- [Vulnerability Scanning](https://owasp.org/www-project-web-security-testing-guide/)

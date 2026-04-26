---
title: "Advanced CSP Configuration"
description: ""
date: "2026-04-24"
author: "Saul Vo"
tags: ["xss","csrf","csp","security"]
readingTime: "5 min"
order: 1
slug: "csp-advanced"
category: "xss-csrf-csp"
---

# Advanced CSP Configuration

## Mục lục
1. [CSP Deep Dive](#1-csp-deep-dive)
2. [CSP Directives](#2-csp-directives)
3. [Bypass Techniques](#3-bypass-techniques)
4. [Nonce-Based CSP](#4-nonce-based-csp)
5. [Strict CSP Migration](#5-strict-csp-migration)
6. [Monitoring & Reporting](#6-monitoring--reporting)

---

## 1. CSP Deep Dive

### CSP Purpose and Mechanism

```
┌─────────────────────────────────────────────────────────────────────┐
│                    CSP Mechanism                                      │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  CSP works by HTTP header:                                         │
│                                                                     │
│  Content-Security-Policy: <directives>                              │
│                                                                     │
│  Browser behavior:                                                  │
│  1. Page loads with CSP header                                      │
│  2. Browser creates policy from header                             │
│  3. For each resource load, browser checks:                        │
│     "Does this load match any allowed source?"                    │
│  4. If no match → blocked + optional report                       │
│  5. If match → load proceeds                                       │
│                                                                     │
│  Note: CSP only applies to browser parsing/rendering               │
│        It does NOT prevent server-side injection                   │
│        It does NOT encrypt data                                    │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### CSP Report-Only Mode

```http
# Test CSP without enforcement
Content-Security-Policy-Report-Only: 
  default-src 'self';
  script-src 'self' 'nonce-abc123';
  report-uri /csp-report;

# Server receives violation reports
{
  "csp-report": {
    "document-uri": "https://example.com/page",
    "blocked-uri": "https://evil.com/evil.js",
    "disposition": "report",
    "effective-directive": "script-src",
    "original-policy": "default-src 'self'; script-src 'self' 'nonce-abc123'",
    "violated-directive": "script-src 'self' 'nonce-abc123'"
  }
}
```

---

## 2. CSP Directives

### Complete Directive Reference

```http
Content-Security-Policy:

  # Fetch directives (control resource loading)
  default-src 'self';
  script-src 'self' 'nonce-xyz';
  style-src 'self' 'unsafe-inline';
  img-src 'self' https: data:;
  font-src 'self' https://fonts.gstatic.com;
  connect-src 'self' https://api.example.com wss://ws.example.com;
  media-src 'self' https://media.example.com;
  object-src 'none';
  frame-src 'none';
  frame-ancestors 'none';
  child-src 'none';
  worker-src 'self';
  manifest-src 'self';

  # Document directives (control page properties)
  base-uri 'self';
  sandbox allow-scripts allow-forms;
  report-uri /csp-report;
  report-to csp-group;

  # Navigation directives
  form-action 'self';
  frame-ancestors 'none';

  # Reporting
  report-uri /csp-report;
  report-to csp-endpoint;
```

### Source Allowlists

| Source | Description | Example |
|--------|-------------|---------|
| `'self'` | Same origin | script-src 'self' |
| `'none'` | Block all | object-src 'none' |
| `'unsafe-inline'` | Inline scripts/styles | style-src 'unsafe-inline' |
| `'unsafe-eval'` | eval() usage | script-src 'unsafe-eval' |
| `'strict-dynamic'` | Trust scripts from trusted scripts | script-src 'strict-dynamic' |
| `'nonce-xxx'` | Allow script with nonce | script-src 'nonce-xyz' |
| `'sha256-xxx'` | Allow specific script hash | script-src 'sha256-abc123' |
| `'unsafe-hashes'` | Allow specific inline handlers | Not recommended |
| https: | Allow all HTTPS | img-src https: |
| data: | Allow data: URLs | img-src data: |
| 'unsafe-allowredirects' | Allow redirects | Not standard |

---

## 3. Bypass Techniques

### Bypassing with unsafe-inline

```html
<!-- If 'unsafe-inline' is allowed, inline handlers work -->
<button onclick="alert(1)">XSS</button>
<img src=x onerror="alert(1)">
<div onmouseover="alert(1)">XSS</div>

<!-- Prevention: Don't use 'unsafe-inline' -->
<!-- Use nonce or hash instead -->
```

### Bypassing with JSONP

```html
<!-- If app includes JSONP endpoints -->
<script src="https://api.example.com/jsonp?callback=alert(1)//"></script>

<!-- Or if app includes scripts from CDN with JSONP -->
<script src="https://trusted-cdn.com/load?callback=evil"></script>
```

### Bypassing with File Upload

```html
<!-- If user can upload files and app serves them -->
<!-- Attacker uploads evil.jpg with embedded JS -->
<!-- If server doesn't validate MIME type properly: -->
<script src="/uploads/evil.jpg"></script>

<!-- Prevention: -->
<!-- 1. Store uploads outside webroot -->
<!-- 2. Force application/octet-stream for downloads -->
<!-- 3. Validate file signatures (magic bytes) -->
```

### Bypassing via DNS Rebinding

```http
# If connect-src allows external domains
connect-src 'self' https://*.example.com;

# Attacker uses DNS that initially resolves to victim, then to attacker
# Not easily prevented by CSP alone
```

### Bypassing via Service Worker

```javascript
// If attacker can register a Service Worker:
// 1. Service Worker can intercept all requests
// 2. Can serve malicious content
// 3. Can exfiltrate data

// Prevention:
// 1. Don't allow user-controlled SW registration
// 2. Use 'worker-src' directive
// 3. Register SWs only from your own origin
```

---

## 4. Nonce-Based CSP

### How Nonce Works

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Nonce-Based CSP                                  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Server:                                                          │
│  1. Generate unique nonce per request                              │
│  2. Include in CSP header + in script tags                         │
│  3. Nonce changes on every page load                              │
│                                                                     │
│  Content-Security-Policy: script-src 'nonce-abc123' 'strict-dynamic'  │
│                                                                     │
│  <script nonce="abc123">/* allowed script */</script>             │
│  <script>/* NOT allowed - no nonce */</script>                    │
│                                                                     │
│  Attacker:                                                        │
│  • Cannot predict nonce                                           │
│  • Cannot inject script without knowing nonce                    │
│  • 'strict-dynamic' allows trusted scripts to load dependencies  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Implementation (Express.js)

```javascript
// middleware/csp-nonce.js
const crypto = require('crypto');

function cspNonceMiddleware(req, res, next) {
  // Generate random nonce
  const nonce = crypto.randomBytes(16).toString('base64');

  // Store in res.locals for use in templates
  res.locals.nonce = nonce;

  // Set CSP header
  res.setHeader(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      // Allow scripts with the nonce
      `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
      // Unsafe inline for styles (or use nonce for styles too)
      "style-src 'self' 'unsafe-inline'",
      // Images from same origin and specific CDNs
      "img-src 'self' data: https://images.unsplash.com",
      // Fonts from Google Fonts
      "font-src 'self' https://fonts.gstatic.com",
      // Connect to same origin and API
      "connect-src 'self' https://api.example.com",
      // No objects
      "object-src 'none'",
      // No frames
      "frame-ancestors 'none'"
    ].join('; ')
  );

  next();
}

module.exports = cspNonceMiddleware;
```

```ejs
<!-- Template: layout.ejs -->
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <!-- CSP nonce available from middleware -->
  <!-- Template should inject nonce into script tags -->
</head>
<body>
  <%- body %>

  <!-- Scripts with nonce -->
  <script nonce="<%= nonce %>">
    // Application code here
    console.log('Nonced script');
  </script>

  <!-- Or external scripts with nonce -->
  <script src="/app.js" nonce="<%= nonce %>"></script>
</body>
</html>
```

### React + Nonce Implementation

```typescript
// _app.tsx (Next.js)
import { Html, Head, Main, NextScript } from 'next/document';

export default function Document() {
  // Get nonce from custom header (set by server)
  // This needs to be passed from server to client

  return (
    <Html>
      <Head>
        {/* CSP meta tag (less secure than header, but works) */}
        {/* Real implementation should use HTTP header */}
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}

// getServerSideProps to add nonce header
export async function getServerSideProps({ res }) {
  const nonce = crypto.randomBytes(16).toString('base64');

  res.setHeader(
    'Content-Security-Policy',
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'; object-src 'none';`
  );

  return {
    props: {
      nonce  // Passed to page as prop
    }
  };
}

// In your _app.tsx, pass nonce to scripts
function MyApp({ Component, pageProps, nonce }) {
  return (
    <SessionProvider session={pageProps.session}>
      <Component {...pageProps} />
      {/* Nonce needs to be accessible to scripts */}
    </SessionProvider>
  );
}
```

---

## 5. Strict CSP Migration

### Migration Strategy

```
┌─────────────────────────────────────────────────────────────────────┐
│                    CSP Migration Steps                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Phase 1: Audit & Report                                            │
│  • Enable CSP-Report-Only                                           │
│  • Collect violation reports                                       │
│  • Identify required resources                                    │
│  • Map all third-party scripts                                     │
│                                                                     │
│  Phase 2: Relaxed CSP                                              │
│  • Create CSP with known-good allowlist                           │
│  • Include 'unsafe-inline' for styles                             │
│  • Include needed domains                                         │
│  • Test in report-only mode                                        │
│                                                                     │
│  Phase 3: Remove unsafe-inline                                   │
│  • Use 'nonce' for inline styles                                  │
│  • Or use CSS-in-JS solution                                       │
│                                                                     │
│  Phase 4: Strict CSP                                              │
│  • Remove 'unsafe-inline' entirely                                │
│  • Add nonces/hashes                                               │
│  • Lock down all sources                                          │
│                                                                     │
│  Phase 5: Monitor & Maintain                                      │
│  • Review reports regularly                                        │
│  • Update nonces on new deployments                               │
│  • Audit new third-party additions                                 │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Starting CSP (Report-Only)

```http
# Start with report-only to see what's needed
Content-Security-Policy-Report-Only:
  default-src 'self';
  script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.example.com;
  style-src 'self' 'unsafe-inline' https://cdn.example.com;
  img-src 'self' data: https:;
  font-src 'self' https://fonts.gstatic.com;
  connect-src 'self' https://api.example.com;
  report-uri /csp-report;
```

### Progressive Strict CSP

```http
# After audit, move to strict CSP
Content-Security-Policy:
  # Default to none
  default-src 'none';

  # Allow same origin
  default-src 'self';

  # Scripts with nonce
  script-src 'self' 'nonce-abc123';

  # Styles with nonce (if needed)
  style-src 'self' 'nonce-def456';

  # Images
  img-src 'self' data: https://images.unsplash.com;

  # Fonts
  font-src 'self' https://fonts.gstatic.com;

  # API calls
  connect-src 'self' https://api.example.com;

  # No objects/iframes
  object-src 'none';
  frame-src 'none';
  frame-ancestors 'none';
```

### CSP with Hash for Static Scripts

```http
# For inline scripts that won't change often, use hashes
Content-Security-Policy:
  script-src 'self' 'sha256-base64hash-of-script';
  script-src 'self' 'sha256-another-script-hash';

# Browser calculates: sha256 of <script>content</script> and compares
```

### Common Third-Party Integrations

```http
# Google Analytics
Content-Security-Policy:
  script-src 'self' 'unsafe-inline' https://www.google-analytics.com;
  img-src 'self' https://www.google-analytics.com;
  connect-src 'self' https://www.google-analytics.com;

# Google Fonts
Content-Security-Policy:
  font-src 'self' https://fonts.gstatic.com;
  style-src 'self' https://fonts.googleapis.com;

# Stripe (if payment integration)
Content-Security-Policy:
  script-src 'self' 'unsafe-inline' https://js.stripe.com;
  frame-src 'self' https://js.stripe.com https://hooks.stripe.com;

# Intercom
Content-Security-Policy:
  script-src 'self' 'unsafe-inline' https://js.intercomcdn.com;
  img-src 'self' https://uploads.intercomcdn.com;
  connect-src 'self' wss://app-nexus.intercom.com wss://nexus.intercom.io;
```

---

## 6. Monitoring & Reporting

### CSP Violation Report Endpoint

```javascript
// Express endpoint for CSP reports
app.post('/csp-report', express.json({ type: 'application/csp-report' }), (req, res) => {
  const report = req.body['csp-report'];

  if (report) {
    // Log the violation
    console.log('CSP Violation:', {
      timestamp: new Date().toISOString(),
      documentUri: report['document-uri'],
      blockedUri: report['blocked-uri'],
      violatedDirective: report['violated-directive'],
      originalPolicy: report['original-policy']
    });

    // Store for analysis
    await cspReportsCollection.insertOne({
      ...report,
      timestamp: new Date(),
      userAgent: req.headers['user-agent'],
      sourceIp: req.ip
    });

    // Alert on new violations (especially for previously allowed resources)
    checkForNewBlockedResources(report);
  }

  res.status(204).end();
});
```

### Report-Only Endpoint

```javascript
// Different endpoint for Report-Only
app.post('/csp-report-only', express.json({ type: 'application/csp-report' }), (req, res) => {
  const report = req.body['csp-report'];

  if (report) {
    // Analyze without blocking
    await cspReportsCollection.insertOne({
      ...report,
      type: 'report-only',
      timestamp: new Date()
    });
  }

  res.status(204).end();
});
```

### Violation Analysis Dashboard

```typescript
// API endpoint for violation dashboard
app.get('/admin/csp-reports', requirePermission('admin:view'), async (req, res) => {
  const { startDate, endDate, directive, page = 1, limit = 50 } = req.query;

  const query: any = {};
  if (startDate || endDate) {
    query.timestamp = {};
    if (startDate) query.timestamp.$gte = new Date(startDate);
    if (endDate) query.timestamp.$lte = new Date(endDate);
  }
  if (directive) query['violated-directive'] = directive;

  const reports = await cspReportsCollection
    .find(query)
    .sort({ timestamp: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .toArray();

  const total = await cspReportsCollection.countDocuments(query);

  // Aggregate statistics
  const stats = await cspReportsCollection.aggregate([
    { $match: query },
    {
      $group: {
        _id: '$violated-directive',
        count: { $sum: 1 },
        blockedDomains: { $addToSet: '$blocked-uri' }
      }
    }
  ]).toArray();

  res.json({
    reports,
    stats,
    pagination: { page, limit, total }
  });
});
```

### Alerting on New Violations

```javascript
// Check for unexpected CSP violations
async function checkForNewBlockedResources(report) {
  // Known blocked resources (previously seen)
  const knownBlocked = await cache.get('known_blocked_domains') || [];

  const newBlocked = new URL(report['blocked-uri']);

  // If blocked resource is from a new domain
  if (!knownBlocked.includes(newBlocked.hostname)) {
    // Alert administrators
    await sendAlert({
      type: 'NEW_CSP_VIOLATION',
      severity: newBlocked.hostname.includes('attacker') ? 'HIGH' : 'MEDIUM',
      message: `New blocked domain: ${newBlocked.hostname}`,
      details: {
        blockedUri: report['blocked-uri'],
        directive: report['violated-directive'],
        documentUri: report['document-uri']
      }
    });

    // Update known blocked
    knownBlocked.push(newBlocked.hostname);
    await cache.set('known_blocked_domains', knownBlocked, { ttl: 86400 });
  }
}
```

### Browser DevTools

```
┌─────────────────────────────────────────────────────────────────────┐
│                    CSP Violations in DevTools                       │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Chrome:                                                           │
│  • Open DevTools → Console                                         │
│  • CSP violations appear in red                                   │
│  • Filter by "csp" in filter box                                  │
│  • Network tab shows blocked resources with CSP status              │
│                                                                     │
│  Firefox:                                                          │
│  • Open DevTools → Console                                        │
│  • CSP warnings shown with (CSP) prefix                           │
│  • Security panel shows CSP info                                  │
│                                                                     │
│  Information shown:                                                │
│  • Which directive was violated                                   │
│  • Which resource was blocked                                      │
│  • Which page loaded the resource                                 │
│  • Full policy that was in effect                                  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## OWASP References

- [CSP Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Content_Security_Policy_Cheat_Sheet.html)
- [CSP Evaluator](https://csp-evaluator.withgoogle.com/) - Test your CSP
- [CSP Header Generator](https://www.cspheader.com/) - Generate CSP headers

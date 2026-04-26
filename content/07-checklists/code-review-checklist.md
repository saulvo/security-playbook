---
title: "Code Review Security Checklist"
description: ""
date: "2026-04-24"
author: "Saul Vo"
tags: ["checklist","security","best-practices"]
readingTime: "5 min"
order: 1
slug: "code-review-checklist"
category: "checklists"
---

# Code Review Security Checklist

## Mục lục
1. [Authentication & Authorization](#1-authentication--authorization)
2. [Input Validation & Output Encoding](#2-input-validation--output-encoding)
3. [Cryptography](#3-cryptography)
4. [Error Handling & Logging](#4-error-handling--logging)
5. [Security Headers & Configuration](#5-security-headers--configuration)
6. [React-Specific](#6-react-specific)

---

## 1. Authentication & Authorization

### Authentication Review

- [ ] **JWT Implementation**
  - [ ] Algorithm explicitly specified (`algorithms: ['HS256']`)
  - [ ] Token expiration enforced (`exp` claim)
  - [ ] Secret key from environment, not hardcoded
  - [ ] `iss` and `aud` claims validated
  - [ ] Token stored in httpOnly cookie or sessionStorage

- [ ] **Session Management**
  - [ ] Session ID: cryptographically random (32+ bytes)
  - [ ] httpOnly, secure, sameSite attributes set
  - [ ] Session regenerated after login
  - [ ] Session expiration enforced server-side
  - [ ] Session destroyed on logout

- [ ] **Password Handling**
  - [ ] Passwords hashed with Argon2id or bcrypt
  - [ ] Password never logged or returned in responses
  - [ ] Password reset tokens: random, single-use, time-limited

### Authorization Review

- [ ] **Access Control**
  - [ ] Server-side authorization check for every endpoint
  - [ ] Resource ownership validated before mutation
  - [ ] Role-based permissions checked correctly
  - [ ] IDOR protection: can't access other users' resources

- [ ] **API Authorization**
  - [ ] `/api/*` endpoints require authentication
  - [ ] Admin endpoints require admin role
  - [ ] Rate limiting applied

---

## 2. Input Validation & Output Encoding

### Input Validation Review

- [ ] **All User Input Validated**
  - [ ] Type validation (string, number, boolean)
  - [ ] Length validation (min, max)
  - [ ] Format validation (email, URL, UUID)
  - [ ] Allowlist validation preferred over denylist

- [ ] **File Uploads**
  - [ ] File type extension validated (allowlist)
  - [ ] MIME type validated
  - [ ] File size limited
  - [ ] Content scanned or re-encoded

- [ ] **Database Queries**
  - [ ] Parameterized queries (no string concatenation)
  - [ ] ORM used correctly
  - [ ] Input sanitized before DB operations

### Output Encoding Review

- [ ] **XSS Prevention**
  - [ ] User input escaped before rendering
  - [ ] `dangerouslySetInnerHTML` only with prior `DOMPurify.sanitize()`
  - [ ] No `.innerHTML =` with user data
  - [ ] Event handlers not created from user input

- [ ] **Context-Aware Encoding**
  - [ ] HTML context: `&lt;`, `&gt;`, `&amp;`, `&quot;`
  - [ ] JavaScript context: Unicode escaping
  - [ ] URL context: `encodeURIComponent`
  - [ ] CSS context: no user input in styles

---

## 3. Cryptography

### Crypto Review

- [ ] **No Crypto Weakness**
  - [ ] No MD5 for hashing
  - [ ] No SHA1 for security purposes
  - [ ] No DES/3DES for new code
  - [ ] No `eval()` for dynamic code execution
  - [ ] No custom crypto (use established libraries)

- [ ] **Secure Random**
  - [ ] Use `crypto.getRandomValues()` or `crypto.randomBytes()`
  - [ ] Never `Math.random()` for security

- [ ] **Key Management**
  - [ ] Keys not hardcoded
  - [ ] Keys not in version control
  - [ ] Keys rotated appropriately
  - [ ] Encryption keys separate from signing keys

- [ ] **Sensitive Data**
  - [ ] No secrets in code
  - [ ] No tokens in URL parameters
  - [ ] No API keys in client-side code
  - [ ] Sensitive data not logged

---

## 4. Error Handling & Logging

### Error Handling Review

- [ ] **Error Messages**
  - [ ] No stack traces in production
  - [ ] No sensitive data in error responses
  - [ ] Generic errors to clients, detailed logs to server

- [ ] **Exception Handling**
  - [ ] All exceptions caught and handled
  - [ ] Async errors wrapped properly
  - [ ] Unhandled promise rejections caught

- [ ] **Status Codes**
  - [ ] 401 for authentication failures
  - [ ] 403 for authorization failures
  - [ ] 404 without revealing resource existence
  - [ ] 500 for unexpected errors

### Logging Review

- [ ] **Security Events Logged**
  - [ ] Login attempts (success and failure)
  - [ ] Authorization failures
  - [ ] Token validation failures
  - [ ] Admin actions

- [ ] **Log Security**
  - [ ] No passwords in logs
  - [ ] No tokens or API keys in logs
  - [ ] No PII without consent
  - [ ] Logs secured and retention policy enforced

---

## 5. Security Headers & Configuration

### Security Headers Review

- [ ] **CSP (Content Security Policy)**
  - [ ] CSP header configured
  - [ ] No `'unsafe-inline'` for scripts
  - [ ] No `'unsafe-eval'`
  - [ ] Strict allowlist for sources

- [ ] **Other Security Headers**
  - [ ] `X-Content-Type-Options: nosniff`
  - [ ] `X-Frame-Options: DENY`
  - [ ] `Strict-Transport-Security` (if HTTPS)
  - [ ] `Referrer-Policy: strict-origin-when-cross-origin`

- [ ] **CORS**
  - [ ] Proper origin validation
  - [ ] `Access-Control-Allow-Origin` not `*` for sensitive data
  - [ ] Credentials flag handled correctly

---

## 6. React-Specific

### React Security Review

- [ ] **State Management**
  - [ ] No sensitive data in client-side state (unless necessary)
  - [ ] State cleared on logout
  - [ ] State not persisted to localStorage without encryption

- [ ] **Component Security**
  - [ ] `dangerouslySetInnerHTML` used with sanitization
  - [ ] No `innerHTML` property assignment
  - [ ] User input not directly rendered to HTML
  - [ ] URLs validated before rendering

- [ ] **Authentication Flow**
  - [ ] Auth tokens stored securely (sessionStorage, not localStorage)
  - [ ] Protected routes check authentication
  - [ ] Auth state not exposed in URLs
  - [ ] Logout clears all auth data

- [ ] **API Security**
  - [ ] API calls include auth headers
  - [ ] Token refresh handled correctly
  - [ ] Sensitive data not cached in API responses
  - [ ] Requests validated for CSRF (if using cookies)

---

## Code Review Sign-Off Checklist

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Code Review Security Checklist                   │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  PR Title: ________________________________________                │
│  Author: ___________________________________________               │
│  Reviewer: _________________________________________                │
│  Date: ___________________________________________                │
│                                                                     │
│  Security Review:                                                  │
│  ☐ Authentication & authorization reviewed                        │
│  ☐ Input validation & output encoding reviewed                     │
│  ☐ Cryptography practices verified                                 │
│  ☐ Error handling & logging reviewed                              │
│  ☐ Security headers verified                                      │
│  ☐ React-specific security reviewed                               │
│                                                                     │
│  Issues Found:                                                     │
│  Critical: _______                                                │
│  High: _______                                                     │
│  Medium: _______                                                   │
│  Low: _______                                                      │
│                                                                     │
│  Status: ☐ Approved ☐ Changes Requested ☐ Blocked               │
│                                                                     │
│  Security Sign-off: _________________________                       │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

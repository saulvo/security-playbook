---
title: "Pre-Development Security Checklist"
description: ""
date: "2026-04-24"
author: "Saul Vo"
tags: ["checklist","security","best-practices"]
readingTime: "5 min"
order: 3
slug: "pre-development-checklist"
category: "checklists"
---

# Pre-Development Security Checklist

## Mục lục
1. [Architecture Review](#1-architecture-review)
2. [Authentication Design](#2-authentication-design)
3. [Authorization Design](#3-authorization-design)
4. [Data Security](#4-data-security)
5. [Dependencies](#5-dependencies)
6. [Infrastructure](#6-infrastructure)

---

## 1. Architecture Review

### Security Architecture Checklist

- [ ] **Threat Modeling Completed**
  - [ ] Identify all assets to protect
  - [ ] Map data flows
  - [ ] Identify trust boundaries
  - [ ] Document attack surfaces
  - [ ] Assess risks and prioritize

- [ ] **Attack Surface Mapped**
  - [ ] All public endpoints documented
  - [ ] All API routes identified
  - [ ] WebSocket endpoints identified
  - [ ] Third-party integrations listed
  - [ ] File upload/download points identified

- [ ] **Security Requirements Defined**
  - [ ] Data classification (public, internal, confidential, restricted)
  - [ ] Compliance requirements (GDPR, HIPAA, PCI-DSS)
  - [ ] Retention policies defined
  - [ ] Encryption requirements specified
  - [ ] Session timeout requirements

---

## 2. Authentication Design

### Authentication Checklist

- [ ] **Authentication Mechanism Selected**
  - [ ] JWT with secure storage
  - [ ] OAuth2/OIDC (with provider)
  - [ ] Session-based (httpOnly cookies)
  - [ ] MFA required for sensitive operations

- [ ] **Token Security**
  - [ ] Access token expiration: 15-60 minutes
  - [ ] Refresh token rotation implemented
  - [ ] Token storage: httpOnly cookies (preferred) or sessionStorage
  - [ ] Algorithm explicitly specified (HS256 or RS256)
  - [ ] Secret key: 256+ bits

- [ ] **Password Security**
  - [ ] Password policy enforced (min 8 chars, complexity)
  - [ ] Password hashing: Argon2id or bcrypt (cost factor 12+)
  - [ ] No password in URL or logs
  - [ ] Password reset with secure token

- [ ] **MFA Implementation**
  - [ ] TOTP (authenticator app) supported
  - [ ] Backup codes generated and stored securely
  - [ ] Recovery options defined

---

## 3. Authorization Design

### Authorization Checklist

- [ ] **Access Control Model**
  - [ ] RBAC/ABAC/ReBAC model selected
  - [ ] Role hierarchy defined
  - [ ] Permission matrix documented
  - [ ] Ownership model defined

- [ ] **Permission Management**
  - [ ] Permissions tied to user role, not directly to user
  - [ ] Least privilege principle applied
  - [ ] Admin access requires elevated privileges
  - [ ] Guest/anonymous access limited

- [ ] **Resource-Level Authorization**
  - [ ] Ownership checks for all resource mutations
  - [ ] Team/group access properly scoped
  - [ ] Sharing functionality validated
  - [ ] Temporary access grants with expiry

---

## 4. Data Security

### Data Security Checklist

- [ ] **Data Classification**
  - [ ] Sensitive data (PII, payment) identified
  - [ ] Encryption requirements defined per classification
  - [ ] Data retention policies specified

- [ ] **Encryption at Rest**
  - [ ] Database encryption enabled
  - [ ] File storage encryption enabled
  - [ ] Backup encryption configured
  - [ ] Key management strategy defined

- [ ] **Encryption in Transit**
  - [ ] TLS 1.2+ enforced
  - [ ] Certificate pinning for mobile apps
  - [ ] WSS (WebSocket Secure) required
  - [ ] HSTS configured

- [ ] **Input Validation**
  - [ ] Allowlist validation (prefer) vs denylist
  - [ ] Type, length, format validation
  - [ ] Sanitization for stored data (XSS prevention)
  - [ ] File upload validation (type, size, content)

---

## 5. Dependencies

### Dependencies Checklist

- [ ] **Dependency Management**
  - [ ] Package manager locked (package-lock.json, yarn.lock)
  - [ ] Minimal dependencies policy
  - [ ] Vendor isolation strategy
  - [ ] Private packages security policy

- [ ] **Security Scanning**
  - [ ] npm audit in CI pipeline
  - [ ] Snyk or Dependabot enabled
  - [ ] Known CVE monitoring active
  - [ ] Regular dependency updates scheduled

- [ ] **Trusted Sources**
  - [ ] Only npm/yarn official registries
  - [ ] Package provenance verification
  - [ ] No typosquatting (verify package names)
  - [ ] Review new dependencies before adding

---

## 6. Infrastructure

### Infrastructure Checklist

- [ ] **Secrets Management**
  - [ ] Environment variables for secrets
  - [ ] Secret rotation policy defined
  - [ ] Secrets not in code or version control
  - [ ] Secret scanning in CI

- [ ] **Security Headers**
  - [ ] Content-Security-Policy configured
  - [ ] X-Content-Type-Options: nosniff
  - [ ] X-Frame-Options: DENY
  - [ ] Strict-Transport-Security configured
  - [ ] Referrer-Policy configured
  - [ ] Permissions-Policy configured

- [ ] **Rate Limiting**
  - [ ] API rate limits defined
  - [ ] Auth endpoint rate limiting
  - [ ] DDoS protection configured
  - [ ] IP blocklist/allowlist

- [ ] **Logging & Monitoring**
  - [ ] Security event logging
  - [ ] Failed authentication logging
  - [ ] Access anomaly detection
  - [ ] Alert thresholds defined
  - [ ] Audit log retention policy

---

## Pre-Development Security Sign-Off

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Pre-Development Sign-Off                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Project: _______________________________________                   │
│  Date: _______________________________________                      │
│                                                                     │
│  Security Architecture:                                            │
│  ☐ Reviewed by Security Team                                     │
│  ☐ Threat model completed                                          │
│  ☐ Attack surface documented                                       │
│                                                                     │
│  Authentication & Authorization:                                    │
│  ☐ Auth design approved                                           │
│  ☐ RBAC model approved                                            │
│  ☐ Permission matrix reviewed                                      │
│                                                                     │
│  Data Protection:                                                  │
│  ☐ Data classification approved                                   │
│  ☐ Encryption requirements defined                                │
│  ☐ Retention policy defined                                       │
│                                                                     │
│  Infrastructure:                                                   │
│  ☐ Security headers configured                                     │
│  ☐ Secrets management approved                                     │
│  ☐ Monitoring plan reviewed                                       │
│                                                                     │
│  Signatures:                                                        │
│  Security Lead: _________________ Date: _____                      │
│  Engineering Lead: _________________ Date: _____                 │
│  Product Owner: _________________ Date: _____                    │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

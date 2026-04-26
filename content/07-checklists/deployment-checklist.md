---
title: "Deployment Security Checklist"
description: ""
date: "2026-04-24"
author: "Saul Vo"
tags: ["checklist","security","best-practices"]
readingTime: "5 min"
order: 2
slug: "deployment-checklist"
category: "checklists"
---

# Deployment Security Checklist

## Mục lục
1. [Pre-Deployment](#1-pre-deployment)
2. [Infrastructure Security](#2-infrastructure-security)
3. [Application Security](#3-application-security)
4. [Monitoring & Incident Response](#4-monitoring--incident-response)
5. [Compliance & Documentation](#5-compliance--documentation)

---

## 1. Pre-Deployment

### Pre-Deployment Checklist

- [ ] **Security Testing Completed**
  - [ ] SAST scan passed with no critical/high findings
  - [ ] DAST scan completed and vulnerabilities addressed
  - [ ] Dependency scan passed (no known CVE in dependencies)
  - [ ] Secrets scan passed (no secrets in codebase)
  - [ ] Security unit tests passing

- [ ] **Code Freeze**
  - [ ] No debug code in production
  - [ ] No test endpoints exposed
  - [ ] Console.log/debug removed
  - [ ] Source maps disabled in production
  - [ ] Verbose error handling disabled

- [ ] **Deployment Plan**
  - [ ] Rollback plan documented and tested
  - [ ] Deployment window scheduled
  - [ ] Communication plan for stakeholders
  - [ ] On-call team notified
  - [ ] Monitoring dashboards ready

---

## 2. Infrastructure Security

### Infrastructure Checklist

- [ ] **Network Security**
  - [ ] TLS 1.2+ enforced on all endpoints
  - [ ] Certificates valid and not expired
  - [ ] Certificate renewal automation
  - [ ] Load balancer configured securely
  - [ ] WAF rules configured
  - [ ] DDoS protection enabled

- [ ] **Server Security**
  - [ ] Servers hardened (latest patches)
  - [ ] Unnecessary services disabled
  - [ ] Firewall configured (least privilege)
  - [ ] SSH access restricted (key-based only)
  - [ ] Ports closed (no exposed services)

- [ ] **Secrets Management**
  - [ ] Secrets injected at runtime (not in image)
  - [ ] Secrets from secure vault
  - [ ] Secrets rotated after deployment
  - [ ] Old secrets revoked

- [ ] **Container Security** (if applicable)
  - [ ] Minimal base image
  - [ ] No secrets in Dockerfiles
  - [ ] Non-root user in container
  - [ ] Read-only root filesystem
  - [ ] Container signing verified

---

## 3. Application Security

### Application Security Checklist

- [ ] **Security Headers**
  - [ ] Content-Security-Policy set
  - [ ] X-Content-Type-Options: nosniff
  - [ ] X-Frame-Options: DENY
  - [ ] Strict-Transport-Security (HSTS)
  - [ ] Referrer-Policy set
  - [ ] Permissions-Policy set

- [ ] **API Security**
  - [ ] Rate limiting enabled
  - [ ] CORS configured correctly
  - [ ] API versioning in place
  - [ ] Deprecation warnings ready

- [ ] **Database Security**
  - [ ] Database credentials rotated
  - [ ] Connection string secured
  - [ ] Encryption at rest enabled
  - [ ] Backup encryption configured
  - [ ] Backup tested

- [ ] **Authentication**
  - [ ] Production auth working correctly
  - [ ] MFA enforced for admin accounts
  - [ ] Session timeout configured
  - [ ] Password policy enforced

---

## 4. Monitoring & Incident Response

### Monitoring Checklist

- [ ] **Logging Enabled**
  - [ ] Application logs centralized
  - [ ] Security events logged
  - [ ] Access logs enabled
  - [ ] Error logs captured
  - [ ] Log retention policy active

- [ ] **Monitoring Active**
  - [ ] Uptime monitoring
  - [ ] Performance monitoring
  - [ ] Security event alerting
  - [ ] Error rate alerting
  - [ ] Anomaly detection enabled

- [ ] **Incident Response**
  - [ ] IR plan documented
  - [ ] Contact list updated
  - [ ] Escalation procedures defined
  - [ ] Forensic tools ready
  - [ ] Communication templates prepared

- [ ] **Backup Verification**
  - [ ] Backup schedule verified
  - [ ] Backup restoration tested
  - [ ] Backup retention verified
  - [ ] Off-site backup confirmed

---

## 5. Compliance & Documentation

### Compliance Checklist

- [ ] **Data Protection**
  - [ ] PII handling documented
  - [ ] Data retention policy enforced
  - [ ] Right to deletion mechanism
  - [ ] Data export capability
  - [ ] Cookie consent (if applicable)

- [ ] **Documentation**
  - [ ] Architecture diagram updated
  - [ ] Security configuration documented
  - [ ] Deployment runbook complete
  - [ ] Incident response plan accessible
  - [ ] Security contacts listed

- [ ] **Audit Trail**
  - [ ] All security events logged
  - [ ] Audit logs immutable
  - [ ] Log integrity verified
  - [ ] Retention meets requirements

---

## Deployment Sign-Off

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Deployment Security Sign-Off                      │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Environment: ☐ Production ☐ Staging ☐ Development                 │
│  Version: _______________________________________                  │
│  Deployment Date: _______________________________                  │
│                                                                     │
│  Pre-Deployment Checks:                                             │
│  ☐ All security tests passing                                       │
│  ☐ No critical/high vulnerabilities open                           │
│  ☐ Secrets managed properly                                         │
│  ☐ Security headers configured                                     │
│  ☐ Monitoring and alerting active                                  │
│  ☐ Rollback plan tested                                            │
│                                                                     │
│  Infrastructure:                                                   │
│  ☐ Network security verified                                       │
│  ☐ Server hardening complete                                       │
│  ☐ TLS/SSL configured                                              │
│  ☐ Database security verified                                       │
│                                                                     │
│  Application:                                                      │
│  ☐ Security headers present                                        │
│  ☐ Rate limiting configured                                        │
│  ☐ Authentication verified                                          │
│  ☐ Authorization verified                                           │
│                                                                     │
│  Monitoring:                                                       │
│  ☐ Logs centralized                                                │
│  ☐ Alerts configured                                               │
│  ☐ Backup verified                                                 │
│                                                                     │
│  Approvals:                                                        │
│  Security Lead: _________________ Date: _____                      │
│  DevOps Lead: _________________ Date: _____                        │
│  Engineering Manager: _________________ Date: _____                  │
│  Product Owner: _________________ Date: _____                       │
│                                                                     │
│  ☐ Ready for Deployment                                            │
│  ☐ Blocked - Reason: ___________________________________________ │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Quick Reference: Deployment Commands

```bash
# Pre-deployment security checks
npm audit --audit-level=high
npx eslint --ext .ts,.tsx src/
detect-secrets scan --baseline .secrets.baseline

# Environment variables check
grep -r "process\.env\." src/ | grep -v "NEXT_PUBLIC"

# Build verification
npm run build
grep -r "console\.(log|debug)" .next/

# Secrets check in built files
grep -rE "api[_-]key|secret|password|token" .next/

# Security headers check (replace with your domain)
curl -I https://yourapp.com | grep -E "Content-Security|X-Content|X-Frame|Strict-Transport"
```

# Security Playbook

A comprehensive guide to securing frontend applications. Covers authentication, authorization, encryption, XSS/CSRF/CSP, WebSocket security, and security scanning.

## Tech Stack

- **Framework**: Next.js 16.2.4 with React 19.2.4
- **Content**: MDX files rendered via `next-mdx-remote`
- **Styling**: Tailwind CSS v4
- **Syntax Highlighting**: Shiki + rehype-pretty-code
- **Search**: FlexSearch + cmdk

## Development

```bash
bun run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the site.

## Content Structure

```
content/
├── 01-authentication/      # OAuth2, JWT, Session management, MFA
├── 02-authorization/      # RBAC, Permission checking, Resource access control
├── 03-encryption/         # E2EE, Web Crypto API, Signal Protocol, Libsodium
├── 04-web-chat-security/   # WebSocket hardening, Message sanitization, Realtime patterns
├── 05-xss-csrf-csp/        # XSS, CSP, CSRF protection
├── 06-security-scanning/   # Automated scanning, Penetration testing, Vulnerability assessment
└── 07-checklists/          # Pre-development, Deployment, Code review checklists
```

## Deployment

Deployed on Vercel: [security-playbook.vercel.app](https://security-playbook.vercel.app/)

---
title: "OAuth 2.0 và OpenID Connect (OIDC)"
description: ""
date: "2026-04-24"
author: "Saul Vo"
tags: ["authentication","security","oauth","jwt"]
readingTime: "5 min"
order: 3
slug: "oauth2-oidc"
category: "authentication"
---

# OAuth 2.0 và OpenID Connect (OIDC)

## Mục lục
1. [OAuth 2.0 vs OIDC](#1-oauth-20-vs-oidc)
2. [OAuth 2.0 Flows](#2-oauth-20-flows)
3. [OpenID Connect](#3-openid-connect)
4. [Implementation với NextAuth.js](#4-implementation-với-nextauthjs)
5. [Security Best Practices](#5-security-best-practices)
6. [Common Pitfalls](#6-common-pitfalls)

---

## 1. OAuth 2.0 vs OIDC

### OAuth 2.0
- **Purpose:** Authorization (cho phép truy cập resource)
- **Returns:** Access Token
- **Không có user identity**

### OpenID Connect (OIDC)
- **Purpose:** Authentication + Authorization
- **Returns:** Access Token + ID Token
- **Có user identity** (standardized claims)

```
┌─────────────────────────────────────────────────────────────────┐
│                     OAuth 2.0 Flow                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Client App ────── Authorization Request ──────→ Resource Owner │
│       │                                              (User)     │
│       │                                                    │    │
│       │ ←──────────── Authorization Grant ────────────────│    │
│       │                                                    │    │
│       │ ────────── Authorization Grant ──────────────────→│    │
│       │                                                    │    │
│       │ ←──────────── Access Token ───────────────────────│    │
│       │                                                    │    │
│       │ ───────────── Access Token ──────────────────────→│    │
│       │                                              API         │
│       │ ←──────────── Protected Resource ────────────────│    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                     OIDC Flow                                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Client ──── Authentication Request ────→ Identity Provider    │
│       │                                        (Google, etc.)   │
│       │                                              │          │
│       │ ←────────── ID Token + Access Token ─────────│          │
│       │                                              │          │
│       │ ID Token chứa user info:                               │
│       │ {                                                        │
│       │   "sub": "user123",                                      │
│       │   "email": "user@gmail.com",                            │
│       │   "name": "John Doe"                                    │
│       │ }                                                        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. OAuth 2.0 Flows

### 2.1 Authorization Code Flow (Recommended)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                Authorization Code Flow (PKCE)                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  1. Client tạo code_verifier + code_challenge                          │
│                                                                         │
│  2. Redirect to Authorization Server                                    │
│     GET /authorize?                                                     │
│       response_type=code                                                │
│       &client_id=xxx                                                    │
│       &redirect_uri=https://app.com/callback                           │
│       &scope=openid profile email                                       │
│       &code_challenge=xxx                                               │
│       &code_challenge_method=S256                                       │
│                                                                         │
│  3. User authenticates + consents                                       │
│                                                                         │
│  4. Authorization Server redirects back                                 │
│     https://app.com/callback?code=xxx                                   │
│                                                                         │
│  5. Client exchanges code for tokens                                   │
│     POST /token                                                         │
│       code=xxx                                                          │
│       &code_verifier=xxx                                                │
│       &client_id=xxx                                                    │
│       &grant_type=authorization_code                                   │
│                                                                         │
│  6. Authorization Server returns                                        │
│     {                                                                   │
│       "access_token": "xxx",                                            │
│       "refresh_token": "xxx",                                          │
│       "id_token": "xxx"        ← OIDC only                             │
│     }                                                                   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2.2 PKCE (Proof Key for Code Exchange)

**Tại sao cần PKCE?**

| Attack Vector | Without PKCE | With PKCE |
|---------------|--------------|-----------|
| Authorization code interception | ✅ Attack possible | ❌ Blocked |
| Code substitution | ✅ Attack possible | ❌ Blocked |

```javascript
// Server: Generate code verifier and challenge
const crypto = require('crypto');

function generateCodeVerifier() {
  return crypto.randomBytes(32).toString('base64url');
}

function generateCodeChallenge(verifier) {
  return crypto
    .createHash('sha256')
    .update(verifier)
    .digest('base64url');
}

// Client-side (Next.js)
import { kdf } from 'crypto';

function createPKCE() {
  const verifier = generateCodeVerifier();
  const challenge = generateCodeChallenge(verifier);

  return { verifier, challenge };
}

async function initiateLogin() {
  const { verifier, challenge } = createPKCE();

  // Store verifier for later token exchange
  sessionStorage.setItem('pkce_verifier', verifier);

  // Redirect to authorization server
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: 'your-client-id',
    redirect_uri: 'https://your-app.com/api/auth/callback',
    scope: 'openid profile email',
    code_challenge: challenge,
    code_challenge_method: 'S256'
  });

  window.location.href = `https://auth-server.com/authorize?${params}`;
}
```

### 2.3 Client Credentials Flow (Machine-to-Machine)

```javascript
// Không có user involvement - service account
async function getServiceToken() {
  const response = await fetch('https://auth-server.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: process.env.CLIENT_ID,
      client_secret: process.env.CLIENT_SECRET,
      scope: 'api://backend/read'
    })
  });

  return response.json();
}
```

### 2.4 Implicit Flow (Deprecated)

```javascript
// ❌ KHÔNG SỬ DỤNG - đã bị deprecate
// Access token exposed in URL fragment
// No refresh token
// Không có client secret verification

// Thay vào đó dùng Authorization Code + PKCE
```

---

## 3. OpenID Connect

### ID Token Structure

```json
{
  "iss": "https://accounts.google.com",
  "sub": "109876543210987654321",
  "aud": "123456789.apps.googleusercontent.com",
  "exp": 1704070800,
  "iat": 1704067200,
  "nonce": "abc123",
  "name": "John Doe",
  "email": "johndoe@gmail.com",
  "picture": "https://lh3.googleusercontent.com/...",
  "email_verified": true
}
```

### OIDC Scopes

| Scope | Claims Returned |
|-------|-----------------|
| `openid` | `sub` (required) |
| `profile` | `name`, `family_name`, `given_name`, `picture` |
| `email` | `email`, `email_verified` |
| `phone` | `phone_number`, `phone_number_verified` |
| `address` | `address` |
| `offline_access` | Refresh token (nếu cần) |

### ID Token Validation (Server-side)

```javascript
// PHẢI verify ID token trên server
async function verifyIDToken(idToken, clientId) {
  // 1. Decode JWT (không verify vội)
  const tokenParts = idToken.split('.');
  const header = JSON.parse(Buffer.from(tokenParts[0], 'base64url'));
  const payload = JSON.parse(Buffer.from(tokenParts[2], 'base64url'));

  // 2. Fetch JWKS (JSON Web Key Set) từ provider
  const jwks = await fetch('https://auth-server.com/.well-known/jwks.json');
  const keys = await jwks.json();

  // 3. Find matching key
  const key = keys.keys.find(k => k.kid === header.kid);
  if (!key) {
    throw new Error('No matching key found');
  }

  // 4. Verify signature using jose library
  const { JWTVerify, createRemoteJWKSet } = require('jose');
  const JWKS = createRemoteJWKSet(new URL('https://auth-server.com/.well-known/jwks.json'));

  const { payload: verified } = await JWTVerify(idToken, JWKS, {
    issuer: 'https://auth-server.com',
    audience: clientId
  });

  return verified;
}
```

### OIDC Discovery

```javascript
// Metadata endpoint: .well-known/openid-configuration
async function getOIDCConfig(providerUrl) {
  const response = await fetch(`${providerUrl}/.well-known/openid-configuration`);
  return response.json();
}

// Returns something like:
// {
//   "issuer": "https://accounts.google.com",
//   "authorization_endpoint": "https://accounts.google.com/o/oauth2/v2/auth",
//   "token_endpoint": "https://oauth2.googleapis.com/token",
//   "userinfo_endpoint": "https://openidconnect.googleapis.com/userinfo",
//   "jwks_uri": "https://www.googleapis.com/oauth2/v3/certs"
// }
```

---

## 4. Implementation với NextAuth.js

### 4.1 Setup

```bash
npm install next-auth
```

### 4.2 Configuration

```typescript
// app/api/auth/[...nextauth]/route.ts
import NextAuth from 'next-auth';
import { NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import GitHubProvider from 'next-auth/providers/github';
import CredentialsProvider from 'next-auth/providers/credentials';

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: 'openid profile email',
          prompt: 'consent',
          access_type: 'offline'
        }
      }
    }),

    // Enterprise providers
    MicrosoftEntraProvider({
      clientId: process.env.AZURE_AD_CLIENT_ID!,
      clientSecret: process.env.AZURE_AD_CLIENT_SECRET!,
      issuer: `https://login.microsoftonline.com/${process.env.AZURE_AD_TENANT_ID}/v2.0`
    }),

    // Credentials provider (username/password)
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        // Verify against your database
        const user = await verifyUserCredentials(
          credentials.email,
          credentials.password
        );

        if (user) {
          return {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role
          };
        }

        return null;
      }
    })
  ],

  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },

  callbacks: {
    async jwt({ token, user, account }) {
      // Initial sign in
      if (account && user) {
        token.accessToken = account.access_token;
        token.provider = account.provider;
        token.role = user.role;
      }
      return token;
    },

    async session({ session, token }) {
      // Expose JWT fields to client
      session.accessToken = token.accessToken;
      session.user.role = token.role;

      return session;
    }
  },

  pages: {
    signIn: '/login',
    error: '/login/error'
  },

  security: {
    callbacks: {
      async session({ session, token }) {
        // Force re-validation every 15 minutes for sensitive sessions
        session.expires = new Date(Date.now() + 15 * 60 * 1000);
        return session;
      }
    }
  }
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
```

### 4.3 Client Usage

```typescript
// app/hooks/useSession.ts
'use client';

import { SessionProvider } from 'next-auth/react';
import { createContext, useContext, useState, useEffect } from 'react';

interface ExtendedSession {
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
  };
  accessToken: string;
  expires: string;
}

const SessionContext = createContext<ExtendedSession | null>(null);

export function SessionProviderWrapper({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <SessionProviderInner>{children}</SessionProviderInner>
    </SessionProvider>
  );
}

function SessionProviderInner({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();

  useEffect(() => {
    if (status === 'unauthenticated') {
      window.location.href = '/login';
    }
  }, [status]);

  if (status === 'loading') {
    return <LoadingSpinner />;
  }

  if (!session) {
    return null;
  }

  return (
    <SessionContext.Provider value={session as ExtendedSession}>
      {children}
    </SessionContext.Provider>
  );
}

export function useExtendedSession() {
  return useContext(SessionContext);
}
```

### 4.4 API Route Protection

```typescript
// app/api/protected/route.ts
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/route';
import { NextResponse } from 'next/server';

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Fetch data with provider token
  const response = await fetch('https://api.provider.com/userinfo', {
    headers: {
      Authorization: `Bearer ${session.accessToken}`
    }
  });

  const data = await response.json();

  return NextResponse.json({ data });
}
```

### 4.5 Social Login + Database Linking

```typescript
// Callbacks for linking accounts
callbacks: {
  async signIn({ user, account, profile }) {
    if (account?.provider === 'google' && profile?.email) {
      // Check if user exists with same email
      const existingUser = await findUserByEmail(profile.email);

      if (existingUser && !existingUser.googleId) {
        // Link Google account to existing user
        await linkAccountToUser(existingUser.id, 'google', account);
        user.id = existingUser.id;
      }
    }
    return true;
  },

  async session({ session, token }) {
    // Load full user data on each session
    const fullUser = await getUserById(token.sub);
    session.user.role = fullUser.role;
    session.user.permissions = fullUser.permissions;
    return session;
  }
}
```

---

## 5. Security Best Practices

### Authorization Server Security

```
┌─────────────────────────────────────────────────────────────────┐
│                    Security Checklist                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ✅ Sử dụng PKCE cho public clients                              │
│  ✅ Validate redirect_uri (exact match, not prefix)             │
│  ✅ Use short-lived authorization codes                         │
│  ✅ Bind authorization code to client_id + redirect_uri         │
│  ✅ Store secrets server-side, never in code                   │
│  ✅ Implement rate limiting                                    │
│  ✅ Log all authentication events                              │
│  ✅ Use state parameter to prevent CSRF                        │
│  ✅ Validate id_token signature and claims                      │
│  ✅ Check nonce for replay attacks                              │
│  ✅ Implement PKCE code challenge verification                  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Redirect URI Validation

```javascript
// ❌ NGUY HIỂM - wildcard hoặc prefix match
const validRedirects = [
  'https://*.example.com/*',  // ❌ Wildcard
  'https://app.example.com'    // ❌ Prefix - cho phép https://app.example.com.evil.com
];

// ✅ AN TOÀN - exact match
const ALLOWED_REDIRECT_URIS = [
  'https://app.example.com/api/auth/callback',
  'https://localhost:3000/api/auth/callback'
];

function validateRedirectUri(uri) {
  return ALLOWED_REDIRECT_URIS.includes(uri);
}
```

### State Parameter (CSRF Protection)

```javascript
// Client: Generate state
function generateState() {
  const state = crypto.randomBytes(32).toString('hex');
  sessionStorage.setItem('oauth_state', state);
  return state;
}

// Server: Verify state
function verifyState(receivedState) {
  const storedState = sessionStorage.getItem('oauth_state');

  if (!storedState || storedState !== receivedState) {
    throw new Error('Invalid state - possible CSRF attack');
  }

  sessionStorage.removeItem('oauth_state');
}
```

### Token Storage

```javascript
// Access Token: sessionStorage hoặc memory
// Refresh Token: httpOnly, secure cookie
// ID Token: không cần store ở client, dùng khi cần

// ❌ KHÔNG BAO GIỜ
localStorage.setItem('access_token', token);  // XSS accessible
sessionStorage.setItem('refresh_token', token); // Không cần thiết
```

---

## 6. Common Pitfalls

### Pitfall 1: Implicit Flow Usage

```javascript
// ❌ DEPRECATED - không sử dụng
window.location.href = `https://auth.com/authorize?
  response_type=token&
  client_id=xxx&
  redirect_uri=xxx`;

// ✅ Sử dụng Authorization Code + PKCE
```

### Pitfall 2: Insufficient Redirect Validation

```javascript
// ❌ NGUY HIỂM
function validateRedirect(uri) {
  return uri.startsWith('https://myapp.com');
}

// https://myapp.com.evil.com/auth/callback ✅ passes!
```

### Pitfall 3: Missing Nonce Validation

```javascript
// ❌ Security issue - missing nonce check
async function handleCallback(idToken) {
  const payload = decodeToken(idToken);
  // Should verify: payload.nonce === stored_nonce
}

// ✅ Correct
async function handleCallback(idToken) {
  const storedNonce = sessionStorage.getItem('nonce');
  const payload = await verifyIDToken(idToken);

  if (payload.nonce !== storedNonce) {
    throw new Error('Invalid nonce - replay attack');
  }
}
```

### Pitfall 4: Trusting Provider Claims Without Verification

```javascript
// ❌ NGUY HIỂM
async function signIn(provider, idToken) {
  const payload = decodeToken(idToken); // Decode only, no verify
  // Trusting email from provider without verification
  createSession(payload.email);
}

// ✅ Correct
async function signIn(provider, idToken) {
  const payload = await verifyAndDecodeToken(idToken, provider);
  // Only after verification, create session
  createSession(payload.email);
}
```

---

## OWASP References

- [OAuth 2.0 Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/OAuth_2.0_Security_Cheat_Sheet.html)
- [OIDC Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/JSON_Web_Token_for_Java_Cheat_Sheet.html)
- [Web Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Web_Authentication_Cheat_Sheet.html)

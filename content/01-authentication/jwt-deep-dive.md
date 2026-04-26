---
title: "JWT Deep Dive"
description: ""
date: "2026-04-24"
author: "Saul Vo"
tags: ["authentication","security","oauth","jwt"]
readingTime: "5 min"
order: 1
slug: "jwt-deep-dive"
category: "authentication"
---

# JWT Deep Dive

## Mục lục
1. [JWT là gì?](#1-jwt-là-gì)
2. [Cấu trúc JWT](#2-cấu-trúc-jwt)
3. [Thuật toán và bảo mật](#3-thuật-toán-và-bảo-mật)
4. [Token Storage](#4-token-storage)
5. [Token Refresh & Revocation](#5-token-refresh--revocation)
6. [Các tấn công phổ biến](#6-các-tấn-công-phổ-biến)
7. [Implementation thực tế (Next.js + Node.js)](#7-implementation-thực-tế-nextjs---nodejs)
8. [Security Checklist](#8-security-checklist)

---

## 1. JWT là gì?

**JWT (JSON Web Token)** là một chuẩn token dạng compact, self-contained để truyền tải thông tin giữa các bên dưới dạng JSON. Token được ký để đảm bảo tính toàn vẹn.

### Khi nào nên dùng JWT?

| Nên dùng | Không nên dùng |
|----------|----------------|
| Stateless authentication | Thay thế session database |
| API authorization | Lưu trữ sensitive data |
| Information exchange giữa các bên | Primary session management |

---

## 2. Cấu trúc JWT

```
xxxxx.yyyyy.zzzzz
│     │     └── Signature (Chữ ký)
│     └── Payload (Dữ liệu)
└─── Header (Tiêu đề)
```

### Header
```json
{
  "alg": "HS256",
  "typ": "JWT"
}
```

### Payload (Claims)
```json
{
  "sub": "user_123",
  "email": "user@example.com",
  "role": "admin",
  "iat": 1704067200,
  "exp": 1704070800
}
```

### Standard Claims
| Claim | Mô tả |
|-------|-------|
| `iss` | Issuer - ai đã phát hành token |
| `sub` | Subject - chủ thể của token |
| `aud` | Audience - đối tượng sử dụng |
| `exp` | Expiration time |
| `nbf` | Not before |
| `iat` | Issued at |
| `jti` | JWT ID - unique identifier cho revocation |

---

## 3. Thuật toán và bảo mật

### So sánh HMAC vs RSA

```
┌─────────────────────────────────────────────────────────┐
│                    HS256 (Symmetric)                     │
├─────────────────────────────────────────────────────────┤
│  Client ────────────────────────── Server                │
│          sign(payload, secret)                          │
│                                         verify(payload, secret) │
│                                                         │
│  ⚠️ Secret phải được giữ KÉP trên tất cả servers         │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│                    RS256 (Asymmetric)                    │
├─────────────────────────────────────────────────────────┤
│  Client                         Server                  │
│    │                               │                    │
│    │  verify(payload, publicKey)   │                    │
│    │  ←────────────────────────────│                    │
│    │                               │                    │
│    │  sign(payload, privateKey)    │                    │
│    │  ────────────────────────────→│                    │
│                                                         │
│  ✅ Chỉ server giữ private key, public key có thể public │
└─────────────────────────────────────────────────────────┘
```

### Best Practice: Luôn chỉ định rõ algorithm

```javascript
// ❌ NGUY HIỂM - auto-detect algorithm
const decoded = jwt.verify(token, secret);

// ✅ AN TOÀN - chỉ chấp nhận HS256
const decoded = jwt.verify(token, secret, {
  algorithms: ['HS256']
});

// ✅ AN TOÀN - chỉ chấp nhận RS256
const decoded = jwt.verify(token, publicKey, {
  algorithms: ['RS256']
});
```

---

## 4. Token Storage

### So sánh các phương án

| Storage | Ưu điểm | Nhược điểm | Recommend |
|---------|---------|------------|-----------|
| `localStorage` | Dễ implement | Accessible via XSS, persists after browser close | ❌ |
| `sessionStorage` | Cleared on tab close | Still accessible via XSS | ⚠️ |
| `httpOnly Cookie` | Không accessible via JS | Cần CSRF protection | ✅ |
| `Memory (redux/zustand)` | Không bị XSS đọc | Mất khi refresh page | ✅ |

### Recommended: httpOnly Cookie + Fingerprint

```javascript
// Server: Set secure httpOnly cookie
res.cookie('access_token', token, {
  httpOnly: true,      // Không đọc được từ JS
  secure: true,        // HTTPS only
  sameSite: 'Strict', // CSRF protection
  maxAge: 15 * 60 * 1000 // 15 phút
});
```

### Alternative: sessionStorage với Authorization Header

```javascript
// Client: Lưu vào sessionStorage
sessionStorage.setItem('token', jwt);

// Gửi kèm request
fetch('/api/data', {
  headers: {
    'Authorization': `Bearer ${sessionStorage.getItem('token')}`
  }
});

// Xóa khi logout
sessionStorage.removeItem('token');
```

---

## 5. Token Refresh & Revocation

### Access Token + Refresh Token Pattern

```
┌──────────────────────────────────────────────────────────────┐
│                    Token Refresh Flow                         │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  Login → Access Token (15m) + Refresh Token (7d)             │
│                    │                                         │
│                    ↓                                         │
│  Access Token Expires? ──No──→ Continue normal               │
│                    │                                         │
│                   Yes                                        │
│                    ↓                                         │
│  POST /refresh → Validate Refresh Token                      │
│                    │                                         │
│         ┌────────┴────────┐                                  │
│         ↓                 ↓                                  │
│      Valid            Invalid                                │
│         ↓                 ↓                                  │
│   Issue New          401 + Force                            │
│   Access Token       Login                                  │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### Implementation

```javascript
// Server: Tạo access + refresh token
function generateTokens(userId) {
  const accessToken = jwt.sign(
    { sub: userId, type: 'access' },
    accessSecret,
    { expiresIn: '15m', jti: crypto.randomUUID() }
  );

  const refreshToken = jwt.sign(
    { sub: userId, type: 'refresh', jti: crypto.randomUUID() },
    refreshSecret,
    { expiresIn: '7d' }
  );

  return { accessToken, refreshToken };
}

// Server: Refresh endpoint
app.post('/auth/refresh', async (req, res) => {
  const { refreshToken } = req.body;

  try {
    const decoded = jwt.verify(refreshToken, refreshSecret, {
      algorithms: ['HS256']
    });

    if (decoded.type !== 'refresh') {
      throw new Error('Invalid token type');
    }

    // Check revocation
    if (await isTokenRevoked(decoded.jti)) {
      throw new Error('Token revoked');
    }

    // Issue new access token
    const newAccessToken = jwt.sign(
      { sub: decoded.sub, type: 'access' },
      accessSecret,
      { expiresIn: '15m', jti: crypto.randomUUID() }
    );

    res.json({ accessToken: newAccessToken });
  } catch (error) {
    res.status(401).json({ error: 'Invalid refresh token' });
  }
});
```

### Token Revocation (Denylist)

```javascript
// Redis-backed denylist (production)
const revokedTokens = new Set();

// Hoặc dùng Redis: SET token:jti <expiry> NX
async function revokeToken(token) {
  const decoded = jwt.decode(token);
  const expiry = decoded.exp * 1000 - Date.now();

  if (expiry > 0) {
    await redis.set(`revoked:${decoded.jti}`, '1', 'EX', expiry / 1000);
  }
}

async function isTokenRevoked(jti) {
  return await redis.exists(`revoked:${jti}`);
}
```

---

## 6. Các tấn công phổ biến

### 6.1 Algorithm Confusion Attack

**Mô tả:** Attacker thay đổi algorithm từ RS256 → HS256, dùng public key làm secret để sign token.

```javascript
// ❌ LỖ HỔNG - chấp nhận bất kỳ algorithm nào
const decoded = jwt.verify(token, publicKey);

// ✅ AN TOÀN - chỉ chấp nhận RS256
const decoded = jwt.verify(token, publicKey, {
  algorithms: ['RS256']
});
```

### 6.2 None Algorithm Attack

**Mô tả:** Attacker thay đổi algorithm thành "none" để bypass signature.

```bash
# Token header: {"alg":"HS256"}
# Attacker sửa thành: {"alg":"none"}

# Header sửa: eyJhbGciOiJub25lIiwidHlwIjoiand0In0=
# Payload: eyJzdWIiOiIxMjM0NTY3ODkwIiwicm9sZSI6ImFkbWluIn0=
# Signature: (empty)

# Kết quả: header.payload. → valid token không có signature!
```

```javascript
// ✅ CHECKLIST - verify không có algorithm "none"
const decoded = jwt.verify(token, secret, {
  algorithms: ['HS256', 'RS256'] // KHÔNG bao gồm 'none'
});
```

### 6.3 Token Sidejacking

**Mô tả:** Attacker đánh cắp token qua XSS, malware, hoặc network sniffing.

```javascript
// MITIGATION: Fingerprint binding
function createToken(userId, fingerprint) {
  const fingerprintHash = crypto
    .createHash('sha256')
    .update(fingerprint)
    .digest('hex');

  return jwt.sign(
    { sub: userId, fph: fingerprintHash },
    secret,
    { expiresIn: '15m' }
  );
}

// Validation
function validateToken(token, fingerprintCookie) {
  const decoded = jwt.verify(token, secret, { algorithms: ['HS256'] });

  const fingerprintHash = crypto
    .createHash('sha256')
    .update(fingerprintCookie)
    .digest('hex');

  if (decoded.fph !== fingerprintHash) {
    throw new Error('Invalid fingerprint - possible token theft');
  }

  return decoded;
}
```

### 6.4 Information Disclosure

**Mô tả:** JWT payload là Base64-encoded, không encrypted. Ai cũng đọc được.

```javascript
// ❌ NGUY HIỂM - sensitive data trong payload
jwt.sign({
  sub: userId,
  ssn: '123-45-6789',
  salary: 100000,
  secretKey: '...'
}, secret);

// ✅ AN TOÀN - chỉ lưu minimal claims
jwt.sign({
  sub: userId,
  role: 'user'
}, secret);

// ✅ Nếu cần encrypt data: dùng JWE (JSON Web Encryption)
```

---

## 7. Implementation thực tế (Next.js + Node.js)

### 7.1 Backend (Node.js/Express)

```javascript
// utils/jwt.js
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const accessSecret = process.env.JWT_ACCESS_SECRET;
const refreshSecret = process.env.JWT_REFRESH_SECRET;

function generateTokens(user) {
  const accessToken = jwt.sign(
    {
      sub: user.id,
      email: user.email,
      role: user.role
    },
    accessSecret,
    {
      expiresIn: '15m',
      algorithms: ['HS256'],
      issuer: 'your-app-name'
    }
  );

  const refreshToken = jwt.sign(
    {
      sub: user.id,
      type: 'refresh',
      jti: crypto.randomUUID()
    },
    refreshSecret,
    {
      expiresIn: '7d',
      algorithms: ['HS256']
    }
  );

  return { accessToken, refreshToken };
}

function verifyAccessToken(token) {
  return jwt.verify(token, accessSecret, {
    algorithms: ['HS256'],
    issuer: 'your-app-name'
  });
}

function verifyRefreshToken(token) {
  const decoded = jwt.verify(token, refreshSecret, {
    algorithms: ['HS256']
  });

  if (decoded.type !== 'refresh') {
    throw new Error('Invalid token type');
  }

  return decoded;
}

module.exports = {
  generateTokens,
  verifyAccessToken,
  verifyRefreshToken
};
```

```javascript
// middleware/authenticate.js
const { verifyAccessToken } = require('../utils/jwt');

function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Token required' });
  }

  try {
    req.user = verifyAccessToken(token);
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired', code: 'TOKEN_EXPIRED' });
    }
    return res.status(403).json({ error: 'Invalid token' });
  }
}

module.exports = authenticateToken;
```

```javascript
// routes/auth.js
const express = require('express');
const router = express.Router();
const { generateTokens, verifyRefreshToken } = require('../utils/jwt');
const { authenticateToken } = require('../middleware/authenticate');

// Login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  // Validate input
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }

  // Verify credentials (example)
  const user = await verifyCredentials(email, password);
  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const tokens = generateTokens(user);

  // Set refresh token as httpOnly cookie
  res.cookie('refresh_token', tokens.refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'Strict',
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  });

  res.json({
    accessToken: tokens.accessToken,
    expiresIn: 900 // 15 minutes in seconds
  });
});

// Refresh token
router.post('/refresh', async (req, res) => {
  const refreshToken = req.cookies.refresh_token || req.body.refreshToken;

  if (!refreshToken) {
    return res.status(401).json({ error: 'Refresh token required' });
  }

  try {
    const decoded = verifyRefreshToken(refreshToken);

    // Check revocation
    if (await isTokenRevoked(decoded.jti)) {
      throw new Error('Token revoked');
    }

    // Get fresh user data
    const user = await getUserById(decoded.sub);
    const tokens = generateTokens(user);

    // Update refresh token cookie
    res.cookie('refresh_token', tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'Strict',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    res.json({
      accessToken: tokens.accessToken,
      expiresIn: 900
    });
  } catch (error) {
    res.status(401).json({ error: 'Invalid refresh token' });
  }
});

// Logout
router.post('/logout', authenticateToken, async (req, res) => {
  const refreshToken = req.cookies.refresh_token;

  if (refreshToken) {
    const decoded = jwt.decode(refreshToken);
    await revokeToken(decoded.jti);
  }

  res.clearCookie('refresh_token');
  res.json({ message: 'Logged out successfully' });
});

module.exports = router;
```

### 7.2 Frontend (Next.js)

```typescript
// lib/token.ts
const ACCESS_TOKEN_KEY = 'access_token';
const ACCESS_TOKEN_EXPIRY_KEY = 'access_token_expiry';

export function setAccessToken(token: string, expiresIn: number) {
  if (typeof window === 'undefined') return;

  sessionStorage.setItem(ACCESS_TOKEN_KEY, token);
  const expiry = Date.now() + expiresIn * 1000;
  sessionStorage.setItem(ACCESS_TOKEN_EXPIRY_KEY, expiry.toString());
}

export function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  return sessionStorage.getItem(ACCESS_TOKEN_KEY);
}

export function clearAccessToken() {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(ACCESS_TOKEN_KEY);
  sessionStorage.removeItem(ACCESS_TOKEN_EXPIRY_KEY);
}

export function isTokenExpired(): boolean {
  const expiry = sessionStorage.getItem(ACCESS_TOKEN_EXPIRY_KEY);
  if (!expiry) return true;
  return Date.now() > parseInt(expiry, 10);
}
```

```typescript
// lib/api.ts
import { getAccessToken, setAccessToken, clearAccessToken, isTokenExpired } from './token';

const API_BASE = process.env.NEXT_PUBLIC_API_URL;

type FetchOptions = RequestInit & {
  skipAuth?: boolean;
};

async function authedFetch(url: string, options: FetchOptions = {}): Promise<Response> {
  const { skipAuth, ...fetchOptions } = options;

  let token = getAccessToken();

  // Auto-refresh if expired
  if (!skipAuth && token && isTokenExpired()) {
    const refreshed = await refreshToken();
    if (!refreshed) {
      clearAccessToken();
      window.location.href = '/login';
      throw new Error('Session expired');
    }
    token = getAccessToken();
  }

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token && !skipAuth ? { Authorization: `Bearer ${token}` } : {}),
    ...fetchOptions.headers
  };

  const response = await fetch(`${API_BASE}${url}`, {
    ...fetchOptions,
    credentials: 'include',
    headers
  });

  if (response.status === 401 && !skipAuth) {
    const data = await response.json();
    if (data.code === 'TOKEN_EXPIRED') {
      const refreshed = await refreshToken();
      if (refreshed) {
        // Retry request
        return authedFetch(url, { ...fetchOptions, skipAuth: true });
      }
    }
    clearAccessToken();
    window.location.href = '/login';
  }

  return response;
}

async function refreshToken(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      credentials: 'include'
    });

    if (!response.ok) return false;

    const data = await response.json();
    setAccessToken(data.accessToken, data.expiresIn);
    return true;
  } catch {
    return false;
  }
}

export { authedFetch as fetch, refreshToken };
```

```typescript
// hooks/useAuth.ts
import { useState, useEffect, useCallback } from 'react';
import { fetch } from '../lib/api';
import { clearAccessToken } from '../lib/token';

interface User {
  id: string;
  email: string;
  role: string;
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUser();
  }, []);

  async function loadUser() {
    try {
      const response = await fetch('/auth/me');
      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
      }
    } catch (error) {
      console.error('Failed to load user:', error);
    } finally {
      setLoading(false);
    }
  }

  const logout = useCallback(async () => {
    try {
      await fetch('/auth/logout', { method: 'POST' });
    } finally {
      clearAccessToken();
      setUser(null);
      window.location.href = '/login';
    }
  }, []);

  return { user, loading, logout };
}
```

---

## 8. Security Checklist

- [ ] **Chỉ định rõ algorithm** (`algorithms: ['HS256']`)
- [ ] **Secret key mạnh** (256+ bits hoặc RSA 2048+)
- [ ] **Access token expiry ngắn** (15-60 phút)
- [ ] **Refresh token expiry dài hơn** (7 ngày)
- [ ] **Refresh token stored in httpOnly cookie**
- [ ] **Access token stored in sessionStorage** (hoặc memory)
- [ ] **Validate `iss` (issuer) và `aud` (audience) claims**
- [ ] **Implement token revocation** (denylist)
- [ ] **Binding fingerprint** để ngăn sidejacking
- [ ] **Không lưu sensitive data trong payload**
- [ ] **Sử dụng HTTPS only**
- [ ] **Rate limit** refresh endpoint
- [ ] **Log token validation failures** để detect attacks

---

## OWASP References

- [JWT Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/JSON_Web_Token_for_Java_Cheat_Sheet.html)
- [Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)

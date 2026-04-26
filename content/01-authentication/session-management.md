---
title: "Session Management"
description: ""
date: "2026-04-24"
author: "Saul Vo"
tags: ["authentication","security","oauth","jwt"]
readingTime: "5 min"
order: 4
slug: "session-management"
category: "authentication"
---

# Session Management

## Mục lục
1. [Session vs Token](#1-session-vs-token)
2. [Server-Side Session](#2-server-side-session)
3. [Session Hijacking Prevention](#3-session-hijacking-prevention)
4. [Session Fixation](#4-session-fixation)
5. [Concurrent Sessions](#5-concurrent-sessions)
6. [Session Expiry & Timeout](#6-session-expiry--timeout)
7. [Implementation (Next.js + Redis)](#7-implementation-nextjs--redis)
8. [Security Checklist](#8-security-checklist)

---

## 1. Session vs Token

### So sánh

| Aspect | Server-Side Session | Token (JWT) |
|--------|-------------------|-------------|
| **State** | Stored on server | Stateless |
| **Storage** | Database/Session store | Client-side |
| **Revocation** | Immediate | Requires denylist |
| **Scalability** | Need shared storage | Easier (no state) |
| **Size** | Small session ID | Larger token |
| **CSRF Protection** | Requires extra measures | Via SameSite cookie |
| **Performance** | Extra DB lookup | No lookup needed |

### Khi nào dùng gì?

```
┌─────────────────────────────────────────────────────────────┐
│                    Decision Flow                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Need immediate revocation? ────Yes───→ Server-Side Session │
│                    │                                        │
│                   No                                        │
│                    ↓                                        │
│  Microservices architecture? ────Yes───→ JWT              │
│                    │                                        │
│                   No                                        │
│                    ↓                                        │
│  Simple monolith app? ────────Yes───→ Either               │
│                                                             │
│  High-security app? ────────Yes───→ Server-Side Session     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Server-Side Session

### Session Flow

```
┌──────────────────────────────────────────────────────────────────┐
│                    Server-Side Session Flow                        │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  1. User Login                                                    │
│     Client ───── POST /login ────────── Server                    │
│                                                                   │
│  2. Server tạo session + store in Redis/database                 │
│     ┌────────────────────────────────────────┐                   │
│     │ Session Store (Redis)                  │                   │
│     │ {                                      │                   │
│     │   sid: "abc123...",                    │                   │
│     │   userId: "user_456",                  │                   │
│     │   data: { role: "admin" },            │                   │
│     │   createdAt: 1704067200,               │                   │
│     │   expiresAt: 1704070800                │                   │
│     │ }                                      │                   │
│     └────────────────────────────────────────┘                   │
│                                                                   │
│  3. Server gửi session ID qua Set-Cookie                        │
│     Set-Cookie: session_id=abc123...; HttpOnly; Secure; SameSite │
│                                                                   │
│  4. Subsequent requests                                          │
│     Client ─── Cookie: session_id=xxx ──── Server                 │
│                        │                                         │
│                        ↓                                         │
│                   Lookup Redis ──── Validate ──── Process        │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
```

### Redis Session Store

```javascript
// Session manager với Redis
const { createClient } = require('redis');

class SessionManager {
  constructor(redisUrl) {
    this.client = createClient({ url: redisUrl });
    this.client.connect();
  }

  async create(userId, data = {}, options = {}) {
    const sessionId = crypto.randomBytes(32).toString('hex');
    const ttl = options.maxAge || 3600; // default 1 hour

    const sessionData = {
      userId,
      data,
      createdAt: Date.now(),
      lastAccessedAt: Date.now()
    };

    await this.client.setEx(
      `session:${sessionId}`,
      ttl,
      JSON.stringify(sessionData)
    );

    return sessionId;
  }

  async get(sessionId) {
    const data = await this.client.get(`session:${sessionId}`);

    if (!data) {
      return null;
    }

    // Update last accessed
    const session = JSON.parse(data);
    session.lastAccessedAt = Date.now();
    await this.client.setEx(
      `session:${sessionId}`,
      await this.client.ttl(`session:${sessionId}`),
      JSON.stringify(session)
    );

    return session;
  }

  async destroy(sessionId) {
    await this.client.del(`session:${sessionId}`);
  }

  async touch(sessionId, extendBy = 3600) {
    await this.client.expire(`session:${sessionId}`, extendBy);
  }
}

module.exports = SessionManager;
```

---

## 3. Session Hijacking Prevention

### Session ID Generation

```javascript
// ❌ YẾU - predictable session ID
const sessionId = Math.random().toString(36); // Weak!

// ✅ MẠNH - cryptographically secure
const sessionId = crypto.randomBytes(32).toString('hex');
// Hoặc
const sessionId = crypto.randomUUID();
```

### Secure Cookie Attributes

```javascript
// Secure session cookie configuration
res.cookie('session_id', sessionId, {
  httpOnly: true,         // ✅ Không đọc được từ JavaScript
  secure: true,          // ✅ Chỉ gửi qua HTTPS
  sameSite: 'Strict',    // ✅ Ngăn CSRF (hoặc 'Lax' cho GET navigations)
  domain: '.example.com', // ⚠️ Cẩn thận khi dùng domain
  path: '/',             // Giới hạn path
  maxAge: 3600000        // 1 hour in milliseconds
});
```

### Session Binding với Fingerprint

```javascript
// Tạo fingerprint từ client characteristics
function generateFingerprint() {
  const components = [
    navigator.userAgent,
    screen.width + 'x' + screen.height,
    screen.colorDepth,
    navigator.language,
    navigator.hardwareConcurrency || 'unknown',
    navigator.deviceMemory || 'unknown'
  ];

  return crypto
    .createHash('sha256')
    .update(components.join('|'))
    .digest('hex');
}

// Server validate fingerprint
async function validateSession(sessionId, clientFingerprint) {
  const session = await sessionManager.get(sessionId);

  if (!session) {
    return { valid: false, reason: 'Session not found' };
  }

  const storedHash = session.data.fingerprint;
  const clientHash = crypto
    .createHash('sha256')
    .update(clientFingerprint)
    .digest('hex');

  if (storedHash !== clientHash) {
    // Possible session hijacking!
    await sessionManager.destroy(sessionId);
    return { valid: false, reason: 'Fingerprint mismatch' };
  }

  return { valid: true, session };
}
```

---

## 4. Session Fixation

### Attack Flow

```
┌──────────────────────────────────────────────────────────────────┐
│                  Session Fixation Attack                          │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  1. Attacker visit website, gets session ID: abc123              │
│     Attacker ─── GET / ────→ Server                               │
│                               │                                  │
│                               ↓                                  │
│                          Set-Cookie: session_id=abc123          │
│                                                                   │
│  2. Attacker sends link to victim with session ID                │
│     Attacker ──── Evil Link ────→ Victim                          │
│     https://app.com/?session_id=abc123                           │
│                                                                   │
│  3. Victim clicks link, logs in                                  │
│     Victim ─── Login (with session_id=abc123) ───→ Server        │
│                                                                   │
│  4. Session still abc123 - Attacker can hijack!                  │
│     Attacker ─── Cookie: session_id=abc123 ────→ Server         │
│                        (Victim's authenticated session!)         │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
```

### Prevention: Regenerate Session ID After Login

```javascript
// ❌ NGUY HIỂM - giữ nguyên session ID
app.post('/login', async (req, res) => {
  const user = await verifyCredentials(req.body);

  if (user) {
    req.session.userId = user.id; // Same session ID!
  }
});

// ✅ AN TOÀN - regenerate session ID sau khi login
app.post('/login', async (req, res) => {
  const user = await verifyCredentials(req.body);

  if (user) {
    // Xóa session cũ trước khi tạo session mới
    await sessionManager.destroy(req.session.id);

    // Tạo session mới với ID mới
    const newSessionId = await sessionManager.create(user.id, {
      role: user.role,
      fingerprint: generateFingerprint()
    });

    res.cookie('session_id', newSessionId, {
      httpOnly: true,
      secure: true,
      sameSite: 'Strict'
    });
  }
});
```

### Session ID Rotation

```javascript
// Middleware để rotate session ID periodically
async function sessionRotation(req, res, next) {
  if (req.session) {
    const age = Date.now() - req.session.createdAt;
    const rotationInterval = 15 * 60 * 1000; // 15 minutes

    if (age > rotationInterval) {
      // Create new session with new ID
      const oldData = req.session;
      await sessionManager.destroy(req.session.id);

      const newSessionId = await sessionManager.create(
        oldData.userId,
        oldData.data
      );

      res.cookie('session_id', newSessionId, {
        httpOnly: true,
        secure: true,
        sameSite: 'Strict'
      });
    }
  }

  next();
}
```

---

## 5. Concurrent Sessions

### Limit Per User

```javascript
async function createSessionWithLimit(userId, maxSessions = 3) {
  // Find all existing sessions for user
  const userSessions = await findSessionsByUserId(userId);

  // Destroy oldest if limit exceeded
  if (userSessions.length >= maxSessions) {
    const sorted = userSessions.sort((a, b) => a.createdAt - b.createdAt);
    await sessionManager.destroy(sorted[0].id);
  }

  // Create new session
  return await sessionManager.create(userId, {
    createdAt: Date.now()
  });
}
```

### Device Management

```javascript
// Track session + device info
async function createSession(userId, deviceInfo) {
  const sessionId = crypto.randomBytes(32).toString('hex');

  const sessionData = {
    userId,
    device: {
      userAgent: deviceInfo.userAgent,
      ip: deviceInfo.ip,
      lastSeen: Date.now()
    }
  };

  await sessionManager.save(sessionId, sessionData);

  return sessionId;
}

// List active sessions (for "Logged in devices" feature)
async function getUserSessions(userId) {
  return await sessionManager.findByUserId(userId);
}

// Revoke specific session
async function revokeSession(sessionId, userId) {
  const session = await sessionManager.get(sessionId);

  if (!session || session.userId !== userId) {
    throw new Error('Unauthorized');
  }

  await sessionManager.destroy(sessionId);
}
```

---

## 6. Session Expiry & Timeout

### Timeout Configuration

```javascript
const sessionConfig = {
  // Absolute maximum lifetime (24 hours)
  absoluteTimeout: 24 * 60 * 60 * 1000,

  // Inactivity timeout (30 minutes)
  idleTimeout: 30 * 60 * 1000,

  // Warning before expiry (5 minutes before)
  warningBeforeExpiry: 5 * 60 * 1000
};

// Middleware check expiry
async function checkSessionExpiry(req, res, next) {
  if (!req.session) {
    return next();
  }

  const now = Date.now();
  const lastAccessed = req.session.lastAccessedAt;
  const idleTime = now - lastAccessed;

  if (idleTime > sessionConfig.idleTimeout) {
    await sessionManager.destroy(req.session.id);
    return res.status(401).json({
      error: 'Session expired',
      reason: 'idle_timeout'
    });
  }

  // Update last accessed time
  req.session.lastAccessedAt = now;

  // Check absolute timeout
  const age = now - req.session.createdAt;
  if (age > sessionConfig.absoluteTimeout) {
    await sessionManager.destroy(req.session.id);
    return res.status(401).json({
      error: 'Session expired',
      reason: 'absolute_timeout'
    });
  }

  next();
}
```

### Client-Side Warning

```typescript
// React hook for session expiry warning
function useSessionExpiryWarning() {
  const [showWarning, setShowWarning] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const checkExpiry = () => {
      const expiresAt = sessionStorage.getItem('session_expires_at');
      if (!expiresAt) return;

      const remaining = parseInt(expiresAt) - Date.now();

      if (remaining <= 5 * 60 * 1000 && remaining > 0) {
        setShowWarning(true);
      } else if (remaining <= 0) {
        router.push('/session-expired');
      }
    };

    const interval = setInterval(checkExpiry, 10000);
    return () => clearInterval(interval);
  }, [router]);

  return showWarning;
}
```

---

## 7. Implementation (Next.js + Redis)

### Backend (Node.js + Redis)

```javascript
// lib/session.js
const Redis = require('ioredis');
const crypto = require('crypto');

class SecureSessionManager {
  constructor(redisUrl, options = {}) {
    this.redis = new Redis(redisUrl);
    this.absoluteTimeout = options.absoluteTimeout || 24 * 60 * 60 * 1000;
    this.idleTimeout = options.idleTimeout || 30 * 60 * 1000;
  }

  async create(userId, data = {}, options = {}) {
    const sessionId = crypto.randomBytes(32).toString('hex');
    const now = Date.now();

    const sessionData = {
      userId,
      data,
      createdAt: now,
      lastAccessedAt: now,
      ip: options.ip,
      userAgent: options.userAgent
    };

    await this.redis.setEx(
      `session:${sessionId}`,
      this.absoluteTimeout / 1000,
      JSON.stringify(sessionData)
    );

    return { sessionId, expiresAt: now + this.absoluteTimeout };
  }

  async get(sessionId) {
    const raw = await this.redis.get(`session:${sessionId}`);
    if (!raw) return null;

    const session = JSON.parse(raw);
    const now = Date.now();

    // Check idle timeout
    if (now - session.lastAccessedAt > this.idleTimeout) {
      await this.destroy(sessionId);
      return null;
    }

    return session;
  }

  async update(sessionId, data) {
    const session = await this.get(sessionId);
    if (!session) return null;

    session.data = { ...session.data, ...data };
    session.lastAccessedAt = Date.now();

    const ttl = await this.redis.ttl(`session:${sessionId}`);
    await this.redis.setEx(
      `session:${sessionId}`,
      ttl,
      JSON.stringify(session)
    );

    return session;
  }

  async destroy(sessionId) {
    await this.redis.del(`session:${sessionId}`);
  }

  async destroyAllForUser(userId) {
    const keys = await this.redis.keys(`session:*`);
    const sessionManager = this;

    for (const key of keys) {
      const raw = await this.redis.get(key);
      if (raw) {
        const session = JSON.parse(raw);
        if (session.userId === userId) {
          await this.redis.del(key);
        }
      }
    }
  }
}

module.exports = SecureSessionManager;
```

### Express Middleware

```javascript
// middleware/session.js
const sessionManager = new SecureSessionManager(process.env.REDIS_URL);

function sessionMiddleware(req, res, next) {
  const sessionId = req.cookies?.session_id;

  if (!sessionId) {
    req.session = null;
    return next();
  }

  try {
    const sessionPromise = sessionManager.get(sessionId);

    req.session = {
      id: sessionId,
      get data() {
        return sessionPromise.then(s => s?.data);
      },
      async update(data) {
        const updated = await sessionManager.update(sessionId, data);
        return updated?.data;
      },
      async destroy() {
        await sessionManager.destroy(sessionId);
        res.clearCookie('session_id');
      }
    };

    next();
  } catch (error) {
    console.error('Session error:', error);
    req.session = null;
    next();
  }
}

module.exports = { sessionMiddleware, sessionManager };
```

### Next.js API Route

```typescript
// app/api/user/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import sessionManager from '@/lib/session';

export async function GET(req: NextRequest) {
  const sessionId = cookies().get('session_id')?.value;

  if (!sessionId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const session = await sessionManager.get(sessionId);

  if (!session) {
    return NextResponse.json({ error: 'Session expired' }, { status: 401 });
  }

  return NextResponse.json({ user: session.data });
}
```

### Client-Side Hook

```typescript
// hooks/useSecureSession.ts
'use client';

import { useState, useEffect, useCallback } from 'react';

interface SessionData {
  userId: string;
  role: string;
  [key: string]: any;
}

export function useSecureSession() {
  const [session, setSession] = useState<SessionData | null>(null);
  const [loading, setLoading] = useState(true);

  const loadSession = useCallback(async () => {
    try {
      const response = await fetch('/api/user', {
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        setSession(data.user);
      } else {
        setSession(null);
      }
    } catch (error) {
      console.error('Session load failed:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  const refresh = useCallback(async () => {
    setLoading(true);
    await loadSession();
  }, [loadSession]);

  return { session, loading, refresh };
}
```

---

## 8. Security Checklist

- [ ] **Session ID là cryptographic random** (32+ bytes)
- [ ] **Cookie có httpOnly flag**
- [ ] **Cookie có Secure flag** (HTTPS only)
- [ ] **Cookie có SameSite attribute** (Strict hoặc Lax)
- [ ] **Session ID regenerated sau login** (prevents fixation)
- [ ] **Session có absolute timeout** (max lifetime)
- [ ] **Session có idle timeout** (inactivity period)
- [ ] **Session data validated trước khi sử dụng**
- [ ] **Implement session denylist** nếu cần immediate revocation
- [ ] **Log session creation/destruction events**
- [ ] **Limit concurrent sessions per user**
- [ ] **Store session data server-side**, không trust client

---

## OWASP References

- [Session Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)
- [Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)

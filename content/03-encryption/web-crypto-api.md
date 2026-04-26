---
title: "Web Crypto API"
description: ""
date: "2026-04-24"
author: "Saul Vo"
tags: ["encryption","cryptography","e2ee"]
readingTime: "5 min"
order: 4
slug: "web-crypto-api"
category: "encryption"
---

# Web Crypto API

## Mục lục
1. [WebCrypto Overview](#1-webcrypto-overview)
2. [Generating Keys](#2-generating-keys)
3. [Encrypting/Decrypting](#3-encryptingdecrypting)
4. [Signing/Verifying](#4-signingverifying)
5. [Hashing](#5-hashing)
6. [Key Derivation](#6-key-derivation)
7. [Complete Examples](#7-complete-examples)
8. [Security Considerations](#8-security-considerations)

---

## 1. WebCrypto Overview

### Browser Cryptography APIs

```
┌─────────────────────────────────────────────────────────────────────┐
│                 Browser Cryptography APIs                           │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Web Crypto API (SubtleCrypto)  ◄◄◄ RECOMMENDED                     │
│  • Standardized W3C API                                              │
│  • Available in all modern browsers                                │
│  • Non-extractable keys (in theory)                                 │
│  • Supports RSA, AES, ECDSA, ECDH, HKDF, PBKDF2                     │
│                                                                     │
│ window.crypto.subtle.*                                             │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Crypto (Legacy)                                                    │
│  • window.crypto.getRandomValues()                                 │
│  • Only for random number generation                              │
│  • Use SubtleCrypto for everything else                            │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ❌ AVOID:                                                         │
│  • CryptoJS (rolling cipher, weak defaults)                        │
│  • JavaScript implementations in general (slow, potential issues) │
│  • Any library that doesn't use WebCrypto under the hood           │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Algorithm Support

```typescript
// Check available algorithms
const algorithms = {
  aes: ['AES-CBC', 'AES-CTR', 'AES-GCM', 'AES-KW'],
  rsa: ['RSASSA-PKCS1-v1_5', 'RSA-OAEP', 'RSA-OAEP'],
  ec: ['ECDSA', 'ECDH'],
  hash: ['SHA-1', 'SHA-256', 'SHA-384', 'SHA-512'],
  hmac: ['HMAC'],
  kdf: ['PBKDF2', 'HKDF']
};
```

---

## 2. Generating Keys

### AES Symmetric Key

```typescript
// Generate 256-bit AES key for encryption
async function generateAESKey(): Promise<CryptoKey> {
  return await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,  // extractable - can export
    ['encrypt', 'decrypt']
  );
}

// Generate 128-bit AES key
async function generateAESKey128(): Promise<CryptoKey> {
  return await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 128 },
    true,
    ['encrypt', 'decrypt']
  );
}
```

### ECDH Key Pair

```typescript
// Generate ECDH key pair (P-256 curve)
async function generateECDHKeyPair(): Promise<CryptoKeyPair> {
  return await crypto.subtle.generateKey(
    {
      name: 'ECDH',
      namedCurve: 'P-256'  // Also: 'P-384', 'P-521'
    },
    true,  // extractable
    ['deriveKey', 'deriveBits']
  );
}

// X25519 equivalent using ECDH (in modern browsers)
async function generateX25519KeyPair(): Promise<CryptoKeyPair> {
  // Some browsers support X25519 via this curve name
  return await crypto.subtle.generateKey(
    {
      name: 'ECDH',
      namedCurve: 'X25519'  // May not be available in all browsers
    },
    true,
    ['deriveKey', 'deriveBits']
  );
}
```

### ECDSA Key Pair (Signing)

```typescript
// Generate ECDSA key pair for digital signatures
async function generateECDSAKeyPair(): Promise<CryptoKeyPair> {
  return await crypto.subtle.generateKey(
    {
      name: 'ECDSA',
      namedCurve: 'P-256'  // Also: 'P-384', 'P-521'
    },
    true,
    ['sign', 'verify']
  );
}

// Generate RSA key pair
async function generateRSAKeyPair(): Promise<CryptoKeyPair> {
  return await crypto.subtle.generateKey(
    {
      name: 'RSA-OAEP',  // Or 'RSA-OAEP' for encryption
      modulusLength: 2048,  // Minimum 2048, recommended 4096
      publicExponent: new Uint8Array([1, 0, 1]),  // 65537
      hash: 'SHA-256'
    },
    true,
    ['encrypt', 'decrypt']
  );
}
```

### Import/Export Keys

```typescript
// Export public key to share
async function exportPublicKey(publicKey: CryptoKey): Promise<JsonWebKey> {
  return await crypto.subtle.exportKey('jwk', publicKey);
}

// Export private key (use with caution - password protect)
async function exportPrivateKey(privateKey: CryptoKey): Promise<JsonWebKey> {
  return await crypto.subtle.exportKey('jwk', privateKey);
}

// Import public key
async function importPublicKey(jwk: JsonWebKey): Promise<CryptoKey> {
  return await crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    []
  );
}

// Import private key (typically for decryption)
async function importPrivateKey(jwk: JsonWebKey): Promise<CryptoKey> {
  return await crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveKey', 'deriveBits']
  );
}

// Raw key export (ArrayBuffer)
async function exportKeyRaw(key: CryptoKey): Promise<ArrayBuffer> {
  return await crypto.subtle.exportKey('raw', key);
}

async function importKeyRaw(raw: ArrayBuffer, algorithm: string): Promise<CryptoKey> {
  return await crypto.subtle.importKey(
    'raw',
    raw,
    { name: algorithm },
    true,
    ['encrypt', 'decrypt']
  );
}
```

---

## 3. Encrypting/Decrypting

### AES-GCM (Recommended)

```typescript
// Encrypt with AES-GCM (recommended)
async function encryptAES(
  plaintext: string,
  key: CryptoKey
): Promise<{ ciphertext: ArrayBuffer; iv: Uint8Array }> {
  const encoder = new TextEncoder();
  const data = encoder.encode(plaintext);

  // Generate random IV (12 bytes recommended for GCM)
  const iv = crypto.getRandomValues(new Uint8Array(12));

  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    data
  );

  return { ciphertext, iv };
}

// Decrypt with AES-GCM
async function decryptAES(
  ciphertext: ArrayBuffer,
  key: CryptoKey,
  iv: Uint8Array
): Promise<string> {
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    ciphertext
  );

  const decoder = new TextDecoder();
  return decoder.decode(decrypted);
}

// Complete example
async function exampleAES() {
  // Generate key
  const key = await generateAESKey();

  // Encrypt
  const { ciphertext, iv } = await encryptAES('Hello, World!', key);

  // Decrypt
  const plaintext = await decryptAES(ciphertext, key, iv);
  console.log(plaintext); // "Hello, World!"

  // Store IV with ciphertext (it's not secret, just unique)
  const stored = Buffer.concat([
    Buffer.from(iv),
    Buffer.from(ciphertext)
  ]).toString('base64');
}
```

### RSA-OAEP (Asymmetric Encryption)

```typescript
// RSA key pair for asymmetric encryption
async function encryptRSA(
  plaintext: string,
  publicKey: CryptoKey
): Promise<ArrayBuffer> {
  const encoder = new TextEncoder();
  const data = encoder.encode(plaintext);

  // RSA-OAEP with SHA-256
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'RSA-OAEP' },
    publicKey,
    data
  );

  return ciphertext;
}

async function decryptRSA(
  ciphertext: ArrayBuffer,
  privateKey: CryptoKey
): Promise<string> {
  const decrypted = await crypto.subtle.decrypt(
    { name: 'RSA-OAEP' },
    privateKey,
    ciphertext
  );

  const decoder = new TextDecoder();
  return decoder.decode(decrypted);
}
```

### Hybrid Encryption (RSA + AES)

```typescript
// Encrypt with RSA public key (hybrid: encrypt AES key with RSA)
async function hybridEncrypt(
  message: string,
  recipientPublicKey: CryptoKey
): Promise<{ encryptedMessage: string; encryptedKey: string; iv: string }> {
  // 1. Generate random AES key for this message
  const aesKey = await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );

  // 2. Encrypt message with AES
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoder = new TextEncoder();
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    aesKey,
    encoder.encode(message)
  );

  // 3. Export and encrypt AES key with RSA
  const exportedKey = await crypto.subtle.exportKey('raw', aesKey);
  const encryptedKey = await crypto.subtle.encrypt(
    { name: 'RSA-OAEP' },
    recipientPublicKey,
    exportedKey
  );

  return {
    encryptedMessage: Buffer.from(ciphertext).toString('base64'),
    encryptedKey: Buffer.from(encryptedKey).toString('base64'),
    iv: Buffer.from(iv).toString('base64')
  };
}

// Decrypt with RSA private key
async function hybridDecrypt(
  encryptedMessage: string,
  encryptedKey: string,
  iv: string,
  recipientPrivateKey: CryptoKey
): Promise<string> {
  // 1. Decrypt AES key with RSA
  const keyBuffer = Buffer.from(encryptedKey, 'base64');
  const aesKeyBuffer = await crypto.subtle.decrypt(
    { name: 'RSA-OAEP' },
    recipientPrivateKey,
    keyBuffer
  );

  // 2. Import AES key
  const aesKey = await crypto.subtle.importKey(
    'raw',
    aesKeyBuffer,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  );

  // 3. Decrypt message with AES
  const ivBuffer = Buffer.from(iv, 'base64');
  const messageBuffer = Buffer.from(encryptedMessage, 'base64');

  const combined = Buffer.concat([ivBuffer, messageBuffer]);
  const ciphertext = combined.slice(12);
  const iv = combined.slice(0, 12);

  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    aesKey,
    ciphertext
  );

  return new TextDecoder().decode(plaintext);
}
```

---

## 4. Signing/Verifying

### ECDSA Signing

```typescript
// Sign with ECDSA (recommended)
async function signECDSA(
  message: string,
  privateKey: CryptoKey
): Promise<{ signature: ArrayBuffer; hash: string }> {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);

  // Sign with SHA-256 hash
  const signature = await crypto.subtle.sign(
    {
      name: 'ECDSA',
      hash: 'SHA-256'
    },
    privateKey,
    data
  );

  // Also return hash for verification
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);

  return {
    signature,
    hash: Buffer.from(hashBuffer).toString('hex')
  };
}

// Verify signature
async function verifyECDSA(
  message: string,
  signature: ArrayBuffer,
  publicKey: CryptoKey
): Promise<boolean> {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);

  return await crypto.subtle.verify(
    {
      name: 'ECDSA',
      hash: 'SHA-256'
    },
    publicKey,
    signature,
    data
  );
}

// Example
async function exampleSign() {
  // Generate key pair
  const { privateKey, publicKey } = await generateECDSAKeyPair();

  // Sign
  const { signature } = await signECDSA('Hello, World!', privateKey);

  // Verify
  const isValid = await verifyECDSA('Hello, World!', signature, publicKey);
  console.log(isValid); // true

  // Tampered message
  const tampered = await verifyECDSA('Hello, World?', signature, publicKey);
  console.log(tampered); // false
}
```

### HMAC Signing

```typescript
// HMAC for message authentication (faster than ECDSA for short messages)
async function signHMAC(
  message: string,
  key: CryptoKey
): Promise<ArrayBuffer> {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);

  return await crypto.subtle.sign(
    { name: 'HMAC', hash: 'SHA-256' },
    key,
    data
  );
}

async function verifyHMAC(
  message: string,
  signature: ArrayBuffer,
  key: CryptoKey
): Promise<boolean> {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);

  return await crypto.subtle.verify(
    { name: 'HMAC', hash: 'SHA-256' },
    key,
    signature,
    data
  );
}

// Generate HMAC key
async function generateHMACKey(): Promise<CryptoKey> {
  return await crypto.subtle.generateKey(
    { name: 'HMAC', hash: 'SHA-256', length: 256 },
    true,
    ['sign', 'verify']
  );
}
```

---

## 5. Hashing

```typescript
// SHA-256 hashing
async function hashSHA256(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const buffer = await crypto.subtle.digest('SHA-256', encoder.encode(data));
  return Buffer.from(buffer).toString('hex');
}

// SHA-384 hashing
async function hashSHA384(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const buffer = await crypto.subtle.digest('SHA-384', encoder.encode(data));
  return Buffer.from(buffer).toString('hex');
}

// MD5 (AVOID - broken)
async function hashMD5(data: string): Promise<string> {
  // This should throw - MD5 is not supported in WebCrypto
  // Use a JS library only if absolutely necessary
  throw new Error('MD5 is not supported in WebCrypto API');
}
```

---

## 6. Key Derivation

### PBKDF2 (Password-Based Key Derivation)

```typescript
// Derive key from password using PBKDF2
async function deriveKeyFromPassword(
  password: string,
  salt: Uint8Array,
  iterations: number = 100000
): Promise<CryptoKey> {
  // Import password as key material
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  // Derive AES key from password
  return await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
}

// Complete example with salt generation
async function deriveKeyWithSalt(
  password: string,
  purpose: string = 'default'
): Promise<{ key: CryptoKey; salt: string; hash: string }> {
  // Generate purpose-specific salt
  const purposeBytes = new TextEncoder().encode(purpose);
  const purposeHash = await crypto.subtle.digest('SHA-256', purposeBytes);
  const salt = new Uint8Array(purposeHash);

  const key = await deriveKeyFromPassword(password, salt, 100000);

  return {
    key,
    salt: Buffer.from(salt).toString('base64'),
    hash: Buffer.from(purposeHash).toString('hex')
  };
}
```

### HKDF (HMAC-based Key Derivation)

```typescript
// HKDF for deriving keys from shared secrets
async function deriveKeyHKDF(
  inputKey: ArrayBuffer,
  salt: Uint8Array,
  info: string,
  length: number = 32
): Promise<CryptoKey> {
  // Import input key
  const key = await crypto.subtle.importKey(
    'raw',
    inputKey,
    { name: 'HKDF' },
    false,
    ['deriveKey']
  );

  // Derive key
  return await crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt,
      info: new TextEncoder().encode(info)
    },
    key,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
}

// Usage after ECDH key exchange
async function deriveSharedKey(
  sharedSecret: ArrayBuffer,
  salt: Uint8Array,
  purpose: string
): Promise<CryptoKey> {
  return await deriveKeyHKDF(
    sharedSecret,
    salt,
    purpose,
    32
  );
}
```

### ECDH Key Derivation

```typescript
// Derive shared secret via ECDH
async function deriveSharedSecret(
  privateKey: CryptoKey,
  publicKey: CryptoKey
): Promise<ArrayBuffer> {
  return await crypto.subtle.deriveBits(
    {
      name: 'ECDH',
      public: publicKey
    },
    privateKey,
    256  // Number of bits
  );
}

// Derive AES key from ECDH shared secret
async function deriveAESKeyFromECDH(
  privateKey: CryptoKey,
  publicKey: CryptoKey,
  salt: Uint8Array
): Promise<CryptoKey> {
  const sharedSecret = await deriveSharedSecret(privateKey, publicKey);

  return await deriveKeyHKDF(
    sharedSecret,
    salt,
    'encryption',
    32
  );
}
```

---

## 7. Complete Examples

### Secure Message Encryption

```typescript
// lib/crypto.ts - Complete E2EE messaging encryption
import { v4 as uuidv4 } from 'uuid';

interface EncryptedMessage {
  id: string;
  version: number;
  sender: string;
  recipient: string;
  iv: string;
  ciphertext: string;
  ephemeral: boolean;  // For forward secrecy
  timestamp: number;
}

interface KeyPair {
  publicKey: CryptoKey;
  privateKey: CryptoKey;
}

// Generate user's identity key pair
async function generateIdentityKeyPair(): Promise<KeyPair> {
  return await crypto.subtle.generateKey(
    {
      name: 'ECDH',
      namedCurve: 'P-256'
    },
    true,
    ['deriveKey', 'deriveBits']
  );
}

// Export/import helpers
async function exportPublicKey(key: CryptoKey): Promise<string> {
  const jwk = await crypto.subtle.exportKey('jwk', key);
  return JSON.stringify(jwk);
}

async function importPublicKey(keyJson: string): Promise<CryptoKey> {
  const jwk = JSON.parse(keyJson);
  return await crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    []
  );
}

// Encrypt message
async function encryptMessage(
  message: string,
  senderPrivateKey: CryptoKey,
  recipientPublicKey: CryptoKey
): Promise<EncryptedMessage> {
  // Derive shared secret
  const sharedSecret = await crypto.subtle.deriveBits(
    { name: 'ECDH', public: recipientPublicKey },
    senderPrivateKey,
    256
  );

  // Generate message-specific salt
  const salt = crypto.getRandomValues(new Uint8Array(16));

  // Derive encryption key from shared secret
  const encryptionKey = await crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt,
      info: new TextEncoder().encode('message-key')
    },
    await crypto.subtle.importKey(
      'raw',
      sharedSecret,
      { name: 'HKDF' },
      false,
      ['deriveKey']
    ),
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt']
  );

  // Generate IV
  const iv = crypto.getRandomValues(new Uint8Array(12));

  // Encrypt message
  const encoder = new TextEncoder();
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    encryptionKey,
    encoder.encode(message)
  );

  return {
    id: uuidv4(),
    version: 1,
    sender: await exportPublicKey(senderPrivateKey),
    recipient: await exportPublicKey(recipientPublicKey),
    iv: Buffer.from(iv).toString('base64'),
    ciphertext: Buffer.from(ciphertext).toString('base64'),
    ephemeral: true,
    timestamp: Date.now()
  };
}

// Decrypt message
async function decryptMessage(
  encrypted: EncryptedMessage,
  recipientPrivateKey: CryptoKey,
  senderPublicKey: CryptoKey
): Promise<string> {
  // Derive same shared secret (ECDH is symmetric)
  const sharedSecret = await crypto.subtle.deriveBits(
    { name: 'ECDH', public: senderPublicKey },
    recipientPrivateKey,
    256
  );

  // Derive same encryption key
  const salt = new Uint8Array(0); // Different salt should be stored in message
  const encryptionKey = await crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: Buffer.from(encrypted.iv, 'base64').slice(0, 16),
      info: new TextEncoder().encode('message-key')
    },
    await crypto.subtle.importKey(
      'raw',
      sharedSecret,
      { name: 'HKDF' },
      false,
      ['deriveKey']
    ),
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  );

  // Decrypt
  const iv = Buffer.from(encrypted.iv, 'base64');
  const ciphertext = Buffer.from(encrypted.ciphertext, 'base64');

  const combined = Buffer.concat([iv, ciphertext]);
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    encryptionKey,
    ciphertext
  );

  return new TextDecoder().decode(plaintext);
}
```

---

## 8. Security Considerations

### Key Extraction Prevention

```typescript
// ❌ DANGER: extractable keys can be exported
const key = await crypto.subtle.generateKey(
  { name: 'AES-GCM', length: 256 },
  true,  // extractable = true - BAD!
  ['encrypt', 'decrypt']
);

// ✅ GOOD: non-extractable keys cannot be exported
const key = await crypto.subtle.generateKey(
  { name: 'AES-GCM', length: 256 },
  false,  // extractable = false - GOOD
  ['encrypt', 'decrypt']
);
```

### Random Number Generation

```typescript
// ❌ BAD: Math.random() is NOT cryptographically secure
const badRandom = Math.random(); // Predictable!

// ✅ GOOD: Use crypto.getRandomValues()
const goodRandom = crypto.getRandomValues(new Uint8Array(16));
```

### Constant-Time Comparison

```typescript
// ❌ BAD: Regular comparison is vulnerable to timing attacks
function badCompare(a: ArrayBuffer, b: ArrayBuffer): boolean {
  const aBytes = new Uint8Array(a);
  const bBytes = new Uint8Array(b);
  if (aBytes.length !== bBytes.length) return false;
  for (let i = 0; i < aBytes.length; i++) {
    if (aBytes[i] !== bBytes[i]) return false;
  }
  return true;
}

// ✅ GOOD: Use timingSafeEqual
function goodCompare(a: ArrayBuffer, b: ArrayBuffer): boolean {
  const aBytes = new Uint8Array(a);
  const bBytes = new Uint8Array(b);
  return crypto.timingSafeEqual(aBytes, bBytes);
}
```

### IV/Nonce Reuse Prevention

```typescript
// ❌ BAD: Reusing IV compromises security
const iv = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
// Reusing this IV with same key leaks information

// ✅ GOOD: Generate unique IV for each message
function encryptUniqueIV(message: string, key: CryptoKey) {
  const iv = crypto.getRandomValues(new Uint8Array(12)); // Always unique
  // ... encrypt with unique IV
}
```

### Key Size Requirements

| Algorithm | Minimum | Recommended |
|-----------|----------|-------------|
| AES | 128-bit | 256-bit |
| RSA | 2048-bit | 4096-bit |
| ECDSA (P-curve) | P-256 | P-384 or P-521 |
| ECDH (P-curve) | P-256 | P-384 or P-521 |
| HMAC | 128-bit | 256-bit |

---

## OWASP References

- [Cryptographic Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cryptographic_Storage_Cheat_Sheet.html)
- [Key Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Key_Management_Cheat_Sheet.html)

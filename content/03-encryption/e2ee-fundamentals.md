---
title: "End-to-End Encryption (E2EE) Fundamentals"
description: ""
date: "2026-04-24"
author: "Saul Vo"
tags: ["encryption","cryptography","e2ee"]
readingTime: "5 min"
order: 1
slug: "e2ee-fundamentals"
category: "encryption"
---

# End-to-End Encryption (E2EE) Fundamentals

## Mục lục
1. [E2EE vs In-Transit Encryption](#1-e2ee-vs-in-transit-encryption)
2. [Key Exchange Protocols](#2-key-exchange-protocols)
3. [Symmetric vs Asymmetric Encryption](#3-symmetric-vs-asymmetric-encryption)
4. [E2EE Architecture](#4-e2ee-architecture)
5. [Key Management](#5-key-management)
6. [Common Attack Vectors](#6-common-attack-vectors)
7. [E2EE Implementation Checklist](#7-e2ee-implementation-checklist)

---

## 1. E2EE vs In-Transit Encryption

### In-Transit Encryption (TLS)

```
┌─────────────────────────────────────────────────────────────────────┐
│                 In-Transit Encryption (TLS)                         │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  User A ──────── TLS ──────── Server ──────── TLS ──────── User B   │
│   │                                  │                              │
│   │                                  │                              │
│   ├── Data encrypted                  ├── Data decrypted            │
│   │   between A and Server            │   on Server                │
│   │                                  │                              │
│   └── Server can read                └── Server can read          │
│       all data                           all data                   │
│                                                                     │
│  ⚠️ DATA IS VISIBLE TO SERVER                                      │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### End-to-End Encryption (E2EE)

```
┌─────────────────────────────────────────────────────────────────────┐
│                 End-to-End Encryption (E2EE)                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  User A ──────────── ENCRYPTED ──────────── User B                   │
│   │                                               │                 │
│   │    Only User A and User B can decrypt         │                 │
│   │    Server sees ONLY ciphertext               │                 │
│   │                                               │                 │
│   │                                               │                 │
│  ┌─┴─────────────────────────────────────────────┴─┐              │
│  │              Messages encrypted with            │              │
│  │              shared secret only known          │              │
│  │              to sender and recipient           │              │
│  └────────────────────────────────────────────────┘              │
│                                                                     │
│  ✅ SERVER CANNOT READ ANY DATA                                     │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### When to Use E2EE

| Use Case | Encryption Needed | Why |
|----------|-------------------|-----|
| Chat/Messaging | **E2EE Required** | Only sender/recipient can read |
| Document Collaboration | Depends | Server-side features may need access |
| Banking/Healthcare | **E2EE Strongly Recommended** | Regulatory requirements |
| Customer Support Chat | May use TLS only | Server may need to read for support |
| Real-time Collaboration | May use TLS only | Server features needed |

---

## 2. Key Exchange Protocols

### Diffie-Hellman Key Exchange

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Diffie-Hellman Key Exchange                       │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Setup:                                                             │
│  • Public parameters: prime (p), generator (g)                      │
│  • Both parties agree on these                                      │
│                                                                     │
│  Protocol:                                                          │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  Alice                          Bob                          │   │
│  │    │                              │                          │   │
│  │    │  Generate private key a       │                          │   │
│  │    │  Generate private key b       │                          │   │
│  │    │                              │                          │   │
│  │    │  Compute A = g^a mod p       │  Compute B = g^b mod p   │   │
│  │    │───────────────────────────────│─────────────────────────│   │
│  │    │                              │                          │   │
│  │    │  Compute shared key:         │  Compute shared key:    │   │
│  │    │  K = B^a mod p              │  K = A^b mod p          │   │
│  │    │                              │                          │   │
│  │    │  K = (g^b)^a mod p          │  K = (g^a)^b mod p      │   │
│  │    │    = g^(ab) mod p           │    = g^(ab) mod p      │   │
│  │    │                              │                          │   │
│  │    │  Shared secret K established!                        │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  Attacker (Eve) sees: p, g, A, B                                    │
│  Cannot compute K without solving discrete logarithm                 │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### ECDH (Elliptic Curve Diffie-Hellman)

```typescript
// Modern, recommended key exchange
import * as curve from 'starkbank-ec';

const aliceKeyPair = curve.genKeyPair();
const bobKeyPair = curve.genKeyPair();

// Alice computes shared secret
const aliceSharedSecret = curve.multiply(
  bobKeyPair.publicKey,
  aliceKeyPair.privateKey
);

// Bob computes shared secret
const bobSharedSecret = curve.multiply(
  aliceKeyPair.publicKey,
  bobKeyPair.privateKey
);

// Both get the same shared secret
console.log(aliceSharedSecret === bobSharedSecret); // true
```

### X25519 Key Exchange

```typescript
// libsodium-style key exchange
import { box } from 'tweetnacl';

// Alice generates keypair
const aliceKeyPair = nacl.box.keyPair();

// Bob generates keypair
const bobKeyPair = nacl.box.keyPair();

// Shared secret (Alice -> Bob)
const sharedSecretAliceToBob = nacl.box.before(
  bobKeyPair.publicKey,
  aliceKeyPair.secretKey
);

// Shared secret (Bob -> Alice) - same result
const sharedSecretBobToAlice = nacl.box.before(
  aliceKeyPair.publicKey,
  bobKeyPair.secretKey
);

console.log(sharedSecretAliceToBob === sharedSecretBobToAlice); // true
```

---

## 3. Symmetric vs Asymmetric Encryption

### Symmetric Encryption

```
┌─────────────────────────────────────────────────────────────────────┐
│                 Symmetric Encryption                                │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Uses SAME key for encryption and decryption:                      │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                                                             │   │
│  │   Plaintext ──────[ENCRYPT(key)]──────→ Ciphertext          │   │
│  │                    key = "secret123"                        │   │
│  │                                                             │   │
│  │   Ciphertext ─────[DECRYPT(key)]──────→ Plaintext           │   │
│  │                    key = "secret123"                        │   │
│  │                                                             │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  Pros: Fast, efficient for large data                             │
│  Cons: Key must be shared between parties                         │
│                                                                     │
│  Algorithms: AES-256-GCM (recommended), ChaCha20-Poly1305         │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Asymmetric Encryption

```
┌─────────────────────────────────────────────────────────────────────┐
│                 Asymmetric Encryption                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Uses DIFFERENT keys for encryption and decryption:                │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  Public Key (can be shared freely)                          │   │
│  │  • Used to ENCRYPT                                           │   │
│  │  • Anyone can have this                                     │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  Private Key (MUST be kept secret)                          │   │
│  │  • Used to DECRYPT                                           │   │
│  │  • Only owner should have this                              │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  Pros: No need to share private keys                              │
│  Cons: Slower than symmetric, larger keys                         │
│                                                                     │
│  Algorithms: RSA-OAEP (2048+ bits), ECIES (with AES)              │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Hybrid Encryption (Standard Practice)

```
┌─────────────────────────────────────────────────────────────────────┐
│                 Hybrid Encryption Pattern                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  To encrypt a message:                                             │
│  1. Generate random symmetric key (session key)                    │
│  2. Encrypt message with symmetric key (AES-GCM)                  │
│  3. Encrypt symmetric key with recipient's public key (ECIES)     │
│  4. Send both ciphertext + encrypted session key                   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  Sender:                                                     │   │
│  │    message + random_session_key                            │   │
│  │          │                                                 │   │
│  │          ├──[AES-GCM]──────────→ ciphertext                │   │
│  │          │                                                 │   │
│  │          └──[RSA-OAEP]──────────→ encrypted_session_key   │   │
│  │                                                             │   │
│  │  Send: { ciphertext, encrypted_session_key }                │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  Recipient:                                                 │   │
│  │    encrypted_session_key ───[RSA-DECRYPT]──→ session_key  │   │
│  │    ciphertext ───[AES-DECRYPT]──→ message                  │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Implementation with WebCrypto

```typescript
// Hybrid encryption using WebCrypto API
async function hybridEncrypt(
  message: string,
  recipientPublicKey: CryptoKey
): Promise<{ ciphertext: ArrayBuffer; encryptedKey: ArrayBuffer }> {
  // 1. Generate random session key for AES-GCM
  const sessionKey = await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,  // extractable
    ['encrypt']
  );

  // 2. Generate random IV
  const iv = crypto.getRandomValues(new Uint8Array(12));

  // 3. Encrypt message with session key
  const encoder = new TextEncoder();
  const messageBuffer = encoder.encode(message);

  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    sessionKey,
    messageBuffer
  );

  // 4. Encrypt session key with recipient's public key
  const exportedSessionKey = await crypto.subtle.exportKey('raw', sessionKey);

  const encryptedKey = await crypto.subtle.encrypt(
    { name: 'RSA-OAEP' },
    recipientPublicKey,
    exportedSessionKey
  );

  return { ciphertext, encryptedKey };
}

async function hybridDecrypt(
  ciphertext: ArrayBuffer,
  encryptedKey: ArrayBuffer,
  recipientPrivateKey: CryptoKey
): Promise<string> {
  // 1. Decrypt session key with private key
  const sessionKeyBuffer = await crypto.subtle.decrypt(
    { name: 'RSA-OAEP' },
    recipientPrivateKey,
    encryptedKey
  );

  // 2. Import session key
  const sessionKey = await crypto.subtle.importKey(
    'raw',
    sessionKeyBuffer,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  );

  // 3. Decrypt message
  // Note: IV should be prepended to ciphertext
  const iv = new Uint8Array(ciphertext.slice(0, 12));
  const encryptedMessage = ciphertext.slice(12);

  const messageBuffer = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    sessionKey,
    encryptedMessage
  );

  const decoder = new TextDecoder();
  return decoder.decode(messageBuffer);
}
```

---

## 4. E2EE Architecture

### Direct E2EE (No Server Key Access)

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Direct E2EE Architecture                           │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                    Key Generation                            │  │
│  │                                                              │  │
│  │  Alice's Device:                                             │  │
│  │    • Generates identity key pair (long-term)                 │  │
│  │    • Generates prekeys (for key exchange)                    │  │
│  │    • Publishes public keys to server                         │  │
│  │    • Private keys NEVER leave device                         │  │
│  │                                                              │  │
│  │  Bob's Device:                                               │  │
│  │    • Same process                                            │  │
│  │                                                              │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                    Message Flow                                │  │
│  │                                                              │  │
│  │  Alice:                                                      │  │
│  │    1. Gets Bob's public keys from server                      │  │
│  │    2. Derives shared secret with Bob's keys                  │  │
│  │    3. Encrypts message with shared secret                    │  │
│  │    4. Sends ciphertext to server                             │  │
│  │                                                              │  │
│  │  Server: (SEES ONLY)                                         │  │
│  │    • Ciphertext                                              │  │
│  │    • Sender/recipient metadata                                │  │
│  │    • Timestamps                                              │  │
│  │                                                              │  │
│  │  Bob:                                                        │  │
│  │    1. Receives ciphertext from server                         │  │
│  │    2. Derives shared secret with Alice's keys                 │  │
│  │    3. Decrypts message                                       │  │
│  │                                                              │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Key Distribution Models

```
┌─────────────────────────────────────────────────────────────────────┐
│               Key Distribution Models                               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Model 1: Server Stores Encrypted Keys                             │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │  Server stores:                                              │  │
│  │    • Encrypted private keys (password-derived key)          │  │
│  │    • Public keys                                            │  │
│  │    • Prekey bundles                                         │  │
│  │                                                              │  │
│  │  User authenticates → Server sends encrypted key            │  │
│  │  User decrypts locally with password                         │  │
│  │                                                              │  │
│  │  ⚠️ Password must be strong, otherwise E2EE broken         │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  Model 2: Client Holds All Keys (Recommended)                     │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │  Private keys stored ONLY in:                                │  │
│  │    • User's device (encrypted storage)                       │  │
│  │    • Optional: encrypted backup to cloud                     │  │
│  │                                                              │  │
│  │  Key recovery via:                                          │  │
│  │    • Recovery phrase (BIP39 style)                           │  │
│  │    • Another trusted device                                │  │
│  │                                                              │  │
│  │  ✅ Truly zero-knowledge server                            │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  Model 3: Secret Sharing (Shamir's Secret Sharing)                 │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │  Private key split into N shares                            │  │
│  │  Requires M shares to reconstruct (e.g., 3 of 5)           │  │
│  │                                                              │  │
│  │  Share holders:                                             │  │
│  │    • User (1 share)                                         │  │
│  │    • Friends/family (2 shares)                              │  │
│  │    • Legal guardian (1 share)                              │  │
│  │    • Recovery service (1 share)                            │  │
│  │                                                              │  │
│  │  ✅ Recovery possible without single point of failure       │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 5. Key Management

### Key Generation

```typescript
// Generate E2EE identity keys
async function generateIdentityKeyPair(): Promise<CryptoKeyPair> {
  return await crypto.subtle.generateKey(
    {
      name: 'ECDSA',
      namedCurve: 'P-256'
    },
    true,  // extractable for backup
    ['sign', 'verify']
  );
}

async function generateEncryptionKeyPair(): Promise<CryptoKeyPair> {
  return await crypto.subtle.generateKey(
    {
      name: 'ECDH',
      namedCurve: 'P-256'
    },
    true,
    ['deriveKey', 'deriveBits']
  );
}

async function generatePreKeyPairs(): Promise<PreKeyPair[]> {
  const preKeys = [];
  for (let i = 0; i < 100; i++) {
    const keyPair = await crypto.subtle.generateKey(
      { name: 'ECDH', namedCurve: 'P-256' },
      true,
      ['deriveKey']
    );
    preKeys.push({
      id: i,
      keyPair,
      createdAt: new Date()
    });
  }
  return preKeys;
}
```

### Key Storage

```typescript
// Secure key storage using IndexedDB + encryption
import { getDatabase } from './db';

interface StoredKeyMaterial {
  keyId: string;
  keyType: 'identity' | 'encryption' | 'prekey' | 'session';
  encryptedKey: ArrayBuffer;
  keyMetadata: {
    createdAt: Date;
    deviceId: string;
    algorithm: string;
  };
}

async function storeKeyEncrypted(
  keyId: string,
  keyType: StoredKeyMaterial['keyType'],
  key: CryptoKey,
  password: string
): Promise<void> {
  // Derive encryption key from password
  const passwordKey = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const encryptionKey = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    passwordKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );

  // Export and encrypt key material
  const exportedKey = await crypto.subtle.exportKey('pkcs8', key);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encryptedKey = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    encryptionKey,
    exportedKey
  );

  // Store in IndexedDB
  const db = await getDatabase();
  await db.put('keys', {
    keyId,
    keyType,
    encryptedKey: Buffer.from(encryptedKey).toString('base64'),
    salt: Buffer.from(salt).toString('base64'),
    iv: Buffer.from(iv).toString('base64'),
    keyMetadata: {
      createdAt: new Date(),
      deviceId: getDeviceId(),
      algorithm: 'AES-256-GCM'
    }
  });
}

async function retrieveKeyDecrypted(
  keyId: string,
  password: string
): Promise<CryptoKey> {
  const db = await getDatabase();
  const stored = await db.get('keys', keyId);

  const salt = Buffer.from(stored.salt, 'base64');
  const iv = Buffer.from(stored.iv, 'base64');
  const encryptedKey = Buffer.from(stored.encryptedKey, 'base64');

  // Derive same encryption key
  const passwordKey = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  const encryptionKey = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    passwordKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );

  // Decrypt key material
  const decryptedKey = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    encryptionKey,
    encryptedKey
  );

  // Import back as CryptoKey
  return await crypto.subtle.importKey(
    'pkcs8',
    decryptedKey,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    ['deriveKey']
  );
}
```

### Key Rotation

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Key Rotation Strategy                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Identity Keys (Long-term):                                        │
│  • Rotate: Yearly or when compromised                              │
│  • Old key signatures remain verifiable for a grace period          │
│  • Notify contacts of new identity key                             │
│                                                                     │
│  Prekeys (Key exchange):                                           │
│  • Rotate: Daily or weekly                                         │
│  • Consume ~20-100 prekeys per key exchange                        │
│  • Server-side prekey bundles replenished automatically             │
│                                                                     │
│  Session Keys (Ephemeral):                                         │
│  • Rotate: Every message or session                                │
│  • Ratcheting forward secrecy (Signal Protocol)                    │
│  • Old keys destroyed immediately                                  │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  Forward Secrecy:                                           │   │
│  │    Compromising current key does NOT                        │   │
│  │    compromise past messages                                │   │
│  │                                                             │   │
│  │  Future Secrecy (Break-in Recovery):                       │   │
│  │    Compromising current key does NOT                       │   │
│  │    compromise future messages (after rotation)             │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 6. Common Attack Vectors

### Attack 1: Man-in-the-Middle (MITM)

```
┌─────────────────────────────────────────────────────────────────────┐
│                    MITM Attack on Key Exchange                      │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Alice ──────── A ──────────── Eve ─────────── B ──────── Bob      │
│          (Eve's key)         (Eve's key)                            │
│                                                                     │
│  Eve intercepts and replaces public keys:                          │
│  • Alice thinks Eve's key is Bob's                                  │
│  • Bob thinks Eve's key is Alice's                                  │
│  • Eve sits in the middle, decrypts and re-encrypts               │
│                                                                     │
│  DEFENSE:                                                          │
│  • Trust-on-first-use (TOFU) with manual verification              │
│  • Compare key fingerprints via secure channel                    │
│  • Use key pinning / certificate transparency                      │
│  • OTR protocol with socialist millionaire protocol               │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Attack 2: Key Compromise

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Key Compromise Attack                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Scenario: Attacker steals device/key backup                      │
│                                                                     │
│  If NO forward secrecy:                                            │
│  • All past messages can be decrypted                             │
│  • All future messages can be decrypted (if key reused)           │
│                                                                     │
│  With E2EE:                                                        │
│  • Stolen encrypted backup + weak password → decrypted            │
│  • Stolen device without encryption → all keys exposed           │
│                                                                     │
│  DEFENSE:                                                          │
│  • Forward secrecy (session key rotation)                         │
│  • Strong device encryption + Biometric/PIN                        │
│  • Recovery phrases, not actual keys                              │
│  • Key compromise detection alerts                                │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Attack 3: Metadata Correlation

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Metadata Correlation Attack                      │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Even with E2EE, metadata reveals:                                 │
│  • Who is communicating with whom                                 │
│  • When communication happens                                     │
│  • Message frequency and patterns                                 │
│  • Device fingerprinting                                          │
│  • IP addresses (if not masked)                                   │
│                                                                     │
│  Example:                                                         │
│  "User A sent encrypted message to User B                         │
│   at 3:00 AM, lasting 2 minutes"                                  │
│   reveals: suspicious communication timing                        │
│                                                                     │
│  DEFENSE:                                                          │
│  • Mix network (Tor-style)                                        │
│  • Dummy traffic                                                  │
│  • Onion routing                                                  │
│  • Metadata protection (Silence protocol)                         │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Attack 4: Social Engineering / Key Tainting

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Key Tainting Attack                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Attacker (Eve) manipulates Alice to accept fake key:              │
│                                                                     │
│  1. Eve creates fake key pretending to be Bob                      │
│  2. Eve sends message "Hi, my key changed"                       │
│  3. Alice, trusting Bob, accepts new key                          │
│  4. All future messages go through Eve                            │
│                                                                     │
│  DEFENSE:                                                         │
│  • Safety numbers (key fingerprints) verification                 │
│  • Automatic key change detection with alerts                     │
│  • Require out-of-band verification for key changes              │
│  • Social graph verification (friends list)                      │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 7. E2EE Implementation Checklist

### Key Management

- [ ] **Identity keys generated client-side**
- [ ] **Private keys never transmitted to server**
- [ ] **Keys encrypted at rest with strong password-derived key**
- [ ] **Key rotation schedule defined (identity: yearly, prekeys: weekly)**
- [ ] **Forward secrecy implemented**
- [ ] **Key compromise detection and alerts**
- [ ] **Secure key backup/recovery mechanism**

### Cryptographic Implementation

- [ ] **AES-256-GCM for symmetric encryption**
- [ ] **ECDH P-256 or X25519 for key exchange**
- [ ] **RSA-OAEP 2048+ for encrypting session keys** (if RSA used)
- [ ] **Cryptographically secure random number generation**
- [ ] **Proper IV/nonce handling (unique per message)**
- [ ] **Authenticated encryption (AEAD)**
- [ ] **Timing-safe comparison for MACs/keys**

### Protocol Design

- [ ] **Perfect forward secrecy via ratcheting**
- [ ] **Future secrecy via key rotation**
- [ ] **Replay attack prevention (sequence numbers)**
- [ ] **Deniability (for messaging)**
- [ ] **PFS property maintained even during key changes**

### Metadata Protection

- [ ] **Minimize metadata collection**
- [ ] **Transport over Tor/VPN option**
- [ ] **Sealed sender (hide sender from server)**
- [ ] **Private contact discovery**

### UI/UX Security

- [ ] **Safety numbers/fingerprint display for verification**
- [ ] **Key change alerts**
- [ ] **Clear trust indicators**
- [ ] **Secure input methods (no clipboard for sensitive data)**

---

## OWASP References

- [Cryptography Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cryptographic_Storage_Cheat_Sheet.html)
- [卿](https://cheatsheetseries.owasp.org/cheatsheets/Key_Management_Cheat_Sheet.html)

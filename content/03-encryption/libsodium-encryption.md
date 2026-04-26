---
title: "Libsodium Encryption"
description: ""
date: "2026-04-24"
author: "Saul Vo"
tags: ["encryption","cryptography","e2ee"]
readingTime: "5 min"
order: 2
slug: "libsodium-encryption"
category: "encryption"
---

# Libsodium Encryption

## Mục lục
1. [Libsodium Overview](#1-libsodium-overview)
2. [Installation](#2-installation)
3. [Secret-Key Encryption](#3-secret-key-encryption)
4. [Public-Key Encryption](#4-public-key-encryption)
5. [Sealed Boxes (Anonymous Encryption)](#5-sealed-boxes-anonymous-encryption)
6. [Key Derivation](#6-key-derivation)
7. [Password Hashing](#7-password-hashing)
8. [Authentication](#8-authentication)
9. [Complete Examples](#9-complete-examples)

---

## 1. Libsodium Overview

### What is Libsodium?

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Libsodium Overview                                │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Libsodium is a modern, easy-to-use cryptography library:           │
│                                                                     │
│  ✓ Cross-platform (C, bindings for 20+ languages)                  │
│  ✓ Memory-hard hashing (resistant to GPU/ASIC)                      │
│  ✓ Easy API design (high-level functions)                          │
│  ✓ Side-channel resistant implementations                           │
│  ✓ Well-audited and widely used                                    │
│  ✓ Used by Signal, Wire, and many others                          │
│                                                                     │
│  Node.js/Bun: npm install libsodium-wrappers                       │
│  Browser: Bundled via WebAssembly                                   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### API Categories

| Category | Functions | Use Case |
|----------|-----------|----------|
| Secret-key encryption | `crypto_secretbox_*` | Symmetric encryption |
| Public-key encryption | `crypto_box_*` | Key exchange + encryption |
| Sealed boxes | `crypto_sealedbox_*` | Anonymous encryption |
| Authentication | `crypto_auth`, `crypto_onetimeauth` | MACs, streaming |
| Password hashing | `crypto_pwhash_*` | Argon2, password storage |
| Key derivation | `crypto_kdf_*` | HKDF-like derivation |
| Scalars | `crypto_scalarmult_*` | ECDH-like operations |

---

## 2. Installation

### Node.js

```bash
npm install libsodium-wrappers
```

```typescript
// TypeScript usage
import * as sodium from 'libsodium-wrappers';

async function initSodium() {
  await sodium.ready;
  return sodium;
}

// Use throughout your code
const msg = 'Hello, World';
const key = sodium.crypto_secretbox_keygen();

const encrypted = sodium.crypto_secretbox_easy(msg, key);
const decrypted = sodium.crypto_secretbox_open_easy(encrypted, key);
```

### Browser (WASM)

```typescript
// libsodium-wrappers auto-detects and uses WASM in browser
import * as sodium from 'libsodium-wrappers';

await sodium.ready;

// All same APIs work in browser
const encrypted = sodium.crypto_secretbox_easy(msg, key);
```

### Bun Native

```typescript
// Bun has native libsodium support
import { crypto_secretbox_keygen, crypto_secretbox_easy } from 'bun';

const key = crypto_secretbox_keygen();
const encrypted = crypto_secretbox_easy(msg, key);
```

---

## 3. Secret-Key Encryption

### Quick Example

```typescript
import * as sodium from 'libsodium-wrappers';

async function secretBoxExample() {
  await sodium.ready;

  // Generate random 256-bit key
  const key = sodium.crypto_secretbox_keygen();

  // Generate random 24-byte nonce (unique per message!)
  const nonce = sodium.randombytes_buf(24);

  const message = 'Secret message';

  // Encrypt
  const ciphertext = sodium.crypto_secretbox_easy(message, nonce, key);

  // Decrypt
  const plaintext = sodium.crypto_secretbox_open_easy(ciphertext, nonce, key);

  console.log('Message:', message);
  console.log('Ciphertext:', sodium.to_hex(ciphertext));
  console.log('Decrypted:', plaintext);
}

secretBoxExample();
```

### API Reference

```typescript
// Key generation (256-bit)
const key = sodium.crypto_secretbox_keygen();

// Alternative: derive key from password
const key = sodium.crypto_kdf_derive_from_key(
  32,  // Output length
  1,    // Subkey ID
  'application_id',  // Context/subkey ID
  masterKey
);

// Encrypt message
const ciphertext = sodium.crypto_secretbox_easy(
  message: string | Uint8Array,
  nonce: Uint8Array,  // 24 bytes
  key: Uint8Array     // 32 bytes
): Uint8Array;

// Decrypt message
const plaintext = sodium.crypto_secretbox_open_easy(
  ciphertext: Uint8Array,
  nonce: Uint8Array,
  key: Uint8Array
): Uint8Array;

// Detached mode (for large messages)
const { ciphertext, mac } = sodium.crypto_secretbox_detach(
  message,
  nonce,
  key
);
// Send: nonce + mac + ciphertext (separately)
```

### Constants

```typescript
console.log({
  KEYBYTES: sodium.crypto_secretbox_KEYBYTES,     // 32
  NONCEBYTES: sodium.crypto_secretbox_NONCEBYTES,  // 24
  MACBYTES: sodium.crypto_secretbox_MACBYTES,     // 16
  PRIMITIVE: sodium.crypto_secretbox_PRIMITIVE    // 'x25519-xsalsa20-poly1305'
});
```

---

## 4. Public-Key Encryption

### Key Exchange + Encryption

```typescript
import * as sodium from 'libsodium-wrappers';

async function boxExample() {
  await sodium.ready;

  // Generate key pairs
  const aliceKeyPair = sodium.crypto_box_keypair();
  const bobKeyPair = sodium.crypto_box_keypair();

  // Alice's side: Encrypt for Bob
  const nonce = sodium.randombytes_buf(24);
  const message = 'Secret message for Bob';

  // Method 1: Using sender's private + recipient's public key
  const ciphertext = sodium.crypto_box_easy(
    message,
    nonce,
    bobKeyPair.publicKey,
    aliceKeyPair.privateKey
  );

  // Method 2: Pre-compute shared key (more efficient for multiple messages)
  const sharedKey = sodium.crypto_box_beforenm(
    bobKeyPair.publicKey,
    aliceKeyPair.privateKey
  );

  const ciphertext2 = sodium.crypto_box_easy_afternm(message, nonce, sharedKey);

  // Bob's side: Decrypt with his private + Alice's public key
  const plaintext = sodium.crypto_box_open_easy(
    ciphertext,
    nonce,
    aliceKeyPair.publicKey,
    bobKeyPair.privateKey
  );

  console.log('Original:', message);
  console.log('Decrypted:', plaintext);
}

boxExample();
```

### API Reference

```typescript
// Generate key pair (25519)
const keyPair = sodium.crypto_box_keypair();
// keyPair.publicKey (32 bytes)
// keyPair.privateKey (32 bytes)

// Seeded key pair (deterministic)
const keyPair = sodium.crypto_box_seed_keypair(seed);

// Pre-compute shared key (for many messages to same recipient)
const sharedKey = sodium.crypto_box_beforenm(
  recipientPublicKey: Uint8Array,
  senderPrivateKey: Uint8Array
): Uint8Array;  // 32 bytes

// Encrypt
const ciphertext = sodium.crypto_box_easy(
  message: string | Uint8Array,
  nonce: Uint8Array,
  recipientPublicKey: Uint8Array,
  senderPrivateKey: Uint8Array
): Uint8Array;

// Encrypt with pre-computed shared key
const ciphertext = sodium.crypto_box_easy_afternm(
  message,
  nonce,
  sharedKey
): Uint8Array;

// Decrypt
const plaintext = sodium.crypto_box_open_easy(
  ciphertext,
  nonce,
  senderPublicKey: Uint8Array,
  recipientPrivateKey: Uint8Array
): Uint8Array;

// Decrypt with pre-computed shared key
const plaintext = sodium.crypto_box_open_easy_afternm(
  ciphertext,
  nonce,
  sharedKey
): Uint8Array;

// Detached mode
const { ciphertext, mac } = sodium.crypto_box_detach(...);
const plaintext = sodium.crypto_box_open_detach(..., mac);
```

---

## 5. Sealed Boxes (Anonymous Encryption)

### One-Way Encryption (Sender Anonymity)

```typescript
import * as sodium from 'libsodium-wrappers';

async function sealedBoxExample() {
  await sodium.ready;

  // Bob generates his key pair (public key only needed for sealing)
  const bobKeyPair = sodium.crypto_box_keypair();

  // Alice seals message with just Bob's public key (no sender key needed)
  const message = 'Anonymous message to Bob';
  const sealed = sodium.crypto_sealedbox_seal(message, bobKeyPair.publicKey);

  // Bob opens with his private key (sender is anonymous)
  const plaintext = sodium.crypto_sealedbox_open(sealed, bobKeyPair);

  console.log('Sealed (hex):', sodium.to_hex(sealed));
  console.log('Decrypted:', plaintext);
}

sealedBoxExample();
```

### When to Use Sealed Boxes

| Use Case | Recommended |
|----------|-------------|
| User-to-user messaging | `crypto_box_*` |
| Anonymous tips/messages | `crypto_sealedbox_*` |
| Encrypted storage | `crypto_secretbox_*` |
| Key exchange | `crypto_box_beforenm` |

### API Reference

```typescript
// Sealed box (anonymous sender)
// Only recipient's public key is needed
const sealed = sodium.crypto_sealedbox_seal(
  message: string | Uint8Array,
  recipientPublicKey: Uint8Array
): Uint8Array;

// Open sealed box (requires recipient's key pair)
const plaintext = sodium.crypto_sealedbox_open(
  sealed: Uint8Array,
  recipientKeyPair: KeyPair
): Uint8Array;

// Note: sealed boxes are slightly larger than normal boxes
// because they include an ephemeral sender key
```

---

## 6. Key Derivation

### Master Key + Subkeys

```typescript
import * as sodium from 'libsodium-wrappers';

async function kdfExample() {
  await sodium.ready;

  // Generate 32-byte master key
  const masterKey = sodium.randombytes_buf(32);

  // Derive multiple subkeys for different purposes
  const encryptionKey = sodium.crypto_kdf_derive_from_key(
    32,           // Output length
    1,            // Subkey ID (arbitrary number)
    'encryption', // Context (8 bytes max)
    masterKey
  );

  const macKey = sodium.crypto_kdf_derive_from_key(
    32,
    2,
    'authentication',
    masterKey
  );

  const fileKey = sodium.crypto_kdf_derive_from_key(
    32,
    3,
    'file-encryption',
    masterKey
  );

  // Contexts should be unique per purpose
  // The same subkey ID with different context produces different keys
}

kdfExample();
```

### API Reference

```typescript
// Derive subkey from master key
const subkey = sodium.crypto_kdf_derive_from_key(
  length: number,       // 1-64 bytes (but typically 32)
  subkeyId: number,     // Arbitrary number to distinguish subkeys
  context: string,      // 8 bytes max, MUST be unique per context
  masterKey: Uint8Array // 32 bytes
): Uint8Array;

// Constants
console.log({
  KEYBYTES: sodium.crypto_kdf_KEYBYTES,         // 32
  CONTEXTBYTES: sodium.crypto_kdf_CONTEXTBYTES, // 8
  BYTES_MIN: sodium.crypto_kdf_BYTES_MIN,       // 16
  BYTES_MAX: sodium.crypto_kdf_BYTES_MAX        // 64
});
```

---

## 7. Password Hashing

### Argon2id Implementation

```typescript
import * as sodium from 'libsodium-wrappers';

async function passwordHashExample() {
  await sodium.ready;

  const password = 'secure_password_123';

  // Hash password
  const hash = sodium.crypto_pwhash_str(
    password,
    sodium.crypto_pwhash_OPSLIMIT_INTERACTIVE,
    sodium.crypto_pwhash_MEMLIMIT_INTERACTIVE
  );

  // Verify password
  const valid = sodium.crypto_pwhash_str_verify(hash, password);
  console.log('Hash:', hash);
  console.log('Valid:', valid); // true

  // Wrong password
  const invalid = sodium.crypto_pwhash_str_verify(hash, 'wrong_password');
  console.log('Invalid:', invalid); // false
}

passwordHashExample();
```

### API Reference

```typescript
// Hash password with Argon2id (recommended)
const hash = sodium.crypto_pwhash_str(
  password: string | Uint8Array,
  opsLimit: number,    // CPU cost (use preset constants)
  memLimit: number     // Memory cost (use preset constants)
): string;             // Returns formatted hash string

// Verify password against hash
const valid = sodium.crypto_pwhash_str_verify(
  hash: string,
  password: string | Uint8Array
): boolean;

// Low-level API for more control
const hash = sodium.crypto_pwhash(
  outputLength: number,  // 16+ bytes recommended
  password: string | Uint8Array,
  salt: Uint8Array,       // 16 bytes
  opsLimit: number,
  memLimit: number,
  algorithm: number       // ARGON2ID13 (default) or ARGON2ID14
): Uint8Array;

// Preset constants
console.log({
  OPS_LIMIT_INTERACTIVE: sodium.crypto_pwhash_OPSLIMIT_INTERACTIVE,
  OPS_LIMIT_MODERATE: sodium.crypto_pwhash_OPSLIMIT_MODERATE,
  OPS_LIMIT_SENSITIVE: sodium.crypto_pwhash_OPSLIMIT_SENSITIVE,
  MEM_LIMIT_INTERACTIVE: sodium.crypto_pwhash_MEMLIMIT_INTERACTIVE,
  MEM_LIMIT_MODERATE: sodium.crypto_pwhash_MEMLIMIT_MODERATE,
  MEM_LIMIT_SENSITIVE: sodium.crypto_pwhash_MEMLIMIT_SENSITIVE
});
```

### Hash Format

```
$argon2id$v=19$m=65536,t=2,p=1$
$gfdhjkghfdjkghfdjkghfdjkghfdjkg$
$hfdgjkdfhgjkdhfgjkdhfkgjhdkgjhd=
```

Format: `$argon2id$v=19$m=32768,t=3,p=4$` + salt + hash

---

## 8. Authentication

### HMAC-SHA512

```typescript
import * as sodium from 'libsodium-wrappers';

async function authExample() {
  await sodium.ready;

  // Generate authentication key
  const key = sodium.crypto_auth_keygen();

  const message = 'Authenticated message';

  // Create authentication tag
  const tag = sodium.crypto_auth_fast(message, key);

  // Verify (same key)
  const valid = sodium.crypto_auth_verify(tag, message, key);
  console.log('Valid:', valid); // true

  // Tampered message
  const tampered = sodium.crypto_auth_verify(tag, 'Tampered', key);
  console.log('Tampered:', tampered); // false
}

authExample();
```

### One-Time Auth (Poly1305)

```typescript
import * as sodium from 'libsodium-wrappers';

async function oneTimeAuthExample() {
  await sodium.ready;

  // Poly1305 key (generated separately per message)
  const key = sodium.crypto_onetimeauth_keygen();

  const message = 'Message for one-time auth';

  // Authenticate
  const tag = sodium.crypto_onetimeauth_fast(message, key);

  // Verify
  const valid = sodium.crypto_onetimeauth_verify(tag, message, key);
  console.log('Valid:', valid); // true
}

oneTimeAuthExample();
```

---

## 9. Complete Examples

### E2EE Messaging with Libsodium

```typescript
import * as sodium from 'libsodium-wrappers';

interface EncryptedMessage {
  version: number;
  from: string;
  to: string;
  nonce: string;
  ciphertext: string;
}

interface KeyPair {
  publicKey: Uint8Array;
  privateKey: Uint8Array;
}

// Initialize
let sodiumInstance: typeof sodium;

async function init() {
  await sodium.ready;
  sodiumInstance = sodium;
}

// Generate user identity
function generateIdentity(): KeyPair {
  return sodiumInstance.crypto_box_keypair();
}

// Export public key (for sharing)
function exportPublicKey(keyPair: KeyPair): string {
  return sodiumInstance.to_hex(keyPair.publicKey);
}

// Import public key
function importPublicKey(hexKey: string): Uint8Array {
  return sodiumInstance.from_hex(hexKey);
}

// Encrypt message
function encryptMessage(
  message: string,
  sender: KeyPair,
  recipientPublicKey: Uint8Array
): EncryptedMessage {
  const nonce = sodiumInstance.randombytes_buf(24);

  const ciphertext = sodiumInstance.crypto_box_easy(
    message,
    nonce,
    recipientPublicKey,
    sender.privateKey
  );

  return {
    version: 1,
    from: exportPublicKey(sender),
    to: sodiumInstance.to_hex(recipientPublicKey),
    nonce: sodiumInstance.to_hex(nonce),
    ciphertext: sodiumInstance.to_hex(ciphertext)
  };
}

// Decrypt message
function decryptMessage(
  encrypted: EncryptedMessage,
  recipient: KeyPair
): string {
  const nonce = sodiumInstance.from_hex(encrypted.nonce);
  const senderPublicKey = sodiumInstance.from_hex(encrypted.from);
  const ciphertext = sodiumInstance.from_hex(encrypted.ciphertext);

  const plaintext = sodiumInstance.crypto_box_open_easy(
    ciphertext,
    nonce,
    senderPublicKey,
    recipient.privateKey
  );

  return sodiumInstance.to_string(plaintext);
}

// Session key derivation (for many messages)
function deriveSessionKey(
  sender: KeyPair,
  recipientPublicKey: Uint8Array
): Uint8Array {
  return sodiumInstance.crypto_box_beforenm(recipientPublicKey, sender.privateKey);
}

// Full example
async function main() {
  await init();

  // Alice and Bob generate identities
  const alice = generateIdentity();
  const bob = generateIdentity();

  // Alice sends encrypted message to Bob
  const message = 'Hey Bob, secret message!';
  const encrypted = encryptMessage(message, alice, bob.publicKey);

  console.log('Encrypted:', JSON.stringify(encrypted, null, 2));

  // Bob decrypts
  const decrypted = decryptMessage(encrypted, bob);
  console.log('Decrypted:', decrypted);

  // Verify
  console.log('Match:', decrypted === message); // true
}
```

### Encrypted Local Storage

```typescript
import * as sodium from 'libsodium-wrappers';

interface EncryptedStorage {
  salt: string;
  nonce: string;
  ciphertext: string;
}

async function createEncryptedStorage(
  data: Record<string, any>,
  password: string
): Promise<EncryptedStorage> {
  await sodium.ready;

  // Derive key from password
  const salt = sodium.randombytes_buf(16);
  const key = sodium.crypto_pwhash(
    32,
    password,
    salt,
    sodium.crypto_pwhash_OPSLIMIT_INTERACTIVE,
    sodium.crypto_pwhash_MEMLIMIT_INTERACTIVE,
    sodium.crypto_pwhash_ALG_DEFAULT
  );

  // Encrypt data
  const nonce = sodium.randombytes_buf(24);
  const plaintext = JSON.stringify(data);
  const ciphertext = sodium.crypto_secretbox_easy(plaintext, nonce, key);

  return {
    salt: sodium.to_hex(salt),
    nonce: sodium.to_hex(nonce),
    ciphertext: sodium.to_hex(ciphertext)
  };
}

async function decryptStorage(
  storage: EncryptedStorage,
  password: string
): Promise<Record<string, any>> {
  await sodium.ready;

  const salt = sodium.from_hex(storage.salt);
  const nonce = sodium.from_hex(storage.nonce);
  const ciphertext = sodium.from_hex(storage.ciphertext);

  const key = sodium.crypto_pwhash(
    32,
    password,
    salt,
    sodium.crypto_pwhash_OPSLIMIT_INTERACTIVE,
    sodium.crypto_pwhash_MEMLIMIT_INTERACTIVE,
    sodium.crypto_pwhash_ALG_DEFAULT
  );

  try {
    const plaintext = sodium.crypto_secretbox_open_easy(ciphertext, nonce, key);
    return JSON.parse(sodium.to_string(plaintext));
  } catch {
    throw new Error('Decryption failed - wrong password?');
  }
}

// Usage
const storage = await createEncryptedStorage(
  { apiKeys: { openai: 'sk-xxx' }, settings: { theme: 'dark' } },
  'user_password'
);

// Store securely (encryptedStorage.salt, nonce, ciphertext in IndexedDB/localStorage)
console.log('Storage:', storage);
```

---

## Security Notes

### Key Security

- **Never expose private keys** to network or logs
- **Store keys encrypted** with strong password-derived keys
- **Use unique nonces** for every encryption operation
- **Destroy keys** when no longer needed

### Password Hashing

- **Use Argon2id** (via `crypto_pwhash_str`)
- **Use INTERACTIVE or SENSITIVE limits** for production
- **Never use MD5/SHA1 for passwords**

### Random Numbers

```typescript
// Always use sodium's random functions
const random = sodium.randombytes_buf(32);    // 32 random bytes
const random16 = sodium.randombytes_random(); // 0-65535
const randomUniform = sodium.randombytes_uniform(100); // 0-99
```

---

## OWASP References

- [Cryptographic Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cryptographic_Storage_Cheat_Sheet.html)
- [Password Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)

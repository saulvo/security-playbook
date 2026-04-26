---
title: "Signal Protocol for Chat Encryption"
description: ""
date: "2026-04-24"
author: "Saul Vo"
tags: ["encryption","cryptography","e2ee"]
readingTime: "5 min"
order: 3
slug: "signal-protocol-chat"
category: "encryption"
---

# Signal Protocol for Chat Encryption

## Mục lục
1. [Signal Protocol Overview](#1-signal-protocol-overview)
2. [Double Ratchet Algorithm](#2-double-ratchet-algorithm)
3. [Prekey Bundle](#3-prekey-bundle)
4. [Session Management](#4-session-management)
5. [Implementation Architecture](#5-implementation-architecture)
6. [Complete Example](#6-complete-example)
7. [Security Properties](#7-security-properties)

---

## 1. Signal Protocol Overview

### What is Signal Protocol?

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Signal Protocol Overview                         │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Signal Protocol is the gold standard for E2EE messaging:          │
│                                                                     │
│  ✓ Used by Signal, WhatsApp, Facebook Messenger, Skype             │
│  ✓ Provides Perfect Forward Secrecy (PFS)                         │
│  ✓ Provides Future Secrecy / Break-in Recovery                     │
│  ✓ Minimal metadata leakage                                        │
│  ✓ Efficient for resource-constrained devices                     │
│                                                                     │
│  Key Components:                                                    │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │  Extended Triple Diffie-Hellman (X3DH) Key Agreement        │  │
│  │  • Initial key exchange between devices                     │  │
│  │  • Supports offline message delivery                       │  │
│  └─────────────────────────────────────────────────────────────┘  │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │  Double Ratchet Algorithm                                    │  │
│  │  • Continuous key derivation after each message             │  │
│  │  • Forward secrecy + break-in recovery                      │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Security Properties

| Property | Description | Protection |
|----------|-------------|-------------|
| **Forward Secrecy** | Past keys compromised doesn't reveal past messages | ✅ |
| **Future Secrecy** | Compromised current key doesn't reveal future messages | ✅ |
| **PFS + Break-in Recovery** | Both forward AND future secrecy combined | ✅ |
| **Message Unlinkability** | Cannot link messages to sender | ✅ |

---

## 2. Double Ratchet Algorithm

### Ratchet Concept

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Double Ratchet Visualization                      │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Message Chain (Symmetric Ratchet):                                 │
│                                                                     │
│  ┌─────────┐    ratchet    ┌─────────┐    ratchet    ┌─────────┐   │
│  │ Msg 1   │──────────────▶│ Msg 2   │──────────────▶│ Msg 3   │   │
│  │         │               │         │               │         │   │
│  │ chain_1 │               │ chain_2 │               │ chain_3 │   │
│  │  key    │               │  key    │               │  key    │   │
│  └─────────┘               └─────────┘               └─────────┘   │
│       │                          │                          │       │
│       ▼                          ▼                          ▼       │
│  DH Ratchet ◄────────────────┐   ◄────────────────────────┘       │
│       │                     │                                      │
│       │    ┌────────────────┴───────┐                             │
│       │    │                        │                             │
│       │    ▼                        ▼                             │
│  ┌─────────┐                  ┌─────────┐                          │
│  │ DH ratchet key            │ DH ratchet key                    │
│  │ (changes on              │ (changes on                       │
│  │  each recv)              │  each recv)                      │
│  └─────────┘                  └─────────┘                          │
│                                                                     │
│  Each message uses a NEW key derived from chain + DH ratchet       │
│  Old keys are destroyed after use (or max 1000 messages)           │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Symmetric Ratchet

```typescript
// Symmetric ratchet - derive new keys from old keys + message number
import * as sodium from 'libsodium-wrappers';

interface SymmetricRatchetState {
  chainKey: Uint8Array;
  messageNumber: number;
}

async function symRatchet(
  state: SymmetricRatchetState
): Promise<{ key: Uint8Array; newState: SymmetricRatchetState }> {
  await sodium.ready;

  // Derive key from chain key
  const keyMaterial = sodium.crypto_kdf_derive_from_key(
    32,
    state.messageNumber + 1,  // Subkey ID based on message number
    'symmetric-chain',
    state.chainKey
  );

  // Update chain key for next message (using HKDF-like derive)
  const newChainKey = sodium.crypto_kdf_derive_from_key(
    32,
    0,  // Different subkey ID for chain key update
    'symmetric-chain',
    state.chainKey
  );

  return {
    key: keyMaterial,
    newState: {
      chainKey: newChainKey,
      messageNumber: state.messageNumber + 1
    }
  };
}

// Example: sending messages
async function sendMessages() {
  const initialChainKey = sodium.randombytes_buf(32);
  let state: SymmetricRatchetState = {
    chainKey: initialChainKey,
    messageNumber: 0
  };

  // Message 1
  const { key: key1, newState: state1 } = await symRatchet(state);
  const msg1 = encryptWithKey('Hello', key1);
  state = state1;

  // Message 2
  const { key: key2, newState: state2 } = await symRatchet(state);
  const msg2 = encryptWithKey('World', key2);
  state = state2;

  console.log('Messages sent with different keys:', key1 !== key2);
}
```

### DH Ratchet

```typescript
// DH ratchet - update DH keys on each message receipt
import * as sodium from 'libsodium-wrappers';

interface DHRatchetState {
  DHKeyPair: CryptoKeyPair;
  remoteDHPublicKey: CryptoKey | null;
  chainKey: Uint8Array;
  rootKey: Uint8Array;
}

async function dhRatchet(
  state: DHRatchetState,
  newRemoteKey: CryptoKey
): Promise<{
  sendingChainKey: Uint8Array;
  receivingChainKey: Uint8Array;
  newState: DHRatchetState;
}> {
  await sodium.ready;

  if (state.remoteDHPublicKey) {
    // Calculate shared secret with previous remote key
    const prevSharedSecret = await deriveSharedSecret(
      state.DHKeyPair.privateKey,
      state.remoteDHPublicKey
    );

    // Update root key
    state.rootKey = await kdfRootKey(state.rootKey, prevSharedSecret);
  }

  // Generate new DH key pair
  const newDHKeyPair = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveKey', 'deriveBits']
  );

  // Calculate new shared secret with new remote key
  const newSharedSecret = await deriveSharedSecret(
    newDHKeyPair.privateKey,
    newRemoteKey
  );

  // Derive new root key
  const newRootKey = await kdfRootKey(state.rootKey, newSharedSecret);

  // Derive sending and receiving chain keys
  const sendingChainKey = await kdfChainKey(newRootKey, 'sending');
  const receivingChainKey = await kdfChainKey(newRootKey, 'receiving');

  return {
    sendingChainKey,
    receivingChainKey,
    newState: {
      DHKeyPair: newDHKeyPair,
      remoteDHPublicKey: newRemoteKey,
      chainKey: receivingChainKey,
      rootKey: newRootKey
    }
  };
}

async function deriveSharedSecret(privateKey: CryptoKey, publicKey: CryptoKey): Promise<ArrayBuffer> {
  return await crypto.subtle.deriveBits(
    { name: 'ECDH', public: publicKey },
    privateKey,
    256
  );
}

async function kdfRootKey(rootKey: Uint8Array, sharedSecret: ArrayBuffer): Promise<Uint8Array> {
  // Simple KDF: concatenate and hash
  const combined = new Uint8Array([...rootKey, ...new Uint8Array(sharedSecret)]);
  const hash = await crypto.subtle.digest('SHA-256', combined);
  return new Uint8Array(hash);
}

async function kdfChainKey(rootKey: Uint8Array, purpose: string): Promise<Uint8Array> {
  const purposeBytes = new TextEncoder().encode(purpose);
  const combined = new Uint8Array([...rootKey, ...purposeBytes]);
  const hash = await crypto.subtle.digest('SHA-256', combined);
  return new Uint8Array(hash);
}
```

### Double Ratchet (Combined)

```typescript
// Complete double ratchet state machine
import * as sodium from 'libsodium-wrappers';

interface DoubleRatchetState {
  // DH ratchet state
  DHKeyPair: { publicKey: Uint8Array; privateKey: Uint8Array };
  remoteDHPublicKey: Uint8Array;
  remoteDHRatchetKey: Uint8Array;

  // Symmetric ratchet state
  rootKey: Uint8Array;
  sendingChainKey: Uint8Array;
  receivingChainKey: Uint8Array;
  sendingMessageNumber: number;
  receivingMessageNumber: number;
  previousSendingChainLength: number;  // For out-of-order messages
}

interface Message {
  header: {
    dh_public_key: Uint8Array;
    chain_key_index: number;
    message_index: number;
    previous_chain_length: number;
  };
  ciphertext: Uint8Array;
}

// Send message
async function ratchetSend(
  state: DoubleRatchetState,
  plaintext: Uint8Array
): Promise<{ ciphertext: Message; newState: DoubleRatchetState }> {
  await sodium.ready;

  // If remote key changed, perform DH ratchet
  if (!arraysEqual(state.remoteDHPublicKey, state.remoteDHRatchetKey)) {
    state = await performDHRatchet(state);
  }

  // Symmetric ratchet - derive message key
  const { messageKey, chainKey, newChainKey } = await ratchetSymmetric(
    state.sendingChainKey,
    state.sendingMessageNumber
  );

  // Encrypt message
  const nonce = sodium.randombytes_buf(24);
  const ciphertext = sodium.crypto_secretbox_easy(plaintext, nonce, messageKey);

  const message: Message = {
    header: {
      dh_public_key: state.DHKeyPair.publicKey,
      chain_key_index: state.sendingMessageNumber,
      message_index: state.sendingMessageNumber,
      previous_chain_length: state.previousSendingChainLength
    },
    ciphertext: new Uint8Array([...nonce, ...ciphertext])
  };

  return {
    ciphertext: message,
    newState: {
      ...state,
      sendingChainKey: newChainKey,
      sendingMessageNumber: state.sendingMessageNumber + 1,
      previousSendingChainLength: state.sendingMessageNumber
    }
  };
}

// Receive message
async function ratchetReceive(
  state: DoubleRatchetState,
  message: Message
): Promise<{ plaintext: Uint8Array; newState: DoubleRatchetState }> {
  await sodium.ready;

  let currentState = state;

  // Check if we need to DH ratchet
  if (!arraysEqual(message.header.dh_public_key, state.remoteDHRatchetKey)) {
    currentState = await performDHRatchetForReceive(currentState, message.header.dh_public_key);
  }

  // Calculate which message key we need
  const { messageKey } = await ratchetGetMessageKey(
    currentState.receivingChainKey,
    currentState.receivingMessageNumber,
    message.header.message_index
  );

  // Decrypt message
  const nonce = message.ciphertext.slice(0, 24);
  const ciphertext = message.ciphertext.slice(24);

  const plaintext = sodium.crypto_secretbox_open_easy(ciphertext, nonce, messageKey);

  return {
    plaintext,
    newState: currentState
  };
}

async function performDHRatchet(state: DoubleRatchetState): Promise<DoubleRatchetState> {
  // Previous chain key derivation
  if (state.remoteDHPublicKey) {
    const prevShared = sodium.crypto_scalarmult(
      state.DHKeyPair.privateKey,
      state.remoteDHPublicKey
    );
    state.rootKey = kdfSimple(state.rootKey, prevShared, 'root');
    state.sendingChainKey = kdfSimple(state.sendingChainKey, prevShared, 'chain');
  }

  // Generate new DH key pair
  const newKeyPair = sodium.crypto_box_keypair();

  // Shared secret with new remote key
  const newShared = sodium.crypto_scalarmult(
    newKeyPair.privateKey,
    state.remoteDHRatchetKey
  );

  // Update root and chain keys
  state.rootKey = kdfSimple(state.rootKey, newShared, 'root');
  state.sendingChainKey = kdfSimple(state.rootKey, newShared, 'sending');
  state.receivingChainKey = kdfSimple(state.rootKey, newShared, 'receiving');

  // Reset message numbers
  state.DHKeyPair = newKeyPair;
  state.remoteDHPublicKey = state.remoteDHRatchetKey;
  state.sendingMessageNumber = 0;
  state.receivingMessageNumber = 0;
  state.previousSendingChainLength = 0;

  return state;
}

function kdfSimple(key: Uint8Array, shared: Uint8Array, purpose: string): Uint8Array {
  const combined = new Uint8Array([...key, ...shared, ...new TextEncoder().encode(purpose)]);
  const hash = sodium.crypto_hash_sha256(combined);
  return hash;
}

function arraysEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}
```

---

## 3. Prekey Bundle

### X3DH - Extended Triple Diffie-Hellman

```
┌─────────────────────────────────────────────────────────────────────┐
│                    X3DH Key Agreement                               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Purpose: Establish shared secret between two parties               │
│           without being online at the same time                    │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                    Prekey Bundle (Bob publishes)              │  │
│  │                                                              │  │
│  │  {                                                            │  │
│  │    identity_key: PK_Bob,         // Long-term key            │  │
│  │    signed_prekey: PK_Bob_signed, // Medium-term key          │  │
│  │    signed_prekey_signature: sig, // Signature of signed key  │  │
│  │    one_time_prekeys: [           // One-time keys (used once)│  │
│  │      PK_Bob_1, PK_Bob_2, ...                               │  │
│  │    ]                                                         │  │
│  │  }                                                            │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                    X3DH Protocol                              │  │
│  │                                                              │  │
│  │  Alice has: PK_Alice (identity), EK_Alice (ephemeral)        │  │
│  │  Bob has: IK_Bob (identity), SPK_Bob (signed), OPK_Bob (one-time) │
│  │                                                              │  │
│  │  Shared secrets:                                             │  │
│  │  DH1 = DH(IK_Alice, SPK_Bob)                                 │  │
│  │  DH2 = DH(EK_Alice, IK_Bob)                                  │  │
│  │  DH3 = DH(EK_Alice, SPK_Bob)                                 │  │
│  │  DH4 = DH(EK_Alice, OPK_Bob)  // Optional                    │  │
│  │                                                              │  │
│  │  SK = KDF(DH1 || DH2 || DH3 || DH4)                          │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Prekey Bundle Structure

```typescript
interface IdentityKeyPair {
  publicKey: Uint8Array;
  privateKey: Uint8Array;
}

interface SignedPreKeyPair {
  keyPair: IdentityKeyPair;
  signature: Uint8Array;
  id: number;
}

interface OneTimePreKeyPair {
  keyPair: IdentityKeyPair;
  id: number;
}

interface PreKeyBundle {
  identityKey: Uint8Array;        // Bob's long-term identity key
  signedPreKey: SignedPreKeyPair;  // Bob's medium-term signed key
  oneTimePreKey?: OneTimePreKeyPair; // Bob's one-time key (optional but recommended)
}

// Server stores/prepublishes prekey bundles
async function createPreKeyBundle(bobIdentity: IdentityKeyPair): Promise<PreKeyBundle> {
  await sodium.ready;

  // Generate signed prekey (rotated periodically)
  const signedPreKeyPair = sodium.crypto_box_keypair();
  const signature = sodium.crypto_sign_detached(
    signedPreKeyPair.publicKey,
    bobIdentity.privateKey
  );

  // Generate one-time prekeys (replenished after use)
  const oneTimePreKey = sodium.crypto_box_keypair();

  return {
    identityKey: bobIdentity.publicKey,
    signedPreKey: {
      keyPair: signedPreKeyPair,
      signature,
      id: 1  // Version ID
    },
    oneTimePreKey: {
      keyPair: oneTimePreKey,
      id: 1
    }
  };
}
```

### X3DH Key Agreement

```typescript
// X3DH shared secret derivation
async function x3dhKeyAgreement(
  aliceIdentity: IdentityKeyPair,
  aliceEphemeral: IdentityKeyPair,
  bobBundle: PreKeyBundle
): Promise<Uint8Array> {
  await sodium.ready;

  // DH1 = DH(IK_Alice, SPK_Bob)
  const dh1 = sodium.crypto_scalarmult(
    aliceIdentity.privateKey,
    bobBundle.signedPreKey.keyPair.publicKey
  );

  // DH2 = DH(EK_Alice, IK_Bob)
  const dh2 = sodium.crypto_scalarmult(
    aliceEphemeral.privateKey,
    bobBundle.identityKey
  );

  // DH3 = DH(EK_Alice, SPK_Bob)
  const dh3 = sodium.crypto_scalarmult(
    aliceEphemeral.privateKey,
    bobBundle.signedPreKey.keyPair.publicKey
  );

  // DH4 = DH(EK_Alice, OPK_Bob) if available
  let dh4: Uint8Array | null = null;
  if (bobBundle.oneTimePreKey) {
    dh4 = sodium.crypto_scalarmult(
      aliceEphemeral.privateKey,
      bobBundle.oneTimePreKey.keyPair.publicKey
    );
  }

  // SK = KDF(DH1 || DH2 || DH3 || DH4)
  const dh1b = dh1;
  const dh2b = dh2;
  const dh3b = dh3;
  const dh4b = dh4 || new Uint8Array(32);

  const combined = new Uint8Array([...dh1b, ...dh2b, ...dh3b, ...dh4b]);
  const sharedSecret = sodium.crypto_hash_sha256(combined);

  // Derive actual encryption key
  const encryptionKey = sodium.crypto_kdf_derive_from_key(
    32,
    1,
    'x3dh-master',
    sharedSecret
  );

  return encryptionKey;
}
```

---

## 4. Session Management

### Session States

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Session State Machine                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────┐                                                │
│  │   NO_SESSION    │                                                │
│  └────────┬────────┘                                                │
│           │ fetch prekey bundle + X3DH                               │
│           ▼                                                          │
│  ┌─────────────────┐                                                │
│  │ SESSION_CREATED │                                                │
│  │   (Initial)     │                                                │
│  └────────┬────────┘                                                │
│           │ first message sent/received                             │
│           ▼                                                          │
│  ┌─────────────────┐                                                │
│  │  RATCHETING     │◄────────────────────────────────┐             │
│  │   (Active)      │                                 │             │
│  └────────┬────────┘                                 │             │
│           │                                          │             │
│           │ receive message with new DH key          │             │
│           └──────────────────────────────────────────┘             │
│           │                                                          │
│           ▼                                                          │
│  ┌─────────────────┐                                                │
│  │   CLOSED        │  (user deletes session)                        │
│  └─────────────────┘                                                │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Session Storage

```typescript
interface SessionState {
  id: string;
  recipientId: string;
  deviceId: string;

  // Identity keys
  localIdentityKey: Uint8Array;
  remoteIdentityKey: Uint8Array;

  // Ratchet state
  rootKey: Uint8Array;
  sendingChainKey: Uint8Array;
  receivingChainKey: Uint8Array;
  sendingMessageNumber: number;
  receivingMessageNumber: number;
  previousSendingChainLength: number;

  // Remote ratchet key
  remoteRatchetKey: Uint8Array;

  // Timestamp
  createdAt: number;
  updatedAt: number;
}

// Session store interface
interface SessionStore {
  getSession(recipientId: string, deviceId: string): Promise<SessionState | null>;
  saveSession(session: SessionState): Promise<void>;
  deleteSession(recipientId: string, deviceId: string): Promise<void>;
  getAllSessionsForRecipient(recipientId: string): Promise<SessionState[]>;
}

// IndexedDB implementation for browser
class IndexedDBSessionStore implements SessionStore {
  private dbName = 'signal_sessions';
  private storeName = 'sessions';

  async getSession(recipientId: string, deviceId: string): Promise<SessionState | null> {
    const db = await this.openDB();
    const tx = db.transaction(this.storeName, 'readonly');
    const store = tx.objectStore(this.storeName);
    const key = `${recipientId}:${deviceId}`;

    return new Promise((resolve, reject) => {
      const request = store.get(key);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async saveSession(session: SessionState): Promise<void> {
    const db = await this.openDB();
    const tx = db.transaction(this.storeName, 'readwrite');
    const store = tx.objectStore(this.storeName);
    const key = `${session.recipientId}:${session.deviceId}`;

    return new Promise((resolve, reject) => {
      const request = store.put({ ...session, id: key });
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async deleteSession(recipientId: string, deviceId: string): Promise<void> {
    const db = await this.openDB();
    const tx = db.transaction(this.storeName, 'readwrite');
    const store = tx.objectStore(this.storeName);
    const key = `${recipientId}:${deviceId}`;

    return new Promise((resolve, reject) => {
      const request = store.delete(key);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  private openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        db.createObjectStore(this.storeName, { keyPath: 'id' });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
}
```

---

## 5. Implementation Architecture

### Complete Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Signal Protocol Architecture                      │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                      Application Layer                        │  │
│  │  {                                                            │  │
│  │    sendMessage(text), receiveMessage(encrypted),            │  │
│  │    onMessageDecrypted(callback)                              │  │
│  │  }                                                            │  │
│  └────────────────────────────┬───────────────────────────────┘  │
│                               │                                    │
│  ┌────────────────────────────▼───────────────────────────────┐  │
│  │                    Session Manager                           │  │
│  │  • createSession(recipientId, prekeyBundle)                 │  │
│  │  • getSession(recipientId)                                   │  │
│  │  • closeSession(recipientId)                               │  │
│  └────────────────────────────┬───────────────────────────────┘  │
│                               │                                    │
│  ┌────────────────────────────▼───────────────────────────────┐  │
│  │                   Ratchet Manager                          │  │
│  │  • ratchetSend(state, plaintext)                           │  │
│  │  • ratchetReceive(state, message)                         │  │
│  │  • performDHRatchet(state)                               │  │
│  └────────────────────────────┬───────────────────────────────┘  │
│                               │                                    │
│  ┌────────────────────────────▼───────────────────────────────┐  │
│  │                   Crypto Primitives                        │  │
│  │  • AES-GCM (symmetric encryption)                         │  │
│  │  • X25519/ECDH (key exchange)                            │  │
│  │  • HS256/HMAC (signing)                                  │  │
│  │  • Argon2 (password hashing)                             │  │
│  └────────────────────────────┬───────────────────────────────┘  │
│                               │                                    │
│  ┌────────────────────────────▼───────────────────────────────┐  │
│  │                    Storage Layer                          │  │
│  │  • SessionStore (IndexedDB)                              │  │
│  │  • PrekeyStore (IndexedDB)                               │  │
│  │  • IdentityKeyStore (encrypted)                          │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Key Management Service

```typescript
// lib/signal/keys.ts
import * as sodium from 'libsodium-wrappers';

interface KeyManager {
  generateIdentityKeyPair(): IdentityKeyPair;
  generateSignedPreKey(identityKey: IdentityKeyPair): SignedPreKeyPair;
  generateOneTimePreKeys(count: number): OneTimePreKeyPair[];
  getPublicPreKeyBundle(): PreKeyBundle;
}

class SignalKeyManager implements KeyManager {
  private identityKey: IdentityKeyPair;
  private signedPreKey: SignedPreKeyPair;
  private oneTimePreKeys: OneTimePreKeyPair[];
  private preKeyBundle: PreKeyBundle | null = null;

  constructor() {
    // Keys loaded from storage or generated fresh
  }

  async initialize(masterKey: Uint8Array) {
    await sodium.ready;

    // Load or generate identity key (encrypted with master key)
    this.identityKey = await this.loadOrGenerateIdentityKey(masterKey);
    this.signedPreKey = this.generateSignedPreKey(this.identityKey);
    this.oneTimePreKeys = this.generateOneTimePreKeys(100);

    this.preKeyBundle = await this.createPreKeyBundle(
      this.identityKey,
      this.signedPreKey,
      this.oneTimePreKeys[0]
    );
  }

  private generateSignedPreKey(identityKey: IdentityKeyPair): SignedPreKeyPair {
    const keyPair = sodium.crypto_box_keypair();
    const signature = sodium.crypto_sign_detached(keyPair.publicKey, identityKey.privateKey);

    return { keyPair, signature, id: 1 };
  }

  generateOneTimePreKeys(count: number): OneTimePreKeyPair[] {
    const preKeys = [];
    for (let i = 0; i < count; i++) {
      preKeys.push({
        keyPair: sodium.crypto_box_keypair(),
        id: i + 1
      });
    }
    return preKeys;
  }

  async getPublicPreKeyBundle(): Promise<PreKeyBundle> {
    if (!this.preKeyBundle) {
      throw new Error('Key manager not initialized');
    }
    return this.preKeyBundle;
  }

  consumeOneTimePreKey(): OneTimePreKeyPair | null {
    // Remove and return first available one-time prekey
    return this.oneTimePreKeys.shift() || null;
  }
}

export const keyManager = new SignalKeyManager();
```

---

## 6. Complete Example

### Simple Chat Encryption

```typescript
import * as sodium from 'libsodium-wrappers';

interface Message {
  sender: string;
  recipient: string;
  ciphertext: Uint8Array;
  nonce: Uint8Array;
  timestamp: number;
}

interface ChatSession {
  id: string;
  recipientId: string;
  sendingChainKey: Uint8Array;
  receivingChainKey: Uint8Array;
  sendingMessageNumber: number;
  receivingMessageNumber: number;
  rootKey: Uint8Array;
}

class SignalChat {
  private sessions: Map<string, ChatSession> = new Map();

  async initializeSession(recipientId: string, sharedSecret: Uint8Array): Promise<ChatSession> {
    await sodium.ready;

    const session: ChatSession = {
      id: `session:${recipientId}`,
      recipientId,
      rootKey: sharedSecret,
      sendingChainKey: sodium.crypto_kdf_derive_from_key(32, 1, 'sending', sharedSecret),
      receivingChainKey: sodium.crypto_kdf_derive_from_key(32, 1, 'receiving', sharedSecret),
      sendingMessageNumber: 0,
      receivingMessageNumber: 0
    };

    this.sessions.set(recipientId, session);
    return session;
  }

  async encryptMessage(recipientId: string, plaintext: string): Promise<Message> {
    await sodium.ready;

    let session = this.sessions.get(recipientId);
    if (!session) {
      throw new Error('Session not initialized');
    }

    // Derive message key
    const messageKey = sodium.crypto_kdf_derive_from_key(
      32,
      session.sendingMessageNumber + 1,
      'message',
      session.sendingChainKey
    );

    // Update chain key
    session.sendingChainKey = sodium.crypto_kdf_derive_from_key(
      32,
      0,
      'chain',
      session.sendingChainKey
    );

    // Encrypt
    const nonce = sodium.randombytes_buf(24);
    const ciphertext = sodium.crypto_secretbox_easy(plaintext, nonce, messageKey);

    const message: Message = {
      sender: 'self',
      recipient: recipientId,
      ciphertext,
      nonce,
      timestamp: Date.now()
    };

    session.sendingMessageNumber++;
    return message;
  }

  async decryptMessage(session: ChatSession, message: Message): Promise<string> {
    await sodium.ready;

    // Derive message key
    const messageKey = sodium.crypto_kdf_derive_from_key(
      32,
      session.receivingMessageNumber + 1,
      'message',
      session.receivingChainKey
    );

    // Update chain key
    session.receivingChainKey = sodium.crypto_kdf_derive_from_key(
      32,
      0,
      'chain',
      session.receivingChainKey
    );

    // Decrypt
    try {
      const plaintext = sodium.crypto_secretbox_open_easy(
        message.ciphertext,
        message.nonce,
        messageKey
      );
      session.receivingMessageNumber++;
      return sodium.to_string(plaintext);
    } catch {
      throw new Error('Decryption failed');
    }
  }
}

// Usage example
async function example() {
  await sodium.ready;

  const chat = new SignalChat();

  // Initialize session with shared secret (from X3DH)
  const sharedSecret = sodium.randombytes_buf(32); // Would be from X3DH
  const session = await chat.initializeSession('bob', sharedSecret);

  // Encrypt message
  const encrypted = await chat.encryptMessage('bob', 'Hello, Bob!');
  console.log('Encrypted:', sodium.to_hex(encrypted.ciphertext));

  // Decrypt message (on other side)
  const decrypted = await chat.decMessage(session, encrypted);
  console.log('Decrypted:', decrypted);
}
```

---

## 7. Security Properties

### Property Verification

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Signal Protocol Security Properties               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ✅ Forward Secrecy:                                                │
│     Each message key derived from chain key, which is updated      │
│     after each message. Old keys destroyed.                        │
│     Compromising current key DOES NOT reveal past messages.        │
│                                                                     │
│  ✅ Future Secrecy (Break-in Recovery):                            │
│     DH ratchet on each message updates DH keys.                    │
│     Compromising current key DOES NOT reveal future messages       │
│     (until next ratchet step).                                     │
│                                                                     │
│  ✅ Message Unlinkability:                                          │
│     Different ephemeral keys used for each session initiation.     │
│     Cannot link messages to same sender without knowing key.       │
│                                                                     │
│  ✅ Deniable Authentication:                                        │
│    MAC keys derived from shared secret provideauthentication       │
│     without transferable proof.                                     │
│                                                                     │
│  ✅ Break-in Recovery (Future Secrecy):                            │
│     If attacker records encrypted messages and later compromises   │
│     keys, they can only decrypt messages within a limited window  │
│     around the compromise.                                         │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Attack Scenarios

| Attack | Protected By |
|--------|-------------|
| Past session key stolen | Forward secrecy - past keys destroyed |
| Current session key stolen | Future secrecy - DH ratchet continues |
| Device compromised | Per-device keys + remote wipe |
| Man-in-middle on prekey exchange | Signatures on prekeys |
| Replay attacks | Message numbers + chain index |
| Out-of-order messages | Store intermediate chain keys |

---

## OWASP References

- [Key Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Key_Management_Cheat_Sheet.html)
- [Cryptographic Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cryptographic_Storage_Cheat_Sheet.html)

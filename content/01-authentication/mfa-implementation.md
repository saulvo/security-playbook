---
title: "Multi-Factor Authentication (MFA)"
description: ""
date: "2026-04-24"
author: "Saul Vo"
tags: ["authentication","security","oauth","jwt"]
readingTime: "5 min"
order: 2
slug: "mfa-implementation"
category: "authentication"
---

# Multi-Factor Authentication (MFA)

## Mục lục
1. [MFA Fundamentals](#1-mfa-fundamentals)
2. [Authentication Factors](#2-authentication-factors)
3. [TOTP Implementation](#3-totp-implementation)
4. [WebAuthn/FIDO2](#4-webauthnfido2)
5. [Backup Codes](#5-backup-codes)
6. [Recovery Codes](#6-recovery-codes)
7. [Implementation (Next.js)](#7-implementation-nextjs)
8. [Security Checklist](#8-security-checklist)

---

## 1. MFA Fundamentals

### Why MFA?

```
┌────────────────────────────────────────────────────────────────────┐
│                    Password-Only Auth Weakness                       │
├────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Password alone is VULNERABLE to:                                  │
│                                                                     │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐            │
│  │   Phishing  │    │   Brute    │    │   Credential │            │
│  │    Attacks  │    │   Force    │    │    Stuffing  │            │
│  └─────────────┘    └─────────────┘    └─────────────┘            │
│                                                                     │
│  Even strong passwords fail against these.                         │
│                                                                     │
│  MFA adds a SECOND factor - attacker needs BOTH:                   │
│  [Password] + [SMS Code] + [Hardware Key] = MUCH HARDER           │
│                                                                     │
└────────────────────────────────────────────────────────────────────┘
```

### MFA Adoption Rate Impact

| Attack Type | Password Only | Password + MFA |
|-------------|---------------|----------------|
| Phishing | 100% success | &lt;1% success |
| Credential Stuffing | 100% success | &lt;1% success |
| Keylogger | 100% success | &lt;1% success |
| Brute Force | Possible | Nearly Impossible |

---

## 2. Authentication Factors

### Factor Categories

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Authentication Factors                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  KNOWLEDGE (Something you know)                                │  │
│  ├──────────────────────────────────────────────────────────────┤  │
│  │  • Password                                                    │  │
│  │  • PIN                                                         │  │
│  │  • Security Questions                                         │  │
│  │                                                              │  │
│  │  ⚠️ Vulnerable: phishing, leakage, brute force              │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  POSSESSION (Something you have)                               │  │
│  ├──────────────────────────────────────────────────────────────┤  │
│  │  • TOTP Authenticator App (Google Auth, Authy)                │  │
│  │  • SMS/Voice OTP                                              │  │
│  │  • Hardware Key (YubiKey, Google Titan)                       │  │
│  │  • Smart Card                                                 │  │
│  │                                                              │  │
│  │  ⚠️ SMS is WEAK - SIM swap attacks possible                  │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  INHERENCE (Something you are)                                 │  │
│  ├──────────────────────────────────────────────────────────────┤  │
│  │  • Fingerprint                                                │  │
│  │  • Face Recognition                                           │  │
│  │  • Iris Scan                                                   │  │
│  │  • Behavioral Biometrics                                      │  │
│  │                                                              │  │
│  │  ⚠️ False positives/negatives, not foolproof                 │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Factor Strength

| Factor | Strength | Notes |
|--------|----------|-------|
| SMS OTP | Weak | SIM swap vulnerable |
| Email OTP | Weak | Email compromised = broken |
| Software TOTP | Medium | Good balance |
| Hardware Key (FIDO2) | Strong | Phishing resistant |
| Biometric | Medium | Often combined with other factors |

### Recommended MFA Setup

```
┌────────────────────────────────────────────────────────────────────┐
│                    Recommended MFA Stack                            │
├────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Primary (Required):                                               │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │  TOTP (Authenticator App)  - Google Authenticator, Authy   │    │
│  └────────────────────────────────────────────────────────────┘    │
│                                                                     │
│  Secondary (Optional but recommended):                             │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │  Hardware Key (FIDO2/WebAuthn) - YubiKey 5, Google Titan  │    │
│  └────────────────────────────────────────────────────────────┘    │
│                                                                     │
│  Backup Methods:                                                    │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │  • 10-20 Backup codes (one-time use)                       │    │
│  │  • Recovery link via email                                 │    │
│  └────────────────────────────────────────────────────────────┘    │
│                                                                     │
│  AVOID:                                                             │
│  • SMS OTP as only second factor                                   │
│  • Security questions as secondary factor                          │
│                                                                     │
└────────────────────────────────────────────────────────────────────┘
```

---

## 3. TOTP Implementation

### How TOTP Works

```
┌────────────────────────────────────────────────────────────────────┐
│                    TOTP Algorithm                                  │
├────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  1. Secret Key shared between server and authenticator app        │
│     ┌────────────────────────────────────────┐                     │
│     │  Base32(Secret) = "JBSWY3DPEHPK3PXP"  │                     │
│     └────────────────────────────────────────┘                     │
│                                                                     │
│  2. Current Unix Time (30-second window)                          │
│     const timeStep = 30;                                          │
│     const time = Math.floor(Date.now() / 1000 / timeStep);        │
│                                                                     │
│  3. HMAC-SHA1(secret, time) → 20 bytes                           │
│                                                                     │
│  4. Dynamic Truncation → 6-digit code                             │
│     bytes[19] & 0xF = offset                                      │
│     code = (bytes[offset] & 0x7F) << 24                            │
│          | (bytes[offset+1] & 0xFF) << 16                         │
│          | (bytes[offset+2] & 0xFF) << 8                           │
│          | (bytes[offset+3] & 0xFF)                               │
│     code = code % 1000000  // 6 digits                            │
│                                                                     │
│  5. User enters 6-digit code → Server verifies                    │
│                                                                     │
│  6. Server allows ±1 time step tolerance (60 seconds window)     │
│                                                                     │
└────────────────────────────────────────────────────────────────────┘
```

### Server-Side Implementation

```javascript
// lib/mfa/totp.js
const crypto = require('crypto');
const base32 = require('base32-js');

// Generate secret
function generateSecret() {
  const buffer = crypto.randomBytes(20);
  return base32.encode(buffer).replace(/=+$/, '');
}

// Generate provisioning URI (for QR code)
function generateProvisioningUri(secret, email, issuer = 'MyApp') {
  const encodedIssuer = encodeURIComponent(issuer);
  const encodedEmail = encodeURIComponent(email);
  const label = `${encodedIssuer}:${encodedEmail}`;

  return `otpauth://totp/${label}?secret=${secret}&issuer=${encodedIssuer}&algorithm=SHA1&digits=6&period=30`;
}

// Generate QR code URL (for QR code generation libraries)
function generateQRCodeUrl(secret, email, issuer = 'MyApp') {
  const uri = generateProvisioningUri(secret, email, issuer);
  return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(uri)}`;
}

// Verify TOTP
function verifyTOTP(secret, token, window = 1) {
  const time = Math.floor(Date.now() / 1000 / 30);

  // Allow ±1 time step for clock drift
  for (let i = -window; i <= window; i++) {
    const expectedToken = generateToken(secret, time + i);
    if (timingSafeEqual(expectedToken, token)) {
      return true;
    }
  }

  return false;
}

// Generate token at specific time
function generateToken(secret, time) {
  const buffer = Buffer.alloc(8);
  buffer.writeBigInt64BE(BigInt(time), 0);

  const key = base32.toArrayBuffer(secret);
  const hmac = crypto.createHmac('sha1', Buffer.from(key));
  hmac.update(buffer);
  const hash = hmac.digest();

  const offset = hash[hash.length - 1] & 0xF;
  const code = (
    ((hash[offset] & 0x7F) << 24) |
    ((hash[offset + 1] & 0xFF) << 16) |
    ((hash[offset + 2] & 0xFF) << 8) |
    (hash[offset + 3] & 0xFF)
  ) % 1000000;

  return code.toString().padStart(6, '0');
}

// Timing-safe comparison
function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;

  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);

  return crypto.timingSafeEqual(bufA, bufB);
}

module.exports = { generateSecret, generateProvisioningUri, generateQRCodeUrl, verifyTOTP };
```

### TOTP Database Schema

```typescript
// types/mfa.ts
interface MFASetup {
  userId: string;
  secret: string;              // Encrypted at rest
  status: 'pending' | 'active' | 'disabled';
  enabledAt?: Date;
  lastUsedAt?: Date;
  backupCodes?: string[];      // Hashed one-time codes
}

// Enable MFA for user
async function enableMFA(userId: string) {
  const secret = generateSecret();

  // Generate encrypted secret for storage
  const encryptedSecret = encrypt(secret, process.env.MFA_ENCRYPTION_KEY);

  // Generate backup codes
  const backupCodes = generateBackupCodes(10);

  await db.createMFASetup({
    userId,
    secret: encryptedSecret,
    backupCodes: hashBackupCodes(backupCodes),
    status: 'pending',
    setupAt: new Date()
  });

  // Return provisioning URI for QR code
  const user = await getUserById(userId);
  return {
    secret,
    provisioningUri: generateProvisioningUri(secret, user.email, 'MyApp'),
    backupCodes // Return plaintext codes ONLY once
  };
}

// Verify MFA during login
async function verifyMFA(userId: string, token: string) {
  const mfaSetup = await db.getMFASetup(userId);

  if (!mfaSetup || mfaSetup.status !== 'active') {
    return { success: false, reason: 'MFA not enabled' };
  }

  const secret = decrypt(mfaSetup.secret, process.env.MFA_ENCRYPTION_KEY);

  if (verifyTOTP(secret, token)) {
    await db.updateMFASetup(userId, { lastUsedAt: new Date() });
    return { success: true };
  }

  return { success: false, reason: 'Invalid code' };
}
```

---

## 4. WebAuthn/FIDO2

### How WebAuthn Works

```
┌────────────────────────────────────────────────────────────────────┐
│                    WebAuthn Registration Flow                       │
├────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  1. Server sends challenge + user info                              │
│     {                                                               │
│       challenge: random(32 bytes),                                 │
│       rp: { name: "MyApp" },                                       │
│       user: { id: userId, name: email }                            │
│     }                                                               │
│                                                                     │
│  2. Browser calls navigator.credentials.create()                   │
│     • User clicks "Register Security Key"                           │
│     • Browser communicates with authenticator (USB/NFC)            │
│     • User verifies with fingerprint/PIN                            │
│     • Authenticator generates key pair                             │
│                                                                     │
│  3. Authenticator returns:                                         │
│     {                                                               │
│       credentialId: "xxx",                                         │
│       counter: 0,                                                   │
│       attestObj: "yyy"  (signed challenge)                          │
│     }                                                               │
│                                                                     │
│  4. Server stores credentialId + public key                        │
│                                                                     │
└────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────┐
│                    WebAuthn Authentication Flow                     │
├────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  1. Server sends challenge                                          │
│     {                                                               │
│       challenge: random(32 bytes),                                 │
│       allowCredentials: [{ id: storedCredId }]                     │
│     }                                                               │
│                                                                     │
│  2. Browser calls navigator.credentials.get()                      │
│     • User clicks "Login with Security Key"                         │
│     • User verifies with fingerprint/PIN                            │
│     • Authenticator signs challenge with stored private key        │
│                                                                     │
│  3. Server verifies signature                                       │
│     • Check credentialId exists                                     │
│     • Verify signature using stored public key                     │
│     • Check counter > stored counter (prevent replay)               │
│                                                                     │
│  4. Login successful!                                              │
│                                                                     │
└────────────────────────────────────────────────────────────────────┘
```

### WebAuthn in Browser

```typescript
// lib/webauthn.ts
const base64url = require('base64url');

interface PublicKeyCredentialCreationOptions {
  challenge: Buffer;
  rp: { name: string; id: string };
  user: { id: string; name: string; displayName: string };
  pubKeyCredParams: { alg: number; type: string }[];
  authenticatorSelection: {
    authenticatorAttachment?: string;
    userVerification: string;
    requireResidentKey: boolean;
  };
}

// Registration
async function registerWebAuthn(userId: string, email: string) {
  const challenge = crypto.randomBytes(32);

  const options: PublicKeyCredentialCreationOptions = {
    challenge,
    rp: {
      name: 'MyApp',
      id: window.location.hostname
    },
    user: {
      id: base64url.encode(Buffer.from(userId)),
      name: email,
      displayName: email
    },
    pubKeyCredParams: [
      { alg: -7, type: 'public-key' },   // ES256
      { alg: -257, type: 'public-key' } // RS256
    ],
    authenticatorSelection: {
      userVerification: 'preferred',
      requireResidentKey: false
    }
  };

  // Store challenge for verification
  await storeChallenge(userId, challenge);

  const credential = await navigator.credentials.create({
    publicKey: options
  }) as PublicKeyCredential;

  return parseAttestationResponse(credential);
}

// Authentication
async function authenticateWebAuthn(credentialId: string) {
  const challenge = await getChallenge();

  const options = {
    challenge,
    allowCredentials: [{
      id: credentialId,
      type: 'public-key' as const
    }],
    userVerification: 'preferred' as const
  };

  const assertion = await navigator.credentials.get({
    publicKey: options
  }) as PublicKeyCredential;

  return parseAssertionResponse(assertion);
}

// Parse attestation response
function parseAttestationResponse(credential: PublicKeyCredential) {
  const response = credential.response as AuthenticatorAttestationResponse;

  return {
    credentialId: base64url.encode(credential.rawId),
    attestationObject: base64url.encode(Buffer.from(response.attestationObject)),
    clientDataJSON: base64url.encode(Buffer.from(response.clientDataJSON))
  };
}
```

### WebAuthn Server Verification

```javascript
// lib/webauthn/verify.js
const crypto = require('crypto');
const cbor = require('cbor');

async function verifyRegistrationResponse(response, challenge, expectedOrigin) {
  // Parse client data
  const clientData = JSON.parse(Buffer.from(
    base64url.toBuffer(response.clientDataJSON)
  ).toString());

  // Verify challenge
  if (!crypto.timingSafeEqual(
    Buffer.from(clientData.challenge),
    Buffer.from(challenge)
  )) {
    throw new Error('Challenge mismatch');
  }

  // Verify origin
  if (clientData.origin !== expectedOrigin) {
    throw new Error('Origin mismatch');
  }

  // Parse attestation object (CBOR)
  const attestationObject = cbor.decode(
    Buffer.from(base64url.toBuffer(response.attestationObject))
  );

  // Verify attestation (simplified - real impl needs more)
  const authData = attestationObject.authData;
  const credentialId = authData.credentialId;
  const publicKey = authData.publicKey;

  return {
    credentialId: base64url.encode(credentialId),
    publicKey: base64url.encode(cbor.encode(authData.publicKey)),
    counter: authData.counter
  };
}

async function verifyAssertionResponse(assertion, storedCredential, challenge, expectedOrigin) {
  // Parse client data
  const clientData = JSON.parse(Buffer.from(
    base64url.toBuffer(assertion.clientDataJSON)
  ).toString());

  // Verify challenge
  if (!crypto.timingSafeEqual(
    Buffer.from(clientData.challenge),
    Buffer.from(challenge)
  )) {
    throw new Error('Challenge mismatch');
  }

  // Get authenticator data
  const authData = parseAuthData(assertion.authenticatorData);

  // Verify counter (replay attack prevention)
  if (authData.counter <= storedCredential.counter) {
    throw new Error('Counter too low - possible replay');
  }

  // Verify signature
  const publicKey = cbor.decode(
    Buffer.from(storedCredential.publicKey)
  );
  const clientDataHash = crypto.createHash('sha256')
    .update(Buffer.from(clientDataJSON))
    .digest();

  const verificationData = Buffer.concat([
    authData,
    clientDataHash
  ]);

  // Verify using public key
  const isValid = crypto.verify(
    'ES256',
    verificationData,
    publicKey,
    assertion.signature
  );

  if (!isValid) {
    throw new Error('Signature verification failed');
  }

  return true;
}
```

---

## 5. Backup Codes

### Generation

```javascript
// Generate 10 backup codes (each 10 characters)
function generateBackupCodes(count = 10, length = 10) {
  const codes = [];
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Exclude ambiguous chars

  for (let i = 0; i < count; i++) {
    let code = '';
    const randomBytes = crypto.randomBytes(length);

    for (let j = 0; j < length; j++) {
      code += chars[randomBytes[j] % chars.length];
    }

    // Add dash every 5 chars for readability: XXXXX-XXXXX
    codes.push(code.slice(0, 5) + '-' + code.slice(5));
  }

  return codes;
}

// Hash for storage (bcrypt or similar)
const bcrypt = require('bcrypt');

function hashBackupCodes(codes) {
  return codes.map(code => bcrypt.hashSync(code, 10));
}

async function verifyBackupCode(code, hashedCodes) {
  for (const hashed of hashedCodes) {
    if (await bcrypt.compare(code, hashed)) {
      return true;
    }
  }
  return false;
}
```

### Usage Flow

```
┌────────────────────────────────────────────────────────────────────┐
│                    Backup Code Flow                                │
├────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Setup Phase:                                                       │
│  1. User enables MFA                                               │
│  2. System generates 10 backup codes                                │
│  3. User downloads/saves codes                                      │
│  4. Codes hashed and stored                                        │
│                                                                     │
│  Recovery Phase:                                                    │
│  1. User cannot access authenticator app                           │
│  2. User enters one backup code                                     │
│  3. System verifies + marks code as used                          │
│  4. User gets new set of backup codes                             │
│  5. User asked to re-setup MFA                                     │
│                                                                     │
└────────────────────────────────────────────────────────────────────┘
```

---

## 6. Recovery Codes

### Implementation

```javascript
// Generate recovery codes
function generateRecoveryCodes(count = 10) {
  return Array.from({ length: count }, () => {
    const bytes = crypto.randomBytes(16);
    const code = base32.encode(bytes).replace(/=+$/, '').slice(0, 16);
    return code.toUpperCase();
  });
}

// Store hashed
async function setupRecoveryCodes(userId) {
  const codes = generateRecoveryCodes();

  // Hash and store
  const hashedCodes = codes.map(code =>
    bcrypt.hashSync(code, bcrypt.genSaltSync())
  );

  await db.updateUser(userId, {
    mfaRecoveryCodes: hashedCodes,
    mfaRecoveryCodesSetupAt: new Date()
  });

  return codes; // Return plaintext for user download
}

// Verify recovery code
async function verifyRecoveryCode(userId, code) {
  const user = await db.getUser(userId);

  if (!user.mfaRecoveryCodes) {
    return { success: false, reason: 'No recovery codes' };
  }

  const codes = user.mfaRecoveryCodes;

  for (let i = 0; i < codes.length; i++) {
    if (await bcrypt.compare(code, codes[i])) {
      // Remove used code
      codes.splice(i, 1);
      await db.updateUser(userId, {
        mfaRecoveryCodes: codes
      });

      return {
        success: true,
        remaining: codes.length
      };
    }
  }

  return { success: false, reason: 'Invalid code' };
}
```

---

## 7. Implementation (Next.js)

### MFA Setup Flow

```typescript
// app/api/mfa/setup/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import { generateSecret, generateProvisioningUri, verifyTOTP } from '@/lib/mfa/totp';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Generate secret
  const secret = generateSecret();
  const user = await getUserByEmail(session.user.email);
  const uri = generateProvisioningUri(secret, user.email, 'MyApp');

  // Store pending setup
  await db.updateMFASetup(session.user.id, {
    secret: encrypt(secret, process.env.MFA_ENCRYPTION_KEY),
    status: 'pending'
  });

  return NextResponse.json({
    secret,
    uri,
    qrCodeUrl: `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(uri)}`
  });
}

// Verify setup
export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const { token } = await req.json();

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const mfaSetup = await db.getMFASetup(session.user.id);

  if (!mfaSetup || mfaSetup.status !== 'pending') {
    return NextResponse.json({ error: 'MFA not pending setup' }, { status: 400 });
  }

  const secret = decrypt(mfaSetup.secret, process.env.MFA_ENCRYPTION_KEY);

  if (!verifyTOTP(secret, token)) {
    return NextResponse.json({ error: 'Invalid code' }, { status: 400 });
  }

  // Activate MFA
  await db.updateMFASetup(session.user.id, {
    status: 'active',
    enabledAt: new Date()
  });

  // Generate backup codes
  const backupCodes = generateBackupCodes(10);
  await db.updateMFASetup(session.user.id, {
    backupCodes: hashBackupCodes(backupCodes)
  });

  return NextResponse.json({
    message: 'MFA enabled successfully',
    backupCodes // Only returned once!
  });
}
```

### MFA Verification Middleware

```typescript
// lib/mfa/requireMFA.ts
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { NextResponse } from 'next/server';

export async function requireMFA() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return { authorized: false, error: 'Unauthorized' };
  }

  const mfaSetup = await db.getMFASetup(session.user.id);

  if (!mfaSetup || mfaSetup.status !== 'active') {
    return {
      authorized: false,
      error: 'MFA required',
      code: 'MFA_REQUIRED'
    };
  }

  return { authorized: true, session };
}

// Usage in API route
export async function sensitiveRouteHandler(req: NextRequest) {
  const auth = await requireMFA();

  if (!auth.authorized) {
    return NextResponse.json(
      { error: auth.error, code: auth.code },
      { status: auth.code === 'MFA_REQUIRED' ? 403 : 401 }
    );
  }

  // Process sensitive request
  return NextResponse.json({ data: 'secret data' });
}
```

### Frontend MFA Component

```typescript
// components/MFASetup.tsx
'use client';

import { useState } from 'react';

export function MFASetup() {
  const [step, setStep] = useState<'intro' | 'scan' | 'verify' | 'backup'>('intro');
  const [qrCode, setQRCode] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [verifyCode, setVerifyCode] = useState('');

  async function initiateSetup() {
    const response = await fetch('/api/mfa/setup', { method: 'POST' });
    const data = await response.json();
    setQRCode(data.qrCodeUrl);
    setStep('scan');
  }

  async function verifyCode() {
    const response = await fetch('/api/mfa/setup', {
      method: 'PUT',
      body: JSON.stringify({ token: verifyCode })
    });

    if (response.ok) {
      const data = await response.json();
      setBackupCodes(data.backupCodes);
      setStep('backup');
    }
  }

  return (
    <div className="mfa-setup">
      {step === 'intro' && (
        <div>
          <h2>Enable Two-Factor Authentication</h2>
          <p>Add an extra layer of security to your account.</p>
          <button onClick={initiateSetup}>Get Started</button>
        </div>
      )}

      {step === 'scan' && (
        <div>
          <img src={qrCode} alt="Scan QR code" />
          <p>Scan with your authenticator app</p>
          <button onClick={() => setStep('verify')}>I've scanned</button>
        </div>
      )}

      {step === 'verify' && (
        <div>
          <input
            type="text"
            placeholder="Enter 6-digit code"
            value={verifyCode}
            onChange={(e) => setVerifyCode(e.target.value)}
          />
          <button onClick={verifyCode}>Verify</button>
        </div>
      )}

      {step === 'backup' && (
        <div>
          <h3>Save Your Backup Codes</h3>
          <p>Store these safely. Each code can only be used once.</p>
          <ul>
            {backupCodes.map((code, i) => (
              <li key={i}>{code}</li>
            ))}
          </ul>
          <button onClick={() => window.location.href = '/dashboard'}>
            Done
          </button>
        </div>
      )}
    </div>
  );
}
```

---

## 8. Security Checklist

### MFA Implementation

- [ ] **TOTP with 6-digit codes** (RFC 6238)
- [ ] **±1 time window tolerance** for clock drift
- [ ] **Timing-safe comparison** for codes
- [ ] **Encrypted secret storage** (at rest)
- [ ] **Rate limit verification** (3-5 attempts max)
- [ ] **Account lockout after failed attempts**
- [ ] **Backup codes hashed** (one-time use)
- [ ] **Recovery codes generated** on MFA enable
- [ ] **User notification** on MFA changes

### WebAuthn/FIDO2

- [ ] **Challenge stored server-side** before registration
- [ ] **Challenge validated** on authentication
- [ ] **Origin validated** matches expected
- [ ] **Counter checked** to prevent replay
- [ ] **Credential ID allowlist** for authentication
- [ ] **RP ID matches hostname** for security

### User Experience

- [ ] **Clear setup instructions** provided
- [ ] **QR code generated** for easy scanning
- [ ] **Backup codes downloadable** as text file
- [ ] **Recovery flow** documented
- [ ] **Backup codes renewable** after use
- [ ] **Graceful degradation** if authenticator lost

---

## OWASP References

- [MFA Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Multifactor_Authentication_Cheat_Sheet.html)
- [Web Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Web_Authentication_Cheat_Sheet.html)
- [Credential Stuffing Attack](https://cheatsheetseries.owasp.org/cheatsheets/Credential_Stuffing_Prevention_Cheat_Sheet.html)

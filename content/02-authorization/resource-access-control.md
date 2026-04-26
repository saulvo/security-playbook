---
title: "Resource Access Control"
description: ""
date: "2026-04-24"
author: "Saul Vo"
tags: ["authorization","rbac","permissions"]
readingTime: "5 min"
order: 3
slug: "resource-access-control"
category: "authorization"
---

# Resource Access Control

## Mục lục
1. [Ownership vs Permission Models](#1-ownership-vs-permission-models)
2. [Sharing Models](#2-sharing-models)
3. [Team/Group-Based Access](#3-teamgroup-based-access)
4. [Time-Based Access](#4-time-based-access)
5. [Temporary Access Grants](#5-temporary-access-grants)
6. [Implementation](#6-implementation)
7. [Security Checklist](#7-security-checklist)

---

## 1. Ownership vs Permission Models

### Ownership Model

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Ownership Model                                   │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Every resource has exactly ONE owner:                              │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  Post "My Article"                                          │   │
│  │  ├── authorId: "user_123"  ◄── Owner                        │   │
│  │  ├── teamId: "team_456"                                     │   │
│  │  └── visibility: "private"                                   │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  Owner permissions:                                                 │
│  • Full control (read, write, delete, share)                      │
│  • Can transfer ownership                                           │
│  • Can delete regardless of other rules                            │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Permission Model

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Permission Model                                  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Resources can have MULTIPLE permission grants:                    │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  Document "Q4 Report"                                        │   │
│  │  │                                                         │   │
│  │  ├── Owner: user_123                                        │   │
│  │  │     └── Full control                                      │   │
│  │  │                                                         │   │
│  │  ├── Grant: team_456 (editor)  ◄── Shared with team       │   │
│  │  │     └── Can edit                                         │   │
│  │  │                                                         │   │
│  │  └── Grant: user_789 (viewer)  ◄── Shared with individual  │   │
│  │        └── Read only                                         │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Combined Model (Most Common)

```typescript
// Combined ownership + permission grants
interface ResourceAccess {
  resourceId: string;
  resourceType: string;
  ownerId: string;
  grants: ResourceGrant[];
  createdAt: Date;
  updatedAt: Date;
}

interface ResourceGrant {
  id: string;
  granteeType: 'user' | 'team' | 'role';
  granteeId: string;  // userId, teamId, or roleName
  level: 'owner' | 'editor' | 'viewer' | 'commenter';
  grantedBy: string;   // userId who granted
  grantedAt: Date;
  expiresAt?: Date;    // Optional time-based expiry
  conditions?: {
    ipAddress?: string[];      // Allow only from IPs
    timeRange?: {              // Allow only during time
      start: string;           // e.g., "09:00"
      end: string;             // e.g., "17:00"
      days?: string[];         // e.g., ["monday", "tuesday"]
    };
    metadata?: Record<string, any>;  // Conditional metadata
  };
}

// Access level hierarchy
const ACCESS_LEVELS = {
  owner: { rank: 4, inherits: ['editor', 'viewer', 'commenter'] },
  editor: { rank: 3, inherits: ['viewer', 'commenter'] },
  viewer: { rank: 2, inherits: ['commenter'] },
  commenter: { rank: 1, inherits: [] }
};
```

---

## 2. Sharing Models

### Direct User Sharing

```typescript
// Share with specific user
async function shareWithUser(
  resourceId: string,
  resourceType: string,
  targetUserId: string,
  level: 'viewer' | 'editor' | 'owner',
  grantedBy: string
) {
  // Validate resource exists and grantor has permission
  const resource = await getResource(resourceId, resourceType);
  const canShare = await checkSharePermission(grantedBy, resource);

  if (!canShare) {
    throw new ForbiddenError('Cannot share this resource');
  }

  // Check if user is already a grantee
  const existing = await db.findGrant(resourceId, targetUserId, 'user');
  if (existing) {
    // Update existing grant
    await db.updateGrant(existing.id, { level });
  } else {
    // Create new grant
    await db.createGrant({
      resourceId,
      resourceType,
      granteeType: 'user',
      granteeId: targetUserId,
      level,
      grantedBy,
      grantedAt: new Date()
    });
  }

  // Notify target user
  await notificationService.notifyShare(
    targetUserId,
    resource,
    level
  );
}

// Check share permission
async function checkSharePermission(
  userId: string,
  resource: Resource
): Promise<boolean> {
  // Owner can share
  if (resource.ownerId === userId) return true;

  // Check if user has owner-level grant
  const grant = await db.findGrant(resource.id, userId, 'user');
  if (grant?.level === 'owner') return true;

  // Check role permission
  const userPerms = await getUserPermissions(userId);
  if (userPerms.includes('*:share')) return true;

  return false;
}
```

### Team/Group Sharing

```typescript
// Share with entire team
async function shareWithTeam(
  resourceId: string,
  resourceType: string,
  teamId: string,
  level: 'viewer' | 'editor',
  grantedBy: string
) {
  const resource = await getResource(resourceId, resourceType);
  const canShare = await checkSharePermission(grantedBy, resource);

  if (!canShare) {
    throw new ForbiddenError('Cannot share this resource');
  }

  // Create grant for team
  await db.createGrant({
    resourceId,
    resourceType,
    granteeType: 'team',
    granteeId: teamId,
    level,
    grantedBy,
    grantedAt: new Date()
  });

  // Invalidate team members' permission cache
  await cache.invalidateByTag(`team:${teamId}`);

  // Notify team members
  await notificationService.notifyTeamShare(teamId, resource, level);
}

// Share with team, excluding specific members
async function shareWithTeamExcluding(
  resourceId: string,
  resourceType: string,
  teamId: string,
  level: 'viewer' | 'editor',
  excludeUserIds: string[],
  grantedBy: string
) {
  const resource = await getResource(resourceId, resourceType);

  // Get all team members
  const teamMembers = await db.getTeamMembers(teamId);

  // Create individual grants excluding specified users
  for (const member of teamMembers) {
    if (!excludeUserIds.includes(member.id)) {
      await db.createGrant({
        resourceId,
        resourceType,
        granteeType: 'user',
        granteeId: member.id,
        level,
        grantedBy,
        grantedAt: new Date(),
        conditions: {
          metadata: { viaTeam: teamId }
        }
      });
    }
  }
}
```

### Link-Based Sharing

```
┌─────────────────────────────────────────────────────────────────────┐
│                   Link Sharing Models                               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │  Public Link                                                 │  │
│  │  • Anyone with link can access                               │  │
│  │  • No authentication required                                │  │
│  │  • Example: share.example.com/p/public/abc123               │  │
│  │  • Use when: Public content                                  │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │  Shared Link (with authentication)                         │  │
│  │  • Requires sign-in to access                              │  │
│  │  • Logs who accessed                                        │  │
│  │  • Can revoke without changing link                         │  │
│  │  • Example: share.example.com/p/s/abc123                   │  │
│  │  • Use when: Internal sharing, audit required              │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │  Password-Protected Link                                    │  │
│  │  • Requires password + optional sign-in                    │  │
│  │  • Double protection                                        │  │
│  │  • Example: share.example.com/p/pwd/abc123                 │  │
│  │  • Use when: Confidential external sharing                   │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │  Expiring Link                                              │  │
│  │  • Auto-disables after set time                            │  │
│  │  • Example: share.example.com/p/exp/abc123?exp=24h         │  │
│  │  • Use when: Temporary access needed                       │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Link Generation & Validation

```typescript
// lib/sharing/link-service.ts
interface SharedLink {
  id: string;
  resourceId: string;
  resourceType: string;
  linkType: 'public' | 'shared' | 'password' | 'expiring';
  passwordHash?: string;
  expiresAt?: Date;
  maxAccessCount?: number;
  accessCount: number;
  createdBy: string;
  createdAt: Date;
  permissions: {
    canView: boolean;
    canDownload: boolean;
    canPrint: boolean;
  };
}

async function createSharedLink(
  resourceId: string,
  resourceType: string,
  options: {
    linkType: 'public' | 'shared' | 'password' | 'expiring';
    password?: string;
    expiresAt?: Date;
    maxAccessCount?: number;
    permissions?: SharedLink['permissions'];
  },
  createdBy: string
): Promise<SharedLink> {
  // Generate cryptographically secure link ID
  const id = crypto.randomBytes(16).toString('base64url');

  // Hash password if provided
  const passwordHash = options.password
    ? await bcrypt.hash(options.password, 10)
    : undefined;

  const link = await db.createSharedLink({
    id,
    resourceId,
    resourceType,
    linkType: options.linkType,
    passwordHash,
    expiresAt: options.expiresAt,
    maxAccessCount: options.maxAccessCount,
    accessCount: 0,
    createdBy,
    createdAt: new Date(),
    permissions: options.permissions || { canView: true, canDownload: false, canPrint: false }
  });

  return link;
}

async function validateSharedLink(
  linkId: string,
  options: {
    password?: string;
    userId?: string;
    ipAddress?: string;
  } = {}
): Promise<{ valid: boolean; reason?: string; permissions?: SharedLink['permissions'] }> {
  const link = await db.getSharedLink(linkId);

  if (!link) {
    return { valid: false, reason: 'Link not found' };
  }

  // Check expiry
  if (link.expiresAt && link.expiresAt < new Date()) {
    return { valid: false, reason: 'Link has expired' };
  }

  // Check access count
  if (link.maxAccessCount && link.accessCount >= link.maxAccessCount) {
    return { valid: false, reason: 'Link access limit reached' };
  }

  // Check password
  if (link.passwordHash) {
    if (!options.password) {
      return { valid: false, reason: 'Password required' };
    }
    if (!(await bcrypt.compare(options.password, link.passwordHash))) {
      return { valid: false, reason: 'Invalid password' };
    }
  }

  // Check authentication requirement (for 'shared' links)
  if (link.linkType === 'shared' && !options.userId) {
    return { valid: false, reason: 'Authentication required' };
  }

  // Log access
  await db.logSharedLinkAccess({
    linkId,
    userId: options.userId,
    ipAddress: options.ipAddress,
    accessedAt: new Date()
  });

  // Increment access count
  await db.incrementLinkAccessCount(linkId);

  return {
    valid: true,
    permissions: link.permissions
  };
}
```

---

## 3. Team/Group-Based Access

### Team Hierarchy

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Team-Based Access Model                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Organization "Acme Corp"                                            │
│  │                                                                  │
│  ├── Engineering Team                                              │
│  │   ├── Frontend Squad                                           │
│  │   │   ├── Alice (lead)                                          │
│  │   │   └── Bob (member)                                          │
│  │   └── Backend Squad                                            │
│  │       ├── Charlie (lead)                                        │
│  │       └── Diana (member)                                        │
│  │                                                                  │
│  └── Marketing Team                                                │
│      ├── Eve (lead)                                                │
│      └── Frank (member)                                            │
│                                                                     │
│  Access Rules:                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  Project "AcmeApp"                                           │   │
│  │  │                                                         │   │
│  │  ├── Engineering Team → Editor                              │   │
│  │  │   └── Frontend Squad → Editor (inherited)                │   │
│  │  │       └── Alice → Owner (personal access)                │   │
│  │  │                                                         │   │
│  │  └── Marketing Team → Viewer                                │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  Resolution Order (for access level):                              │
│  1. Personal grant (highest priority)                             │
│  2. Squad-level grant                                             │
│  3. Team-level grant                                              │
│  4. Organization-level grant (lowest priority)                   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Team Permission Resolver

```typescript
// lib/auth/team-access.ts
interface TeamHierarchy {
  id: string;
  name: string;
  parentId?: string;  // For nested teams
  type: 'organization' | 'team' | 'squad';
}

async function resolveTeamAccess(
  userId: string,
  resourceId: string,
  resourceType: string
): Promise<{ hasAccess: boolean; level: string | null }> {
  // Get user's team memberships with hierarchy
  const userTeams = await db.getUserTeamsWithHierarchy(userId);

  // Get resource grants
  const resourceGrants = await db.getResourceGrants(resourceId);

  // Find best matching grant
  let bestLevel: string | null = null;

  for (const team of userTeams) {
    const grant = resourceGrants.find(g =>
      g.granteeType === 'team' && g.granteeId === team.id
    );

    if (grant) {
      // Compare access levels
      const grantRank = ACCESS_LEVELS[grant.level]?.rank || 0;
      const bestRank = bestLevel ? ACCESS_LEVELS[bestLevel]?.rank || 0 : 0;

      if (grantRank > bestRank) {
        bestLevel = grant.level;
      }

      // Check if this team is descendant of a higher-priority team
      // (implemented via team hierarchy traversal)
    }
  }

  // Check personal grant (highest priority)
  const personalGrant = resourceGrants.find(g =>
    g.granteeType === 'user' && g.granteeId === userId
  );

  if (personalGrant) {
    bestLevel = personalGrant.level;
  }

  return {
    hasAccess: bestLevel !== null,
    level: bestLevel
  };
}

async function getUserTeamsWithHierarchy(userId: string): Promise<TeamHierarchy[]> {
  const directTeams = await db.getUserTeams(userId);
  const result: TeamHierarchy[] = [...directTeams];

  // Traverse up the hierarchy
  for (const team of directTeams) {
    let current = team;
    while (current.parentId) {
      const parent = await db.getTeam(current.parentId);
      if (parent && !result.find(t => t.id === parent.id)) {
        result.push(parent);
      }
      current = parent!;
    }
  }

  return result;
}
```

---

## 4. Time-Based Access

### Time-Restricted Permissions

```typescript
// Time-based access conditions
interface TimeCondition {
  type: 'time_range';
  start: string;      // "09:00"
  end: string;        // "17:00"
  timezone: string;    // "America/New_York"
  days?: string[];     // ["monday", "tuesday", ...]
}

async function checkTimeCondition(
  condition: TimeCondition,
  userTimezone?: string
): Promise<boolean> {
  const now = new Date();

  // Get user's timezone or default
  const tz = userTimezone || condition.timezone || 'UTC';
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour: '2-digit',
    minute: '2-digit',
    weekday: 'long'
  });

  const parts = formatter.formatToParts(now);
  const getPart = (type: string) =>
    parts.find(p => p.type === type)?.value;

  const currentDay = getPart('weekday')?.toLowerCase();
  const currentHour = parseInt(getPart('hour') || '0', 10);
  const currentMinute = parseInt(getPart('minute') || '0', 10);

  // Parse condition times
  const [startHour, startMinute] = condition.start.split(':').map(Number);
  const [endHour, endMinute] = condition.end.split(':').map(Number);

  const currentMinutes = currentHour * 60 + currentMinute;
  const startMinutes = startHour * 60 + startMinute;
  const endMinutes = endHour * 60 + endMinute;

  // Check day if specified
  if (condition.days && currentDay && !condition.days.includes(currentDay)) {
    return false;
  }

  // Check time range
  if (startMinutes <= endMinutes) {
    // Normal range (e.g., 09:00 - 17:00)
    return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
  } else {
    // Overnight range (e.g., 22:00 - 06:00)
    return currentMinutes >= startMinutes || currentMinutes <= endMinutes;
  }
}

// Time-restricted grant check
async function checkGrantWithConditions(
  grant: ResourceGrant,
  userId: string
): Promise<boolean> {
  if (!grant.conditions?.timeRange) {
    return true;  // No time restriction
  }

  return checkTimeCondition(grant.conditions.timeRange);
}
```

### IP-Based Restrictions

```typescript
// IP restriction conditions
interface IPCondition {
  type: 'ip_address';
  allowedIPs: string[];
  blockedIPs?: string[];
}

async function checkIPCondition(
  condition: IPCondition,
  clientIP: string
): Promise<boolean> {
  // Check blocked IPs first
  if (condition.blockedIPs?.includes(clientIP)) {
    return false;
  }

  // Check allowed IPs
  if (condition.allowedIPs.length === 0) {
    return true;  // No restriction
  }

  return condition.allowedIPs.some(allowed => {
    if (allowed.includes('/')) {
      // CIDR notation
      return ipInCIDR(clientIP, allowed);
    }
    return clientIP === allowed;
  });
}

function ipInCIDR(ip: string, cidr: string): boolean {
  const [range, bits] = cidr.split('/');
  const mask = parseInt(bits, 10);

  const ipInt = ipToInt(ip);
  const rangeInt = ipToInt(range);
  const maskInt = (1 << (32 - mask)) - 1;

  return (ipInt & ~maskInt) === (rangeInt & ~maskInt);
}
```

---

## 5. Temporary Access Grants

### Temporary Access Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                Temporary Access Grant Flow                           │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  1. Owner grants temporary access                                  │
│     POST /resources/{id}/access                                     │
│     {                                                               │
│       "granteeType": "user",                                        │
│       "granteeId": "user_456",                                      │
│       "level": "editor",                                           │
│       "expiresAt": "2024-01-15T17:00:00Z"                          │
│     }                                                               │
│                                                                     │
│  2. System creates time-limited grant                               │
│     ┌─────────────────────────────────────────────────────────┐    │
│     │  Grant {                                                   │    │
│     │    level: "editor",                                       │    │
│     │    expiresAt: "2024-01-15T17:00:00Z" ◄── Auto-expires   │    │
│     │    status: "pending_activation"                           │    │
│     │  }                                                         │    │
│     └─────────────────────────────────────────────────────────┘    │
│                                                                     │
│  3. Grantee receives notification                                  │
│     "You've been granted temporary access to Project X"            │
│     "Access expires in 24 hours"                                   │
│                                                                     │
│  4. At expiry, access automatically revoked                        │
│     (via scheduled job or on-demand check)                        │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Auto-Expiring Grants

```typescript
// lib/auth/temporary-access.ts
interface TemporaryGrant {
  id: string;
  resourceId: string;
  resourceType: string;
  granteeType: 'user' | 'team';
  granteeId: string;
  level: 'viewer' | 'editor';
  grantedBy: string;
  grantedAt: Date;
  expiresAt: Date;
  status: 'active' | 'expired' | 'revoked';
  notifyBeforeExpiry: boolean;
  notifyAtExpiry: boolean;
}

async function createTemporaryGrant(
  resourceId: string,
  resourceType: string,
  granteeType: 'user' | 'team',
  granteeId: string,
  level: 'viewer' | 'editor',
  duration: number,  // milliseconds
  grantedBy: string
): Promise<TemporaryGrant> {
  const grant = await db.createGrant({
    resourceId,
    resourceType,
    granteeType,
    granteeId,
    level,
    grantedBy,
    grantedAt: new Date(),
    expiresAt: new Date(Date.now() + duration),
    status: 'active',
    notifyBeforeExpiry: true,
    notifyAtExpiry: true
  });

  // Schedule expiry job
  await scheduleJob('grant-expiry', {
    grantId: grant.id,
    executeAt: grant.expiresAt
  });

  return grant;
}

// Scheduled job to expire grants
async function expireGrants() {
  const now = new Date();

  // Find all expired but active grants
  const expiredGrants = await db.findGrants({
    status: 'active',
    expiresAt: { $lte: now }
  });

  for (const grant of expiredGrants) {
    await db.updateGrant(grant.id, { status: 'expired' });

    // Invalidate permission cache for grantee
    await permissionService.invalidateCache(grant.granteeId);

    // Notify grantee
    await notificationService.notifyGrantExpired(grant);
  }
}

// Check access including expiry
async function checkAccessWithExpiry(
  userId: string,
  resourceId: string,
  resourceType: string
): Promise<{ hasAccess: boolean; level: string | null; expiresAt?: Date }> {
  const grant = await db.findActiveGrant(userId, resourceId, resourceType);

  if (!grant) {
    return { hasAccess: false, level: null };
  }

  // Check if expired
  if (grant.expiresAt && grant.expiresAt < new Date()) {
    await db.updateGrant(grant.id, { status: 'expired' });
    return { hasAccess: false, level: null };
  }

  return {
    hasAccess: true,
    level: grant.level,
    expiresAt: grant.expiresAt
  };
}
```

### Access Request Workflow

```typescript
// Access request system
interface AccessRequest {
  id: string;
  resourceId: string;
  resourceType: string;
  requesterId: string;
  requestedLevel: 'viewer' | 'editor';
  reason: string;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  requestedDuration?: number;  // For temporary access
  reviewedBy?: string;
  reviewedAt?: Date;
  reviewNote?: string;
  createdAt: Date;
  expiresAt?: Date;  // Request expiry if not reviewed
}

async function requestAccess(
  resourceId: string,
  resourceType: string,
  requesterId: string,
  requestedLevel: 'viewer' | 'editor',
  reason: string,
  requestedDuration?: number
): Promise<AccessRequest> {
  // Check if requester already has access
  const existingAccess = await checkAccessWithExpiry(
    requesterId,
    resourceId,
    resourceType
  );

  if (existingAccess.hasAccess) {
    throw new BadRequestError('You already have access to this resource');
  }

  // Check for pending request
  const pendingRequest = await db.findPendingRequest(
    resourceId,
    requesterId
  );

  if (pendingRequest) {
    throw new BadRequestError('You have a pending request');
  }

  const request = await db.createAccessRequest({
    resourceId,
    resourceType,
    requesterId,
    requestedLevel,
    reason,
    status: 'pending',
    requestedDuration,
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
  });

  // Notify resource owner
  const resource = await getResource(resourceId, resourceType);
  await notificationService.notifyAccessRequest(resource.ownerId, request);

  return request;
}

async function approveAccessRequest(
  requestId: string,
  approverId: string,
  grantDuration?: number
) {
  const request = await db.getAccessRequest(requestId);

  if (request.status !== 'pending') {
    throw new BadRequestError('Request is not pending');
  }

  // Create grant
  const grant = await createTemporaryGrant(
    request.resourceId,
    request.resourceType,
    'user',
    request.requesterId,
    request.requestedLevel,
    grantDuration || request.requestedDuration || 24 * 60 * 60 * 1000,  // Default 24h
    approverId
  );

  // Update request status
  await db.updateAccessRequest(requestId, {
    status: 'approved',
    reviewedBy: approverId,
    reviewedAt: new Date()
  });

  // Notify requester
  await notificationService.notifyRequestApproved(request.requesterId, grant);

  return grant;
}
```

---

## 6. Implementation

### Access Control Service

```typescript
// lib/auth/access-control.ts
class AccessControlService {
  constructor(
    private db: Database,
    private permissionService: PermissionService,
    private notificationService: NotificationService
  ) {}

  async checkAccess(
    userId: string,
    resourceId: string,
    resourceType: string,
    requiredLevel: 'viewer' | 'editor' | 'owner'
  ): Promise<boolean> {
    // Get resource
    const resource = await this.db.getResource(resourceId, resourceType);
    if (!resource) return false;

    // Owner always has access
    if (resource.ownerId === userId) return true;

    // Check user permissions (role-based)
    const hasRolePermission = await this.permissionService.hasPermission(
      userId,
      `${resourceType}s:${requiredLevel === 'owner' ? 'write' : requiredLevel}`
    );
    if (hasRolePermission) return true;

    // Check personal grant
    const personalGrant = await this.db.findGrant(resourceId, userId, 'user');
    if (personalGrant && this.meetsLevel(personalGrant.level, requiredLevel)) {
      return this.checkGrantConditions(personalGrant);
    }

    // Check team grants
    const userTeams = await this.db.getUserTeams(userId);
    for (const team of userTeams) {
      const teamGrant = await this.db.findGrant(resourceId, team.id, 'team');
      if (teamGrant && this.meetsLevel(teamGrant.level, requiredLevel)) {
        return this.checkGrantConditions(teamGrant);
      }
    }

    return false;
  }

  private meetsLevel(hasLevel: string, requiredLevel: string): boolean {
    const levels = ['viewer', 'editor', 'owner'];
    const hasRank = levels.indexOf(hasLevel);
    const requiredRank = levels.indexOf(requiredLevel);
    return hasRank >= requiredRank;
  }

  private async checkGrantConditions(grant: ResourceGrant): Promise<boolean> {
    if (!grant.conditions) return true;

    // Check time condition
    if (grant.conditions.timeRange) {
      if (!await checkTimeCondition(grant.conditions.timeRange)) {
        return false;
      }
    }

    // Check IP condition
    if (grant.conditions.ipAddress) {
      // Would need to pass client IP here
      return true;  // Placeholder
    }

    return true;
  }
}

export const accessControlService = new AccessControlService();
```

---

## 7. Security Checklist

### General Access Control

- [ ] **Every resource has an owner**
- [ ] **Owner can always access their own resources**
- [ ] **Grants follow least privilege principle**
- [ ] **No unauthorized privilege escalation**
- [ ] **Access checks are server-side only**
- [ ] **Permission cache invalidates on changes**

### Sharing

- [ ] **Validate shared links before granting access**
- [ ] **Public links require explicit opt-in**
- [ ] **Password-protected links use strong hashing**
- [ ] **Link access is logged for audit**
- [ ] **Expiring links auto-disable at expiry**

### Team Access

- [ ] **Team hierarchies properly resolved**
- [ ] **Nested team access works correctly**
- [ ] **Removing user from team revokes access**
- [ ] **Team grants don't leak to non-members**

### Time/IP Restrictions

- [ ] **Time-based access respects timezone**
- [ ] **IP allowlist/blocklist works with CIDR**
- [ ] **Conditions checked on each access**
- [ ] **Invalid conditions fail closed**

### Temporary Access

- [ ] **Grants have explicit expiry**
- [ ] **Expired grants are automatically revoked**
- [ ] **Notification sent before expiry**
- [ ] **Extension requires re-authorization**

---

## OWASP References

- [Access Control Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Access_Control_Cheat_Sheet.html)
- [Sharing Common Vulnerabilities](https://cheatsheetseries.owasp.org/cheatsheets/Sharing_Common_Vulnerabilities_Cheat_Sheet.html)

---
title: "RBAC Implementation"
description: ""
date: "2026-04-24"
author: "Saul Vo"
tags: ["authorization","rbac","permissions"]
readingTime: "5 min"
order: 2
slug: "rbac-implementation"
category: "authorization"
---

# RBAC Implementation

## Mục lục
1. [RBAC vs ABAC vs Other Models](#1-rbac-vs-abac-vs-other-models)
2. [RBAC Core Concepts](#2-rbac-core-concepts)
3. [Database Schema](#3-database-schema)
4. [Permission Checking](#4-permission-checking)
5. [Middleware Implementation](#5-middleware-implementation)
6. [Frontend Integration](#6-frontend-integration)
7. [Common Pitfalls](#7-common-pitfalls)
8. [Security Checklist](#8-security-checklist)

---

## 1. RBAC vs ABAC vs Other Models

### Access Control Models Comparison

```
┌────────────────────────────────────────────────────────────────────┐
│                  Access Control Models                              │
├────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │  DAC (Discretionary Access Control)                          │ │
│  │  • Owner defines who can access                               │ │
│  │  • Example: Linux file permissions                            │ │
│  │  • Most flexible, hardest to audit                            │ │
│  └──────────────────────────────────────────────────────────────┘ │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │  MAC (Mandatory Access Control)                              │ │
│  │  • System enforces access rules                              │ │
│  │  • Example: SELinux, military classifications                 │ │
│  │  • Most restricted, government/enterprise                    │ │
│  └──────────────────────────────────────────────────────────────┘ │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │  RBAC (Role-Based Access Control)  ◄◄◄ FOCUS                 │ │
│  │  • Users → Roles → Permissions                              │ │
│  │  • Example: Admin, Editor, Viewer                            │ │
│  │  • Simple, scalable, industry standard                        │ │
│  └──────────────────────────────────────────────────────────────┘ │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │  ABAC (Attribute-Based Access Control)                        │ │
│  │  • Policies based on user/resource attributes                │ │
│  │  • Example: "Users in 'Engineering' can edit 'code' files"  │ │
│  │  • Most flexible, complex to implement                        │ │
│  └──────────────────────────────────────────────────────────────┘ │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │  ReBAC (Relationship-Based Access Control)                  │ │
│  │  • Access based on relationships between entities           │ │
│  │  • Example: "Only the document owner can delete it"         │ │
│  │  • Used in Google Docs, Notion-style apps                   │ │
│  └──────────────────────────────────────────────────────────────┘ │
│                                                                     │
└────────────────────────────────────────────────────────────────────┘
```

### When to Use RBAC vs ABAC

| Scenario | Recommended Model |
|----------|-------------------|
| Simple permissions (admin/user/viewer) | RBAC |
| Organization-based access | RBAC + Departments |
| Document sharing (owner/editor/viewer) | ReBAC |
| Dynamic policies based on attributes | ABAC |
| Enterprise with complex hierarchies | Hybrid RBAC + ABAC |

---

## 2. RBAC Core Concepts

### RBAC Hierarchy

```
┌─────────────────────────────────────────────────────────────────────┐
│                    RBAC Hierarchy                                   │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│                           ┌─────────┐                               │
│                           │ USERS   │                               │
│                           └────┬────┘                               │
│                                │                                    │
│                    ┌───────────┼───────────┐                       │
│                    │           │           │                        │
│               ┌────┴────┐ ┌────┴────┐ ┌────┴────┐                  │
│               │  role  │ │  role  │ │  role  │                    │
│               │ admin  │ │ editor │ │ viewer │                   │
│               └────┬────┘ └────┬────┘ └────┬────┘                  │
│                    │           │           │                        │
│                    └───────────┴───────────┘                        │
│                                │                                    │
│                           ┌────┴────┐                               │
│                           │PERMISSIONS│                              │
│                           └───┬─────┘                               │
│                               │                                    │
│         ┌─────────────────────┼─────────────────────┐             │
│         │           │           │           │         │             │
│    ┌────┴────┐ ┌────┴────┐ ┌────┴────┐ ┌────┴────┐  │             │
│    │  read   │ │  write  │ │ delete  │ │  admin  │  │             │
│    │   ✓     │ │   ✓     │ │   ✓     │ │   ✓     │  │             │
│    └─────────┘ └─────────┘ └─────────┘ └─────────┘  │             │
│                                                              │
└─────────────────────────────────────────────────────────────────────┘
```

### Role Hierarchy (with Inheritance)

```typescript
// Role definitions with inheritance
const roleHierarchy = {
  superadmin: {
    inherits: [],  // Top-level, no inheritance
    permissions: ['*']  // All permissions
  },
  admin: {
    inherits: ['moderator'],
    permissions: ['users:read', 'users:write', 'users:delete', 'settings:admin']
  },
  moderator: {
    inherits: ['user'],
    permissions: ['content:moderate', 'content:delete', 'users:view']
  },
  user: {
    inherits: ['viewer'],
    permissions: ['profile:read', 'profile:write', 'content:create']
  },
  viewer: {
    inherits: [],
    permissions: ['content:read']
  }
};

// Flatten permissions for a role
function getFlattenedPermissions(roleName: string): string[] {
  const visited = new Set<string>();
  const permissions = new Set<string>();

  function traverse(role: string) {
    if (visited.has(role)) return;  // Prevent cycles
    visited.add(role);

    const config = roleHierarchy[role];
    if (!config) return;

    // Add direct permissions
    config.permissions.forEach(p => permissions.add(p));

    // Traverse parent roles
    config.inherits.forEach(traverse);
  }

  traverse(roleName);
  return Array.from(permissions);
}

// Example
console.log(getFlattenedPermissions('admin'));
// ['content:moderate', 'content:delete', 'users:view',
//  'profile:read', 'profile:write', 'content:create',
//  'users:read', 'users:write', 'users:delete', 'settings:admin']
```

---

## 3. Database Schema

### Traditional RBAC Schema

```sql
-- Users table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Roles table
CREATE TABLE roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(50) UNIQUE NOT NULL,
  description TEXT,
  parent_role_id UUID REFERENCES roles(id),  -- For hierarchy
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Permissions table
CREATE TABLE permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) UNIQUE NOT NULL,  -- e.g., 'users:read'
  description TEXT,
  resource VARCHAR(50) NOT NULL,       -- e.g., 'users'
  action VARCHAR(20) NOT NULL,         -- e.g., 'read', 'write', 'delete'
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User-Role mapping (many-to-many)
CREATE TABLE user_roles (
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, role_id)
);

-- Role-Permission mapping (many-to-many)
CREATE TABLE role_permissions (
  role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
  permission_id UUID REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);
```

### Permission Naming Convention

```
┌─────────────────────────────────────────────────────────────────────┐
│                  Permission Format: resource:action                │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Pattern: <resource>:<action>                                      │
│                                                                     │
│  Examples:                                                          │
│  ┌─────────────────────────────────────────────────────────┐       │
│  │  users:read      → View user list, user profiles         │       │
│  │  users:write     → Create/edit users                     │       │
│  │  users:delete    → Delete users                           │       │
│  │  posts:read      → View posts                             │       │
│  │  posts:write     → Create/edit own posts                 │       │
│  │  posts:moderate  → Edit/delete any post                  │       │
│  │  settings:admin  → Access admin settings                  │       │
│  │  *:*             → Superadmin - all permissions          │       │
│  └─────────────────────────────────────────────────────────┘       │
│                                                                     │
│  Wildcard support:                                                 │
│  ┌─────────────────────────────────────────────────────────┐       │
│  │  users:*    → All actions on users                     │       │
│  │  *:read     → Read access to all resources              │       │
│  │  *:*        → Everything (use sparingly!)               │       │
│  └─────────────────────────────────────────────────────────┘       │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Seed Data

```sql
-- Permissions
INSERT INTO permissions (name, resource, action) VALUES
  ('users:read', 'users', 'read'),
  ('users:write', 'users', 'write'),
  ('users:delete', 'users', 'delete'),
  ('posts:read', 'posts', 'read'),
  ('posts:write', 'posts', 'write'),
  ('posts:delete', 'posts', 'delete'),
  ('posts:moderate', 'posts', 'moderate'),
  ('settings:admin', 'settings', 'admin');

-- Roles
INSERT INTO roles (name, description, parent_role_id) VALUES
  ('superadmin', 'Super administrator', NULL),
  ('admin', 'Administrator', (SELECT id FROM roles WHERE name = 'moderator')),
  ('moderator', 'Content moderator', (SELECT id FROM roles WHERE name = 'user')),
  ('user', 'Regular user', (SELECT id FROM roles WHERE name = 'viewer')),
  ('viewer', 'View-only user', NULL);

-- Role-Permission mapping
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'viewer' AND p.name LIKE 'posts:read';

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'user' AND p.name IN ('posts:read', 'posts:write', 'posts:delete');

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'moderator' AND p.name IN ('posts:moderate');

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'admin' AND p.name LIKE 'users:%';

-- Superadmin gets everything
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'superadmin';
```

---

## 4. Permission Checking

### Core Permission Service

```typescript
// lib/auth/rbac.ts
interface User {
  id: string;
  email: string;
  role: string;
  permissions: string[];
}

interface PermissionContext {
  resourceId?: string;
  resourceOwnerId?: string;
  [key: string]: any;
}

class RBACService {
  constructor(
    private roleHierarchy: Record<string, { inherits: string[]; permissions: string[] }>,
    private db: Database
  ) {}

  // Get all permissions for a user (with role inheritance)
  async getUserPermissions(userId: string): Promise<string[]> {
    const user = await this.db.getUser(userId);
    if (!user) return [];

    return this.getFlattenedPermissions(user.role);
  }

  // Flatten role hierarchy
  getFlattenedPermissions(roleName: string): string[] {
    const visited = new Set<string>();
    const permissions = new Set<string>();

    const traverse = (role: string) => {
      if (visited.has(role)) return;
      visited.add(role);

      const config = this.roleHierarchy[role];
      if (!config) return;

      config.permissions.forEach(p => permissions.add(p));
      config.inherits.forEach(traverse);
    };

    traverse(roleName);
    return Array.from(permissions);
  }

  // Check if user has specific permission
  async hasPermission(userId: string, permission: string): Promise<boolean> {
    const userPermissions = await this.getUserPermissions(userId);

    // Direct match
    if (userPermissions.includes('*:*') || userPermissions.includes('*:' + permission.split(':')[1])) {
      return true;
    }
    if (userPermissions.includes(permission)) {
      return true;
    }
    if (userPermissions.includes(permission.split(':')[0] + ':*')) {
      return true;
    }

    return false;
  }

  // Check permission with resource context
  async canAccessResource(
    userId: string,
    permission: string,
    resourceId: string,
    context: PermissionContext = {}
  ): Promise<boolean> {
    // Superadmin bypass
    if (await this.hasPermission(userId, '*:*')) {
      return true;
    }

    // Check basic permission
    if (!await this.hasPermission(userId, permission)) {
      return false;
    }

    // Check resource-specific rules
    if (context.resourceOwnerId) {
      // Owner can always access their own resources
      if (context.resourceOwnerId === userId) {
        return true;
      }

      // Moderators can access any resource
      if (await this.hasPermission(userId, '*')) {
        return true;
      }
    }

    return true;
  }

  // Get user's role
  async getUserRole(userId: string): Promise<string | null> {
    const user = await this.db.getUser(userId);
    return user?.role || null;
  }
}
```

### Permission Check Helper

```typescript
// lib/auth/can.ts
type PermissionCheck = string | [string, (ctx: any) => Promise<boolean>];

interface PermissionRule {
  permission: string;
  resourceType?: string;
  checkOwnership?: boolean;
  fallback?: string;
}

function createPermissionChecker(rbac: RBACService) {
  return function can(
    userId: string,
    permission: string,
    resource?: { id: string; ownerId: string }
  ): Promise<boolean> {
    if (resource) {
      return rbac.canAccessResource(userId, permission, resource.id, {
        resourceOwnerId: resource.ownerId
      });
    }
    return rbac.hasPermission(userId, permission);
  };
}

// Usage
const checkPermission = createPermissionChecker(rbac);

// Simple check
const canViewUsers = await checkPermission(userId, 'users:read');

// Resource check
const canEditPost = await checkPermission(userId, 'posts:write', {
  id: postId,
  ownerId: post.authorId
});
```

---

## 5. Middleware Implementation

### Express Middleware

```typescript
// middleware/rbac.ts
type Permission = string | {
  permission: string;
  resourceType?: string;
  resourceIdParam?: string;  // e.g., 'params.id'
};

function requirePermission(permission: Permission) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
      let permissionToCheck = typeof permission === 'string'
        ? permission
        : permission.permission;

      let resourceId: string | undefined;
      if (typeof permission !== 'string' && permission.resourceIdParam) {
        resourceId = getNestedValue(req, permission.resourceIdParam);
      }

      const hasAccess = await rbac.canAccessResource(
        userId,
        permissionToCheck,
        resourceId,
        {
          resourceOwnerId: resourceId ? await getResourceOwner(resourceId) : undefined
        }
      );

      if (!hasAccess) {
        return res.status(403).json({
          error: 'Forbidden',
          requiredPermission: permissionToCheck
        });
      }

      next();
    } catch (error) {
      console.error('RBAC middleware error:', error);
      res.status(500).json({ error: 'Authorization error' });
    }
  };
}

// Helper to get nested object values
function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((current, key) => current?.[key], obj);
}
```

```typescript
// middleware/authorize.ts
import { requirePermission } from './rbac';

// Usage in Express routes
app.delete('/users/:id',
  authenticateToken,
  requirePermission({
    permission: 'users:delete',
    resourceType: 'user',
    resourceIdParam: 'params.id'
  }),
  async (req, res) => {
    // Only admins (who also own the user or have *:*) reach here
    await deleteUser(req.params.id);
    res.json({ success: true });
  }
);

// Simple permission check
app.post('/posts',
  authenticateToken,
  requirePermission('posts:write'),
  async (req, res) => {
    const post = await createPost(req.user.id, req.body);
    res.json(post);
  }
);

// Multi-permission check (any of)
app.get('/admin/dashboard',
  authenticateToken,
  requirePermission(['settings:admin', 'users:read']),
  async (req, res) => {
    // Admins or users with read access
    const data = await getDashboardData();
    res.json(data);
  }
);
```

### Next.js Route Protection

```typescript
// app/api/posts/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { rbac } from '@/lib/auth/rbac';

async function authorize(
  permission: string,
  resource?: { id: string; getOwnerId: () => Promise<string> }
) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return { authorized: false, error: 'Unauthorized', status: 401 };
  }

  let ownerId: string | undefined;
  if (resource) {
    ownerId = await resource.getOwnerId();
  }

  const hasAccess = await rbac.canAccessResource(
    session.user.id,
    permission,
    resource?.id,
    { resourceOwnerId: ownerId }
  );

  if (!hasAccess) {
    return { authorized: false, error: 'Forbidden', status: 403 };
  }

  return { authorized: true };
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await authorize('posts:delete', {
    id: params.id,
    getOwnerId: async () => {
      const post = await db.getPost(params.id);
      return post?.authorId;
    }
  });

  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  await db.deletePost(params.id);
  return NextResponse.json({ success: true });
}
```

---

## 6. Frontend Integration

### Permission Hook

```typescript
// hooks/usePermissions.ts
'use client';

import { useSession } from 'next-auth/react';
import { useMemo } from 'react';

interface Permission {
  permission: string;
  resourceType?: string;
}

export function usePermissions() {
  const { data: session } = useSession();
  const userPermissions = session?.user?.permissions || [];
  const userRole = session?.user?.role;

  const can = useMemo(() => {
    return (permission: string): boolean => {
      if (!session) return false;

      // Check wildcard permissions
      if (userPermissions.includes('*:*') ||
          userPermissions.includes(permission.split(':')[0] + ':*')) {
        return true;
      }

      return userPermissions.includes(permission);
    };
  }, [session, userPermissions]);

  const isRole = useMemo(() => {
    return (role: string): boolean => {
      if (!session) return false;
      return userRole === role;
    };
  }, [session, userRole]);

  return { can, isRole, permissions: userPermissions, role: userRole };
}
```

### Permission Guard Component

```typescript
// components/PermissionGuard.tsx
'use client';

import { usePermissions } from '@/hooks/usePermissions';

interface PermissionGuardProps {
  children: React.ReactNode;
  permission: string;
  fallback?: React.ReactNode;
  requiredRole?: string;
}

export function PermissionGuard({
  children,
  permission,
  fallback = null,
  requiredRole
}: PermissionGuardProps) {
  const { can, isRole } = usePermissions();

  if (requiredRole && !isRole(requiredRole)) {
    return <>{fallback}</>;
  }

  if (!can(permission)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

// Usage
function AdminPanel() {
  return (
    <div>
      <h1>Admin Panel</h1>

      <PermissionGuard permission="users:read">
        <UserList />
      </PermissionGuard>

      <PermissionGuard permission="settings:admin" fallback={<p>Access denied</p>}>
        <SettingsPanel />
      </PermissionGuard>
    </div>
  );
}
```

### API Permission Fetch

```typescript
// lib/api-permissions.ts
interface PermissionMetadata {
  [endpoint: string]: string[];
}

// Permissions config - single source of truth
const apiPermissions: PermissionMetadata = {
  'GET /api/users': ['users:read'],
  'POST /api/users': ['users:write'],
  'DELETE /api/users/:id': ['users:delete'],
  'GET /api/posts': ['posts:read'],
  'POST /api/posts': ['posts:write'],
  'DELETE /api/posts/:id': ['posts:delete'],
  'PUT /api/posts/:id': ['posts:write'],
};

// Client-side: get allowed actions
async function getAllowedActions(): Promise<string[]> {
  const response = await fetch('/api/auth/permissions');
  if (!response.ok) return [];
  const data = await response.json();
  return data.permissions;
}

// Server-side: validate permissions before processing
async function validatePermissions(userId: string, method: string, path: string) {
  const permissionKey = `${method} ${path}`;
  const requiredPermission = apiPermissions[permissionKey];

  if (!requiredPermission) {
    return true; // No specific permission required
  }

  return rbac.hasPermission(userId, requiredPermission);
}
```

---

## 7. Common Pitfalls

### Pitfall 1: Storing Permissions in JWT

```javascript
// ❌ NGUY HIỂM - permissions in JWT are not updatable
const token = jwt.sign({
  sub: userId,
  permissions: ['posts:read', 'posts:write']  // Fixed until token expires
}, secret);

// Problem: If admin revokes permission, user still has access until token expires
```

```javascript
// ✅ AN TOÀN - fetch permissions on each request (for sensitive operations)
async function getFreshPermissions(userId) {
  const user = await db.getUser(userId);
  return flattenPermissions(user.role);
}

// Or use short-lived tokens (15 min) + refresh
```

### Pitfall 2: Ownership Check Missing

```javascript
// ❌ LỖ HỔNG - anyone with 'posts:delete' can delete any post
app.delete('/posts/:id',
  requirePermission('posts:delete'),
  deletePost
);

// ✅ ĐÚNG - check ownership
app.delete('/posts/:id',
  requirePermission('posts:delete'),
  async (req, res) => {
    const post = await getPost(req.params.id);

    // Owner or admin can delete
    if (post.authorId !== req.user.id &&
        !await hasPermission(req.user.id, '*')) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    await deletePost(req.params.id);
    res.json({ success: true });
  }
);
```

### Pitfall 3: Role Hierarchy Not Flattened

```javascript
// ❌ SAI - only checks direct role
function hasPermission(userId, permission) {
  const user = getUser(userId);
  return user.role.permissions.includes(permission);
  // admin role permissions checked, but moderator inherits from user!
}

// ✅ ĐÚNG - flatten hierarchy
function hasPermission(userId, permission) {
  const user = getUser(userId);
  const allPermissions = flattenRoleHierarchy(user.role);
  return allPermissions.includes(permission);
}
```

### Pitfall 4: No Audit Log

```javascript
// ❌ KHUYẾT KHÍCH - no tracking
app.delete('/posts/:id', deletePost);

// ✅ ĐÚNG - log all access
app.delete('/posts/:id',
  requirePermission('posts:delete'),
  async (req, res) => {
    const post = await getPost(req.params.id);
    const user = getUser(req.user.id);

    // Log before action
    await auditLog.create({
      userId: req.user.id,
      userEmail: user.email,
      action: 'delete',
      resourceType: 'post',
      resourceId: req.params.id,
      previousData: post,
      timestamp: new Date()
    });

    await deletePost(req.params.id);

    // Log after action
    await auditLog.update({ completedAt: new Date() });

    res.json({ success: true });
  }
);
```

---

## 8. Security Checklist

### RBAC Implementation

- [ ] **Role hierarchy properly flattened** (no permission gaps)
- [ ] **No circular role inheritance** (validate on role create)
- [ ] **Principle of least privilege** (minimal permissions per role)
- [ ] **Wildcard permissions limited** (prefer specific permissions)
- [ ] **Ownership checks** for resource-level access
- [ ] **Permissions validated server-side** (never trust client)
- [ ] **Permissions fetched fresh** for sensitive operations

### Database & Schema

- [ ] **Normalized permission tables** (no duplicating permissions)
- [ ] **Indexes on user_id and role_id** for performance
- [ ] **Soft delete for roles** (preserve audit trail)
- [ ] **Unique constraint on role names**
- [ ] **Unique constraint on permission names**

### API Security

- [ ] **All endpoints have permission requirements**
- [ ] **Resource ownership checked before mutation**
- [ ] **Sensitive operations require MFA** (optional but recommended)
- [ ] **Rate limiting on permission-protected endpoints**
- [ ] **Audit log for admin actions**

### Frontend Security

- [ ] **UI elements hidden based on permissions** (defense in depth)
- [ ] **API calls protected (client-side hiding is cosmetic)**
- [ ] **No sensitive data exposed in client bundles**

---

## OWASP References

- [Access Control Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Access_Control_Cheat_Sheet.html)
- [Role-Based Access Control Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Role_Based_Access_Control_Cheat_Sheet.html)

---
title: "Permission Checking Patterns"
description: ""
date: "2026-04-24"
author: "Saul Vo"
tags: ["authorization", "rbac", "permissions"]
readingTime: "5 min"
order: 1
slug: "permission-checking"
category: "authorization"
---

# Permission Checking Patterns

## Mục lục

1. [Permission Check Patterns](#1-permission-check-patterns)
2. [Resource-Level Authorization](#2-resource-level-authorization)
3. [Field-Level Security](#3-field-level-security)
4. [Batch Permission Checks](#4-batch-permission-checks)
5. [Real-time Permission Updates](#5-real-time-permission-updates)
6. [Implementation Examples](#6-implementation-examples)

---

## 1. Permission Check Patterns

### Pattern 1: Direct Permission Check

```typescript
// Simplest pattern - check permission directly
async function checkPermission(
  userId: string,
  permission: string,
): Promise<boolean> {
  const permissions = await getUserPermissions(userId);
  return (
    permissions.includes(permission) ||
    permissions.includes("*:*") ||
    permissions.includes(permission.split(":")[0] + ":*")
  );
}

// Usage
if (await checkPermission(userId, "posts:delete")) {
  await deletePost(postId);
}
```

### Pattern 2: Conditional Permission Check

```typescript
// Check permission with conditional logic
async function checkPermissionWithCondition(
  userId: string,
  permission: string,
  condition: (user: User) => boolean,
): Promise<boolean> {
  const user = await getUser(userId);
  const hasBasePermission = await checkPermission(userId, permission);

  return hasBasePermission && condition(user);
}

// Usage: Allow users to edit their own posts
if (
  await checkPermissionWithCondition(
    userId,
    "posts:write",
    (user) => user.role === "editor" || user.isAdmin,
  )
) {
  await editPost(postId);
}
```

### Pattern 3: Context-Aware Permission Check

```typescript
// Include resource context in permission check
interface ResourceContext {
  resourceType: string;
  resourceId: string;
  ownerId: string;
  createdAt: Date;
  metadata?: Record<string, any>;
}

async function checkPermissionWithContext(
  userId: string,
  permission: string,
  context: ResourceContext,
): Promise<boolean> {
  const permissions = await getUserPermissions(userId);

  // Superadmin bypass
  if (permissions.includes("*:*")) return true;

  // Basic permission check
  if (
    !permissions.includes(permission) &&
    !permissions.includes(permission.split(":")[0] + ":*")
  ) {
    return false;
  }

  // Special handling for resource ownership
  if (context.ownerId === userId) {
    // Owner gets special treatment
    return true;
  }

  // Moderator check (can access any resource in their domain)
  if (permissions.includes("*") && context.resourceType === "moderatable") {
    return true;
  }

  return false;
}
```

### Pattern 4: Policy-Based Permission Check

```typescript
// Define policies for complex authorization
interface Policy {
  id: string;
  name: string;
  evaluate: (user: User, context: ResourceContext) => Promise<boolean>;
}

const policies: Policy[] = [
  {
    id: "owner-can-edit",
    name: "Resource Owner Can Edit",
    evaluate: (user, context) => context.ownerId === user.id,
  },
  {
    id: "admin-can-delete-any",
    name: "Admin Can Delete Any",
    evaluate: async (user, _context) => {
      const perms = await getUserPermissions(user.id);
      return perms.includes("*:delete");
    },
  },
  {
    id: "team-member-can-view",
    name: "Team Member Can View",
    evaluate: async (user, context) => {
      const team = await getUserTeam(user.id);
      return team.id === context.metadata?.teamId;
    },
  },
];

async function checkPolicy(
  policyId: string,
  userId: string,
  context: ResourceContext,
): Promise<boolean> {
  const policy = policies.find((p) => p.id === policyId);
  if (!policy) return false;

  const user = await getUser(userId);
  return policy.evaluate(user, context);
}
```

---

## 2. Resource-Level Authorization

### Resource Ownership Model

```
┌─────────────────────────────────────────────────────────────────────┐
│                 Resource-Level Authorization                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Resource Entity:                                                   │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │  Post {                                                         │ │
│  │    id: "post_123",                                            │ │
│  │    authorId: "user_456",     ◄── Owner                        │ │
│  │    teamId: "team_789",                                       │ │
│  │    visibility: "team",                                       │ │
│  │    createdAt: ...,                                            │ │
│  │    updatedAt: ...                                             │ │
│  │  }                                                            │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                     │
│  Permission Rules:                                                 │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │  READ:  • Author                                            │ │
│  │         • Team members (if visibility = "team")             │ │
│  │         • Anyone with posts:read                             │ │
│  │                                                             │ │
│  │  WRITE: • Author                                            │ │
│  │         • Team leads (if teamId matches)                     │ │
│  │         • Anyone with posts:moderate                        │ │
│  │                                                             │ │
│  │  DELETE: • Author (if not published)                         │ │
│  │          • Author (if published) + admin                    │ │
│  │          • Anyone with posts:moderate                        │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Ownership Decorator

```typescript
// decorators/authorize.ts
function authorize(operation: "read" | "write" | "delete") {
  return function targetDecorator(
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor,
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const req = args[0];
      const resourceId = args[1]?.id || req.params?.id;

      if (!req.user?.id) {
        throw new UnauthorizedError("Not logged in");
      }

      const resource = await getResource(resourceId);

      const canAccess = await checkResourceAccess(
        req.user.id,
        operation,
        resource,
      );

      if (!canAccess) {
        throw new ForbiddenError(`Cannot ${operation} this resource`);
      }

      return originalMethod.apply(this, args);
    };

    return descriptor;
  };
}

// Usage in controller
class PostController {
  @authorize("delete")
  async deletePost(req: Request, res: Response) {
    const postId = req.params.id;
    await postService.delete(postId);
    res.json({ success: true });
  }
}
```

### Resource Access Checker

```typescript
// lib/auth/resource-access.ts
interface ResourceAccessRule {
  resourceType: string;
  operations: {
    [operation: string]: {
      allowedIf?: (user: User, resource: any) => Promise<boolean>;
      deniedIf?: (user: User, resource: any) => Promise<boolean>;
      ownerCan?: boolean;
      roles?: string[]; // Specific roles that can perform
      permissions?: string[]; // Specific permissions required
    };
  };
}

const resourceAccessRules: ResourceAccessRule[] = [
  {
    resourceType: "post",
    operations: {
      read: {
        allowedIf: async (user, resource) => {
          // Public posts readable by all
          if (resource.visibility === "public") return true;
          // Team posts only for team members
          if (resource.visibility === "team") {
            const userTeam = await getUserTeam(user.id);
            return userTeam.id === resource.teamId;
          }
          // Private posts only for author
          return resource.authorId === user.id;
        },
      },
      write: {
        ownerCan: true,
        roles: ["editor", "admin"],
        permissions: ["posts:write"],
      },
      delete: {
        deniedIf: async (_user, resource) => {
          // Cannot delete published posts
          return resource.status === "published";
        },
        ownerCan: false, // Override owner's ability for published posts
        permissions: ["posts:moderate", "posts:delete"],
      },
    },
  },
];

async function checkResourceAccess(
  userId: string,
  operation: string,
  resource: any,
): Promise<boolean> {
  const user = await getUser(userId);
  if (!user) return false;

  const rule = resourceAccessRules.find(
    (r) => r.resourceType === resource.resourceType,
  );
  if (!rule) return false;

  const opRule = rule.operations[operation];
  if (!opRule) return false;

  // Check deniedIf first (takes precedence)
  if (opRule.deniedIf) {
    const denied = await opRule.deniedIf(user, resource);
    if (denied) return false;
  }

  // Check ownerCan
  if (opRule.ownerCan && resource.ownerId === userId) {
    return true;
  }

  // Check roles
  if (opRule.roles?.length) {
    if (opRule.roles.includes(user.role)) {
      return true;
    }
  }

  // Check permissions
  if (opRule.permissions?.length) {
    const userPerms = await getUserPermissions(userId);
    if (opRule.permissions.some((p) => userPerms.includes(p))) {
      return true;
    }
  }

  // Check allowedIf
  if (opRule.allowedIf) {
    return opRule.allowedIf(user, resource);
  }

  return false;
}
```

---

## 3. Field-Level Security

### Field Permission Matrix

```
┌─────────────────────────────────────────────────────────────────────┐
│                   Field-Level Security Matrix                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  User Entity:                                                        │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  Field          │ Public │ Self │ Admin │ HR                 │   │
│  ├─────────────────┼────────┼──────┼───────┼───────────────────┤   │
│  │  id             │   ✓    │  ✓   │   ✓   │   ✓                │   │
│  │  email          │        │  ✓   │   ✓   │   ✓                │   │
│  │  name           │   ✓    │  ✓   │   ✓   │   ✓                │   │
│  │  phone          │        │  ✓   │   ✓   │   ✓                │   │
│  │  salary         │        │      │   ✓   │   ✓                │   │
│  │  ssn            │        │      │       │   ✓                │   │
│  │  role           │        │  ✓   │   ✓   │   ✓                │   │
│  │  performance   │        │      │   ✓   │   ✓                │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Field Selector

```typescript
// lib/auth/field-selector.ts
type FieldVisibility = "public" | "self" | "admin" | "hr";

interface FieldConfig {
  field: string;
  visibility: FieldVisibility[];
}

const fieldPermissions: Record<string, FieldConfig[]> = {
  user: [
    { field: "id", visibility: ["public", "self", "admin", "hr"] },
    { field: "email", visibility: ["self", "admin", "hr"] },
    { field: "name", visibility: ["public", "self", "admin", "hr"] },
    { field: "phone", visibility: ["self", "admin", "hr"] },
    { field: "salary", visibility: ["admin", "hr"] },
    { field: "ssn", visibility: ["hr"] },
    { field: "role", visibility: ["self", "admin", "hr"] },
  ],
};

function selectVisibleFields<T extends Record<string, any>>(
  resourceType: string,
  resource: T,
  userId: string,
  userRole: string,
): Partial<T> {
  const fields = fieldPermissions[resourceType];
  if (!fields) return resource;

  const visibility = getUserVisibility(userId, userRole);
  const result: Partial<T> = {};

  for (const config of fields) {
    if (config.visibility.includes(visibility)) {
      (result as any)[config.field] = resource[config.field];
    }
  }

  return result;
}

function getUserVisibility(userId: string, userRole: string): FieldVisibility {
  if (userRole === "admin") return "admin";
  if (userRole === "hr") return "hr";
  return "self"; // Users can see their own "self" fields
}

// Usage
const user = await db.getUser(userId);
const session = await getSession();

const visibleUser = selectVisibleFields(
  "user",
  user,
  session.userId,
  session.role,
);

// Response only includes fields user is allowed to see
res.json(visibleUser);
```

### GraphQL Field-Level Security

```typescript
// GraphQL resolver with field permissions
const resolvers = {
  User: {
    // This runs for each field
    salary: async (user, _args, context) => {
      // Only admin or HR can see salary
      if (!canAccessField(context.user, "salary", user)) {
        return null; // Or throw error
      }
      return user.salary;
    },

    ssn: async (user, _args, context) => {
      // Only HR can see SSN
      if (!canAccessField(context.user, "ssn", user)) {
        return null;
      }
      return user.ssn;
    },
  },
};

async function canAccessField(
  user: User,
  fieldName: string,
  resource: any,
): Promise<boolean> {
  const fieldConfig = fieldPermissions["user"].find(
    (f) => f.field === fieldName,
  );

  if (!fieldConfig) return false;

  // Check if user's visibility level includes this field
  const userVisibility = getUserVisibility(user.id, user.role);
  return fieldConfig.visibility.includes(userVisibility);
}
```

---

## 4. Batch Permission Checks

### Batch Permission Service

```typescript
// lib/auth/batch-permissions.ts
interface BatchPermissionCheck {
  userId: string;
  permissions: string[];
  resources?: { id: string; type: string; ownerId?: string }[];
}

interface BatchPermissionResult {
  permissions: Record<string, boolean>;
  resources: Record<string, Record<string, boolean>>;
}

async function checkBatchPermissions(
  checks: BatchPermissionCheck,
): Promise<BatchPermissionResult> {
  const { userId, permissions, resources = [] } = checks;

  // Get user's permissions once
  const userPermissions = await getUserPermissions(userId);

  // Check each permission
  const permissionResults: Record<string, boolean> = {};
  for (const perm of permissions) {
    permissionResults[perm] = checkSinglePermission(userPermissions, perm);
  }

  // Check each resource
  const resourceResults: Record<string, Record<string, boolean>> = {};
  for (const resource of resources) {
    resourceResults[resource.id] = await checkResourcePermissions(
      userId,
      userPermissions,
      resource,
    );
  }

  return {
    permissions: permissionResults,
    resources: resourceResults,
  };
}

function checkSinglePermission(
  userPermissions: string[],
  required: string,
): boolean {
  if (userPermissions.includes("*:*")) return true;
  if (userPermissions.includes(required)) return true;
  if (userPermissions.includes(required.split(":")[0] + ":*")) return true;
  return false;
}

async function checkResourcePermissions(
  userId: string,
  userPermissions: string[],
  resource: { id: string; type: string; ownerId?: string },
): Promise<Record<string, boolean>> {
  const results: Record<string, boolean> = {};
  const operations = ["read", "write", "delete"];

  for (const op of operations) {
    const permission = `${resource.type}:${op}`;

    // Check ownership
    if (resource.ownerId === userId) {
      results[op] = true;
      continue;
    }

    // Check permission
    results[op] = checkSinglePermission(userPermissions, permission);
  }

  return results;
}
```

### GraphQL Batch Check

```typescript
// GraphQL query with batch permission check
const typeDefs = gql`
  type Post {
    id: ID!
    title: String!
    content: String!
    authorId: ID!
    canEdit: Boolean!
    canDelete: Boolean!
  }

  type Query {
    posts(where: JSON): [Post!]!
    myPermissions: PermissionResult!
  }
`;

const resolvers = {
  Query: {
    posts: async (_: any, { where }: { where?: any }, context: Context) => {
      const posts = await db.queryPosts(where);

      // Batch check permissions for all posts
      const results = await checkBatchPermissions({
        userId: context.user.id,
        permissions: ["posts:read"],
        resources: posts.map((p) => ({
          id: p.id,
          type: "post",
          ownerId: p.authorId,
        })),
      });

      // Attach permissions to each post
      return posts.map((post) => ({
        ...post,
        canEdit: results.resources[post.id]?.write ?? false,
        canDelete: results.resources[post.id]?.delete ?? false,
      }));
    },
  },
};
```

---

## 5. Real-time Permission Updates

### WebSocket Permission Events

```typescript
// Real-time permission updates
class PermissionWebSocket {
  private clients: Map<string, Set<WebSocket>> = new Map();

  async notifyPermissionChange(userId: string, resourceType: string) {
    const key = `${userId}:${resourceType}`;
    const clientSockets = this.clients.get(key);

    if (clientSockets) {
      const message = JSON.stringify({
        type: "PERMISSION_CHANGED",
        resourceType,
        timestamp: Date.now(),
      });

      clientSockets.forEach((socket) => {
        socket.send(message);
      });
    }
  }

  async broadcastRoleChange(userId: string) {
    const socket = this.clients.get(userId);
    if (socket) {
      // Force re-authentication or refresh permissions
      socket.send(
        JSON.stringify({
          type: "ROLE_CHANGED",
          action: "REFRESH_PERMISSIONS",
        }),
      );
    }
  }
}

// Usage when admin changes user role
async function updateUserRole(userId: string, newRole: string) {
  await db.updateUser(userId, { role: newRole });

  // Invalidate cached permissions
  await cache.invalidate(`permissions:${userId}`);

  // Notify user
  await permissionWs.broadcastRoleChange(userId);
}
```

### Client-Side Permission Refresh

```typescript
// hooks/usePermissionsListener.ts
"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";

export function usePermissionsListener() {
  const { data: session, update } = useSession();

  useEffect(() => {
    // Listen for WebSocket messages
    const ws = new WebSocket(process.env.NEXT_PUBLIC_WS_URL);

    ws.onmessage = async (event) => {
      const message = JSON.parse(event.data);

      if (message.type === "ROLE_CHANGED") {
        // Refresh session to get new permissions
        await update();
      }

      if (message.type === "PERMISSION_CHANGED") {
        // Refresh specific resource permissions
        await update();
      }
    };

    return () => ws.close();
  }, [update]);
}
```

---

## 6. Implementation Examples

### Complete Permission Service

```typescript
// lib/auth/permission-service.ts
interface PermissionServiceConfig {
  cacheEnabled: boolean;
  cacheTTL: number;
  auditEnabled: boolean;
}

class PermissionService {
  private config: PermissionServiceConfig;
  private cache: Map<string, { permissions: string[]; expiry: number }>;

  constructor(
    config: PermissionServiceConfig = {
      cacheEnabled: true,
      cacheTTL: 60000, // 1 minute
      auditEnabled: true,
    },
  ) {
    this.config = config;
    this.cache = new Map();
  }

  async getPermissions(userId: string): Promise<string[]> {
    // Check cache
    if (this.config.cacheEnabled) {
      const cached = this.cache.get(userId);
      if (cached && cached.expiry > Date.now()) {
        return cached.permissions;
      }
    }

    // Fetch from database
    const user = await db.getUser(userId);
    const permissions = this.flattenPermissions(user.role);

    // Update cache
    if (this.config.cacheEnabled) {
      this.cache.set(userId, {
        permissions,
        expiry: Date.now() + this.config.cacheTTL,
      });
    }

    return permissions;
  }

  async hasPermission(
    userId: string,
    permission: string,
    resourceContext?: ResourceContext,
  ): Promise<boolean> {
    const permissions = await this.getPermissions(userId);

    // Wildcard check
    if (this.matchWildcard(permissions, permission)) {
      // Log access if audit enabled
      if (this.config.auditEnabled) {
        await this.auditAccess(userId, permission, resourceContext);
      }
      return true;
    }

    return false;
  }

  async invalidateCache(userId: string) {
    this.cache.delete(userId);
  }

  private flattenPermissions(role: string): string[] {
    // Implementation from RBAC document
    return flattenRoleHierarchy(role);
  }

  private matchWildcard(permissions: string[], target: string): boolean {
    if (permissions.includes("*:*")) return true;

    const [targetResource, targetAction] = target.split(":");
    if (permissions.includes(`${targetResource}:*`)) return true;
    if (permissions.includes(`*:${targetAction}`)) return true;

    return permissions.includes(target);
  }

  private async auditAccess(
    userId: string,
    permission: string,
    context?: ResourceContext,
  ) {
    await db.auditLog.create({
      userId,
      action: "CHECK_PERMISSION",
      permission,
      resourceType: context?.resourceType,
      resourceId: context?.resourceId,
      timestamp: new Date(),
    });
  }
}

export const permissionService = new PermissionService();
```

### Express Route Integration

```typescript
// middleware/permission-check.ts
import { permissionService } from "./permission-service";

export function requirePermission(permission: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const resourceContext: ResourceContext | undefined = req.resource
      ? {
          resourceType: req.resource.type,
          resourceId: req.resource.id,
          ownerId: req.resource.ownerId,
        }
      : undefined;

    const hasPermission = await permissionService.hasPermission(
      userId,
      permission,
      resourceContext,
    );

    if (!hasPermission) {
      return res.status(403).json({
        error: "Forbidden",
        requiredPermission: permission,
      });
    }

    next();
  };
}

export function requireAnyPermission(permissions: string[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    for (const permission of permissions) {
      if (await permissionService.hasPermission(userId, permission)) {
        return next();
      }
    }

    return res.status(403).json({
      error: "Forbidden",
      requiredPermissions: permissions,
    });
  };
}

export function requireAllPermissions(permissions: string[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    for (const permission of permissions) {
      if (!(await permissionService.hasPermission(userId, permission))) {
        return res.status(403).json({
          error: "Forbidden",
          missingPermission: permission,
        });
      }
    }

    next();
  };
}
```

---

## OWASP References

- [Access Control Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Access_Control_Cheat_Sheet.html)
- [Authorization Decision Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Outcomes_Cheat_Sheet.html)

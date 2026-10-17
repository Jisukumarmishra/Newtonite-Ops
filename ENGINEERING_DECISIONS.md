# Engineering Decisions — Newtonite Ops

This document explains the key engineering decisions made when building the "Operations Under Pressure" application for the Newtonite Software Engineering Challenge.

---

## Architecture Overview

```
client/ (React + Vite)        ←→        src/ (Express.js API)        ←→        PostgreSQL (Prisma ORM)
     │                                       │
     ├── pages/                              ├── routes/          → URL mapping
     ├── components/                         ├── controllers/     → Request/response
     ├── api/                                ├── services/        → Business logic
     └── context/                            ├── middleware/      → Auth, authz, validation
                                             ├── db/              → Prisma client
                                             └── utils/           → Errors, validators
```

## Key Decisions

### 1. Optimistic Locking with Version Numbers

**Decision:** Every `WorkItem` has a `version` integer field that starts at 1 and increments on every write. Clients must send the current `version` with every update request.

**Why:** In a multi-user operations dashboard, multiple team members may view and act on the same work item simultaneously. Without optimistic locking, the last writer silently overwrites everyone else's changes. By checking `version`, we detect stale updates and return HTTP 409 Conflict.

**How it works:**
1. Client fetches work item (gets `version: 3`)
2. Client sends `PATCH /api/work-items/:id` with `{ title: "New title", version: 3 }`
3. Server checks: is the database version still 3?
   - **Yes** → update succeeds, version becomes 4
   - **No** → another user updated first, return 409

**Alternative considered:** Timestamp-based locking (check `updatedAt`). Rejected because integer versions are simpler, have no clock-skew issues, and are easier to display to users.

### 2. Concurrent Claiming with Atomic SQL

**Decision:** The `POST /work-items/:id/claim` endpoint uses a raw SQL `UPDATE ... WHERE assigned_to_id IS NULL AND version = ?` within a transaction to ensure only one user can claim an item.

**Why:** Prisma's standard `update()` method performs a separate `SELECT` then `UPDATE`, which creates a race condition window. By using a conditional `UPDATE` in raw SQL, the database enforces atomicity at the row level — if two claims arrive simultaneously, only the first to execute the `UPDATE` will match the `WHERE` clause.

**Alternative considered:** Pessimistic locking (`SELECT ... FOR UPDATE`). This would also work but adds contention and deadlock risk. The conditional update pattern is simpler and equally correct.

### 3. Idempotency Keys

**Decision:** Clients can include an optional `idempotencyKey` string when creating work items. If a work item with that key already exists, the existing item is returned (HTTP 200) instead of creating a duplicate (HTTP 201).

**Why:** Network failures and retries are common in operations scenarios. An operator clicking "Create" during a network hiccup shouldn't create duplicate incidents. The `idempotencyKey` is stored as a unique-indexed column on the `work_items` table.

**Trade-off:** The key is scoped globally (not per-user). This is simpler but means different users sharing a key would conflict. In practice, clients generate UUID keys per request, so this doesn't occur.

### 4. Workflow State Machine

**Decision:** Status transitions follow a strict state machine enforced server-side:

```
OPEN → IN_PROGRESS → AWAITING_APPROVAL → RESOLVED → CLOSED
  ↑         ↓               ↓                ↓         |
  └─────────┘               └──→ IN_PROGRESS ←──┘      |
  |                                                     |
  └─────────────────────────────────────────────────────┘
```

**Why:** In operations, workflow integrity matters. An item shouldn't jump from OPEN to CLOSED without going through the review process. The `VALID_TRANSITIONS` map in `workItemService.js` is the single source of truth.

**Lead-controlled approval:** Only users with LEAD or ADMIN role can transition from `AWAITING_APPROVAL` to `RESOLVED`. This ensures a senior team member reviews completed work before it's marked resolved.

### 5. Team-Based Authorization (RBAC)

**Decision:** Four roles (VIEWER, MEMBER, LEAD, ADMIN) with a numeric hierarchy. Authorization is checked via middleware (`requireTeamRole`) that queries the `team_members` join table.

**Role permissions:**
| Action | VIEWER | MEMBER | LEAD | ADMIN |
|---|---|---|---|---|
| View work items | ✅ | ✅ | ✅ | ✅ |
| Create/edit work items | ❌ | ✅ | ✅ | ✅ |
| Approve/reject items | ❌ | ❌ | ✅ | ✅ |
| Manage team members | ❌ | ❌ | ❌ | ✅ |

**Why:** Operations teams have clear role hierarchies. Viewers (e.g., stakeholders) should see but not modify. Members do the work. Leads approve. Admins manage the team. This maps directly to real operations workflows.

### 6. Transactional Activity Logging

**Decision:** Every state change (status, assignment, priority) is recorded in the `activities` table within the **same database transaction** as the work item update.

**Why:** If we logged activities in a separate request or after the commit, a crash between the update and the log would leave an incomplete audit trail. By using `prisma.$transaction()`, either both the update and the log succeed, or neither does.

### 7. Validation with Zod

**Decision:** All request bodies are validated using Zod schemas in a `validate()` middleware, which runs before the controller.

**Why:** Zod provides type coercion (e.g., string → number for pagination params), detailed error messages with field paths, and is composable. Compared to Joi or express-validator, Zod is more lightweight and has better TypeScript interop if we migrate later.

### 8. Prisma ORM

**Decision:** Use Prisma as the ORM with raw SQL only for the concurrent claim operation.

**Why:** Prisma's declarative schema, automatic migrations, type-safe queries, and relation handling dramatically reduce boilerplate. The one place we use raw SQL (claiming) is clearly documented as a concurrency-safety requirement that Prisma's abstraction doesn't cover.

### 9. Password Hashing with bcryptjs

**Decision:** Use `bcryptjs` with 12 salt rounds.

**Why:** bcrypt is a time-tested adaptive hash function designed for passwords. 12 rounds provides good security without noticeable login delay (~250ms). We use `bcryptjs` (pure JS) over `bcrypt` (native) to avoid native compilation issues on Windows.

### 10. JWT Authentication

**Decision:** Stateless JWT tokens stored in the client's `localStorage`, sent as `Authorization: Bearer <token>`.

**Why:** Stateless tokens avoid server-side session storage and work well with REST APIs. The token contains `{ id, email, displayName }` and expires based on `JWT_EXPIRES_IN` (default 24h).

**Trade-off:** JWTs can't be revoked without a blocklist. For this challenge scope, token expiration is sufficient.

### 11. Folder Structure

**Decision:** Layered architecture separating routes → controllers → services → database access.

```
src/
├── config/          # Environment variable loading
├── controllers/     # HTTP request/response handling
├── db/              # Prisma client singleton
├── middleware/       # Auth, authorization, validation, error handling
├── routes/          # Express route definitions
├── services/        # Business logic (pure functions operating on data)
└── utils/           # Error classes, validators
```

**Why:** This separation keeps each layer focused on one concern:
- **Routes** define URL patterns and wire middleware
- **Controllers** parse request data and format responses
- **Services** contain business logic and database operations
- **Middleware** handles cross-cutting concerns

This makes the code easy to test, modify, and explain.

### 12. Error Handling Strategy

**Decision:** Custom `AppError` class hierarchy mapping to HTTP status codes, caught by a global error handler middleware.

**Why:** Instead of scattered `res.status(400).json(...)` calls throughout the codebase, services throw typed errors (`BadRequestError`, `ConflictError`, etc.) and the global handler translates them. This produces consistent error response formats and centralizes error handling logic.

---

## Trade-offs and Limitations

1. **No real-time updates:** The dashboard uses polling/manual refresh. WebSockets or SSE would provide live updates but add complexity beyond the challenge scope.

2. **No file attachments:** Work items support text only. Adding file uploads would require a storage service (S3, etc.).

3. **Global idempotency keys:** Keys are not scoped per-user. This is simpler but technically allows cross-user key collisions.

4. **No soft deletes:** Deleted comments and removed team members are hard-deleted. A production system might use soft deletes for audit purposes.

5. **In-memory rate limiting:** Using `express-rate-limit` with default in-memory store. A production deployment with multiple instances would need Redis-backed rate limiting.

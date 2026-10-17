# Newtonite Ops — Operations Under Pressure

A full-stack operations management dashboard built for the Newtonite Software Engineering Challenge. Teams can track, assign, and resolve work items through a structured workflow with role-based access control.

# For JWT Token Generations

node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

## Features

- **JWT Authentication** — Secure login with bcrypt password hashing
- **Team-Based RBAC** — Viewer, Member, Lead, and Admin roles with server-enforced permissions
- **Work Item CRUD** — Create, read, update, search, and paginate work items
- **Workflow Engine** — Open → In Progress → Awaiting Approval → Resolved → Closed
- **Lead-Controlled Approval** — Only Leads/Admins can approve work items
- **Concurrent Claiming** — Atomic database operations ensure only one user claims an item
- **Optimistic Locking** — Version-based conflict detection returns HTTP 409 on stale updates
- **Idempotency** — Duplicate-safe creation using client-provided idempotency keys
- **Activity History** — Full audit trail recorded in the same transaction as each change
- **Comments** — Threaded comments on work items
- **Filtering & Pagination** — Server-side search, filter by status/priority, sort, paginate

## Tech Stack

| Layer      | Technology                          |
| ---------- | ----------------------------------- |
| Frontend   | React 18, Vite, React Router, Axios |
| Backend    | Node.js, Express.js                 |
| Database   | PostgreSQL                          |
| ORM        | Prisma                              |
| Auth       | JWT (jsonwebtoken), bcryptjs        |
| Validation | Zod                                 |
| Testing    | Jest, Supertest                     |

## Project Structure

```
newtonite-ops/
├── client/                    # React frontend
│   ├── src/
│   │   ├── api/               # API client layer
│   │   ├── components/        # Reusable UI components
│   │   ├── context/           # Auth context provider
│   │   └── pages/             # Page components
│   └── vite.config.js
├── prisma/
│   ├── schema.prisma          # Database schema
│   └── seed.js                # Demo data seeder
├── src/                       # Express backend
│   ├── config/                # Environment config
│   ├── controllers/           # Request handlers
│   ├── db/                    # Prisma client
│   ├── middleware/            # Auth, RBAC, validation, errors
│   ├── routes/                # API route definitions
│   ├── services/              # Business logic
│   └── utils/                 # Error classes, validators
├── tests/                     # Automated tests
├── ENGINEERING_DECISIONS.md   # Architecture rationale
└── README.md
```

## Prerequisites

- **Node.js** 18+
- **PostgreSQL** 14+
- **npm** 9+

## Setup Instructions

### 1. Clone and install dependencies

```bash
git clone <repository-url>
cd newtonite-ops
npm install
cd client && npm install && cd ..
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env` with your PostgreSQL credentials:

```env
DATABASE_URL="postgresql://username:password@localhost:5432/newtonite_ops?schema=public"
JWT_SECRET="your-secure-random-secret-key"
```

### 3. Create the database

```bash
# Connect to PostgreSQL and create the database
psql -U postgres -c "CREATE DATABASE newtonite_ops;"
```

### 4. Run database migrations

```bash
npx prisma migrate dev --name init
```

### 5. Generate Prisma client

```bash
npx prisma generate
```

### 6. Seed demo data

```bash
npm run db:seed
```

This creates:

- **5 demo users** (all with password `password123`):
  - `alice@newtonite.com` — Operations Admin
  - `bob@newtonite.com` — Operations Lead, Development Admin
  - `carol@newtonite.com` — Operations Member, Development Lead
  - `dave@newtonite.com` — Operations Member, Development Member
  - `eve@newtonite.com` — Operations Viewer
- **2 teams** — Operations, Development
- **7 sample work items** across different statuses
- **Sample comments** and activity logs

### 7. Start the application

```bash
# Terminal 1: Start the backend
npm start
# or for development with auto-reload:
npm run dev

# Terminal 2: Start the frontend
cd client
npm run dev
```

The API runs at `http://localhost:3000` and the frontend at `http://localhost:5173`.

### 8. Run tests

```bash
npm test
```

> **Note:** Tests require a running PostgreSQL database. See "Test Database Setup" below.

## Test Database Setup

For running tests, create a separate test database:

```bash
psql -U postgres -c "CREATE DATABASE newtonite_ops_test;"
```

Create a `.env.test` file (or set environment variables):

```env
DATABASE_URL="postgresql://username:password@localhost:5432/newtonite_ops_test?schema=public"
JWT_SECRET="test-secret"
NODE_ENV=test
```

Then run migrations against the test database:

```bash
DATABASE_URL="postgresql://username:password@localhost:5432/newtonite_ops_test?schema=public" npx prisma migrate deploy
```

## API Reference

### Authentication

| Method | Endpoint             | Description              | Auth |
| ------ | -------------------- | ------------------------ | ---- |
| POST   | `/api/auth/register` | Register new user        | No   |
| POST   | `/api/auth/login`    | Login                    | No   |
| GET    | `/api/auth/profile`  | Get current user profile | Yes  |

### Teams

| Method | Endpoint                              | Description       | Min Role |
| ------ | ------------------------------------- | ----------------- | -------- |
| GET    | `/api/teams`                          | List user's teams | Auth     |
| POST   | `/api/teams`                          | Create a team     | Auth     |
| GET    | `/api/teams/:teamId`                  | Get team details  | VIEWER   |
| POST   | `/api/teams/:teamId/members`          | Add member        | ADMIN    |
| PATCH  | `/api/teams/:teamId/members/:id/role` | Update role       | ADMIN    |
| DELETE | `/api/teams/:teamId/members/:id`      | Remove member     | ADMIN    |

### Work Items

| Method | Endpoint                         | Description        | Min Role |
| ------ | -------------------------------- | ------------------ | -------- |
| GET    | `/api/teams/:teamId/work-items`  | List/search/filter | VIEWER   |
| POST   | `/api/teams/:teamId/work-items`  | Create work item   | MEMBER   |
| GET    | `/api/work-items/:id`            | Get details        | VIEWER   |
| PATCH  | `/api/work-items/:id`            | Update fields      | MEMBER   |
| POST   | `/api/work-items/:id/transition` | Change status      | MEMBER\* |
| POST   | `/api/work-items/:id/claim`      | Claim unassigned   | MEMBER   |
| POST   | `/api/work-items/:id/unassign`   | Unassign           | LEAD     |
| GET    | `/api/work-items/:id/activities` | Activity history   | VIEWER   |

\* _Approving items (AWAITING_APPROVAL → RESOLVED) requires LEAD role_

### Comments

| Method | Endpoint                            | Description    | Min Role    |
| ------ | ----------------------------------- | -------------- | ----------- |
| POST   | `/api/work-items/:id/comments`      | Add comment    | VIEWER      |
| GET    | `/api/work-items/:id/comments`      | List comments  | VIEWER      |
| PATCH  | `/api/work-items/:id/comments/:cid` | Edit comment   | Author      |
| DELETE | `/api/work-items/:id/comments/:cid` | Delete comment | Author/LEAD |

## Workflow Rules

```
┌──────┐     ┌─────────────┐     ┌────────────────────┐     ┌──────────┐     ┌────────┐
│ OPEN │────→│ IN_PROGRESS │────→│ AWAITING_APPROVAL  │────→│ RESOLVED │────→│ CLOSED │
└──────┘     └─────────────┘     └────────────────────┘     └──────────┘     └────────┘
   ↑               │                       │                      │              │
   └───────────────┘                       │                      │              │
   │                                       └──→ IN_PROGRESS ←────┘              │
   │                                                                             │
   └─────────────────────────────────────────────────────────────────────────────┘
```

- Any MEMBER can move OPEN → IN_PROGRESS
- Any MEMBER can submit for review: IN_PROGRESS → AWAITING_APPROVAL
- **Only LEAD/ADMIN** can approve: AWAITING_APPROVAL → RESOLVED
- **Only LEAD/ADMIN** can reject back: AWAITING_APPROVAL → IN_PROGRESS
- Any MEMBER can close resolved items: RESOLVED → CLOSED
- Items can be reopened: CLOSED → OPEN

## Useful Commands

```bash
# Development
npm run dev                     # Start backend with hot-reload
cd client && npm run dev        # Start frontend dev server

# Database
npm run db:migrate              # Run migrations (dev)
npm run db:migrate:prod         # Run migrations (production)
npm run db:seed                 # Seed demo data
npm run db:reset                # Reset database (destructive!)
npm run db:studio               # Open Prisma Studio (visual DB browser)
npm run db:generate             # Regenerate Prisma client

# Testing
npm test                        # Run all tests
npm run test:watch              # Watch mode
npm run test:coverage           # Coverage report
```

## License

This project was built for the Newtonite Software Engineering Challenge.

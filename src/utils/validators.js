const { z } = require('zod');

// ─── Auth Schemas ────────────────────────────────────────────────────────────

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  displayName: z.string().min(1, 'Display name is required').max(100),
});

// ─── Team Schemas ────────────────────────────────────────────────────────────

const createTeamSchema = z.object({
  name: z.string().min(1, 'Team name is required').max(100),
  description: z.string().max(500).optional(),
});

const addTeamMemberSchema = z.object({
  userId: z.string().uuid('Invalid user ID'),
  role: z.enum(['VIEWER', 'MEMBER', 'LEAD', 'ADMIN']).default('MEMBER'),
});

const updateTeamMemberRoleSchema = z.object({
  role: z.enum(['VIEWER', 'MEMBER', 'LEAD', 'ADMIN']),
});

// ─── Work Item Schemas ───────────────────────────────────────────────────────

const createWorkItemSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  description: z.string().max(5000).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).default('MEDIUM'),
  teamId: z.string().uuid('Invalid team ID'),
  idempotencyKey: z.string().max(255).optional(),
});

const updateWorkItemSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(5000).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
  version: z.number().int().positive('Version must be a positive integer'),
});

const transitionWorkItemSchema = z.object({
  status: z.enum(['OPEN', 'IN_PROGRESS', 'AWAITING_APPROVAL', 'RESOLVED', 'CLOSED']),
  version: z.number().int().positive('Version must be a positive integer'),
});

const claimWorkItemSchema = z.object({
  version: z.number().int().positive('Version must be a positive integer'),
});

const workItemQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  status: z.enum(['OPEN', 'IN_PROGRESS', 'AWAITING_APPROVAL', 'RESOLVED', 'CLOSED']).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
  assignedToId: z.string().uuid().optional(),
  search: z.string().max(200).optional(),
  sortBy: z.enum(['createdAt', 'updatedAt', 'priority', 'status', 'title']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

// ─── Comment Schemas ─────────────────────────────────────────────────────────

const createCommentSchema = z.object({
  content: z.string().min(1, 'Comment content is required').max(2000),
});

const updateCommentSchema = z.object({
  content: z.string().min(1, 'Comment content is required').max(2000),
});

module.exports = {
  loginSchema,
  registerSchema,
  createTeamSchema,
  addTeamMemberSchema,
  updateTeamMemberRoleSchema,
  createWorkItemSchema,
  updateWorkItemSchema,
  transitionWorkItemSchema,
  claimWorkItemSchema,
  workItemQuerySchema,
  createCommentSchema,
  updateCommentSchema,
};

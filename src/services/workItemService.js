const prisma = require('../db/prisma');
const {
  NotFoundError,
  ConflictError,
  BadRequestError,
  ForbiddenError,
} = require('../utils/errors');

// ─── Workflow Transition Rules ───────────────────────────────────────────────

/**
 * Valid status transitions.
 * Key = current status, Value = array of allowed next statuses.
 */
const VALID_TRANSITIONS = {
  OPEN: ['IN_PROGRESS'],
  IN_PROGRESS: ['AWAITING_APPROVAL', 'OPEN'],
  AWAITING_APPROVAL: ['RESOLVED', 'IN_PROGRESS'],
  RESOLVED: ['CLOSED', 'IN_PROGRESS'],
  CLOSED: ['OPEN'], // Reopen
};

/**
 * Transitions that require LEAD or ADMIN role.
 */
const LEAD_REQUIRED_TRANSITIONS = [
  { from: 'AWAITING_APPROVAL', to: 'RESOLVED' },
  { from: 'AWAITING_APPROVAL', to: 'IN_PROGRESS' }, // Rejection back to in-progress
];

// ─── Create Work Item ────────────────────────────────────────────────────────

async function createWorkItem({ title, description, priority, teamId, idempotencyKey }, userId) {
  // Idempotency check: if key already used, return existing item
  if (idempotencyKey) {
    const existing = await prisma.workItem.findUnique({
      where: { idempotencyKey },
      include: {
        createdBy: { select: { id: true, email: true, displayName: true } },
        assignedTo: { select: { id: true, email: true, displayName: true } },
        team: { select: { id: true, name: true } },
      },
    });
    if (existing) {
      return { workItem: existing, wasIdempotent: true };
    }
  }

  // Create work item + activity log in a single transaction
  const workItem = await prisma.$transaction(async (tx) => {
    const item = await tx.workItem.create({
      data: {
        title,
        description,
        priority,
        teamId,
        createdById: userId,
        idempotencyKey: idempotencyKey || undefined,
      },
      include: {
        createdBy: { select: { id: true, email: true, displayName: true } },
        assignedTo: { select: { id: true, email: true, displayName: true } },
        team: { select: { id: true, name: true } },
      },
    });

    // Record creation activity
    await tx.activity.create({
      data: {
        action: 'CREATED',
        workItemId: item.id,
        performedById: userId,
        newValue: JSON.stringify({ title, priority, status: 'OPEN' }),
      },
    });

    return item;
  });

  return { workItem, wasIdempotent: false };
}

// ─── Get Work Item by ID ─────────────────────────────────────────────────────

async function getWorkItemById(workItemId) {
  const workItem = await prisma.workItem.findUnique({
    where: { id: workItemId },
    include: {
      createdBy: { select: { id: true, email: true, displayName: true } },
      assignedTo: { select: { id: true, email: true, displayName: true } },
      team: { select: { id: true, name: true } },
      comments: {
        include: {
          author: { select: { id: true, email: true, displayName: true } },
        },
        orderBy: { createdAt: 'asc' },
      },
      activities: {
        include: {
          performedBy: { select: { id: true, email: true, displayName: true } },
        },
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  if (!workItem) {
    throw new NotFoundError('Work item not found');
  }

  return workItem;
}

// ─── List Work Items (with filtering, search, pagination) ────────────────────

async function listWorkItems(teamId, query) {
  const { page, limit, status, priority, assignedToId, search, sortBy, sortOrder } = query;

  const where = { teamId };

  if (status) where.status = status;
  if (priority) where.priority = priority;
  if (assignedToId) where.assignedToId = assignedToId;
  if (search) {
    where.OR = [
      { title: { contains: search, mode: 'insensitive' } },
      { description: { contains: search, mode: 'insensitive' } },
    ];
  }

  const skip = (page - 1) * limit;

  const [items, total] = await Promise.all([
    prisma.workItem.findMany({
      where,
      include: {
        createdBy: { select: { id: true, email: true, displayName: true } },
        assignedTo: { select: { id: true, email: true, displayName: true } },
      },
      orderBy: { [sortBy]: sortOrder },
      skip,
      take: limit,
    }),
    prisma.workItem.count({ where }),
  ]);

  return {
    items,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

// ─── Update Work Item (with optimistic locking) ──────────────────────────────

async function updateWorkItem(workItemId, { title, description, priority, version }, userId) {
  const result = await prisma.$transaction(async (tx) => {
    // Fetch current item
    const current = await tx.workItem.findUnique({ where: { id: workItemId } });
    if (!current) throw new NotFoundError('Work item not found');

    // Optimistic locking check
    if (current.version !== version) {
      throw new ConflictError(
        'This work item has been modified by another user. Please refresh and try again.',
        { currentVersion: current.version, yourVersion: version }
      );
    }

    // Build update data and activity records
    const updateData = { version: { increment: 1 } };
    const activities = [];

    if (title !== undefined && title !== current.title) {
      updateData.title = title;
      activities.push({
        action: 'UPDATED',
        field: 'title',
        oldValue: current.title,
        newValue: title,
        workItemId,
        performedById: userId,
      });
    }

    if (description !== undefined && description !== current.description) {
      updateData.description = description;
      activities.push({
        action: 'UPDATED',
        field: 'description',
        oldValue: current.description || '',
        newValue: description,
        workItemId,
        performedById: userId,
      });
    }

    if (priority !== undefined && priority !== current.priority) {
      activities.push({
        action: 'PRIORITY_CHANGE',
        field: 'priority',
        oldValue: current.priority,
        newValue: priority,
        workItemId,
        performedById: userId,
      });
      updateData.priority = priority;
    }

    const updated = await tx.workItem.update({
      where: { id: workItemId },
      data: updateData,
      include: {
        createdBy: { select: { id: true, email: true, displayName: true } },
        assignedTo: { select: { id: true, email: true, displayName: true } },
        team: { select: { id: true, name: true } },
      },
    });

    // Create activity records in the same transaction
    if (activities.length > 0) {
      await tx.activity.createMany({ data: activities });
    }

    return updated;
  });

  return result;
}

// ─── Transition Status (workflow enforcement) ────────────────────────────────

async function transitionStatus(workItemId, { status: newStatus, version }, userId, userRole) {
  const result = await prisma.$transaction(async (tx) => {
    const current = await tx.workItem.findUnique({ where: { id: workItemId } });
    if (!current) throw new NotFoundError('Work item not found');

    // Optimistic locking check
    if (current.version !== version) {
      throw new ConflictError(
        'This work item has been modified by another user. Please refresh and try again.',
        { currentVersion: current.version, yourVersion: version }
      );
    }

    // Check valid transition
    const allowedTransitions = VALID_TRANSITIONS[current.status];
    if (!allowedTransitions || !allowedTransitions.includes(newStatus)) {
      throw new BadRequestError(
        `Invalid transition: ${current.status} → ${newStatus}. ` +
        `Allowed transitions from ${current.status}: ${(allowedTransitions || []).join(', ')}`
      );
    }

    // Check if this transition requires Lead/Admin role
    const requiresLead = LEAD_REQUIRED_TRANSITIONS.some(
      (t) => t.from === current.status && t.to === newStatus
    );
    if (requiresLead && userRole !== 'LEAD' && userRole !== 'ADMIN') {
      throw new ForbiddenError(
        'Only team Leads and Admins can approve or reject items'
      );
    }

    const updated = await tx.workItem.update({
      where: { id: workItemId },
      data: {
        status: newStatus,
        version: { increment: 1 },
      },
      include: {
        createdBy: { select: { id: true, email: true, displayName: true } },
        assignedTo: { select: { id: true, email: true, displayName: true } },
        team: { select: { id: true, name: true } },
      },
    });

    // Record status change activity
    await tx.activity.create({
      data: {
        action: 'STATUS_CHANGE',
        field: 'status',
        oldValue: current.status,
        newValue: newStatus,
        workItemId,
        performedById: userId,
      },
    });

    return updated;
  });

  return result;
}

// ─── Claim Work Item (concurrent-safe) ───────────────────────────────────────

async function claimWorkItem(workItemId, { version }, userId) {
  const result = await prisma.$transaction(async (tx) => {
    // Use a SELECT ... FOR UPDATE equivalent via raw query for true row-level locking
    // Prisma doesn't support FOR UPDATE directly, so we use a conditional update pattern
    const current = await tx.workItem.findUnique({ where: { id: workItemId } });
    if (!current) throw new NotFoundError('Work item not found');

    // Optimistic locking check
    if (current.version !== version) {
      throw new ConflictError(
        'This work item has been modified by another user. Please refresh and try again.',
        { currentVersion: current.version, yourVersion: version }
      );
    }

    // Ensure item is not already assigned
    if (current.assignedToId) {
      throw new ConflictError(
        'This work item has already been claimed by another user'
      );
    }

    // Conditional atomic update: only update if still unassigned AND version matches
    // This ensures concurrent claims are serialized by the database
    const updateResult = await tx.$executeRaw`
      UPDATE work_items 
      SET assigned_to_id = ${userId}::uuid, 
          version = version + 1,
          updated_at = NOW()
      WHERE id = ${workItemId}::uuid 
        AND assigned_to_id IS NULL 
        AND version = ${version}
    `;

    if (updateResult === 0) {
      throw new ConflictError(
        'Failed to claim work item. It may have been claimed by another user.'
      );
    }

    // Fetch the updated item
    const updated = await tx.workItem.findUnique({
      where: { id: workItemId },
      include: {
        createdBy: { select: { id: true, email: true, displayName: true } },
        assignedTo: { select: { id: true, email: true, displayName: true } },
        team: { select: { id: true, name: true } },
      },
    });

    // Record assignment activity
    await tx.activity.create({
      data: {
        action: 'ASSIGNMENT_CHANGE',
        field: 'assignedTo',
        oldValue: null,
        newValue: userId,
        workItemId,
        performedById: userId,
      },
    });

    return updated;
  });

  return result;
}

// ─── Unassign Work Item ──────────────────────────────────────────────────────

async function unassignWorkItem(workItemId, { version }, userId) {
  const result = await prisma.$transaction(async (tx) => {
    const current = await tx.workItem.findUnique({ where: { id: workItemId } });
    if (!current) throw new NotFoundError('Work item not found');

    if (current.version !== version) {
      throw new ConflictError(
        'This work item has been modified by another user. Please refresh and try again.',
        { currentVersion: current.version, yourVersion: version }
      );
    }

    const oldAssignee = current.assignedToId;

    const updated = await tx.workItem.update({
      where: { id: workItemId },
      data: {
        assignedToId: null,
        version: { increment: 1 },
      },
      include: {
        createdBy: { select: { id: true, email: true, displayName: true } },
        assignedTo: { select: { id: true, email: true, displayName: true } },
        team: { select: { id: true, name: true } },
      },
    });

    await tx.activity.create({
      data: {
        action: 'ASSIGNMENT_CHANGE',
        field: 'assignedTo',
        oldValue: oldAssignee,
        newValue: null,
        workItemId,
        performedById: userId,
      },
    });

    return updated;
  });

  return result;
}

// ─── Get Activity History ────────────────────────────────────────────────────

async function getActivityHistory(workItemId) {
  const activities = await prisma.activity.findMany({
    where: { workItemId },
    include: {
      performedBy: { select: { id: true, email: true, displayName: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  return activities;
}

module.exports = {
  createWorkItem,
  getWorkItemById,
  listWorkItems,
  updateWorkItem,
  transitionStatus,
  claimWorkItem,
  unassignWorkItem,
  getActivityHistory,
  VALID_TRANSITIONS,
};

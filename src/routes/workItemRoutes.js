const express = require('express');
const router = express.Router();
const workItemController = require('../controllers/workItemController');
const commentController = require('../controllers/commentController');
const { authenticate } = require('../middleware/auth');
const { requireTeamRole, requireWorkItemTeamRole } = require('../middleware/authorize');
const { validate } = require('../middleware/validate');
const {
  createWorkItemSchema,
  updateWorkItemSchema,
  transitionWorkItemSchema,
  claimWorkItemSchema,
  workItemQuerySchema,
  createCommentSchema,
  updateCommentSchema,
} = require('../utils/validators');

// All work item routes require authentication
router.use(authenticate);

// ─── Team-scoped routes ──────────────────────────────────────────────────────

// GET /api/teams/:teamId/work-items - List work items for a team
router.get(
  '/teams/:teamId/work-items',
  requireTeamRole('VIEWER'),
  validate(workItemQuerySchema, 'query'),
  workItemController.listWorkItems
);

// POST /api/teams/:teamId/work-items - Create a work item in a team
// Note: teamId comes from body but we also have it in params
router.post(
  '/teams/:teamId/work-items',
  requireTeamRole('MEMBER'),
  validate(createWorkItemSchema),
  workItemController.createWorkItem
);

// ─── Work-item-scoped routes ─────────────────────────────────────────────────

// GET /api/work-items/:id - Get a single work item
router.get(
  '/work-items/:id',
  requireWorkItemTeamRole('VIEWER'),
  workItemController.getWorkItemById
);

// PATCH /api/work-items/:id - Update work item fields
router.patch(
  '/work-items/:id',
  requireWorkItemTeamRole('MEMBER'),
  validate(updateWorkItemSchema),
  workItemController.updateWorkItem
);

// POST /api/work-items/:id/transition - Change status (workflow)
router.post(
  '/work-items/:id/transition',
  requireWorkItemTeamRole('MEMBER'),
  validate(transitionWorkItemSchema),
  workItemController.transitionStatus
);

// POST /api/work-items/:id/claim - Claim an unassigned work item
router.post(
  '/work-items/:id/claim',
  requireWorkItemTeamRole('MEMBER'),
  validate(claimWorkItemSchema),
  workItemController.claimWorkItem
);

// POST /api/work-items/:id/unassign - Unassign a work item
router.post(
  '/work-items/:id/unassign',
  requireWorkItemTeamRole('LEAD'),
  workItemController.unassignWorkItem
);

// GET /api/work-items/:id/activities - Get activity history
router.get(
  '/work-items/:id/activities',
  requireWorkItemTeamRole('VIEWER'),
  workItemController.getActivityHistory
);

// ─── Comments on work items ─────────────────────────────────────────────────

// POST /api/work-items/:id/comments - Add a comment
router.post(
  '/work-items/:id/comments',
  requireWorkItemTeamRole('VIEWER'),
  validate(createCommentSchema),
  commentController.addComment
);

// GET /api/work-items/:id/comments - List comments
router.get(
  '/work-items/:id/comments',
  requireWorkItemTeamRole('VIEWER'),
  commentController.listComments
);

// PATCH /api/work-items/:id/comments/:commentId - Update a comment
router.patch(
  '/work-items/:id/comments/:commentId',
  requireWorkItemTeamRole('VIEWER'),
  validate(updateCommentSchema),
  commentController.updateComment
);

// DELETE /api/work-items/:id/comments/:commentId - Delete a comment
router.delete(
  '/work-items/:id/comments/:commentId',
  requireWorkItemTeamRole('VIEWER'),
  commentController.deleteComment
);

module.exports = router;

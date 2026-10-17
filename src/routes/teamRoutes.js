const express = require('express');
const router = express.Router();
const teamController = require('../controllers/teamController');
const { authenticate } = require('../middleware/auth');
const { requireTeamRole } = require('../middleware/authorize');
const { validate } = require('../middleware/validate');
const {
  createTeamSchema,
  addTeamMemberSchema,
  updateTeamMemberRoleSchema,
} = require('../utils/validators');

// All team routes require authentication
router.use(authenticate);

// GET /api/teams - List user's teams
router.get('/', teamController.getUserTeams);

// POST /api/teams - Create a new team
router.post('/', validate(createTeamSchema), teamController.createTeam);

// GET /api/teams/:teamId - Get team details
router.get('/:teamId', requireTeamRole('VIEWER'), teamController.getTeamById);

// POST /api/teams/:teamId/members - Add a member (Admin only)
router.post(
  '/:teamId/members',
  requireTeamRole('ADMIN'),
  validate(addTeamMemberSchema),
  teamController.addMember
);

// PATCH /api/teams/:teamId/members/:memberId/role - Update member role (Admin only)
router.patch(
  '/:teamId/members/:memberId/role',
  requireTeamRole('ADMIN'),
  validate(updateTeamMemberRoleSchema),
  teamController.updateMemberRole
);

// DELETE /api/teams/:teamId/members/:memberId - Remove member (Admin only)
router.delete(
  '/:teamId/members/:memberId',
  requireTeamRole('ADMIN'),
  teamController.removeMember
);

// GET /api/users - List all users (for adding to teams)
router.get('/users/list', teamController.listUsers);

module.exports = router;

const prisma = require('../db/prisma');
const { ForbiddenError, NotFoundError } = require('../utils/errors');

/**
 * Role hierarchy for permission checks.
 * Higher number = more permissions.
 */
const ROLE_HIERARCHY = {
  VIEWER: 1,
  MEMBER: 2,
  LEAD: 3,
  ADMIN: 4,
};

/**
 * Middleware factory: checks that the authenticated user has at least
 * the specified role in the team identified by req.params.teamId.
 *
 * @param {string} requiredRole - Minimum role needed (VIEWER, MEMBER, LEAD, ADMIN)
 */
function requireTeamRole(requiredRole) {
  return async (req, res, next) => {
    try {
      const teamId = req.params.teamId || req.body.teamId;

      if (!teamId) {
        return next(new ForbiddenError('Team ID is required for authorization'));
      }

      const membership = await prisma.teamMember.findUnique({
        where: {
          userId_teamId: {
            userId: req.user.id,
            teamId,
          },
        },
      });

      if (!membership) {
        return next(new ForbiddenError('You are not a member of this team'));
      }

      const userRoleLevel = ROLE_HIERARCHY[membership.role];
      const requiredLevel = ROLE_HIERARCHY[requiredRole];

      if (userRoleLevel < requiredLevel) {
        return next(
          new ForbiddenError(
            `Requires at least ${requiredRole} role. Your role: ${membership.role}`
          )
        );
      }

      // Attach membership info to request for downstream use
      req.teamMembership = membership;
      next();
    } catch (err) {
      next(err);
    }
  };
}

/**
 * Middleware: resolves the team from a work item and checks role.
 * Useful for routes like /work-items/:id where teamId isn't in params.
 */
function requireWorkItemTeamRole(requiredRole) {
  return async (req, res, next) => {
    try {
      const workItemId = req.params.id || req.params.workItemId;

      const workItem = await prisma.workItem.findUnique({
        where: { id: workItemId },
        select: { id: true, teamId: true },
      });

      if (!workItem) {
        return next(new NotFoundError('Work item not found'));
      }

      // Store resolved teamId for the role check
      req.params.teamId = workItem.teamId;
      req.workItemId = workItem.id;

      // Now delegate to the standard team role check
      return requireTeamRole(requiredRole)(req, res, next);
    } catch (err) {
      next(err);
    }
  };
}

module.exports = {
  requireTeamRole,
  requireWorkItemTeamRole,
  ROLE_HIERARCHY,
};

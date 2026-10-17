const prisma = require('../db/prisma');
const { NotFoundError, ConflictError, ForbiddenError } = require('../utils/errors');

/**
 * Create a new team. The creator becomes ADMIN automatically.
 */
async function createTeam({ name, description }, creatorId) {
  const team = await prisma.team.create({
    data: {
      name,
      description,
      members: {
        create: {
          userId: creatorId,
          role: 'ADMIN',
        },
      },
    },
    include: {
      members: {
        include: {
          user: {
            select: { id: true, email: true, displayName: true },
          },
        },
      },
    },
  });

  return team;
}

/**
 * Get all teams for the authenticated user.
 */
async function getUserTeams(userId) {
  const memberships = await prisma.teamMember.findMany({
    where: { userId },
    include: {
      team: {
        include: {
          _count: {
            select: { members: true, workItems: true },
          },
        },
      },
    },
  });

  return memberships.map((m) => ({
    ...m.team,
    role: m.role,
  }));
}

/**
 * Get a single team by ID with members.
 */
async function getTeamById(teamId) {
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    include: {
      members: {
        include: {
          user: {
            select: { id: true, email: true, displayName: true },
          },
        },
      },
      _count: {
        select: { workItems: true },
      },
    },
  });

  if (!team) {
    throw new NotFoundError('Team not found');
  }

  return team;
}

/**
 * Add a member to a team.
 */
async function addMember(teamId, { userId, role }) {
  // Check user exists
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new NotFoundError('User not found');
  }

  // Check not already a member
  const existing = await prisma.teamMember.findUnique({
    where: { userId_teamId: { userId, teamId } },
  });
  if (existing) {
    throw new ConflictError('User is already a member of this team');
  }

  const membership = await prisma.teamMember.create({
    data: { userId, teamId, role },
    include: {
      user: {
        select: { id: true, email: true, displayName: true },
      },
    },
  });

  return membership;
}

/**
 * Update a member's role.
 */
async function updateMemberRole(teamId, memberId, { role }) {
  const membership = await prisma.teamMember.findFirst({
    where: { id: memberId, teamId },
  });

  if (!membership) {
    throw new NotFoundError('Team membership not found');
  }

  const updated = await prisma.teamMember.update({
    where: { id: memberId },
    data: { role },
    include: {
      user: {
        select: { id: true, email: true, displayName: true },
      },
    },
  });

  return updated;
}

/**
 * Remove a member from a team.
 */
async function removeMember(teamId, memberId) {
  const membership = await prisma.teamMember.findFirst({
    where: { id: memberId, teamId },
  });

  if (!membership) {
    throw new NotFoundError('Team membership not found');
  }

  await prisma.teamMember.delete({ where: { id: memberId } });
}

/**
 * List all users (for admin adding members to teams).
 */
async function listUsers() {
  return prisma.user.findMany({
    select: {
      id: true,
      email: true,
      displayName: true,
    },
    orderBy: { displayName: 'asc' },
  });
}

module.exports = {
  createTeam,
  getUserTeams,
  getTeamById,
  addMember,
  updateMemberRole,
  removeMember,
  listUsers,
};

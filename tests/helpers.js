const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const config = require('../src/config');

/**
 * Generates a signed JWT token for testing.
 * Accepts either (userId, email, displayName) or an object (user).
 *
 * @param {string|Object} userId - User ID or User object
 * @param {string} [email] - User email
 * @param {string} [displayName] - User display name
 * @returns {string} JWT token
 */
function getAuthToken(userId, email, displayName) {
  let id, userEmail, userDisplayName;

  if (typeof userId === 'object' && userId !== null) {
    id = userId.id;
    userEmail = userId.email;
    userDisplayName = userId.displayName;
  } else {
    id = userId;
    userEmail = email || `user-${id}@example.com`;
    userDisplayName = displayName || 'Test User';
  }

  const secret = process.env.JWT_SECRET || config.jwt.secret;

  return jwt.sign(
    {
      id,
      email: userEmail,
      displayName: userDisplayName,
    },
    secret,
    { expiresIn: config.jwt.expiresIn || '24h' }
  );
}

/**
 * Creates a test user in the database with a bcrypt-hashed password.
 *
 * @param {import('@prisma/client').PrismaClient} prisma - Prisma client instance
 * @param {Object} [overrides] - Optional overrides for user fields
 * @returns {Promise<Object>} Created user record
 */
async function createTestUser(prisma, overrides = {}) {
  const uniqueSuffix = crypto.randomBytes(6).toString('hex');
  const defaultPassword = 'Password123!';
  const rawPassword = overrides.password || defaultPassword;
  const passwordHash = overrides.passwordHash || (await bcrypt.hash(rawPassword, 10));

  const { password, ...cleanOverrides } = overrides;

  return await prisma.user.create({
    data: {
      email: cleanOverrides.email || `test-${uniqueSuffix}@example.com`,
      displayName: cleanOverrides.displayName || `Test User ${uniqueSuffix}`,
      passwordHash,
      ...cleanOverrides,
    },
  });
}

/**
 * Creates a test team and automatically assigns the creator as ADMIN.
 *
 * @param {import('@prisma/client').PrismaClient} prisma - Prisma client instance
 * @param {string} creatorId - User ID of the creator
 * @param {Object} [overrides] - Optional overrides for team fields
 * @returns {Promise<Object>} Created team record with members
 */
async function createTestTeam(prisma, creatorId, overrides = {}) {
  const uniqueSuffix = crypto.randomBytes(6).toString('hex');
  const { name, description, ...rest } = overrides;

  return await prisma.team.create({
    data: {
      name: name || `Test Team ${uniqueSuffix}`,
      description: description !== undefined ? description : 'A test team description',
      members: {
        create: {
          userId: creatorId,
          role: 'ADMIN',
        },
      },
      ...rest,
    },
    include: {
      members: {
        include: {
          user: true,
        },
      },
    },
  });
}

/**
 * Adds a user to a team with a specific role.
 *
 * @param {import('@prisma/client').PrismaClient} prisma - Prisma client instance
 * @param {string} teamId - Team ID
 * @param {string} userId - User ID
 * @param {string} [role='MEMBER'] - Role ('VIEWER', 'MEMBER', 'LEAD', 'ADMIN')
 * @returns {Promise<Object>} Created team member record
 */
async function addTestTeamMember(prisma, teamId, userId, role = 'MEMBER') {
  return await prisma.teamMember.create({
    data: {
      teamId,
      userId,
      role,
    },
    include: {
      user: true,
      team: true,
    },
  });
}

/**
 * Creates a test work item in the database.
 *
 * @param {import('@prisma/client').PrismaClient} prisma - Prisma client instance
 * @param {string} teamId - Team ID
 * @param {string} creatorId - User ID of the creator
 * @param {Object} [overrides] - Optional overrides for work item fields
 * @returns {Promise<Object>} Created work item record
 */
async function createTestWorkItem(prisma, teamId, creatorId, overrides = {}) {
  const uniqueSuffix = crypto.randomBytes(6).toString('hex');

  return await prisma.workItem.create({
    data: {
      title: overrides.title || `Test Work Item ${uniqueSuffix}`,
      description: overrides.description !== undefined ? overrides.description : 'Test work item description',
      priority: overrides.priority || 'MEDIUM',
      status: overrides.status || 'OPEN',
      version: overrides.version !== undefined ? overrides.version : 1,
      idempotencyKey: overrides.idempotencyKey || null,
      assignedToId: overrides.assignedToId || null,
      teamId,
      createdById: creatorId,
      ...overrides,
    },
    include: {
      createdBy: true,
      assignedTo: true,
      team: true,
    },
  });
}

/**
 * Creates a test comment in the database.
 *
 * @param {import('@prisma/client').PrismaClient} prisma - Prisma client instance
 * @param {string} workItemId - Work item ID
 * @param {string} authorId - User ID of the comment author
 * @param {Object} [overrides] - Optional overrides for comment fields
 * @returns {Promise<Object>} Created comment record
 */
async function createTestComment(prisma, workItemId, authorId, overrides = {}) {
  return await prisma.comment.create({
    data: {
      content: overrides.content || 'This is a test comment',
      workItemId,
      authorId,
      ...overrides,
    },
    include: {
      author: true,
    },
  });
}

/**
 * Cleans up entities from the database in reverse foreign-key dependency order.
 *
 * @param {import('@prisma/client').PrismaClient} prisma - Prisma client instance
 */
async function cleanupDatabase(prisma) {
  try {
    await prisma.activity.deleteMany({});
    await prisma.comment.deleteMany({});
    await prisma.workItem.deleteMany({});
    await prisma.teamMember.deleteMany({});
    await prisma.team.deleteMany({});
    await prisma.user.deleteMany({});
  } catch (error) {
    console.error('Error cleaning up test database:', error.message);
  }
}

module.exports = {
  getAuthToken,
  createTestUser,
  createTestTeam,
  addTestTeamMember,
  createTestWorkItem,
  createTestComment,
  cleanupDatabase,
};

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../db/prisma');
const config = require('../config');
const { UnauthorizedError, ConflictError, NotFoundError } = require('../utils/errors');

const SALT_ROUNDS = 12;

/**
 * Register a new user.
 */
async function register({ email, password, displayName }) {
  // Check if email already exists
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new ConflictError('A user with this email already exists');
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      displayName,
    },
    select: {
      id: true,
      email: true,
      displayName: true,
      createdAt: true,
    },
  });

  const token = generateToken(user);

  return { user, token };
}

/**
 * Authenticate user and return JWT.
 */
async function login({ email, password }) {
  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      displayName: true,
      passwordHash: true,
    },
  });

  if (!user) {
    throw new UnauthorizedError('Invalid email or password');
  }

  const isValidPassword = await bcrypt.compare(password, user.passwordHash);
  if (!isValidPassword) {
    throw new UnauthorizedError('Invalid email or password');
  }

  const token = generateToken(user);

  return {
    user: {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
    },
    token,
  };
}

/**
 * Get user profile by ID.
 */
async function getProfile(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      displayName: true,
      createdAt: true,
      memberships: {
        select: {
          role: true,
          team: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
    },
  });

  if (!user) {
    throw new NotFoundError('User not found');
  }

  return user;
}

/**
 * Generate JWT token for a user.
 */
function generateToken(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
    },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn }
  );
}

module.exports = {
  register,
  login,
  getProfile,
  generateToken,
};

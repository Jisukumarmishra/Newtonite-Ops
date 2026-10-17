const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const jwt = require('jsonwebtoken');

// Ensure NODE_ENV is set to test
process.env.NODE_ENV = 'test';

// Load environment variables: prefer .env if present, otherwise .env.example
const rootDir = path.resolve(__dirname, '..');
const envPath = path.join(rootDir, '.env');
const envExamplePath = path.join(rootDir, '.env.example');

if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
} else if (fs.existsSync(envExamplePath)) {
  dotenv.config({ path: envExamplePath });
}

// Ensure JWT secret and config defaults for testing
const TEST_JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-key-for-newtonite-testing-super-secure';
process.env.JWT_SECRET = TEST_JWT_SECRET;
process.env.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

// Import prisma to allow cleanup on shutdown
const prisma = require('../src/db/prisma');

/**
 * Generate a JWT token for testing.
 * Accepts either an object payload or individual parameters.
 *
 * @param {Object|string} payloadOrUserId
 * @param {string} [email]
 * @param {string} [displayName]
 * @returns {string} Signed JWT token
 */
function generateTestToken(payloadOrUserId, email, displayName) {
  let payload;
  if (typeof payloadOrUserId === 'object' && payloadOrUserId !== null) {
    payload = {
      id: payloadOrUserId.id || 'test-user-id',
      email: payloadOrUserId.email || 'test@example.com',
      displayName: payloadOrUserId.displayName || 'Test User',
    };
  } else if (typeof payloadOrUserId === 'string') {
    payload = {
      id: payloadOrUserId,
      email: email || `user-${payloadOrUserId}@example.com`,
      displayName: displayName || 'Test User',
    };
  } else {
    payload = {
      id: 'default-test-id',
      email: 'default-test@example.com',
      displayName: 'Default Test User',
    };
  }

  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '24h',
  });
}

/**
 * Creates and returns the Express application instance for supertest.
 *
 * @returns {import('express').Application} Express application
 */
function createApp() {
  return require('../src/app');
}

// Global afterAll hook to close Prisma connection when running via Jest
if (typeof afterAll === 'function') {
  afterAll(async () => {
    try {
      await prisma.$disconnect();
    } catch {
      // Ignore disconnect errors during test shutdown
    }
  });
}

module.exports = {
  generateTestToken,
  createApp,
  TEST_JWT_SECRET,
};

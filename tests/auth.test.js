const request = require('supertest');
const app = require('../src/app');
const prisma = require('../src/db/prisma');
const { createTestUser, getAuthToken, cleanupDatabase } = require('./helpers');

describe('Authentication API (/api/auth)', () => {
  let existingUser;
  const userPassword = 'Password123!';

  beforeAll(async () => {
    // Clean up before starting
    await cleanupDatabase(prisma);

    // Create an existing user for login and duplicate tests
    existingUser = await createTestUser(prisma, {
      email: 'existing.auth.user@example.com',
      password: userPassword,
      displayName: 'Existing User',
    });
  });

  afterAll(async () => {
    await cleanupDatabase(prisma);
  });

  describe('POST /api/auth/register', () => {
    it('should register a new user successfully with valid data', async () => {
      const newUserPayload = {
        email: 'new.registered.user@example.com',
        password: 'ValidPassword123!',
        displayName: 'Registered User',
      };

      const res = await request(app)
        .post('/api/auth/register')
        .send(newUserPayload);

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('user');
      expect(res.body).toHaveProperty('token');
      expect(res.body.user.email).toBe(newUserPayload.email);
      expect(res.body.user.displayName).toBe(newUserPayload.displayName);
      expect(res.body.user).toHaveProperty('id');
      expect(res.body.user).toHaveProperty('createdAt');
      expect(res.body.user).not.toHaveProperty('password');
      expect(res.body.user).not.toHaveProperty('passwordHash');
      expect(typeof res.body.token).toBe('string');

      // Verify user actually persisted in DB
      const userInDb = await prisma.user.findUnique({
        where: { email: newUserPayload.email },
      });
      expect(userInDb).not.toBeNull();
      expect(userInDb.displayName).toBe(newUserPayload.displayName);
    });

    it('should return 409 Conflict when attempting to register with a duplicate email', async () => {
      const duplicatePayload = {
        email: existingUser.email,
        password: 'AnotherPassword123!',
        displayName: 'Duplicate Attempt',
      };

      const res = await request(app)
        .post('/api/auth/register')
        .send(duplicatePayload);

      expect(res.status).toBe(409);
      expect(res.body).toHaveProperty('error');
      expect(res.body.error).toMatch(/already exists/i);
    });

    it('should return 400 Bad Request when email is invalid', async () => {
      const invalidEmailPayload = {
        email: 'invalid-email-format',
        password: 'Password123!',
        displayName: 'Invalid Email User',
      };

      const res = await request(app)
        .post('/api/auth/register')
        .send(invalidEmailPayload);

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error', 'Validation failed');
      expect(Array.isArray(res.body.details)).toBe(true);
      const emailError = res.body.details.find((d) => d.field === 'email');
      expect(emailError).toBeDefined();
    });

    it('should return 400 Bad Request when password is under 8 characters', async () => {
      const shortPasswordPayload = {
        email: 'shortpass@example.com',
        password: 'short',
        displayName: 'Short Password User',
      };

      const res = await request(app)
        .post('/api/auth/register')
        .send(shortPasswordPayload);

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error', 'Validation failed');
      const passError = res.body.details.find((d) => d.field === 'password');
      expect(passError).toBeDefined();
      expect(passError.message).toMatch(/8 characters/i);
    });

    it('should return 400 Bad Request when displayName is missing or empty', async () => {
      const missingNamePayload = {
        email: 'missingname@example.com',
        password: 'Password123!',
        displayName: '',
      };

      const res = await request(app)
        .post('/api/auth/register')
        .send(missingNamePayload);

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error', 'Validation failed');
      const nameError = res.body.details.find((d) => d.field === 'displayName');
      expect(nameError).toBeDefined();
    });
  });

  describe('POST /api/auth/login', () => {
    it('should login successfully with correct credentials and return a token', async () => {
      const loginPayload = {
        email: existingUser.email,
        password: userPassword,
      };

      const res = await request(app)
        .post('/api/auth/login')
        .send(loginPayload);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('user');
      expect(res.body).toHaveProperty('token');
      expect(res.body.user.id).toBe(existingUser.id);
      expect(res.body.user.email).toBe(existingUser.email);
      expect(res.body.user.displayName).toBe(existingUser.displayName);
      expect(res.body.user).not.toHaveProperty('passwordHash');
      expect(typeof res.body.token).toBe('string');
    });

    it('should return 401 Unauthorized when password is wrong', async () => {
      const wrongPasswordPayload = {
        email: existingUser.email,
        password: 'IncorrectPassword999!',
      };

      const res = await request(app)
        .post('/api/auth/login')
        .send(wrongPasswordPayload);

      expect(res.status).toBe(401);
      expect(res.body).toHaveProperty('error');
      expect(res.body.error).toMatch(/invalid email or password/i);
    });

    it('should return 401 Unauthorized when user does not exist', async () => {
      const nonexistentPayload = {
        email: 'doesnotexist_98765@example.com',
        password: 'Password123!',
      };

      const res = await request(app)
        .post('/api/auth/login')
        .send(nonexistentPayload);

      expect(res.status).toBe(401);
      expect(res.body).toHaveProperty('error');
      expect(res.body.error).toMatch(/invalid email or password/i);
    });

    it('should return 400 Bad Request when email or password is missing', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'onlyemail@example.com' });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error', 'Validation failed');
    });
  });

  describe('GET /api/auth/profile', () => {
    it('should return the authenticated user profile with a valid token', async () => {
      const token = getAuthToken(existingUser);

      const res = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('user');
      expect(res.body.user.id).toBe(existingUser.id);
      expect(res.body.user.email).toBe(existingUser.email);
      expect(res.body.user.displayName).toBe(existingUser.displayName);
      expect(res.body.user).toHaveProperty('memberships');
      expect(Array.isArray(res.body.user.memberships)).toBe(true);
      expect(res.body.user).not.toHaveProperty('passwordHash');
    });

    it('should return 401 Unauthorized when Authorization header is missing', async () => {
      const res = await request(app).get('/api/auth/profile');

      expect(res.status).toBe(401);
      expect(res.body).toHaveProperty('error');
      expect(res.body.error).toMatch(/authorization header/i);
    });

    it('should return 401 Unauthorized when token is invalid or malformed', async () => {
      const res = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', 'Bearer invalid.jwt.token.here');

      expect(res.status).toBe(401);
      expect(res.body).toHaveProperty('error');
      expect(res.body.error).toMatch(/invalid token/i);
    });

    it('should return 401 Unauthorized when Authorization scheme is not Bearer', async () => {
      const res = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', 'Basic dXNlcjpwYXNz');

      expect(res.status).toBe(401);
      expect(res.body).toHaveProperty('error');
    });
  });
});

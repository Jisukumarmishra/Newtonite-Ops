const request = require('supertest');
const app = require('../src/app');
const prisma = require('../src/db/prisma');
const {
  createTestUser,
  createTestTeam,
  addTestTeamMember,
  createTestWorkItem,
  getAuthToken,
  cleanupDatabase,
} = require('./helpers');

describe('Workflow & Status Transitions (/api/work-items/:id/transition)', () => {
  let adminUser, leadUser, memberUser;
  let adminToken, leadToken, memberToken;
  let team;

  beforeAll(async () => {
    await cleanupDatabase(prisma);

    adminUser = await createTestUser(prisma, { displayName: 'Team Admin' });
    leadUser = await createTestUser(prisma, { displayName: 'Team Lead' });
    memberUser = await createTestUser(prisma, { displayName: 'Team Member' });

    adminToken = getAuthToken(adminUser);
    leadToken = getAuthToken(leadUser);
    memberToken = getAuthToken(memberUser);

    team = await createTestTeam(prisma, adminUser.id, { name: 'Workflow Test Team' });
    await addTestTeamMember(prisma, team.id, leadUser.id, 'LEAD');
    await addTestTeamMember(prisma, team.id, memberUser.id, 'MEMBER');
  });

  afterAll(async () => {
    await cleanupDatabase(prisma);
  });

  describe('Valid Lifecycle Transitions', () => {
    let lifecycleItem;

    beforeAll(async () => {
      lifecycleItem = await createTestWorkItem(prisma, team.id, adminUser.id, {
        title: 'Full Lifecycle Work Item',
        status: 'OPEN',
        version: 1,
      });
    });

    it('should allow MEMBER to transition OPEN → IN_PROGRESS', async () => {
      const res = await request(app)
        .post(`/api/work-items/${lifecycleItem.id}/transition`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({
          status: 'IN_PROGRESS',
          version: lifecycleItem.version,
        });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('workItem');
      expect(res.body.workItem.status).toBe('IN_PROGRESS');
      expect(res.body.workItem.version).toBe(lifecycleItem.version + 1);

      // Verify activity log recorded STATUS_CHANGE
      const activities = await prisma.activity.findMany({
        where: { workItemId: lifecycleItem.id, action: 'STATUS_CHANGE' },
      });
      expect(activities.length).toBeGreaterThan(0);
      const latestActivity = activities[0];
      expect(latestActivity.oldValue).toBe('OPEN');
      expect(latestActivity.newValue).toBe('IN_PROGRESS');

      lifecycleItem.version = res.body.workItem.version;
    });

    it('should allow MEMBER to transition IN_PROGRESS → AWAITING_APPROVAL', async () => {
      const res = await request(app)
        .post(`/api/work-items/${lifecycleItem.id}/transition`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({
          status: 'AWAITING_APPROVAL',
          version: lifecycleItem.version,
        });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('workItem');
      expect(res.body.workItem.status).toBe('AWAITING_APPROVAL');
      expect(res.body.workItem.version).toBe(lifecycleItem.version + 1);

      lifecycleItem.version = res.body.workItem.version;
    });

    it('should forbid MEMBER from approving AWAITING_APPROVAL → RESOLVED (403)', async () => {
      const res = await request(app)
        .post(`/api/work-items/${lifecycleItem.id}/transition`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({
          status: 'RESOLVED',
          version: lifecycleItem.version,
        });

      expect(res.status).toBe(403);
      expect(res.body).toHaveProperty('error');
      expect(res.body.error).toMatch(/only team leads and admins can approve/i);

      // Item should still be in AWAITING_APPROVAL
      const current = await prisma.workItem.findUnique({
        where: { id: lifecycleItem.id },
      });
      expect(current.status).toBe('AWAITING_APPROVAL');
      expect(current.version).toBe(lifecycleItem.version);
    });

    it('should allow LEAD to transition AWAITING_APPROVAL → RESOLVED', async () => {
      const res = await request(app)
        .post(`/api/work-items/${lifecycleItem.id}/transition`)
        .set('Authorization', `Bearer ${leadToken}`)
        .send({
          status: 'RESOLVED',
          version: lifecycleItem.version,
        });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('workItem');
      expect(res.body.workItem.status).toBe('RESOLVED');
      expect(res.body.workItem.version).toBe(lifecycleItem.version + 1);

      lifecycleItem.version = res.body.workItem.version;
    });

    it('should allow transition RESOLVED → CLOSED', async () => {
      const res = await request(app)
        .post(`/api/work-items/${lifecycleItem.id}/transition`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({
          status: 'CLOSED',
          version: lifecycleItem.version,
        });

      expect(res.status).toBe(200);
      expect(res.body.workItem.status).toBe('CLOSED');
      expect(res.body.workItem.version).toBe(lifecycleItem.version + 1);

      lifecycleItem.version = res.body.workItem.version;
    });

    it('should allow reopening CLOSED → OPEN', async () => {
      const res = await request(app)
        .post(`/api/work-items/${lifecycleItem.id}/transition`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({
          status: 'OPEN',
          version: lifecycleItem.version,
        });

      expect(res.status).toBe(200);
      expect(res.body.workItem.status).toBe('OPEN');
      expect(res.body.workItem.version).toBe(lifecycleItem.version + 1);
    });
  });

  describe('Invalid Transitions', () => {
    let openItem;

    beforeEach(async () => {
      openItem = await createTestWorkItem(prisma, team.id, adminUser.id, {
        title: 'Open Work Item for Invalid Transition Tests',
        status: 'OPEN',
        version: 1,
      });
    });

    it('should reject invalid transition OPEN → RESOLVED (400)', async () => {
      const res = await request(app)
        .post(`/api/work-items/${openItem.id}/transition`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({
          status: 'RESOLVED',
          version: openItem.version,
        });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
      expect(res.body.error).toMatch(/invalid transition.*OPEN.*RESOLVED/i);

      // Verify item remains unchanged in DB
      const inDb = await prisma.workItem.findUnique({ where: { id: openItem.id } });
      expect(inDb.status).toBe('OPEN');
      expect(inDb.version).toBe(openItem.version);
    });

    it('should reject invalid transition OPEN → CLOSED (400)', async () => {
      const res = await request(app)
        .post(`/api/work-items/${openItem.id}/transition`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({
          status: 'CLOSED',
          version: openItem.version,
        });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
      expect(res.body.error).toMatch(/invalid transition.*OPEN.*CLOSED/i);

      // Verify item remains unchanged in DB
      const inDb = await prisma.workItem.findUnique({ where: { id: openItem.id } });
      expect(inDb.status).toBe('OPEN');
      expect(inDb.version).toBe(openItem.version);
    });

    it('should reject invalid transition OPEN → AWAITING_APPROVAL (400)', async () => {
      const res = await request(app)
        .post(`/api/work-items/${openItem.id}/transition`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({
          status: 'AWAITING_APPROVAL',
          version: openItem.version,
        });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
      expect(res.body.error).toMatch(/invalid transition/i);
    });
  });
});

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

describe('Optimistic Locking (/api/work-items)', () => {
  let user, memberUser;
  let memberToken;
  let team;

  beforeAll(async () => {
    await cleanupDatabase(prisma);

    user = await createTestUser(prisma, { displayName: 'Team Creator' });
    memberUser = await createTestUser(prisma, { displayName: 'Team Member' });
    memberToken = getAuthToken(memberUser);

    team = await createTestTeam(prisma, user.id, { name: 'Optimistic Locking Team' });
    await addTestTeamMember(prisma, team.id, memberUser.id, 'MEMBER');
  });

  afterAll(async () => {
    await cleanupDatabase(prisma);
  });

  describe('Update with Optimistic Locking', () => {
    let item;

    beforeEach(async () => {
      item = await createTestWorkItem(prisma, team.id, memberUser.id, {
        title: 'Initial Versioned Item',
        description: 'Initial description',
        version: 1,
      });
    });

    it('should succeed when updating with the current correct version', async () => {
      const res = await request(app)
        .patch(`/api/work-items/${item.id}`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({
          title: 'Successfully Updated Title',
          version: 1,
        });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('workItem');
      expect(res.body.workItem.title).toBe('Successfully Updated Title');
      expect(res.body.workItem.version).toBe(2);

      // Verify in DB
      const inDb = await prisma.workItem.findUnique({ where: { id: item.id } });
      expect(inDb.version).toBe(2);
      expect(inDb.title).toBe('Successfully Updated Title');
    });

    it('should return 409 Conflict when updating with a stale version', async () => {
      // First update brings version to 2
      await request(app)
        .patch(`/api/work-items/${item.id}`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({
          title: 'First Update',
          version: 1,
        });

      // Stale update still trying to send version 1
      const staleRes = await request(app)
        .patch(`/api/work-items/${item.id}`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({
          title: 'Stale Update Attempt',
          version: 1,
        });

      expect(staleRes.status).toBe(409);
      expect(staleRes.body).toHaveProperty('error');
      expect(staleRes.body.error).toMatch(/modified by another user/i);
      expect(staleRes.body).toHaveProperty('details');
      expect(staleRes.body.details).toMatchObject({
        currentVersion: 2,
        yourVersion: 1,
      });

      // Verify DB title was not overridden by the stale update
      const inDb = await prisma.workItem.findUnique({ where: { id: item.id } });
      expect(inDb.title).toBe('First Update');
      expect(inDb.version).toBe(2);
    });

    it('should increment version sequentially after each consecutive update', async () => {
      // Update 1: version 1 -> 2
      const res1 = await request(app)
        .patch(`/api/work-items/${item.id}`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ title: 'Step 1', version: 1 });
      expect(res1.status).toBe(200);
      expect(res1.body.workItem.version).toBe(2);

      // Update 2: version 2 -> 3
      const res2 = await request(app)
        .patch(`/api/work-items/${item.id}`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ title: 'Step 2', version: 2 });
      expect(res2.status).toBe(200);
      expect(res2.body.workItem.version).toBe(3);

      // Update 3: version 3 -> 4
      const res3 = await request(app)
        .patch(`/api/work-items/${item.id}`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ title: 'Step 3', version: 3 });
      expect(res3.status).toBe(200);
      expect(res3.body.workItem.version).toBe(4);

      // Verify in DB
      const inDb = await prisma.workItem.findUnique({ where: { id: item.id } });
      expect(inDb.version).toBe(4);
      expect(inDb.title).toBe('Step 3');
    });
  });

  describe('Transition with Optimistic Locking', () => {
    let transitionItem;

    beforeEach(async () => {
      transitionItem = await createTestWorkItem(prisma, team.id, memberUser.id, {
        title: 'Item for Transition Locking Test',
        status: 'OPEN',
        version: 1,
      });
    });

    it('should return 409 Conflict when transition is attempted with a stale version', async () => {
      // Artificially advance version in DB to 3
      await prisma.workItem.update({
        where: { id: transitionItem.id },
        data: { version: 3 },
      });

      // Attempt transition with old version 1
      const res = await request(app)
        .post(`/api/work-items/${transitionItem.id}/transition`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({
          status: 'IN_PROGRESS',
          version: 1,
        });

      expect(res.status).toBe(409);
      expect(res.body).toHaveProperty('error');
      expect(res.body.error).toMatch(/modified by another user/i);

      // Verify status did not change
      const inDb = await prisma.workItem.findUnique({ where: { id: transitionItem.id } });
      expect(inDb.status).toBe('OPEN');
      expect(inDb.version).toBe(3);
    });

    it('should succeed transition with correct version and increment version', async () => {
      const res = await request(app)
        .post(`/api/work-items/${transitionItem.id}/transition`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({
          status: 'IN_PROGRESS',
          version: 1,
        });

      expect(res.status).toBe(200);
      expect(res.body.workItem.status).toBe('IN_PROGRESS');
      expect(res.body.workItem.version).toBe(2);

      const inDb = await prisma.workItem.findUnique({ where: { id: transitionItem.id } });
      expect(inDb.status).toBe('IN_PROGRESS');
      expect(inDb.version).toBe(2);
    });
  });
});

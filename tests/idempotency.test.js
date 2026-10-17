const request = require('supertest');
const app = require('../src/app');
const prisma = require('../src/db/prisma');
const {
  createTestUser,
  createTestTeam,
  addTestTeamMember,
  getAuthToken,
  cleanupDatabase,
} = require('./helpers');

describe('Idempotency in Work Item Creation (/api/teams/:teamId/work-items)', () => {
  let user, memberUser;
  let memberToken;
  let team;

  beforeAll(async () => {
    await cleanupDatabase(prisma);

    user = await createTestUser(prisma, { displayName: 'Team Creator' });
    memberUser = await createTestUser(prisma, { displayName: 'Team Member' });
    memberToken = getAuthToken(memberUser);

    team = await createTestTeam(prisma, user.id, { name: 'Idempotency Test Team' });
    await addTestTeamMember(prisma, team.id, memberUser.id, 'MEMBER');
  });

  afterAll(async () => {
    await cleanupDatabase(prisma);
  });

  it('should return 201 on first request with an idempotency key', async () => {
    const idempotencyKey = 'unique-key-first-attempt-1';
    const payload = {
      title: 'Idempotent Item',
      description: 'First attempt description',
      priority: 'HIGH',
      teamId: team.id,
      idempotencyKey,
    };

    const res = await request(app)
      .post(`/api/teams/${team.id}/work-items`)
      .set('Authorization', `Bearer ${memberToken}`)
      .send(payload);

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('workItem');
    expect(res.body.wasIdempotent).toBe(false);
    expect(res.body.workItem.idempotencyKey).toBe(idempotencyKey);
    expect(res.body.workItem.title).toBe(payload.title);
  });

  it('should return 200 with the original item when retrying with the same idempotency key', async () => {
    const idempotencyKey = 'unique-key-retry-test-2';
    const firstPayload = {
      title: 'Original Title',
      description: 'Original description',
      priority: 'MEDIUM',
      teamId: team.id,
      idempotencyKey,
    };

    // First attempt -> 201 Created
    const firstRes = await request(app)
      .post(`/api/teams/${team.id}/work-items`)
      .set('Authorization', `Bearer ${memberToken}`)
      .send(firstPayload);

    expect(firstRes.status).toBe(201);
    expect(firstRes.body.wasIdempotent).toBe(false);
    const originalItem = firstRes.body.workItem;

    // Second attempt with same idempotency key but altered content
    const secondPayload = {
      title: 'Different Title Should Be Ignored',
      description: 'Different description',
      priority: 'CRITICAL',
      teamId: team.id,
      idempotencyKey,
    };

    const countBeforeSecondCall = await prisma.workItem.count({
      where: { teamId: team.id },
    });

    const secondRes = await request(app)
      .post(`/api/teams/${team.id}/work-items`)
      .set('Authorization', `Bearer ${memberToken}`)
      .send(secondPayload);

    expect(secondRes.status).toBe(200);
    expect(secondRes.body.wasIdempotent).toBe(true);
    expect(secondRes.body.workItem.id).toBe(originalItem.id);
    expect(secondRes.body.workItem.title).toBe(originalItem.title);
    expect(secondRes.body.workItem.idempotencyKey).toBe(idempotencyKey);

    // Verify no additional item was created in the database
    const countAfterSecondCall = await prisma.workItem.count({
      where: { teamId: team.id },
    });
    expect(countAfterSecondCall).toBe(countBeforeSecondCall);
  });

  it('should always create a new item when no idempotency key is provided', async () => {
    const basePayload = {
      title: 'Item Without Idempotency Key',
      teamId: team.id,
    };

    const res1 = await request(app)
      .post(`/api/teams/${team.id}/work-items`)
      .set('Authorization', `Bearer ${memberToken}`)
      .send(basePayload);

    expect(res1.status).toBe(201);
    expect(res1.body.wasIdempotent).toBe(false);
    const id1 = res1.body.workItem.id;

    const res2 = await request(app)
      .post(`/api/teams/${team.id}/work-items`)
      .set('Authorization', `Bearer ${memberToken}`)
      .send(basePayload);

    expect(res2.status).toBe(201);
    expect(res2.body.wasIdempotent).toBe(false);
    const id2 = res2.body.workItem.id;

    expect(id1).not.toBe(id2);
  });

  it('should create different items when distinct idempotency keys are provided', async () => {
    const keyAlpha = 'distinct-key-alpha-3';
    const keyBeta = 'distinct-key-beta-4';

    const resA = await request(app)
      .post(`/api/teams/${team.id}/work-items`)
      .set('Authorization', `Bearer ${memberToken}`)
      .send({
        title: 'Alpha Item',
        teamId: team.id,
        idempotencyKey: keyAlpha,
      });

    const resB = await request(app)
      .post(`/api/teams/${team.id}/work-items`)
      .set('Authorization', `Bearer ${memberToken}`)
      .send({
        title: 'Beta Item',
        teamId: team.id,
        idempotencyKey: keyBeta,
      });

    expect(resA.status).toBe(201);
    expect(resB.status).toBe(201);
    expect(resA.body.workItem.id).not.toBe(resB.body.workItem.id);
    expect(resA.body.workItem.idempotencyKey).toBe(keyAlpha);
    expect(resB.body.workItem.idempotencyKey).toBe(keyBeta);
  });
});

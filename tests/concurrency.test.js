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

describe('Concurrency & Work Item Claiming (/api/work-items/:id/claim)', () => {
  let adminUser, worker1, worker2, worker3;
  let worker1Token, worker2Token, worker3Token;
  let team;

  beforeAll(async () => {
    await cleanupDatabase(prisma);

    adminUser = await createTestUser(prisma, { displayName: 'Team Admin' });
    worker1 = await createTestUser(prisma, { displayName: 'Worker 1' });
    worker2 = await createTestUser(prisma, { displayName: 'Worker 2' });
    worker3 = await createTestUser(prisma, { displayName: 'Worker 3' });

    worker1Token = getAuthToken(worker1);
    worker2Token = getAuthToken(worker2);
    worker3Token = getAuthToken(worker3);

    team = await createTestTeam(prisma, adminUser.id, { name: 'Concurrency Test Team' });
    await addTestTeamMember(prisma, team.id, worker1.id, 'MEMBER');
    await addTestTeamMember(prisma, team.id, worker2.id, 'MEMBER');
    await addTestTeamMember(prisma, team.id, worker3.id, 'MEMBER');
  });

  afterAll(async () => {
    await cleanupDatabase(prisma);
  });

  it('should successfully claim an unassigned work item', async () => {
    const unassignedItem = await createTestWorkItem(prisma, team.id, adminUser.id, {
      title: 'Unassigned Item for Claim',
      assignedToId: null,
      version: 1,
    });

    const res = await request(app)
      .post(`/api/work-items/${unassignedItem.id}/claim`)
      .set('Authorization', `Bearer ${worker1Token}`)
      .send({ version: 1 });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('workItem');
    expect(res.body.workItem.assignedToId).toBe(worker1.id);
    expect(res.body.workItem.version).toBe(2);

    // Verify activity recorded
    const activities = await prisma.activity.findMany({
      where: { workItemId: unassignedItem.id, action: 'ASSIGNMENT_CHANGE' },
    });
    expect(activities.length).toBeGreaterThan(0);
    expect(activities[0].performedById).toBe(worker1.id);
  });

  it('should return 409 Conflict when attempting to claim an already-claimed item', async () => {
    // Item is already claimed by worker1 with version 2
    const alreadyClaimedItem = await createTestWorkItem(prisma, team.id, adminUser.id, {
      title: 'Already Claimed Item',
      assignedToId: worker1.id,
      version: 2,
    });

    const res = await request(app)
      .post(`/api/work-items/${alreadyClaimedItem.id}/claim`)
      .set('Authorization', `Bearer ${worker2Token}`)
      .send({ version: 2 });

    expect(res.status).toBe(409);
    expect(res.body).toHaveProperty('error');
    expect(res.body.error).toMatch(/already been claimed/i);

    // Verify item assignment in DB has not changed
    const itemInDb = await prisma.workItem.findUnique({
      where: { id: alreadyClaimedItem.id },
    });
    expect(itemInDb.assignedToId).toBe(worker1.id);
    expect(itemInDb.version).toBe(2);
  });

  it('should simulate concurrent claims with Promise.all - only one should succeed', async () => {
    // Create a fresh unassigned item
    const concurrentItem = await createTestWorkItem(prisma, team.id, adminUser.id, {
      title: 'Item for Concurrent Race Claim',
      assignedToId: null,
      version: 1,
    });

    // Fire 3 simultaneous claim requests with initial version 1
    const claimRequests = [
      request(app)
        .post(`/api/work-items/${concurrentItem.id}/claim`)
        .set('Authorization', `Bearer ${worker1Token}`)
        .send({ version: 1 }),
      request(app)
        .post(`/api/work-items/${concurrentItem.id}/claim`)
        .set('Authorization', `Bearer ${worker2Token}`)
        .send({ version: 1 }),
      request(app)
        .post(`/api/work-items/${concurrentItem.id}/claim`)
        .set('Authorization', `Bearer ${worker3Token}`)
        .send({ version: 1 }),
    ];

    const responses = await Promise.all(claimRequests);

    // Check statuses
    const successfulResponses = responses.filter((r) => r.status === 200);
    const conflictResponses = responses.filter((r) => r.status === 409);

    // Exactly one claim should succeed
    expect(successfulResponses).toHaveLength(1);
    // The other two should fail with 409 Conflict
    expect(conflictResponses).toHaveLength(2);

    const winnerUser = successfulResponses[0].body.workItem.assignedToId;
    expect([worker1.id, worker2.id, worker3.id]).toContain(winnerUser);

    // Verify database state matches the winner
    const inDb = await prisma.workItem.findUnique({
      where: { id: concurrentItem.id },
    });
    expect(inDb.assignedToId).toBe(winnerUser);
    expect(inDb.version).toBe(2);
  });
});

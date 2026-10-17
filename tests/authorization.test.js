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

describe('Authorization & Team-based Permissions', () => {
  let adminUser, leadUser, memberUser, viewerUser, outsiderUser;
  let adminToken, leadToken, memberToken, viewerToken, outsiderToken;
  let team;
  let testWorkItem;

  beforeAll(async () => {
    await cleanupDatabase(prisma);

    // Create users with different intended roles
    adminUser = await createTestUser(prisma, { displayName: 'Admin User' });
    leadUser = await createTestUser(prisma, { displayName: 'Lead User' });
    memberUser = await createTestUser(prisma, { displayName: 'Member User' });
    viewerUser = await createTestUser(prisma, { displayName: 'Viewer User' });
    outsiderUser = await createTestUser(prisma, { displayName: 'Outsider User' });

    // Generate JWT tokens
    adminToken = getAuthToken(adminUser);
    leadToken = getAuthToken(leadUser);
    memberToken = getAuthToken(memberUser);
    viewerToken = getAuthToken(viewerUser);
    outsiderToken = getAuthToken(outsiderUser);

    // Create team where adminUser is ADMIN
    team = await createTestTeam(prisma, adminUser.id, { name: 'Authorization Test Team' });

    // Add members with respective roles
    await addTestTeamMember(prisma, team.id, leadUser.id, 'LEAD');
    await addTestTeamMember(prisma, team.id, memberUser.id, 'MEMBER');
    await addTestTeamMember(prisma, team.id, viewerUser.id, 'VIEWER');

    // Create a base work item for role testing
    testWorkItem = await createTestWorkItem(prisma, team.id, adminUser.id, {
      title: 'Base Work Item for Auth Tests',
      assignedToId: memberUser.id,
    });
  });

  afterAll(async () => {
    await cleanupDatabase(prisma);
  });

  describe('Work Item Creation Role Checks', () => {
    it('should forbid VIEWER from creating work items (403)', async () => {
      const res = await request(app)
        .post(`/api/teams/${team.id}/work-items`)
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({
          title: 'Viewer Attempt Work Item',
          teamId: team.id,
          priority: 'LOW',
        });

      expect(res.status).toBe(403);
      expect(res.body).toHaveProperty('error');
      expect(res.body.error).toMatch(/requires at least member role/i);
    });

    it('should allow MEMBER to create work items', async () => {
      const res = await request(app)
        .post(`/api/teams/${team.id}/work-items`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({
          title: 'Member Created Work Item',
          description: 'Created by team member',
          teamId: team.id,
          priority: 'MEDIUM',
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('workItem');
      expect(res.body.workItem.title).toBe('Member Created Work Item');
      expect(res.body.workItem.createdById).toBe(memberUser.id);
    });
  });

  describe('Non-Team-Member Access Checks', () => {
    it('should forbid non-team-member from viewing team details (403)', async () => {
      const res = await request(app)
        .get(`/api/teams/${team.id}`)
        .set('Authorization', `Bearer ${outsiderToken}`);

      expect(res.status).toBe(403);
      expect(res.body).toHaveProperty('error');
      expect(res.body.error).toMatch(/not a member of this team/i);
    });

    it('should forbid non-team-member from listing team work items (403)', async () => {
      const res = await request(app)
        .get(`/api/teams/${team.id}/work-items`)
        .set('Authorization', `Bearer ${outsiderToken}`);

      expect(res.status).toBe(403);
      expect(res.body).toHaveProperty('error');
      expect(res.body.error).toMatch(/not a member of this team/i);
    });

    it('should forbid non-team-member from getting a work item by ID (403)', async () => {
      const res = await request(app)
        .get(`/api/work-items/${testWorkItem.id}`)
        .set('Authorization', `Bearer ${outsiderToken}`);

      expect(res.status).toBe(403);
      expect(res.body).toHaveProperty('error');
      expect(res.body.error).toMatch(/not a member of this team/i);
    });

    it('should forbid non-team-member from creating work items in team (403)', async () => {
      const res = await request(app)
        .post(`/api/teams/${team.id}/work-items`)
        .set('Authorization', `Bearer ${outsiderToken}`)
        .send({
          title: 'Outsider Attempt',
          teamId: team.id,
        });

      expect(res.status).toBe(403);
      expect(res.body).toHaveProperty('error');
      expect(res.body.error).toMatch(/not a member of this team/i);
    });
  });

  describe('ADMIN Member Management', () => {
    let candidateUser;
    let addedMembership;

    beforeAll(async () => {
      candidateUser = await createTestUser(prisma, { displayName: 'Candidate User' });
    });

    it('should allow ADMIN to add a member to the team', async () => {
      const res = await request(app)
        .post(`/api/teams/${team.id}/members`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          userId: candidateUser.id,
          role: 'VIEWER',
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('membership');
      expect(res.body.membership.userId).toBe(candidateUser.id);
      expect(res.body.membership.teamId).toBe(team.id);
      expect(res.body.membership.role).toBe('VIEWER');

      addedMembership = res.body.membership;
    });

    it('should forbid non-admin (MEMBER) from adding members (403)', async () => {
      const anotherCandidate = await createTestUser(prisma, { displayName: 'Another Candidate' });

      const res = await request(app)
        .post(`/api/teams/${team.id}/members`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({
          userId: anotherCandidate.id,
          role: 'MEMBER',
        });

      expect(res.status).toBe(403);
      expect(res.body).toHaveProperty('error');
      expect(res.body.error).toMatch(/requires at least admin role/i);
    });

    it('should allow ADMIN to update a member role', async () => {
      const res = await request(app)
        .patch(`/api/teams/${team.id}/members/${addedMembership.id}/role`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          role: 'MEMBER',
        });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('membership');
      expect(res.body.membership.id).toBe(addedMembership.id);
      expect(res.body.membership.role).toBe('MEMBER');
    });

    it('should forbid non-admin (MEMBER) from updating member roles (403)', async () => {
      const res = await request(app)
        .patch(`/api/teams/${team.id}/members/${addedMembership.id}/role`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({
          role: 'LEAD',
        });

      expect(res.status).toBe(403);
      expect(res.body).toHaveProperty('error');
      expect(res.body.error).toMatch(/requires at least admin role/i);
    });

    it('should allow ADMIN to remove a member from the team', async () => {
      const res = await request(app)
        .delete(`/api/teams/${team.id}/members/${addedMembership.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(204);

      // Verify member record was removed
      const inDb = await prisma.teamMember.findUnique({
        where: { id: addedMembership.id },
      });
      expect(inDb).toBeNull();
    });

    it('should forbid non-admin (LEAD) from removing members (403)', async () => {
      // Create a temporary member to test deletion
      const tempUser = await createTestUser(prisma, { displayName: 'Temp User' });
      const tempMembership = await addTestTeamMember(prisma, team.id, tempUser.id, 'VIEWER');

      const res = await request(app)
        .delete(`/api/teams/${team.id}/members/${tempMembership.id}`)
        .set('Authorization', `Bearer ${leadToken}`);

      expect(res.status).toBe(403);
      expect(res.body).toHaveProperty('error');
      expect(res.body.error).toMatch(/requires at least admin role/i);
    });
  });

  describe('Role Hierarchy Enforcement', () => {
    it('should allow LEAD to unassign a work item (requires LEAD)', async () => {
      // First ensure the work item is assigned
      const assignedItem = await createTestWorkItem(prisma, team.id, adminUser.id, {
        title: 'Assigned Item for Lead Unassign',
        assignedToId: memberUser.id,
        version: 1,
      });

      const res = await request(app)
        .post(`/api/work-items/${assignedItem.id}/unassign`)
        .set('Authorization', `Bearer ${leadToken}`)
        .send({ version: 1 });

      expect(res.status).toBe(200);
      expect(res.body.workItem.assignedToId).toBeNull();
    });

    it('should forbid MEMBER from unassigning a work item (requires LEAD) (403)', async () => {
      const assignedItem = await createTestWorkItem(prisma, team.id, adminUser.id, {
        title: 'Assigned Item for Member Attempt',
        assignedToId: memberUser.id,
        version: 1,
      });

      const res = await request(app)
        .post(`/api/work-items/${assignedItem.id}/unassign`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ version: 1 });

      expect(res.status).toBe(403);
      expect(res.body).toHaveProperty('error');
      expect(res.body.error).toMatch(/requires at least lead role/i);
    });

    it('should forbid VIEWER from editing a work item (requires MEMBER) (403)', async () => {
      const res = await request(app)
        .patch(`/api/work-items/${testWorkItem.id}`)
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({
          title: 'Viewer Trying To Edit',
          version: testWorkItem.version,
        });

      expect(res.status).toBe(403);
      expect(res.body).toHaveProperty('error');
      expect(res.body.error).toMatch(/requires at least member role/i);
    });

    it('should allow ADMIN to perform LEAD operations due to hierarchy', async () => {
      const assignedItem = await createTestWorkItem(prisma, team.id, adminUser.id, {
        title: 'Item for Admin Unassign',
        assignedToId: memberUser.id,
        version: 1,
      });

      const res = await request(app)
        .post(`/api/work-items/${assignedItem.id}/unassign`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ version: 1 });

      expect(res.status).toBe(200);
      expect(res.body.workItem.assignedToId).toBeNull();
    });
  });
});

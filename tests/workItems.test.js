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

describe('Work Items API (/api/work-items & /api/teams/:teamId/work-items)', () => {
  let user, memberUser, outsiderUser;
  let memberToken, outsiderToken;
  let team;
  let sampleItem;

  beforeAll(async () => {
    await cleanupDatabase(prisma);

    user = await createTestUser(prisma, { displayName: 'Team Creator' });
    memberUser = await createTestUser(prisma, { displayName: 'Team Member' });
    outsiderUser = await createTestUser(prisma, { displayName: 'Outsider' });

    memberToken = getAuthToken(memberUser);
    outsiderToken = getAuthToken(outsiderUser);

    team = await createTestTeam(prisma, user.id, { name: 'Work Items Test Team' });
    await addTestTeamMember(prisma, team.id, memberUser.id, 'MEMBER');

    sampleItem = await createTestWorkItem(prisma, team.id, memberUser.id, {
      title: 'Initial Sample Item',
      description: 'Initial description',
      priority: 'MEDIUM',
      status: 'OPEN',
      version: 1,
    });
  });

  afterAll(async () => {
    await cleanupDatabase(prisma);
  });

  describe('POST /api/teams/:teamId/work-items (Create)', () => {
    it('should create a work item with valid data', async () => {
      const payload = {
        title: 'New Feature Request',
        description: 'Detailed description of the new feature',
        priority: 'HIGH',
        teamId: team.id,
      };

      const res = await request(app)
        .post(`/api/teams/${team.id}/work-items`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send(payload);

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('workItem');
      expect(res.body.wasIdempotent).toBe(false);
      expect(res.body.workItem.title).toBe(payload.title);
      expect(res.body.workItem.description).toBe(payload.description);
      expect(res.body.workItem.priority).toBe('HIGH');
      expect(res.body.workItem.status).toBe('OPEN');
      expect(res.body.workItem.version).toBe(1);
      expect(res.body.workItem.teamId).toBe(team.id);
      expect(res.body.workItem.createdById).toBe(memberUser.id);
      expect(res.body.workItem).toHaveProperty('createdBy');
      expect(res.body.workItem.createdBy.id).toBe(memberUser.id);

      // Verify activity was created
      const activities = await prisma.activity.findMany({
        where: { workItemId: res.body.workItem.id },
      });
      expect(activities.length).toBeGreaterThan(0);
      expect(activities[0].action).toBe('CREATED');
    });

    it('should return 400 Bad Request when title is missing', async () => {
      const res = await request(app)
        .post(`/api/teams/${team.id}/work-items`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({
          description: 'No title provided',
          teamId: team.id,
        });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error', 'Validation failed');
    });

    it('should return 400 Bad Request when priority is invalid', async () => {
      const res = await request(app)
        .post(`/api/teams/${team.id}/work-items`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({
          title: 'Invalid Priority Item',
          priority: 'SUPER_URGENT', // Invalid enum
          teamId: team.id,
        });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error', 'Validation failed');
    });
  });

  describe('GET /api/work-items/:id (Read)', () => {
    it('should get a work item by ID with related records', async () => {
      const res = await request(app)
        .get(`/api/work-items/${sampleItem.id}`)
        .set('Authorization', `Bearer ${memberToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('workItem');
      expect(res.body.workItem.id).toBe(sampleItem.id);
      expect(res.body.workItem.title).toBe(sampleItem.title);
      expect(res.body.workItem).toHaveProperty('createdBy');
      expect(res.body.workItem).toHaveProperty('team');
      expect(res.body.workItem).toHaveProperty('comments');
      expect(res.body.workItem).toHaveProperty('activities');
      expect(Array.isArray(res.body.workItem.comments)).toBe(true);
      expect(Array.isArray(res.body.workItem.activities)).toBe(true);
    });

    it('should return 404 Not Found for nonexistent work item ID', async () => {
      const nonExistentId = '00000000-0000-0000-0000-000000000000';
      const res = await request(app)
        .get(`/api/work-items/${nonExistentId}`)
        .set('Authorization', `Bearer ${memberToken}`);

      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty('error');
      expect(res.body.error).toMatch(/not found/i);
    });
  });

  describe('PATCH /api/work-items/:id (Update)', () => {
    it('should update work item fields with valid version', async () => {
      const updatePayload = {
        title: 'Updated Work Item Title',
        description: 'Updated work item description',
        priority: 'CRITICAL',
        version: sampleItem.version,
      };

      const res = await request(app)
        .patch(`/api/work-items/${sampleItem.id}`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send(updatePayload);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('workItem');
      expect(res.body.workItem.title).toBe('Updated Work Item Title');
      expect(res.body.workItem.description).toBe('Updated work item description');
      expect(res.body.workItem.priority).toBe('CRITICAL');
      expect(res.body.workItem.version).toBe(sampleItem.version + 1);

      // Verify audit activities were recorded
      const activities = await prisma.activity.findMany({
        where: { workItemId: sampleItem.id },
      });
      const titleActivity = activities.find((a) => a.field === 'title');
      expect(titleActivity).toBeDefined();
      expect(titleActivity.newValue).toBe('Updated Work Item Title');

      // Update sampleItem reference version for subsequent tests
      sampleItem.version = res.body.workItem.version;
    });

    it('should return 400 Bad Request when version is missing', async () => {
      const res = await request(app)
        .patch(`/api/work-items/${sampleItem.id}`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({
          title: 'Missing Version Update',
        });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error', 'Validation failed');
    });
  });

  describe('GET /api/teams/:teamId/work-items (List, Pagination, Filtering, Search)', () => {
    let itemOpenLow, itemOpenHigh, itemClosedMedium;

    beforeAll(async () => {
      // Seed dedicated items for listing, pagination, filtering, and search
      itemOpenLow = await createTestWorkItem(prisma, team.id, memberUser.id, {
        title: 'Searchable Alpha Bug in Login',
        priority: 'LOW',
        status: 'OPEN',
      });
      itemOpenHigh = await createTestWorkItem(prisma, team.id, memberUser.id, {
        title: 'Searchable Beta Feature in Dashboard',
        priority: 'HIGH',
        status: 'OPEN',
      });
      itemClosedMedium = await createTestWorkItem(prisma, team.id, memberUser.id, {
        title: 'Searchable Gamma Task in Settings',
        priority: 'MEDIUM',
        status: 'CLOSED',
      });
    });

    it('should list work items with pagination', async () => {
      const limit = 2;
      const res = await request(app)
        .get(`/api/teams/${team.id}/work-items?page=1&limit=${limit}`)
        .set('Authorization', `Bearer ${memberToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('items');
      expect(res.body).toHaveProperty('pagination');
      expect(res.body.items.length).toBeLessThanOrEqual(limit);
      expect(res.body.pagination.page).toBe(1);
      expect(res.body.pagination.limit).toBe(limit);
      expect(res.body.pagination.total).toBeGreaterThanOrEqual(3);
      expect(res.body.pagination.totalPages).toBeGreaterThanOrEqual(2);
    });

    it('should filter work items by status', async () => {
      const res = await request(app)
        .get(`/api/teams/${team.id}/work-items?status=CLOSED`)
        .set('Authorization', `Bearer ${memberToken}`);

      expect(res.status).toBe(200);
      expect(res.body.items.length).toBeGreaterThan(0);
      res.body.items.forEach((item) => {
        expect(item.status).toBe('CLOSED');
      });
    });

    it('should filter work items by priority', async () => {
      const res = await request(app)
        .get(`/api/teams/${team.id}/work-items?priority=HIGH`)
        .set('Authorization', `Bearer ${memberToken}`);

      expect(res.status).toBe(200);
      expect(res.body.items.length).toBeGreaterThan(0);
      res.body.items.forEach((item) => {
        expect(item.priority).toBe('HIGH');
      });
    });

    it('should search work items by title', async () => {
      const res = await request(app)
        .get(`/api/teams/${team.id}/work-items?search=Alpha`)
        .set('Authorization', `Bearer ${memberToken}`);

      expect(res.status).toBe(200);
      expect(res.body.items.length).toBeGreaterThan(0);
      const matched = res.body.items.some((item) => item.id === itemOpenLow.id);
      expect(matched).toBe(true);

      // Verify case-insensitivity and exclusion of non-matching items
      res.body.items.forEach((item) => {
        const titleMatch = item.title.toLowerCase().includes('alpha');
        const descMatch = (item.description || '').toLowerCase().includes('alpha');
        expect(titleMatch || descMatch).toBe(true);
      });
    });

    it('should return empty list when search yields no matches', async () => {
      const res = await request(app)
        .get(`/api/teams/${team.id}/work-items?search=ZzzNoMatchString987654`)
        .set('Authorization', `Bearer ${memberToken}`);

      expect(res.status).toBe(200);
      expect(res.body.items).toHaveLength(0);
      expect(res.body.pagination.total).toBe(0);
    });
  });
});

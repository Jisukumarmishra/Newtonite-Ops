const request = require('supertest');
const app = require('../src/app');
const prisma = require('../src/db/prisma');
const {
  createTestUser,
  createTestTeam,
  addTestTeamMember,
  createTestWorkItem,
  createTestComment,
  getAuthToken,
  cleanupDatabase,
} = require('./helpers');

describe('Comments API (/api/work-items/:id/comments)', () => {
  let user1, user2, userLead;
  let user1Token, user2Token, userLeadToken;
  let team;
  let workItem;

  beforeAll(async () => {
    await cleanupDatabase(prisma);

    user1 = await createTestUser(prisma, { displayName: 'User One' });
    user2 = await createTestUser(prisma, { displayName: 'User Two' });
    userLead = await createTestUser(prisma, { displayName: 'Team Lead' });

    user1Token = getAuthToken(user1);
    user2Token = getAuthToken(user2);
    userLeadToken = getAuthToken(userLead);

    team = await createTestTeam(prisma, user1.id, { name: 'Comments Test Team' });
    await addTestTeamMember(prisma, team.id, user2.id, 'MEMBER');
    await addTestTeamMember(prisma, team.id, userLead.id, 'LEAD');

    workItem = await createTestWorkItem(prisma, team.id, user1.id, {
      title: 'Work Item with Comments',
    });
  });

  afterAll(async () => {
    await cleanupDatabase(prisma);
  });

  describe('POST /api/work-items/:id/comments (Add Comment)', () => {
    it('should add a comment to a work item successfully', async () => {
      const commentPayload = {
        content: 'This is a test comment by user1',
      };

      const res = await request(app)
        .post(`/api/work-items/${workItem.id}/comments`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send(commentPayload);

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('comment');
      expect(res.body.comment.content).toBe(commentPayload.content);
      expect(res.body.comment.workItemId).toBe(workItem.id);
      expect(res.body.comment.authorId).toBe(user1.id);
      expect(res.body.comment).toHaveProperty('author');
      expect(res.body.comment.author.id).toBe(user1.id);
      expect(res.body.comment.author.displayName).toBe(user1.displayName);

      // Verify activity was recorded
      const activities = await prisma.activity.findMany({
        where: { workItemId: workItem.id, action: 'COMMENTED' },
      });
      expect(activities.length).toBeGreaterThan(0);
      expect(activities[0].performedById).toBe(user1.id);
    });

    it('should return 400 Bad Request when comment content is empty', async () => {
      const res = await request(app)
        .post(`/api/work-items/${workItem.id}/comments`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ content: '' });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error', 'Validation failed');
    });
  });

  describe('GET /api/work-items/:id/comments (List with Pagination)', () => {
    let paginationItem;

    beforeAll(async () => {
      paginationItem = await createTestWorkItem(prisma, team.id, user1.id, {
        title: 'Item for Comment Pagination',
      });

      // Seed 5 comments
      for (let i = 1; i <= 5; i++) {
        await createTestComment(prisma, paginationItem.id, user1.id, {
          content: `Numbered comment #${i}`,
        });
      }
    });

    it('should list comments with pagination', async () => {
      const limit = 2;
      const res = await request(app)
        .get(`/api/work-items/${paginationItem.id}/comments?page=1&limit=${limit}`)
        .set('Authorization', `Bearer ${user1Token}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('comments');
      expect(res.body).toHaveProperty('pagination');
      expect(res.body.comments).toHaveLength(limit);
      expect(res.body.pagination.page).toBe(1);
      expect(res.body.pagination.limit).toBe(limit);
      expect(res.body.pagination.total).toBe(5);
      expect(res.body.pagination.totalPages).toBe(3);
    });

    it('should retrieve subsequent pages accurately', async () => {
      const res = await request(app)
        .get(`/api/work-items/${paginationItem.id}/comments?page=2&limit=2`)
        .set('Authorization', `Bearer ${user1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.comments).toHaveLength(2);
      expect(res.body.pagination.page).toBe(2);
    });
  });

  describe('PATCH /api/work-items/:id/comments/:commentId (Update Comment)', () => {
    let commentByAuthor;

    beforeEach(async () => {
      commentByAuthor = await createTestComment(prisma, workItem.id, user1.id, {
        content: 'Original comment text before update',
      });
    });

    it('should allow author to update their own comment', async () => {
      const updatedContent = 'Updated text by the original author';

      const res = await request(app)
        .patch(`/api/work-items/${workItem.id}/comments/${commentByAuthor.id}`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ content: updatedContent });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('comment');
      expect(res.body.comment.id).toBe(commentByAuthor.id);
      expect(res.body.comment.content).toBe(updatedContent);

      // Verify in DB
      const inDb = await prisma.comment.findUnique({
        where: { id: commentByAuthor.id },
      });
      expect(inDb.content).toBe(updatedContent);
    });

    it("should forbid another user from updating author's comment (403)", async () => {
      const res = await request(app)
        .patch(`/api/work-items/${workItem.id}/comments/${commentByAuthor.id}`)
        .set('Authorization', `Bearer ${user2Token}`)
        .send({ content: 'Malicious update attempt by another user' });

      expect(res.status).toBe(403);
      expect(res.body).toHaveProperty('error');
      expect(res.body.error).toMatch(/only edit your own comments/i);

      // Verify in DB that content remains unchanged
      const inDb = await prisma.comment.findUnique({
        where: { id: commentByAuthor.id },
      });
      expect(inDb.content).toBe('Original comment text before update');
    });
  });

  describe('DELETE /api/work-items/:id/comments/:commentId (Delete Comment)', () => {
    it('should allow author to delete their own comment', async () => {
      const commentToDelete = await createTestComment(prisma, workItem.id, user1.id, {
        content: 'Comment to be deleted by author',
      });

      const res = await request(app)
        .delete(`/api/work-items/${workItem.id}/comments/${commentToDelete.id}`)
        .set('Authorization', `Bearer ${user1Token}`);

      expect(res.status).toBe(204);

      // Verify deletion in DB
      const inDb = await prisma.comment.findUnique({
        where: { id: commentToDelete.id },
      });
      expect(inDb).toBeNull();
    });

    it("should forbid another regular member from deleting author's comment (403)", async () => {
      const protectedComment = await createTestComment(prisma, workItem.id, user1.id, {
        content: 'Protected comment from another member deletion',
      });

      const res = await request(app)
        .delete(`/api/work-items/${workItem.id}/comments/${protectedComment.id}`)
        .set('Authorization', `Bearer ${user2Token}`);

      expect(res.status).toBe(403);
      expect(res.body).toHaveProperty('error');
      expect(res.body.error).toMatch(/only delete your own comments/i);

      // Verify comment still exists in DB
      const inDb = await prisma.comment.findUnique({
        where: { id: protectedComment.id },
      });
      expect(inDb).not.toBeNull();
    });

    it("should allow team LEAD to delete another user's comment", async () => {
      const commentForLeadDeletion = await createTestComment(prisma, workItem.id, user1.id, {
        content: 'Comment that team lead needs to moderate',
      });

      const res = await request(app)
        .delete(`/api/work-items/${workItem.id}/comments/${commentForLeadDeletion.id}`)
        .set('Authorization', `Bearer ${userLeadToken}`);

      expect(res.status).toBe(204);

      const inDb = await prisma.comment.findUnique({
        where: { id: commentForLeadDeletion.id },
      });
      expect(inDb).toBeNull();
    });
  });
});

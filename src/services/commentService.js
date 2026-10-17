const prisma = require('../db/prisma');
const { NotFoundError, ForbiddenError } = require('../utils/errors');

/**
 * Add a comment to a work item (within a transaction to also log activity).
 */
async function addComment(workItemId, { content }, userId) {
  const result = await prisma.$transaction(async (tx) => {
    // Verify work item exists
    const workItem = await tx.workItem.findUnique({ where: { id: workItemId } });
    if (!workItem) throw new NotFoundError('Work item not found');

    const comment = await tx.comment.create({
      data: {
        content,
        workItemId,
        authorId: userId,
      },
      include: {
        author: { select: { id: true, email: true, displayName: true } },
      },
    });

    // Log activity
    await tx.activity.create({
      data: {
        action: 'COMMENTED',
        workItemId,
        performedById: userId,
        newValue: content.substring(0, 200), // Truncate for activity log
      },
    });

    return comment;
  });

  return result;
}

/**
 * List comments for a work item.
 */
async function listComments(workItemId, page = 1, limit = 50) {
  const skip = (page - 1) * limit;

  const [comments, total] = await Promise.all([
    prisma.comment.findMany({
      where: { workItemId },
      include: {
        author: { select: { id: true, email: true, displayName: true } },
      },
      orderBy: { createdAt: 'asc' },
      skip,
      take: limit,
    }),
    prisma.comment.count({ where: { workItemId } }),
  ]);

  return {
    comments,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

/**
 * Update a comment (only the author can edit).
 */
async function updateComment(commentId, { content }, userId) {
  const comment = await prisma.comment.findUnique({ where: { id: commentId } });

  if (!comment) throw new NotFoundError('Comment not found');
  if (comment.authorId !== userId) {
    throw new ForbiddenError('You can only edit your own comments');
  }

  const updated = await prisma.comment.update({
    where: { id: commentId },
    data: { content },
    include: {
      author: { select: { id: true, email: true, displayName: true } },
    },
  });

  return updated;
}

/**
 * Delete a comment (author or team Lead/Admin).
 */
async function deleteComment(commentId, userId, userRole) {
  const comment = await prisma.comment.findUnique({ where: { id: commentId } });

  if (!comment) throw new NotFoundError('Comment not found');

  const isAuthor = comment.authorId === userId;
  const isPrivileged = userRole === 'LEAD' || userRole === 'ADMIN';

  if (!isAuthor && !isPrivileged) {
    throw new ForbiddenError('You can only delete your own comments');
  }

  await prisma.comment.delete({ where: { id: commentId } });
}

module.exports = {
  addComment,
  listComments,
  updateComment,
  deleteComment,
};

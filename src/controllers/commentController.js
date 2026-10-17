const commentService = require('../services/commentService');

async function addComment(req, res, next) {
  try {
    const comment = await commentService.addComment(
      req.params.id,
      req.body,
      req.user.id
    );
    res.status(201).json({ comment });
  } catch (err) {
    next(err);
  }
}

async function listComments(req, res, next) {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 50;
    const result = await commentService.listComments(req.params.id, page, limit);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function updateComment(req, res, next) {
  try {
    const comment = await commentService.updateComment(
      req.params.commentId,
      req.body,
      req.user.id
    );
    res.json({ comment });
  } catch (err) {
    next(err);
  }
}

async function deleteComment(req, res, next) {
  try {
    await commentService.deleteComment(
      req.params.commentId,
      req.user.id,
      req.teamMembership ? req.teamMembership.role : 'MEMBER'
    );
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

module.exports = { addComment, listComments, updateComment, deleteComment };

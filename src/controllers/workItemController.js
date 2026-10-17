const workItemService = require('../services/workItemService');

async function createWorkItem(req, res, next) {
  try {
    const { workItem, wasIdempotent } = await workItemService.createWorkItem(
      req.body,
      req.user.id
    );
    const status = wasIdempotent ? 200 : 201;
    res.status(status).json({ workItem, wasIdempotent });
  } catch (err) {
    next(err);
  }
}

async function getWorkItemById(req, res, next) {
  try {
    const workItem = await workItemService.getWorkItemById(req.params.id);
    res.json({ workItem });
  } catch (err) {
    next(err);
  }
}

async function listWorkItems(req, res, next) {
  try {
    const result = await workItemService.listWorkItems(req.params.teamId, req.query);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function updateWorkItem(req, res, next) {
  try {
    const workItem = await workItemService.updateWorkItem(
      req.params.id,
      req.body,
      req.user.id
    );
    res.json({ workItem });
  } catch (err) {
    next(err);
  }
}

async function transitionStatus(req, res, next) {
  try {
    const workItem = await workItemService.transitionStatus(
      req.params.id,
      req.body,
      req.user.id,
      req.teamMembership.role
    );
    res.json({ workItem });
  } catch (err) {
    next(err);
  }
}

async function claimWorkItem(req, res, next) {
  try {
    const workItem = await workItemService.claimWorkItem(
      req.params.id,
      req.body,
      req.user.id
    );
    res.json({ workItem });
  } catch (err) {
    next(err);
  }
}

async function unassignWorkItem(req, res, next) {
  try {
    const workItem = await workItemService.unassignWorkItem(
      req.params.id,
      req.body,
      req.user.id
    );
    res.json({ workItem });
  } catch (err) {
    next(err);
  }
}

async function getActivityHistory(req, res, next) {
  try {
    const activities = await workItemService.getActivityHistory(req.params.id);
    res.json({ activities });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  createWorkItem,
  getWorkItemById,
  listWorkItems,
  updateWorkItem,
  transitionStatus,
  claimWorkItem,
  unassignWorkItem,
  getActivityHistory,
};

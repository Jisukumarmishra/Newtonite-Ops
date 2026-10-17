const teamService = require('../services/teamService');

async function createTeam(req, res, next) {
  try {
    const team = await teamService.createTeam(req.body, req.user.id);
    res.status(201).json({ team });
  } catch (err) {
    next(err);
  }
}

async function getUserTeams(req, res, next) {
  try {
    const teams = await teamService.getUserTeams(req.user.id);
    res.json({ teams });
  } catch (err) {
    next(err);
  }
}

async function getTeamById(req, res, next) {
  try {
    const team = await teamService.getTeamById(req.params.teamId);
    res.json({ team });
  } catch (err) {
    next(err);
  }
}

async function addMember(req, res, next) {
  try {
    const membership = await teamService.addMember(req.params.teamId, req.body);
    res.status(201).json({ membership });
  } catch (err) {
    next(err);
  }
}

async function updateMemberRole(req, res, next) {
  try {
    const membership = await teamService.updateMemberRole(
      req.params.teamId,
      req.params.memberId,
      req.body
    );
    res.json({ membership });
  } catch (err) {
    next(err);
  }
}

async function removeMember(req, res, next) {
  try {
    await teamService.removeMember(req.params.teamId, req.params.memberId);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

async function listUsers(req, res, next) {
  try {
    const users = await teamService.listUsers();
    res.json({ users });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  createTeam,
  getUserTeams,
  getTeamById,
  addMember,
  updateMemberRole,
  removeMember,
  listUsers,
};

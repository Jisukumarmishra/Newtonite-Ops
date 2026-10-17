import client from './client';

export async function getTeams() {
  const response = await client.get('/teams');
  return response.data; // { teams: [...] }
}

export async function getTeam(teamId) {
  const response = await client.get(`/teams/${teamId}`);
  return response.data; // { team: { ..., members: [...] } }
}

export async function createTeam(data) {
  const response = await client.post('/teams', data);
  return response.data; // { team: {...} }
}

export async function addMember(teamId, { userId, role }) {
  const response = await client.post(`/teams/${teamId}/members`, { userId, role });
  return response.data; // { membership: {...} }
}

export async function updateMemberRole(teamId, memberId, role) {
  const response = await client.patch(`/teams/${teamId}/members/${memberId}/role`, { role });
  return response.data; // { membership: {...} }
}

export async function removeMember(teamId, memberId) {
  const response = await client.delete(`/teams/${teamId}/members/${memberId}`);
  return response.data;
}

export async function listUsers() {
  const response = await client.get('/teams/users/list');
  return response.data; // { users: [...] }
}

export default {
  getTeams,
  getTeam,
  createTeam,
  addMember,
  updateMemberRole,
  removeMember,
  listUsers,
};

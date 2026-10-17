import client from './client';

export async function listWorkItems(teamId, params = {}) {
  const response = await client.get(`/teams/${teamId}/work-items`, { params });
  return response.data; // { items: [...], pagination: { page, limit, total, totalPages } }
}

export async function getWorkItem(id) {
  const response = await client.get(`/work-items/${id}`);
  return response.data; // { workItem: {...} }
}

export async function createWorkItem(teamId, data) {
  const payload = {
    ...data,
    teamId,
  };
  const response = await client.post(`/teams/${teamId}/work-items`, payload);
  return response.data; // { workItem: {...}, wasIdempotent: boolean }
}

export async function updateWorkItem(id, data) {
  const response = await client.patch(`/work-items/${id}`, data);
  return response.data; // { workItem: {...} }
}

export async function transitionStatus(id, { status, version }) {
  const response = await client.post(`/work-items/${id}/transition`, { status, version });
  return response.data; // { workItem: {...} }
}

export async function claimWorkItem(id, version) {
  const response = await client.post(`/work-items/${id}/claim`, { version });
  return response.data; // { workItem: {...} }
}

export async function unassignWorkItem(id, version) {
  const response = await client.post(`/work-items/${id}/unassign`, { version });
  return response.data; // { workItem: {...} }
}

export async function getActivities(id) {
  const response = await client.get(`/work-items/${id}/activities`);
  return response.data; // { activities: [...] }
}

export default {
  listWorkItems,
  getWorkItem,
  createWorkItem,
  updateWorkItem,
  transitionStatus,
  claimWorkItem,
  unassignWorkItem,
  getActivities,
};

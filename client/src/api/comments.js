import client from './client';

export async function addComment(workItemId, content) {
  const response = await client.post(`/work-items/${workItemId}/comments`, { content });
  return response.data; // { comment: {...} }
}

export async function listComments(workItemId, params = {}) {
  const response = await client.get(`/work-items/${workItemId}/comments`, { params });
  return response.data; // { comments: [...], pagination: {...} }
}

export async function updateComment(workItemId, commentId, content) {
  const response = await client.patch(`/work-items/${workItemId}/comments/${commentId}`, { content });
  return response.data; // { comment: {...} }
}

export async function deleteComment(workItemId, commentId) {
  const response = await client.delete(`/work-items/${workItemId}/comments/${commentId}`);
  return response.data;
}

export default {
  addComment,
  listComments,
  updateComment,
  deleteComment,
};

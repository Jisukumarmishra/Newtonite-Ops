import client from './client';

export async function login(email, password) {
  const response = await client.post('/auth/login', { email, password });
  return response.data;
}

export async function register(email, password, displayName) {
  const response = await client.post('/auth/register', { email, password, displayName });
  return response.data;
}

export async function getProfile() {
  const response = await client.get('/auth/profile');
  return response.data;
}

export default {
  login,
  register,
  getProfile,
};

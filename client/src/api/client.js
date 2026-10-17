import axios from 'axios';

const client = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor: attach JWT token if present
client.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: handle 401 and parse server error messages
client.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      // Clear token if unauthorized, and notify if not already on login page
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      if (
        typeof window !== 'undefined' &&
        !window.location.pathname.startsWith('/login') &&
        !window.location.pathname.startsWith('/register')
      ) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

/**
 * Extract human-readable error message from an axios error object.
 */
export function getErrorMessage(error) {
  if (error.response?.data) {
    const data = error.response.data;
    if (typeof data === 'string') return data;
    if (data.error) {
      if (typeof data.error === 'string') return data.error;
      if (Array.isArray(data.error)) {
        return data.error.map((e) => e.message || JSON.stringify(e)).join(', ');
      }
      if (data.error.message) return data.error.message;
    }
    if (data.message) return data.message;
  }
  return error.message || 'An unexpected error occurred';
}

export default client;

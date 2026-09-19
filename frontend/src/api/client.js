import axios from 'axios';

export const api = axios.create({
  baseURL: '/api',
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      if (!window.location.pathname.startsWith('/login')) {
        const returnTo = `${window.location.pathname}${window.location.search}${window.location.hash}`;
        window.location.href = `/login?returnTo=${encodeURIComponent(returnTo)}`;
      }
    }
    return Promise.reject(err);
  }
);

export function errorMessage(err) {
  return err?.response?.data?.message ?? err?.message ?? 'Something went wrong';
}

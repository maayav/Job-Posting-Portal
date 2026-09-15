import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from '../App';
import { AuthProvider } from '../context/AuthContext';
import { api } from '../api/client';

vi.mock('../api/client', () => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn() },
  errorMessage: (err) => err?.message ?? 'error',
}));

function signIn(role = 'student') {
  localStorage.setItem('token', 'test-token');
  localStorage.setItem('user', JSON.stringify({ id: 'u1', name: 'Test User', role }));
}

function renderApp(initialPath = '/') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </MemoryRouter>
  );
}

describe('App routing and navigation order', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    api.get.mockImplementation((url) => {
      if (url === '/jobs') {
        return Promise.resolve({ data: { jobs: [], page: 1, limit: 20, total: 0, totalPages: 0 } });
      }
      return Promise.resolve({ data: {} });
    });
  });

  it('lands on the Jobs page for an authenticated user at /', async () => {
    signIn('student');
    renderApp('/');
    expect(await screen.findByRole('heading', { name: /find jobs/i })).toBeTruthy();
  });

  it('keeps deep links working (/dashboard, /analyze, /assistant)', async () => {
    signIn('student');
    renderApp('/assistant');
    expect(await screen.findByRole('heading', { name: /ai assistant/i })).toBeTruthy();
  });

  it('redirects unauthenticated users to login', async () => {
    renderApp('/');
    expect(await screen.findByRole('heading', { name: /skillgap tracker/i })).toBeTruthy();
  });

  it('renders the main navigation in the required order', async () => {
    signIn('student');
    renderApp('/');
    const nav = await screen.findByRole('navigation', { name: /main navigation/i });
    const links = Array.from(nav.querySelectorAll('a')).map((a) => a.textContent);
    expect(links).toEqual(['Jobs', 'Dashboard', 'New Analysis', 'AI Assistant']);
    expect(nav.querySelector('a[href="/analyze"]')).toBeTruthy();
  });

  it('adds the Admin Jobs link only for admins', async () => {
    signIn('admin');
    renderApp('/');
    const nav = await screen.findByRole('navigation', { name: /main navigation/i });
    const links = Array.from(nav.querySelectorAll('a')).map((a) => a.textContent);
    expect(links).toEqual(['Jobs', 'Dashboard', 'New Analysis', 'AI Assistant', 'Admin Jobs']);
  });
});
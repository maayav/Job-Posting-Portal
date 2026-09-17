import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from '../App';
import { AuthProvider } from '../context/AuthContext';
import { ThemeProvider } from '../context/ThemeContext';
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
        <ThemeProvider>
          <App />
        </ThemeProvider>
      </AuthProvider>
    </MemoryRouter>
  );
}

const report = {
  report_id: 'r1',
  submission_id: 's1',
  target_role: 'SDE',
  status: 'completed',
  score: 77,
  strong_areas: [{ skill: 'React', percent: 100 }],
  developing_areas: [],
  gaps: [],
  study_plan: [],
  generated_at: '2026-09-15T00:00:00.000Z',
};

describe('App routing and navigation order', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    api.get.mockImplementation((url) => {
      if (url === '/jobs') {
        return Promise.resolve({ data: { jobs: [], page: 1, limit: 20, total: 0, totalPages: 0 } });
      }
      if (url.startsWith('/report/')) {
        return Promise.resolve({ data: report });
      }
      return Promise.resolve({ data: {} });
    });
  });

  it('lands on the public Vortex landing page at /', async () => {
    signIn('student');
    localStorage.setItem('report_id', 'r1');
    renderApp('/');
    expect(await screen.findByRole('heading', { name: /ai|clearer next step/i })).toBeTruthy();
  });

  it('renders the landing page for unauthenticated users', async () => {
    renderApp('/');
    expect(await screen.findByRole('heading', { name: /ai|clearer next step/i })).toBeTruthy();
  });

  it('keeps deep links working (/dashboard, /analyze, /assistant)', async () => {
    signIn('student');
    renderApp('/assistant');
    expect(await screen.findByRole('heading', { name: /ai assistant/i })).toBeTruthy();
  });

  it('redirects unauthenticated users to login', async () => {
    renderApp('/dashboard');
    expect(await screen.findByRole('heading', { name: /welcome back/i })).toBeTruthy();
  });

  it('renders the main navigation in the required order', async () => {
    signIn('student');
    renderApp('/jobs');
    const nav = await screen.findByRole('navigation', { name: /main navigation/i });
    const links = Array.from(nav.querySelectorAll('a')).map((a) => a.textContent);
    expect(links).toEqual(['Jobs', 'Dashboard', 'New Analysis', 'AI Assistant', 'My Applications']);
    expect(nav.querySelector('a[href="/analyze"]')).toBeTruthy();
  });

  it('adds the Admin Jobs link only for admins', async () => {
    signIn('admin');
    renderApp('/jobs');
    const nav = await screen.findByRole('navigation', { name: /main navigation/i });
    const links = Array.from(nav.querySelectorAll('a')).map((a) => a.textContent);
    expect(links).toEqual(['Jobs', 'Dashboard', 'New Analysis', 'AI Assistant', 'Admin Jobs', 'Applications']);
  });

  it('exposes a dark-mode toggle in the navigation', async () => {
    signIn('student');
    renderApp('/jobs');
    const toggle = await screen.findByRole('button', { name: /dark/i });
    expect(toggle).toBeTruthy();
  });
});

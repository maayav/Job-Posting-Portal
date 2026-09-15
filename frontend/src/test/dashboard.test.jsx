import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import DashboardPage from '../pages/DashboardPage';
import { AuthProvider } from '../context/AuthContext';
import { api } from '../api/client';

vi.mock('../api/client', () => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn() },
  errorMessage: (err) => err?.message ?? 'error',
}));

const report = {
  report_id: 'r1',
  submission_id: 's1',
  target_role: 'SDE',
  status: 'completed',
  score: 77,
  strong_areas: [{ skill: 'React', percent: 100 }],
  developing_areas: [{ skill: 'SQL', percent: 70 }],
  gaps: [{ skill: 'Express', percent: 55, priority: 1 }],
  study_plan: [
    {
      _id: 'i1',
      skill: 'Express',
      priority: 1,
      resources: [{ title: 'Express Guide', url: 'https://example.com', type: 'documentation', verified: true }],
      done: false,
    },
  ],
  generated_at: '2026-09-15T00:00:00.000Z',
};

describe('Dashboard layout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    localStorage.setItem('token', 'test-token');
    localStorage.setItem('user', JSON.stringify({ id: 'u1', name: 'Test User', role: 'student' }));
    localStorage.setItem('report_id', 'r1');
    api.get.mockResolvedValue({ data: report });
  });

  it('shows ATS score, skill breakdown, study plan and role readiness in order', async () => {
    render(
      <MemoryRouter>
        <AuthProvider>
          <DashboardPage />
        </AuthProvider>
      </MemoryRouter>
    );

    await screen.findByRole('heading', { name: /ats score/i });
    const headings = Array.from(document.querySelectorAll('h2')).map((h) => h.textContent);
    expect(headings).toEqual(['ATS Score', 'Skill breakdown', 'Prioritized study plan', 'Role readiness']);
  });

  it('does not render the score trend chart', async () => {
    render(
      <MemoryRouter>
        <AuthProvider>
          <DashboardPage />
        </AuthProvider>
      </MemoryRouter>
    );

    await screen.findByRole('heading', { name: /ats score/i });
    expect(screen.queryByText(/score trend/i)).toBeNull();
    expect(document.querySelector('.recharts-responsive-container')).toBeNull();
  });
});
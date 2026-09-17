import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import DashboardPage from '../pages/DashboardPage';
import { AuthProvider } from '../context/AuthContext';
import { ThemeProvider } from '../context/ThemeContext';
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
          <ThemeProvider>
            <DashboardPage />
          </ThemeProvider>
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
          <ThemeProvider>
            <DashboardPage />
          </ThemeProvider>
        </AuthProvider>
      </MemoryRouter>
    );

    await screen.findByRole('heading', { name: /ats score/i });
    expect(screen.queryByText(/score trend/i)).toBeNull();
    expect(document.querySelector('.recharts-responsive-container')).toBeNull();
  });

  it('renders the candidate review dashboard for admins from application data', async () => {
    localStorage.setItem('user', JSON.stringify({ id: 'a1', name: 'Admin', role: 'admin' }));
    api.get.mockImplementation((url) => {
      if (url === '/admin/dashboard') {
        return Promise.resolve({ data: {
          totalApplications: 2,
          roles: [{ jobId: 'j1', title: 'Frontend Developer', applicationCount: 2 }],
          applications: [{
            applicationId: 'a1',
            applicant: { name: 'Candidate A', email: 'candidate@example.com' },
            job: { title: 'Frontend Developer', company: 'Acme', city: 'Chennai', experienceLevel: 1 },
            appliedAt: '2026-09-16',
            status: 'under_review',
            reviewStage: 'under_review',
            reviewStageLabel: 'Under Review',
            atsScore: 82,
            roleReadinessScore: 82,
          }],
        } });
      }
      if (url === '/admin/applications/a1') {
        return Promise.resolve({ data: {
          application: {
            id: 'a1', status: 'under_review', appliedAt: '2026-09-16',
            applicant: { name: 'Candidate A', email: 'candidate@example.com' },
            job: { title: 'Frontend Developer', company: 'Acme', city: 'Chennai', experienceLevel: 1 },
          },
          review: { atsScore: 82, roleReadinessScore: 82, strongSkills: [{ skill: 'React', percent: 90 }], missingSkills: [], studyPlan: [] },
        } });
      }
      return Promise.resolve({ data: {} });
    });

    render(
      <MemoryRouter>
        <AuthProvider>
          <ThemeProvider>
            <DashboardPage />
          </ThemeProvider>
        </AuthProvider>
      </MemoryRouter>
    );

    expect(await screen.findByRole('heading', { name: /review the people/i })).toBeTruthy();
    expect(await screen.findByText('2')).toBeTruthy();
    expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual(['Total1', 'Applied0', 'Review1']);
    fireEvent.click(screen.getByRole('tab', { name: /Applied\s*0/ }));
    expect(screen.queryByRole('button', { name: 'View' })).toBeNull();
    fireEvent.click(screen.getByRole('tab', { name: /Review\s*1/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'View' }));
    expect(await screen.findByRole('heading', { name: 'Candidate A' })).toBeTruthy();
    expect(screen.getByText('ATS score')).toBeTruthy();
  });
});

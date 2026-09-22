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
    api.get.mockImplementation((url) => {
      if (url === '/applications/me') {
        return Promise.resolve({
          data: {
            applications: [
              {
                id: 'app1',
                status: 'applied',
                appliedAt: '2026-09-12T00:00:00.000Z',
                job: { id: 'j1', title: 'Backend Engineer', company: 'Acme', city: 'Pune', skills: ['Express', 'Docker'], experienceLevel: 2 },
              },
              {
                id: 'app2',
                status: 'under_review',
                appliedAt: '2026-09-13T00:00:00.000Z',
                job: { id: 'j2', title: 'Frontend Developer', company: 'Beta', city: 'Pune', skills: ['React'], experienceLevel: 1 },
              },
            ],
          },
        });
      }
      if (url === '/wishlist') {
        return Promise.resolve({
          data: {
            items: [
              {
                id: 'w1',
                savedAt: '2026-09-14T00:00:00.000Z',
                job: { id: 'j9', title: 'Saved Backend Role', company: 'Beta Ltd', city: 'Pune', skills: ['Node.js'], experienceLevel: 2 },
              },
            ],
          },
        });
      }
      if (url === '/report/history') {
        return Promise.resolve({
          data: {
            history: [
              { report_id: 'r0', score: 61, target_role: 'SDE', completed_at: '2026-09-01T00:00:00.000Z' },
              { report_id: 'r1', score: 77, target_role: 'SDE', completed_at: '2026-09-15T00:00:00.000Z' },
            ],
          },
        });
      }
      if (url === '/report/roadmap') {
        return Promise.resolve({
          data: {
            roadmaps: [
              {
                target_role: 'SDE',
                report_id: 'r1',
                score: 77,
                gap_count: 1,
                gaps: [{ skill: 'Express', percent: 55 }],
                study_plan: [
                  {
                    _id: 'i1',
                    skill: 'Express',
                    priority: 1,
                    resources: [{ title: 'Express Guide', url: 'https://example.com', type: 'documentation', verified: true }],
                    done: false,
                  },
                ],
              },
              {
                target_role: 'Data Analyst',
                report_id: 'r2',
                score: 62,
                gap_count: 1,
                gaps: [{ skill: 'SQL', percent: 45 }],
                study_plan: [
                  {
                    _id: 'i2',
                    skill: 'SQL',
                    priority: 0.9,
                    resources: [{ title: 'SQLBolt', url: 'https://sqlbolt.com', type: 'practice-set', verified: true }],
                    done: false,
                  },
                ],
              },
            ],
          },
        });
      }
      if (url.startsWith('/report/')) return Promise.resolve({ data: report });
      return Promise.resolve({ data: {} });
    });
  });

  it('shows the score, per-role roadmap, application prep, and readiness graph', async () => {
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
    expect(headings).toEqual([
      'ATS Score',
      'What to study for your target roles',
      'SDE roadmap',
      'Prepare for the roles you applied to',
      'Jobs applied',
      'Saved jobs',
      'Readiness trend',
    ]);
    expect(screen.getByText('2')).toBeTruthy();
    expect(document.querySelector('.recharts-responsive-container')).toBeTruthy();
    expect(screen.getByText('Saved Backend Role')).toBeTruthy();

    // Roadmap for the analyzed role, with its study items.
    const planTitle = document.querySelector('.plan-title');
    expect(planTitle.textContent).toContain('Express');
    expect(screen.getByText('1 open')).toBeTruthy();

    // Skills from applied jobs that are gaps in the roadmap are flagged.
    expect(screen.getByText('Backend Engineer')).toBeTruthy();
    expect(screen.getByText(/from your SDE roadmap/)).toBeTruthy();
    expect(screen.getByText(/does not flag these skills as gaps/)).toBeTruthy();

    // The roadmap is chosen from a role dropdown; switching roles swaps the plan.
    const roleSelect = screen.getByLabelText(/choose role for study plan/i);
    expect(Array.from(roleSelect.options).map((option) => option.textContent)).toEqual([
      'SDE · 77/100 · 1 open',
      'Data Analyst · 62/100 · 1 open',
    ]);
    fireEvent.change(roleSelect, { target: { value: 'r2' } });
    expect(screen.getByRole('heading', { name: 'Data Analyst roadmap' })).toBeTruthy();
    expect(document.querySelector('.plan-title').textContent).toContain('SQL');
    fireEvent.change(roleSelect, { target: { value: 'r1' } });

    api.patch.mockResolvedValueOnce({ data: { done: true } });
    fireEvent.click(screen.getByLabelText(/mark express complete/i));
    expect(api.patch).toHaveBeenCalledWith('/report/r1/study-plan/i1');

    expect(screen.queryByText(/skill breakdown/i)).toBeNull();
    expect(screen.queryByText(/role readiness/i)).toBeNull();
  });

  it('clears an inaccessible stale report and shows the empty state', async () => {
    api.get.mockImplementation((url) => {
      if (url.startsWith('/report/') && !['/report/history', '/report/roadmap'].includes(url)) {
        return Promise.reject({ response: { status: 403 } });
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

    expect(await screen.findByText(/no report yet/i)).toBeTruthy();
    expect(localStorage.getItem('report_id')).toBeNull();
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

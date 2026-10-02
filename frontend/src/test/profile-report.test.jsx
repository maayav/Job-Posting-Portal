import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ProfileAssessment from '../components/ProfileAssessment';
import CareerActions from '../components/CareerActions';
import AnalysisActivity from '../components/AnalysisActivity';

describe('profile reports and analysis activity', () => {
  it('shows unavailable sources without a fake zero score', () => {
    render(<ProfileAssessment targetRole="Data Analyst" assessment={{ score: 65, assessedSources: 1, totalSources: 5, summary: 'Available evidence only.', sources: [{ id: 'github', label: 'GitHub projects', status: 'unavailable', score: null, details: ['Lookup unavailable.'], formula: 'Source-specific rubric.' }] }} />);
    expect(screen.getByText(/1 of 5 sources assessed/)).toBeTruthy();
    expect(screen.getByText('Not scored')).toBeTruthy();
    expect(screen.getByText('Unavailable')).toBeTruthy();
  });
  it('switches actions, exposes curated links, and keeps drafts editable', () => {
    render(<CareerActions actions={{ note: 'Suggested next steps.', projects: [{ title: 'Build a SQL report', skill: 'SQL', reason: 'A current gap.', deliverables: ['Include test queries.'] }], practice: [{ id: 'sql', title: 'Select All', platform: 'HackerRank', difficulty: 'Easy', reason: 'Practice SQL.', url: 'https://www.hackerrank.com/challenges/select-all-sql/problem' }], posts: [{ title: 'My next project', skill: 'SQL', outline: ['Describe the plan.'], draft: 'I plan to learn SQL.' }] }} />);
    expect(screen.getByText('Build a SQL report')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Practice problems' }));
    expect(screen.getByRole('link', { name: /Open problem/ }).href).toContain('hackerrank.com');
    fireEvent.click(screen.getByRole('button', { name: 'LinkedIn ideas' }));
    const draft = screen.getByLabelText('Post draft 1');
    fireEvent.change(draft, { target: { value: 'My actual plan.' } });
    expect(draft.value).toBe('My actual plan.');
    expect(screen.queryByRole('button', { name: /publish/i })).toBeNull();
  });
  it('marks only server-confirmed stages complete', () => {
    const { container, rerender } = render(<AnalysisActivity stage="queued" />);
    expect(container.querySelectorAll('.is-done')).toHaveLength(0);
    rerender(<AnalysisActivity stage="matching" role="Data Analyst" />);
    expect(container.querySelectorAll('.is-done')).toHaveLength(1);
    expect(screen.getByText('Compare role skills for Data Analyst.')).toBeTruthy();
  });
});

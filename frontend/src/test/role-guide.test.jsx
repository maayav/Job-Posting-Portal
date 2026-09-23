import { describe, it, expect } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import RoleGuide from '../components/RoleGuide';
import catalog from '../data/role-catalog.json';

describe('Public role guide', () => {
  it('shows the real AI Engineer criteria and passes the selected role to analysis', () => {
    render(<MemoryRouter><RoleGuide /></MemoryRouter>);
    expect(screen.getByLabelText('Choose a role').value).toBe('AI Engineer');
    expect(screen.getByRole('list', { name: /skill importance/i }).children).toHaveLength(16);
    expect(screen.getByRole('link', { name: /check my skills/i }).getAttribute('href')).toBe('/analysis/new?role=AI%20Engineer');
    fireEvent.change(screen.getByLabelText('Choose a role'), { target: { value: 'SDE' } });
    expect(screen.getByRole('heading', { name: 'Software Development Engineer' })).toBeTruthy();
    expect(screen.getByRole('link', { name: /check my skills/i }).getAttribute('href')).toBe('/analysis/new?role=SDE');
  });

  it('opens skill-specific learning resources using keyboard tabs', async () => {
    render(<MemoryRouter><RoleGuide /></MemoryRouter>);
    fireEvent.keyDown(screen.getByRole('tab', { name: 'Skills to learn' }), { key: 'ArrowRight' });
    await waitFor(() => expect(screen.getByRole('link', { name: /build retrieval-augmented generation/i })).toBeTruthy());
    const link = screen.getByRole('link', { name: /build retrieval-augmented generation/i });
    expect(link.getAttribute('href')).toBe('https://docs.langchain.com/oss/python/deepagents/rag');
    expect(screen.getByRole('tab', { name: 'Learning resources' }).getAttribute('aria-selected')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'Next role' }));
    // The next role is whatever follows AI Engineer in the generated catalog.
    const roleIds = catalog.roles.map((role) => role.id);
    const nextRole = roleIds[(roleIds.indexOf('AI Engineer') + 1) % roleIds.length];
    expect(screen.getByLabelText('Choose a role').value).toBe(nextRole);
  });

  it('includes an HTTPS learning resource for every AI Engineer skill', () => {
    const role = catalog.roles.find((r) => r.id === 'AI Engineer');
    for (const skill of role.skills) {
      expect(skill.resources.length, skill.name).toBeGreaterThan(0);
      expect(skill.resources.every((r) => new URL(r.url).protocol === 'https:')).toBe(true);
    }
  });
});

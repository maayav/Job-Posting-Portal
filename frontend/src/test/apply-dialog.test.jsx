import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import ApplyDialog from '../components/ApplyDialog';
import { api } from '../api/client';

vi.mock('../api/client', () => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn() },
  errorMessage: (err) => err?.message ?? 'error',
}));

const job = { id: 'j1', title: 'Frontend Developer', city: 'Chennai', company: 'Acme' };
const user = { id: 'u1', name: 'Test User', email: 'student@test.com', role: 'student' };

describe('ApplyDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('prefills the account email and offers profile, upload, and no-resume options', () => {
    render(<ApplyDialog job={job} user={user} onClose={vi.fn()} onApplied={vi.fn()} />);
    expect(screen.getByLabelText(/contact email/i).value).toBe('student@test.com');
    expect(screen.getByLabelText(/use my saved profile resume/i)).toBeTruthy();
    expect(screen.getByLabelText(/upload a different resume/i)).toBeTruthy();
    expect(screen.getByLabelText(/apply without a resume/i)).toBeTruthy();
  });

  it('submits with the account resume by default', async () => {
    const onApplied = vi.fn();
    api.post.mockResolvedValue({ data: { application: { id: 'a1' } } });

    render(<ApplyDialog job={job} user={user} onClose={vi.fn()} onApplied={onApplied} />);
    fireEvent.click(screen.getByRole('button', { name: /submit application/i }));

    await waitFor(() => expect(api.post).toHaveBeenCalled());
    const [url, form] = api.post.mock.calls[0];
    expect(url).toBe('/applications');
    expect(form.get('jobId')).toBe('j1');
    expect(form.get('email')).toBe('student@test.com');
    expect(form.get('useProfileResume')).toBe('true');
    await waitFor(() => expect(onApplied).toHaveBeenCalledWith('j1'));
  });

  it('requires a file when uploading a different resume', async () => {
    render(<ApplyDialog job={job} user={user} onClose={vi.fn()} onApplied={vi.fn()} />);
    fireEvent.click(screen.getByLabelText(/upload a different resume/i));
    fireEvent.click(screen.getByRole('button', { name: /submit application/i }));

    expect(await screen.findByText(/choose a pdf resume/i)).toBeTruthy();
    expect(api.post).not.toHaveBeenCalled();
  });

  it('treats an already-applied response as success', async () => {
    const onApplied = vi.fn();
    api.post.mockRejectedValue({ response: { status: 409 } });

    render(<ApplyDialog job={job} user={user} onClose={vi.fn()} onApplied={onApplied} />);
    fireEvent.click(screen.getByRole('button', { name: /submit application/i }));

    await waitFor(() => expect(onApplied).toHaveBeenCalledWith('j1'));
  });
});
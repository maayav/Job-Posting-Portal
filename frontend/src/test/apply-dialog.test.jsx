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

  it('locks page scroll and lets the dialog handle its own scrolling', () => {
    render(<ApplyDialog job={job} user={user} onClose={vi.fn()} onApplied={vi.fn()} />);
    expect(document.body.style.overflow).toBe('hidden');
    expect(document.querySelector('.apply-overlay').hasAttribute('data-lenis-prevent')).toBe(true);
    expect(document.querySelector('.apply-dialog').hasAttribute('data-lenis-prevent')).toBe(true);
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

  it.each([
    [new File(['text'], 'resume.txt', { type: 'text/plain' }), 'Only PDF resumes are accepted.'],
    [new File([new Uint8Array(4 * 1024 * 1024 + 1)], 'resume.pdf', { type: 'application/pdf' }), 'Resume must be 4MB or smaller.'],
  ])('rejects an invalid application resume before sending it', async (file, message) => {
    render(<ApplyDialog job={job} user={user} onClose={vi.fn()} onApplied={vi.fn()} />);
    fireEvent.click(screen.getByLabelText(/upload a different resume/i));
    fireEvent.change(screen.getByLabelText('Application resume PDF'), { target: { files: [file] } });
    fireEvent.click(screen.getByRole('button', { name: /submit application/i }));
    expect(await screen.findByText(message)).toBeTruthy();
    expect(api.post).not.toHaveBeenCalled();
  });

  it('treats an already-applied response as success', async () => {
    const onApplied = vi.fn();
    api.post.mockRejectedValue({ response: { status: 409, data: { error: 'already_applied' } } });

    render(<ApplyDialog job={job} user={user} onClose={vi.fn()} onApplied={onApplied} />);
    fireEvent.click(screen.getByRole('button', { name: /submit application/i }));

    await waitFor(() => expect(onApplied).toHaveBeenCalledWith('j1'));
  });

  it.each(['profile_resume_unavailable', 'job_closed'])('does not mark an application successful after %s', async (errorCode) => {
    const onApplied = vi.fn();
    api.post.mockRejectedValue({ message: 'Choose another resume option or an open job.', response: { status: 409, data: { error: errorCode } } });
    render(<ApplyDialog job={job} user={user} onClose={vi.fn()} onApplied={onApplied} />);
    fireEvent.click(screen.getByRole('button', { name: /submit application/i }));

    expect(await screen.findByText('Choose another resume option or an open job.')).toBeTruthy();
    expect(onApplied).not.toHaveBeenCalled();
  });
});

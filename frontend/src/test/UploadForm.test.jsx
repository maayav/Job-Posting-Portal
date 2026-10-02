import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import UploadForm from '../components/UploadForm';
import { api } from '../api/client';

vi.mock('../api/client', () => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn() },
  errorMessage: (err) => err?.message ?? 'error',
}));

describe('UploadForm target-role selector', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders every role returned by GET /api/roles', async () => {
    api.get.mockResolvedValue({
      data: {
        roles: [
          { id: 'SDE', label: 'Software Development Engineer' },
          { id: 'ML Engineer', label: 'ML Engineer' },
          { id: 'Data Scientist', label: 'Data Scientist' },
        ],
      },
    });

    render(<UploadForm onSubmit={vi.fn()} loading={false} />);

    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/roles'));

    const select = screen.getByLabelText(/target role/i);
    const options = Array.from(select.querySelectorAll('option')).map((o) => ({
      value: o.value,
      text: o.textContent,
    }));

    expect(options).toEqual([
      { value: 'SDE', text: 'Software Development Engineer' },
      { value: 'ML Engineer', text: 'ML Engineer' },
      { value: 'Data Scientist', text: 'Data Scientist' },
    ]);
  });

  it('defaults to the first role from the backend', async () => {
    api.get.mockResolvedValue({
      data: { roles: [{ id: 'ML Engineer', label: 'ML Engineer' }] },
    });

    render(<UploadForm onSubmit={vi.fn()} loading={false} />);

    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/roles'));
    const select = screen.getByLabelText(/target role/i);
    expect(select.value).toBe('ML Engineer');
  });

  it('shows an error state when roles cannot be loaded', async () => {
    api.get.mockRejectedValue(new Error('network down'));

    render(<UploadForm onSubmit={vi.fn()} loading={false} />);

    expect(await screen.findByText(/could not load target roles/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /upload & extract skills/i }).disabled).toBe(true);
  });

  it('selects AI Engineer when opened from its role guide', async () => {
    api.get.mockResolvedValue({ data: { roles: [{ id: 'SDE', label: 'Software Development Engineer' }, { id: 'AI Engineer', label: 'AI Engineer' }] } });
    render(<UploadForm onSubmit={vi.fn()} loading={false} requestedRole="AI Engineer" />);
    await waitFor(() => expect(screen.getByLabelText(/target role/i).value).toBe('AI Engineer'));
  });

  it('passes LinkedIn URL and user-provided summary as optional inputs', async () => {
    api.get.mockResolvedValue({ data: { roles: [{ id: 'SDE', label: 'Software Development Engineer' }] } });
    const onSubmit = vi.fn();
    render(<UploadForm onSubmit={onSubmit} loading={false} />);
    await waitFor(() => expect(screen.getByLabelText(/target role/i).value).toBe('SDE'));

    fireEvent.change(screen.getByLabelText(/linkedin profile url/i), { target: { value: 'https://www.linkedin.com/in/example-user/' } });
    fireEvent.change(screen.getByLabelText(/linkedin about or profile text/i), { target: { value: 'Built React dashboards.' } });
    fireEvent.change(screen.getByLabelText(/resume \(pdf\)/i), { target: { files: [new File(['pdf'], 'resume.pdf', { type: 'application/pdf' })] } });
    fireEvent.submit(screen.getByRole('button', { name: /upload & extract skills/i }).closest('form'));

    expect(onSubmit).toHaveBeenCalledWith(expect.any(File), '', 'https://www.linkedin.com/in/example-user/', 'Built React dashboards.', '', 'SDE');
  });

  it.each([
    'https://www.linkedin.com:444/in/example-user/',
    'https://www.linkedin.com/in/example%ZZ/',
    'https://www.linkedin.com/in/example%2Fuser/',
  ])('allows a corrected LinkedIn URL after rejecting %s', async (invalidUrl) => {
    api.get.mockResolvedValue({ data: { roles: [{ id: 'SDE', label: 'Software Development Engineer' }] } });
    const onSubmit = vi.fn();
    render(<UploadForm onSubmit={onSubmit} loading={false} />);
    await waitFor(() => expect(screen.getByLabelText(/target role/i).value).toBe('SDE'));
    const resume = new File(['pdf'], 'resume.pdf', { type: 'application/pdf' });
    fireEvent.change(screen.getByLabelText(/resume \(pdf\)/i), { target: { files: [resume] } });
    const linkedinInput = screen.getByLabelText(/linkedin profile url/i);
    const form = screen.getByRole('button', { name: /upload & extract skills/i }).closest('form');
    fireEvent.change(linkedinInput, { target: { value: invalidUrl } });
    fireEvent.submit(form);
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText(/enter a public https linkedin profile url/i)).toBeTruthy();

    const correctedUrl = 'https://www.linkedin.com/in/maayav-%E6%9D%8E/';
    fireEvent.change(linkedinInput, { target: { value: correctedUrl } });
    fireEvent.submit(form);
    expect(onSubmit).toHaveBeenCalledWith(resume, '', correctedUrl, '', '', 'SDE');
    expect(screen.queryByText(/enter a public https linkedin profile url/i)).toBeNull();
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
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
});
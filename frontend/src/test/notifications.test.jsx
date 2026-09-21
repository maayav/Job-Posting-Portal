import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import NotificationBell from '../components/NotificationBell';
import { api } from '../api/client';

vi.mock('../api/client', () => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn() },
  errorMessage: (err) => err?.message ?? 'error',
}));

const notifications = [
  {
    id: 'n1',
    title: 'Application Under Review',
    message: 'Your application for "Backend Developer" is now "Under Review".',
    status: 'under_review',
    read: false,
    createdAt: new Date().toISOString(),
  },
];

describe('NotificationBell', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.get.mockResolvedValue({ data: { notifications, unreadCount: 1 } });
    api.patch.mockResolvedValue({ data: { notification: { ...notifications[0], read: true } } });
  });

  it('shows the unread count and latest notification', async () => {
    render(<NotificationBell />);
    expect(await screen.findByText('1')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /notifications/i }));
    expect(await screen.findByText('Application Under Review')).toBeTruthy();
    expect(screen.getByText(/your application for/i)).toBeTruthy();
  });

  it('marks a notification read when clicked', async () => {
    render(<NotificationBell />);
    fireEvent.click(await screen.findByRole('button', { name: /notifications/i }));
    fireEvent.click(await screen.findByText('Application Under Review'));

    await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/notifications/n1/read'));
  });

  it('marks every notification read', async () => {
    api.post.mockResolvedValue({ data: { ok: true } });
    render(<NotificationBell />);
    fireEvent.click(await screen.findByRole('button', { name: /notifications/i }));
    fireEvent.click(await screen.findByRole('button', { name: /mark all read/i }));

    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/notifications/read-all'));
  });
});
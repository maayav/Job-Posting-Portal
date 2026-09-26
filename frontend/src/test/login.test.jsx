import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import LoginPage from '../pages/LoginPage';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { ThemeProvider } from '../context/ThemeContext';
import { api } from '../api/client';

vi.mock('../api/client', () => ({
  api: { post: vi.fn() },
  errorMessage: (err) => err?.response?.data?.message ?? err?.message ?? 'error',
}));

function LogoutProbe() {
  const { logout } = useAuth();
  return <button onClick={logout}>Do logout</button>;
}

describe('Login page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('shows the blocked-session message when the account is already logged in', async () => {
    api.post.mockRejectedValue({
      response: {
        status: 409,
        data: {
          error: 'already_logged_in',
          message:
            'This account is already logged in on another device. Log out there first, or wait for that session to expire.',
        },
      },
    });

    render(
      <MemoryRouter>
        <AuthProvider>
          <ThemeProvider>
            <LoginPage />
          </ThemeProvider>
        </AuthProvider>
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'user@test.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'secret123' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'Log in' }).at(-1));

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('already logged in on another device');
    expect(api.post).toHaveBeenCalledWith('/auth/login', {
      email: 'user@test.com',
      password: 'secret123',
    });
  });

  it('calls the logout endpoint and clears local storage on logout', async () => {
    localStorage.setItem('token', 'test-token');
    localStorage.setItem('user', JSON.stringify({ id: 'u1', name: 'Test User', role: 'admin' }));
    api.post.mockResolvedValue({ data: {} });

    render(
      <MemoryRouter>
        <AuthProvider>
          <LogoutProbe />
        </AuthProvider>
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Do logout' }));

    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/auth/logout'));
    await waitFor(() => expect(localStorage.getItem('token')).toBeNull());
    expect(localStorage.getItem('user')).toBeNull();
  });
});

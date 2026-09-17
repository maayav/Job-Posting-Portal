import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ThemeProvider } from '../context/ThemeContext';
import ThemeToggle from '../components/ThemeToggle';

function renderToggle() {
  return render(<ThemeProvider><ThemeToggle /></ThemeProvider>);
}

describe('Theme preference', () => {
  beforeEach(() => {
    localStorage.clear();
    delete document.documentElement.dataset.theme;
  });

  it('updates the document and restores the selected theme after remounting', () => {
    const view = renderToggle();
    fireEvent.click(screen.getByRole('button', { name: 'Switch to dark mode' }));
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(localStorage.getItem('theme')).toBe('dark');
    view.unmount();
    renderToggle();
    expect(screen.getByRole('button', { name: 'Switch to light mode' })).toBeTruthy();
    expect(document.documentElement.dataset.theme).toBe('dark');
    fireEvent.click(screen.getByRole('button', { name: 'Switch to light mode' }));
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(localStorage.getItem('theme')).toBe('light');
  });

  it('normalizes an invalid stored preference', () => {
    localStorage.setItem('theme', 'invalid');
    renderToggle();
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(screen.getByRole('button', { name: 'Switch to dark mode' })).toBeTruthy();
  });

  it('keeps the toggle usable when browser storage is blocked', () => {
    const get = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('Storage blocked'); });
    const set = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Storage blocked'); });
    try {
      renderToggle();
      fireEvent.click(screen.getByRole('button', { name: 'Switch to dark mode' }));
      expect(document.documentElement.dataset.theme).toBe('dark');
    } finally {
      get.mockRestore();
      set.mockRestore();
    }
  });
});

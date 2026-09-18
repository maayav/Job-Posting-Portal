import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import ExplodedProductView from '../components/ExplodedProductView';
import { loadGsap } from '../utils/gsapRuntime';

vi.mock('../utils/gsapRuntime', () => ({ loadGsap: vi.fn() }));

const fakeGsap = {
  context: (fn) => {
    fn();
    return { revert: vi.fn() };
  },
  set: vi.fn(),
  timeline: () => ({ time: () => 0, to: vi.fn() }),
};

describe('Product tour behaviour', () => {
  beforeEach(() => {
    loadGsap.mockReset();
    loadGsap.mockResolvedValue({ gsap: fakeGsap, ScrollTrigger: { refresh: vi.fn() } });
  });

  it('starts the tour automatically and offers a reduce-motion opt-out', async () => {
    render(<ExplodedProductView />);
    await waitFor(() => expect(loadGsap).toHaveBeenCalled());
    expect(document.querySelector('#product-tour').classList.contains('epv-static')).toBe(false);
    expect(screen.getByRole('button', { name: /reduce motion/i }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByText('Jordan Davis')).toBeTruthy();
  });

  it('lets visitors explore every product chapter without scrolling', () => {
    render(<ExplodedProductView />);
    const chapters = [
      [/02\s*Role match/, 'Find work that fits.', 'Junior Data Analyst'],
      [/03\s*Readiness score/, 'See where you stand.', 'Data Analyst'],
      [/04\s*Next actions/, 'Turn insight into progress.', 'Your next three moves.'],
      [/01\s*Profile evidence/, 'Start with what you know.', 'Jordan Davis'],
    ];
    for (const [button, title, detail] of chapters) {
      fireEvent.click(screen.getByRole('button', { name: button }));
      expect(screen.getByRole('heading', { name: title })).toBeTruthy();
      expect(screen.getByRole('button', { name: button }).getAttribute('aria-pressed')).toBe('true');
      expect(document.querySelector('.epv-layer.is-selected').textContent).toContain(detail);
      expect(document.querySelectorAll('.epv-layer[aria-hidden="false"]').length).toBe(1);
    }
  });

  it('lets visitors reduce motion and restart the tour', async () => {
    render(<ExplodedProductView />);
    await waitFor(() => expect(loadGsap).toHaveBeenCalled());

    fireEvent.click(screen.getByRole('button', { name: /reduce motion/i }));
    await waitFor(() => expect(document.querySelector('#product-tour').classList.contains('epv-static')).toBe(true));

    const animate = screen.getByRole('button', { name: /animate tour/i });
    expect(animate.getAttribute('aria-pressed')).toBe('false');

    fireEvent.click(animate);
    await waitFor(() => expect(document.querySelector('#product-tour').classList.contains('epv-static')).toBe(false));
  });

  it('falls back to the compact navigable tour if the animation bundle cannot load', async () => {
    loadGsap.mockRejectedValueOnce(new Error('Animation bundle unavailable'));
    render(<ExplodedProductView />);
    await waitFor(() => expect(document.querySelector('#product-tour').classList.contains('epv-static')).toBe(true));
    fireEvent.click(screen.getByRole('button', { name: /04\s*Next actions/ }));
    expect(screen.getByRole('heading', { name: 'Turn insight into progress.' })).toBeTruthy();
  });
});
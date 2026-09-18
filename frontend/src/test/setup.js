import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

if (!window.matchMedia) {
  window.matchMedia = vi.fn().mockImplementation((media) => ({
    matches: media.includes('prefers-reduced-motion: reduce'),
    media,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

// jsdom does not implement IntersectionObserver, which Motion's whileInView
// (used by the landing page scroll reveals) requires.
if (!globalThis.IntersectionObserver) {
  globalThis.IntersectionObserver = class {
    constructor(callback) {
      this.callback = callback;
    }
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
  };
}

if (!globalThis.ResizeObserver) {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

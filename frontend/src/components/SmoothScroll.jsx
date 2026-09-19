import { useEffect } from 'react';
import Lenis from 'lenis';

export default function SmoothScroll() {
  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (preference.matches) return;

    const lenis = new Lenis({
      duration: 1.05,
      smoothWheel: true,
      syncTouch: false,
    });

    // Keep in-page navigation in the same motion system as wheel scrolling.
    // Lenis otherwise leaves hash links to the browser's instant jump.
    const onAnchorClick = (event) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = event.target.closest?.('a[href^="#"]');
      if (!link) return;
      const hash = link.getAttribute('href');
      if (!hash || hash === '#') return;
      const target = document.querySelector(hash);
      if (!target) return;
      event.preventDefault();
      history.replaceState(null, '', hash);
      lenis.scrollTo(target, { offset: -88 });
    };
    document.addEventListener('click', onAnchorClick);

    let frame;
    const raf = (time) => {
      lenis.raf(time);
      frame = requestAnimationFrame(raf);
    };
    frame = requestAnimationFrame(raf);

    function stopForReducedMotion(event) {
      if (event.matches) {
        cancelAnimationFrame(frame);
        document.removeEventListener('click', onAnchorClick);
        lenis.destroy();
      }
    }
    preference.addEventListener('change', stopForReducedMotion);

    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('click', onAnchorClick);
      lenis.destroy();
      preference.removeEventListener('change', stopForReducedMotion);
    };
  }, []);

  return null;
}

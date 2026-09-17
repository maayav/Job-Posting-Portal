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

    let frame;
    const raf = (time) => {
      lenis.raf(time);
      frame = requestAnimationFrame(raf);
    };
    frame = requestAnimationFrame(raf);

    function stopForReducedMotion(event) {
      if (event.matches) {
        cancelAnimationFrame(frame);
        lenis.destroy();
      }
    }
    preference.addEventListener('change', stopForReducedMotion);

    return () => {
      cancelAnimationFrame(frame);
      lenis.destroy();
      preference.removeEventListener('change', stopForReducedMotion);
    };
  }, []);

  return null;
}

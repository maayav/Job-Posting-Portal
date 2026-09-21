import { useContext, useLayoutEffect, useRef } from 'react';
import { waapi } from 'animejs';
import { LandingMotionContext } from '../context/LandingMotionContext';

const origins = { left: [-24, 8], right: [24, 8], up: [0, 22], down: [0, -18] };

export default function ScrollReveal({ as = 'div', direction = 'up', delay = 0, stagger = false, children, ...props }) {
  const ref = useRef(null);
  const completed = useRef(new WeakSet());
  const motionEnabled = useContext(LandingMotionContext);

  useLayoutEffect(() => {
    const element = ref.current;
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (!element || motionEnabled === false || (motionEnabled !== true && media.matches)
      || !('IntersectionObserver' in window) || !element.animate) return;

    const targets = stagger ? Array.from(element.children) : [element];
    const [x, y] = origins[direction] ?? origins.up;
    const started = new Set();
    const animations = new Map();
    const clear = (target) => target.removeAttribute('data-reveal-pending');
    const finish = (target) => {
      completed.current.add(target);
      observer.unobserve(target);
      clear(target);
      const animation = animations.get(target);
      if (animation) {
        animation.onComplete = () => {};
        animation.revert();
        animations.delete(target);
      }
    };
    const reveal = (target) => {
      if (started.has(target) || completed.current.has(target)) return;
      started.add(target);
      observer.unobserve(target);
      try {
        // Start synchronously, without waiting for an animation bundle.
        // Individual translate leaves card hover transforms untouched.
        const animation = waapi.animate(target, {
          opacity: [0, 1],
          translate: [`${x}px ${y}px`, '0px 0px'],
          duration: 620,
          delay: (delay + (stagger ? targets.indexOf(target) * .07 : 0)) * 1000,
          ease: 'out(3)',
          onComplete: () => finish(target),
        });
        animations.set(target, animation);
      } catch {
        finish(target);
      }
    };
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => { if (entry.isIntersecting) reveal(entry.target); });
    }, { rootMargin: '0px 0px -16px 0px', threshold: 0 });

    targets.forEach((target) => {
      if (completed.current.has(target)) return;
      const rect = target.getBoundingClientRect();
      if (rect.bottom < 0) return;
      // Prepare before the first paint, never after content becomes visible.
      target.setAttribute('data-reveal-pending', '');
      if (rect.top < window.innerHeight - 16 && rect.bottom > 0
        && rect.left < window.innerWidth && rect.right > 0) reveal(target);
      else observer.observe(target);
    });

    const finishAll = () => targets.forEach(finish);
    const onMotionChange = () => { if (media.matches && motionEnabled !== true) finishAll(); };
    element.addEventListener('focusin', finishAll);
    media.addEventListener('change', onMotionChange);
    return () => {
      observer.disconnect();
      element.removeEventListener('focusin', finishAll);
      media.removeEventListener('change', onMotionChange);
      animations.forEach((animation) => {
        animation.onComplete = () => {};
        animation.revert();
      });
      targets.forEach(clear);
    };
  }, [delay, direction, stagger, motionEnabled]);

  const Tag = as;
  return <Tag {...props} ref={ref} data-reveal-direction={direction}>{children}</Tag>;
}

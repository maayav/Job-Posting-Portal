import { useContext, useLayoutEffect, useRef, useState } from 'react';
import { animate } from 'animejs';
import { LandingMotionContext } from '../context/LandingMotionContext';

const origins = { left: [-24, 8], right: [24, 8], up: [0, 22], down: [0, -18] };

export default function ScrollReveal({ as = 'div', direction = 'up', delay = 0, stagger = false, children, ...props }) {
  const ref = useRef(null);
  const [prepared, setPrepared] = useState(false);
  const completed = useRef(new WeakSet());
  const motionEnabled = useContext(LandingMotionContext);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (motionEnabled === false || (motionEnabled !== true && media.matches)
      || typeof window.IntersectionObserver !== 'function') {
      // Release the initial visibility gate before paint.
      // oxlint-disable-next-line react/set-state-in-effect
      setPrepared(true);
      return;
    }

    const targets = stagger ? Array.from(element.children) : [element];
    const [x, y] = origins[direction] ?? origins.up;
    const started = new Set();
    const animations = new Map();
    const opacityStyles = new Map();
    const clear = (target) => {
      target.removeAttribute('data-reveal-pending');
      const original = opacityStyles.get(target);
      if (!original) return;
      if (original.value) target.style.setProperty('opacity', original.value, original.priority);
      else target.style.removeProperty('opacity');
      opacityStyles.delete(target);
    };
    const finish = (target) => {
      completed.current.add(target);
      observer.unobserve(target);
      const animation = animations.get(target);
      if (animation) {
        animation.onComplete = () => {};
        animation.revert();
        animations.delete(target);
      }
      clear(target);
    };
    const reveal = (target) => {
      if (started.has(target) || completed.current.has(target)) return;
      started.add(target);
      observer.unobserve(target);
      try {
        // Keep opacity and movement on one timeline. The WAAPI wrapper creates
        // separate effects which commit/cancel independently at the final frame.
        // Individual translate leaves card hover transforms untouched.
        const animation = animate(target, {
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
      // Inline opacity also covers the first frame before route CSS is applied.
      opacityStyles.set(target, { value: target.style.getPropertyValue('opacity'), priority: target.style.getPropertyPriority('opacity') });
      target.style.setProperty('opacity', '0');
      target.setAttribute('data-reveal-pending', '');
      if (rect.top < window.innerHeight - 16 && rect.bottom > 0
        && rect.left < window.innerWidth && rect.right > 0) reveal(target);
      else observer.observe(target);
    });
    // DOM targets must be prepared before the subtree is shown.
    // oxlint-disable-next-line react/set-state-in-effect
    setPrepared(true);

    const finishAll = () => targets.forEach(finish);
    const onMotionChange = () => { if (media.matches && motionEnabled !== true) finishAll(); };
    element.addEventListener('focusin', finishAll);
    media.addEventListener('change', onMotionChange);
    return () => {
      observer.disconnect();
      element.removeEventListener('focusin', finishAll);
      media.removeEventListener('change', onMotionChange);
      // An interrupted entrance must settle visibly, never hide and start again
      // when an effect is set up again (prop changes or Strict Mode cleanup).
      started.forEach(finish);
      targets.forEach(clear);
    };
  }, [delay, direction, stagger, motionEnabled]);

  const Tag = as;
  // Conceal the initial subtree in the React commit itself, before layout effects
  // prepare staggered children. Visibility never participates in the animation.
  const style = !prepared && motionEnabled === true
    ? { ...props.style, visibility: 'hidden' } : props.style;
  return <Tag {...props} style={style} ref={ref} data-reveal-direction={direction}>{children}</Tag>;
}

import { useContext, useLayoutEffect, useRef } from 'react';
import { loadGsap } from '../utils/gsapRuntime';
import { LandingMotionContext } from '../context/LandingMotionContext';

const origins = { left: [-42, 16], right: [42, 16], up: [0, 34], down: [0, -28] };

export default function ScrollReveal({ as = 'div', direction = 'up', delay = 0, stagger = false, children, ...props }) {
  const ref = useRef(null);
  const revealed = useRef(false);
  const motionEnabled = useContext(LandingMotionContext);
  useLayoutEffect(() => {
    const element = ref.current;
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (!element || revealed.current || motionEnabled === false || (motionEnabled === null && media.matches) || !('IntersectionObserver' in window) || element.getBoundingClientRect().bottom < 0) return;
    const targets = stagger ? Array.from(element.children) : [element];
    const [x, y] = origins[direction] ?? origins.up;
    const isInitiallyVisible = targets.some((target) => {
      const rect = target.getBoundingClientRect();
      return rect.top < window.innerHeight * .92 && rect.bottom > 0;
    });

    // Anything already on screen must render in its final state. Hiding it for
    // one frame while the observer starts is what caused the hero/footer flash.
    if (isInitiallyVisible) {
      revealed.current = true;
      return;
    }

    let cancelled = false;
    let finished = false;
    let context;
    let gsapInstance;
    const clear = () => targets.forEach((target) => {
      target.removeAttribute('data-reveal-pending');
      target.style.removeProperty('--reveal-x');
      target.style.removeProperty('--reveal-y');
    });
    const finish = () => {
      revealed.current = true;
      finished = true;
      observer.disconnect();
      gsapInstance?.killTweensOf(targets);
      gsapInstance?.set(targets, { clearProps: 'opacity,transform' });
      clear();
    };
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      revealed.current = true;
      observer.disconnect();
      targets.forEach((target) => {
        target.style.setProperty('--reveal-x', `${x}px`);
        target.style.setProperty('--reveal-y', `${y}px`);
        target.setAttribute('data-reveal-pending', '');
      });
      loadGsap().then(({ gsap }) => {
        if (cancelled || finished) return;
        gsapInstance = gsap;
        context = gsap.context(() => {
          gsap.fromTo(targets, { x, y }, {
            x: 0, y: 0, duration: .72, delay,
            stagger: stagger ? .09 : 0, ease: 'power3.out',
            clearProps: 'opacity,transform', onComplete: clear,
          });
        }, element);
      }).catch(clear);
    }, { rootMargin: '0px 0px -24px 0px', threshold: .08 });
    observer.observe(element);
    element.addEventListener('focusin', finish);
    const onMotionChange = () => { if (media.matches && motionEnabled !== true) finish(); };
    media.addEventListener('change', onMotionChange);
    return () => {
      cancelled = true;
      observer.disconnect();
      element.removeEventListener('focusin', finish);
      media.removeEventListener('change', onMotionChange);
      context?.revert();
      clear();
    };
  }, [delay, direction, stagger, motionEnabled]);
  const Tag = as;
  return <Tag {...props} ref={ref} data-reveal-direction={direction}>{children}</Tag>;
}

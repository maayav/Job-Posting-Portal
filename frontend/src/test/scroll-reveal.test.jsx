import { StrictMode } from 'react';
import { act, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { waapi } from 'animejs';
vi.mock('animejs', () => ({ waapi: { animate: vi.fn() } }));
import ScrollReveal from '../components/ScrollReveal';
import { LandingMotionContext } from '../context/LandingMotionContext';

describe('Landing page reveals', () => {
  let observers;
  let animations;
  let animate;
  let top;
  let previousAnimate;

  beforeEach(() => {
    observers = [];
    animations = [];
    top = 1200;
    previousAnimate = Element.prototype.animate;
    animate = waapi.animate.mockReset().mockImplementation((target, options) => {
      const animation = { revert: vi.fn(), onComplete: options.onComplete };
      animations.push(animation);
      return animation;
    });
    Element.prototype.animate = vi.fn();
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(() => ({
      top, bottom: top + 100, left: 0, right: 300, width: 300, height: 100,
    }));
    vi.stubGlobal('IntersectionObserver', class {
      constructor(callback) {
        this.callback = callback;
        this.observe = vi.fn();
        this.unobserve = vi.fn();
        this.disconnect = vi.fn();
        observers.push(this);
      }
    });
  });

  afterEach(() => {
    if (previousAnimate) Element.prototype.animate = previousAnimate;
    else delete Element.prototype.animate;
    vi.unstubAllGlobals();
  });

  function mount(content) {
    return render(<LandingMotionContext.Provider value={true}>{content}</LandingMotionContext.Provider>);
  }
  function enter(target, observer = observers.at(-1)) {
    act(() => observer.callback([{ target, isIntersecting: true }]));
  }

  it('prepares offscreen content before paint, fades it once, and preserves hover transforms', () => {
    const { container, rerender } = mount(<ScrollReveal style={{ transform: 'scale(1.02)' }}>Card</ScrollReveal>);
    const card = container.firstChild;
    expect(card.hasAttribute('data-reveal-pending')).toBe(true);
    expect(animate).not.toHaveBeenCalled();
    enter(card);
    expect(animate.mock.calls[0][1]).toMatchObject({ opacity: [0, 1], translate: ['0px 22px', '0px 0px'] });
    act(() => animations[0].onComplete());
    expect(card.hasAttribute('data-reveal-pending')).toBe(false);
    expect(card.style.transform).toBe('scale(1.02)');
    expect(animations[0].revert).toHaveBeenCalled();
    enter(card);
    rerender(<LandingMotionContext.Provider value={true}><ScrollReveal delay={.2}>Card</ScrollReveal></LandingMotionContext.Provider>);
    expect(animate).toHaveBeenCalledTimes(1);
    expect(card.hasAttribute('data-reveal-pending')).toBe(false);
  });

  it('animates the hero immediately, including after Strict Mode effect cleanup', () => {
    top = 100;
    const { container } = render(<StrictMode><LandingMotionContext.Provider value={true}><ScrollReveal>Hero</ScrollReveal></LandingMotionContext.Provider></StrictMode>);
    expect(animate).toHaveBeenCalledTimes(2);
    expect(animations[0].revert).toHaveBeenCalled();
    expect(animations[1].revert).not.toHaveBeenCalled();
    act(() => animations[1].onComplete());
    expect(container.firstChild.hasAttribute('data-reveal-pending')).toBe(false);
  });

  it('observes staggered children individually so mobile cards wait until visible', () => {
    const { container } = mount(<ScrollReveal stagger><article>First</article><article>Second</article></ScrollReveal>);
    const [first, second] = container.firstChild.children;
    expect(observers[0].observe).toHaveBeenCalledWith(first);
    expect(observers[0].observe).toHaveBeenCalledWith(second);
    enter(first);
    expect(animate).toHaveBeenCalledTimes(1);
    expect(second.hasAttribute('data-reveal-pending')).toBe(true);
    enter(second);
    expect(animate.mock.calls[1][1].delay).toBe(70);
  });

  it('makes keyboard-focused content visible immediately and cancels pending motion', () => {
    const { container, getByRole } = mount(<ScrollReveal><a href="#home">Home</a></ScrollReveal>);
    enter(container.firstChild);
    fireEvent.focus(getByRole('link'));
    expect(container.firstChild.hasAttribute('data-reveal-pending')).toBe(false);
    expect(animations[0].revert).toHaveBeenCalled();
  });

  it('keeps content visible when native animation fails or is unavailable', () => {
    animate.mockImplementation(() => { throw new Error('Animation unavailable'); });
    top = 100;
    const { container, unmount } = mount(<ScrollReveal>Fallback</ScrollReveal>);
    expect(container.firstChild.hasAttribute('data-reveal-pending')).toBe(false);
    unmount();
    delete Element.prototype.animate;
    const fallback = mount(<ScrollReveal>No animation API</ScrollReveal>);
    expect(fallback.container.firstChild.hasAttribute('data-reveal-pending')).toBe(false);
  });

  it('respects reduced motion unless landing motion is explicitly enabled', () => {
    const { container } = render(<ScrollReveal>Reduced motion</ScrollReveal>);
    expect(container.firstChild.hasAttribute('data-reveal-pending')).toBe(false);
    expect(animate).not.toHaveBeenCalled();
  });
});

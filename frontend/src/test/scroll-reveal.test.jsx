import { StrictMode } from 'react';
import { act, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { animate as animeAnimate } from 'animejs';
vi.mock('animejs', () => ({ animate: vi.fn() }));
import ScrollReveal from '../components/ScrollReveal';
import { LandingMotionContext } from '../context/LandingMotionContext';

describe('Landing page reveals', () => {
  let observers;
  let animations;
  let animate;
  let top;

  beforeEach(() => {
    observers = [];
    animations = [];
    top = 1200;
    animate = animeAnimate.mockReset().mockImplementation((target, options) => {
      const animation = { revert: vi.fn(), onComplete: options.onComplete };
      animations.push(animation);
      return animation;
    });
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
    expect(card.style.opacity).toBe('0');
    expect(animate).not.toHaveBeenCalled();
    enter(card);
    expect(animate.mock.calls[0][1]).toMatchObject({ opacity: [0, 1], translate: ['0px 22px', '0px 0px'] });
    act(() => animations[0].onComplete());
    expect(card.hasAttribute('data-reveal-pending')).toBe(false);
    expect(card.style.transform).toBe('scale(1.02)');
    expect(card.style.opacity).toBe('');
    expect(animations[0].revert).toHaveBeenCalled();
    enter(card);
    rerender(<LandingMotionContext.Provider value={true}><ScrollReveal delay={.2}>Card</ScrollReveal></LandingMotionContext.Provider>);
    expect(animate).toHaveBeenCalledTimes(1);
    expect(card.hasAttribute('data-reveal-pending')).toBe(false);
  });

  it('settles the hero visibly during Strict Mode cleanup instead of hiding and replaying', () => {
    top = 100;
    const { container } = render(<StrictMode><LandingMotionContext.Provider value={true}><ScrollReveal>Hero</ScrollReveal></LandingMotionContext.Provider></StrictMode>);
    expect(animate).toHaveBeenCalledTimes(1);
    expect(animations[0].revert).toHaveBeenCalled();
    expect(container.firstChild.hasAttribute('data-reveal-pending')).toBe(false);
    expect(container.firstChild.style.opacity).toBe('');
  });

  it('conceals the initial subtree until staggered entrances are prepared', () => {
    top = 100;
    const startingVisibilities = [];
    animate.mockImplementation((target, options) => {
      startingVisibilities.push(target.parentElement.style.visibility);
      const animation = { revert: vi.fn(), onComplete: options.onComplete };
      animations.push(animation);
      return animation;
    });
    const { container } = mount(<ScrollReveal stagger><p>Title</p><p>Copy</p></ScrollReveal>);
    expect(startingVisibilities).toEqual(['hidden', 'hidden']);
    expect(container.firstChild.style.visibility).toBe('');
    expect(Array.from(container.firstChild.children).every(child => child.style.opacity === '0')).toBe(true);
  });

  it('restores caller opacity after animation cleanup and when pending motion is disabled', () => {
    const { container, rerender } = mount(<ScrollReveal style={{ opacity: .7 }}>Card</ScrollReveal>);
    const card = container.firstChild;
    expect(card.style.opacity).toBe('0');
    enter(card);
    animations[0].revert.mockImplementation(() => { card.style.opacity = '0'; });
    act(() => animations[0].onComplete());
    expect(card.style.opacity).toBe('0.7');
    rerender(<LandingMotionContext.Provider value={false}><ScrollReveal style={{ opacity: .7 }}>Card</ScrollReveal></LandingMotionContext.Provider>);
    expect(card.style.opacity).toBe('0.7');
  });

  it('restores offscreen content when pending motion is disabled before intersection', () => {
    const { container, rerender } = mount(<ScrollReveal>Card</ScrollReveal>);
    expect(container.firstChild.style.opacity).toBe('0');
    rerender(<LandingMotionContext.Provider value={false}><ScrollReveal>Card</ScrollReveal></LandingMotionContext.Provider>);
    expect(container.firstChild.style.opacity).toBe('');
    expect(container.firstChild.hasAttribute('data-reveal-pending')).toBe(false);
    expect(animate).not.toHaveBeenCalled();
  });

  it('does not restart an in-progress entrance when its effect settings change', () => {
    const { container, rerender } = mount(<ScrollReveal>Card</ScrollReveal>);
    const card = container.firstChild;
    enter(card);
    rerender(<LandingMotionContext.Provider value={true}><ScrollReveal delay={.2} direction="left">Card</ScrollReveal></LandingMotionContext.Provider>);
    expect(card.hasAttribute('data-reveal-pending')).toBe(false);
    expect(animations[0].revert).toHaveBeenCalled();
    enter(card);
    expect(animate).toHaveBeenCalledTimes(1);
  });

  it('keeps revealed content visible when motion is switched off and back on', () => {
    const { container, rerender } = mount(<ScrollReveal>Card</ScrollReveal>);
    const card = container.firstChild;
    enter(card);
    rerender(<LandingMotionContext.Provider value={false}><ScrollReveal>Card</ScrollReveal></LandingMotionContext.Provider>);
    expect(card.hasAttribute('data-reveal-pending')).toBe(false);
    rerender(<LandingMotionContext.Provider value={true}><ScrollReveal>Card</ScrollReveal></LandingMotionContext.Provider>);
    expect(card.hasAttribute('data-reveal-pending')).toBe(false);
    expect(animate).toHaveBeenCalledTimes(1);
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

  it('keeps content visible when animation fails or scroll observation is unavailable', () => {
    animate.mockImplementation(() => { throw new Error('Animation unavailable'); });
    top = 100;
    const { container, unmount } = mount(<ScrollReveal>Fallback</ScrollReveal>);
    expect(container.firstChild.hasAttribute('data-reveal-pending')).toBe(false);
    unmount();
    vi.stubGlobal('IntersectionObserver', undefined);
    delete window.IntersectionObserver;
    const fallback = mount(<ScrollReveal>No scroll observer</ScrollReveal>);
    expect(fallback.container.firstChild.hasAttribute('data-reveal-pending')).toBe(false);
  });

  it('respects reduced motion unless landing motion is explicitly enabled', () => {
    const { container } = render(<ScrollReveal>Reduced motion</ScrollReveal>);
    expect(container.firstChild.hasAttribute('data-reveal-pending')).toBe(false);
    expect(animate).not.toHaveBeenCalled();
  });
});

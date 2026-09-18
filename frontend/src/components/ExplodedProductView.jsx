import { useEffect, useRef, useState } from 'react';
import Icon from './Icon';
import { loadGsap } from '../utils/gsapRuntime';
import '../styles/exploded-product-view.css';

const layers = [
  { id: 'profile', number: '01', name: 'Profile evidence', title: 'Start with what you know.', copy: 'Bring your resume and projects together. See the experience you already have, clearly.', icon: 'file', eyebrow: 'YOUR STARTING POINT' },
  { id: 'match', number: '02', name: 'Role match', title: 'Find work that fits.', copy: 'Connect your strengths to relevant opportunities, with the reasons behind each match.', icon: 'briefcase', eyebrow: 'POSSIBILITY, WITH CONTEXT' },
  { id: 'readiness', number: '03', name: 'Readiness score', title: 'See where you stand.', copy: 'Understand your strengths, spot the gaps, and make your next step a deliberate one.', icon: 'chart', eyebrow: 'A CLEARER PICTURE' },
  { id: 'actions', number: '04', name: 'Next actions', title: 'Turn insight into progress.', copy: 'Leave with a practical plan. Small, focused steps bring your next opportunity closer.', icon: 'check', eyebrow: 'YOUR NEXT CHAPTER' },
];
const focusTimes = [0, 1, 2, 3];
const scenePositions = [{ x: 0, y: 0, rotation: -6 }, { x: 68, y: -34, rotation: 7 }, { x: 136, y: 25, rotation: -8 }, { x: 204, y: -17, rotation: 5 }];
const timelineDuration = 3.35;

function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const media = window.matchMedia(query);
    const update = () => setMatches(media.matches);
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, [query]);
  return matches;
}

function LayerContent({ id }) {
  if (id === 'profile') return <>
    <div className="epv-person"><span className="epv-avatar">JD</span><div><strong>Jordan Davis</strong><span>Aspiring data analyst</span></div><span className="epv-small-badge">Your profile</span></div>
    <div className="epv-document"><Icon name="file" size={20} /><div><strong>Jordan_Davis_Resume.pdf</strong><span>Experience, brought together</span></div><Icon name="check" size={16} /></div>
    <div className="epv-card-bottom"><span>2 projects · 6 skills</span><div className="epv-tags"><span>Python</span><span>SQL</span><span>Analysis</span></div></div>
  </>;
  if (id === 'match') return <>
    <div className="epv-person"><span className="epv-avatar">N</span><div><strong>Junior Data Analyst</strong><span>Northstar · Remote</span></div></div>
    <div className="epv-match-score"><div><strong>92<span>%</span></strong><span>Profile match</span></div><p>A strong connection<br />to your existing skills.</p></div>
    <div className="epv-card-bottom"><span>What connects you</span><div className="epv-tags"><span><Icon name="check" size={11} /> SQL</span><span><Icon name="check" size={11} /> Python</span><span>Reporting</span></div></div>
  </>;
  if (id === 'readiness') return <>
    <div className="epv-readiness-summary"><div><strong>Data Analyst</strong><span>A strong foundation to build on.</span></div><div className="epv-score-ring"><strong>84</strong><span>/ 100</span></div></div>
    <div className="epv-skill-bars">{[['Python', 90], ['Data analysis', 78], ['Statistics', 62]].map(([skill, score]) => <div key={skill}><span>{skill}</span><i><b style={{ width: `${score}%` }} /></i><span>{score}%</span></div>)}</div>
    <div className="epv-card-bottom"><span>Know your strengths. Choose your focus.</span></div>
  </>;
  return <>
    <div className="epv-plan-heading"><strong>Your next three moves.</strong><span>A focused plan, built around you.</span></div>
    <div className="epv-task-list">{[['01', 'Build a SQL portfolio', 'Practice · 2 hours'], ['02', 'Explore data storytelling', 'Learn · 45 minutes'], ['03', 'Prepare for your next interview', 'Apply your skills']].map(([number, title, detail]) => <div key={number}><span>{number}</span><div><strong>{title}</strong><span>{detail}</span></div><Icon name="arrow" size={14} /></div>)}</div>
  </>;
}

/** A camera travels between product cards laid out along an uneven path. */
export default function ExplodedProductView() {
  const sectionRef = useRef(null);
  const triggerRef = useRef(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [motionChoice, setMotionChoice] = useState(null);
  const compact = useMediaQuery('(max-width: 720px)');
  const shortScreen = useMediaQuery('(max-height: 600px)');
  const [animationFailed, setAnimationFailed] = useState(false);
  // The tour starts automatically; "Reduce motion" remains available as an opt-out.
  const motionEnabled = motionChoice ?? true;
  const animated = motionEnabled && !shortScreen && !animationFailed;

  useEffect(() => {
    const section = sectionRef.current;
    if (!section || !animated) return undefined;
    let cancelled = false;
    let context;
    let refreshFrame;
    let resizeObserver;
    let travelDistance = 1;
    loadGsap().then(({ gsap, ScrollTrigger }) => {
      if (cancelled) return;
      const shell = section.querySelector('.epv-sticky-shell');
      const world = section.querySelector('.epv-world');
      const cards = Array.from(section.querySelectorAll('.epv-layer'));
      const progress = section.querySelector('.epv-travel-progress i');
      context = gsap.context(() => {
        cards.forEach((card, index) => gsap.set(card, {
          xPercent: -50, yPercent: -50,
          x: 0, y: 0,
          rotation: index === 0 ? 0 : scenePositions[index].rotation,
          scale: index === 0 ? 1 : .84,
          opacity: index === 0 ? 1 : .32,
          zIndex: index === 0 ? 4 : 1,
        }));
        gsap.set(world, { xPercent: 0, yPercent: 0 });
        gsap.set(progress, { scaleX: 0 });
        section.classList.add('epv-ready');
        const timeline = gsap.timeline({
          onUpdate() {
            const time = this.time();
            // Update the story with the camera, rather than the raw scroll position.
            const next = Math.min(3, Math.max(0, Math.floor(time + .32)));
            setActiveIndex(current => current === next ? current : next);
          },
          scrollTrigger: {
            trigger: section,
            start: () => `top ${compact ? 82 : 96}px`,
            end: () => `+=${travelDistance}`,
            scrub: .65,
            invalidateOnRefresh: true,
          },
        });
        triggerRef.current = timeline.scrollTrigger;
        for (let focus = 1; focus < layers.length; focus += 1) {
          const start = focus - .66;
          timeline.to(world, {
            xPercent: -scenePositions[focus].x,
            yPercent: -scenePositions[focus].y,
            duration: .66, ease: 'power2.inOut',
          }, start);
          cards.forEach((card, index) => {
            timeline.to(card, {
              scale: index === focus ? 1 : .84,
              rotation: index === focus ? 0 : scenePositions[index].rotation,
              opacity: index === focus ? 1 : .32,
              zIndex: index === focus ? 4 : 1,
              duration: .66, ease: 'power2.inOut',
            }, start);
          });
        }
        timeline.to(progress, { scaleX: 1, duration: timelineDuration, ease: 'none' }, 0);
      }, section);
      resizeObserver = new ResizeObserver(() => {
        const distance = Math.max(1, section.offsetHeight - shell.offsetHeight);
        if (cancelled || distance === travelDistance) return;
        travelDistance = distance;
        ScrollTrigger.refresh();
      });
      resizeObserver.observe(section);
      resizeObserver.observe(shell);
      // Switching from the static tour changes page height. Measure after layout.
      refreshFrame = requestAnimationFrame(() => ScrollTrigger.refresh());
    }).catch(() => { if (!cancelled) setAnimationFailed(true); });
    return () => {
      cancelled = true;
      cancelAnimationFrame(refreshFrame);
      resizeObserver?.disconnect();
      context?.revert();
      triggerRef.current = null;
      section.classList.remove('epv-ready');
    };
  }, [animated, compact]);

  function selectLayer(index) {
    const trigger = triggerRef.current;
    if (!animated || !trigger) { setActiveIndex(index); return; }
    window.scrollTo({
      top: trigger.start + (trigger.end - trigger.start) * (focusTimes[index] / timelineDuration),
      behavior: 'smooth',
    });
  }

  const activeLayer = layers[activeIndex];
  return <section className={`exploded-product-section${animated ? '' : ' epv-static'}`} id="product-tour" ref={sectionRef} aria-labelledby="epv-title">
    <div className="epv-sticky-shell">
      <div className="epv-heading">
        <p className="epv-kicker"><span /> A PRODUCT THAT MOVES WITH YOU</p>
        <h2 id="epv-title">Every part of your next move, <em>in focus.</em></h2>
        <p>From the experience you have to the opportunity ahead.</p>
      </div>
      <div className="epv-layout">
        <div className="epv-story">
          <div className="epv-chapter"><span>{activeLayer.number}</span><i /><span>YOUR JOURNEY / 04</span></div>
          <div className="epv-copy" key={activeLayer.id} aria-live="polite" aria-atomic="true">
            <p className="epv-current-label">{activeLayer.eyebrow}</p>
            <h3>{activeLayer.title}</h3><p>{activeLayer.copy}</p>
          </div>
          <div className="epv-step-nav" role="group" aria-label="Explore product layers">
            {layers.map((layer, index) => <button className={`epv-step-button${activeIndex === index ? ' is-active' : ''}`} type="button" key={layer.id} aria-pressed={activeIndex === index} onClick={() => selectLayer(index)}><span className="epv-step-number">{layer.number}</span><span>{layer.name}</span><Icon name="arrow" size={15} /></button>)}
          </div>
          <p className="epv-interaction-hint">{animated ? 'Scroll to travel. Or choose a chapter.' : 'Choose a chapter to explore.'}</p>
        </div>
        <div className="epv-visual" aria-label="Interactive preview of Vortex career workspace">
          <div className="epv-visual-topline"><span><i /> VORTEX / PRODUCT WALKTHROUGH</span><span>ILLUSTRATIVE DATA</span></div>
          <span className="epv-scene-number" aria-hidden="true">{activeLayer.number}</span>
          <div className="epv-world" aria-label={`Showing ${activeLayer.name}`}>
            {layers.map((layer, index) => <article className={`epv-layer epv-layer-${layer.id}${activeIndex === index ? ' is-selected' : ''}`} key={layer.id} style={{ '--scene-x': `${scenePositions[index].x}%`, '--scene-y': `${scenePositions[index].y}%` }} aria-hidden={activeIndex !== index}>
              <div className="epv-layer-topline"><span className="epv-layer-symbol"><Icon name={layer.icon} size={16} /></span><span>{layer.name}</span><span className="epv-layer-index">{layer.number} / 04</span></div>
              <LayerContent id={layer.id} />
            </article>)}
          </div>
          <div className="epv-visual-footer"><span>{activeLayer.number} — 04</span>{!shortScreen && !animationFailed && <button className="epv-motion-toggle" type="button" aria-pressed={motionEnabled} onClick={() => setMotionChoice(!motionEnabled)}>{motionEnabled ? 'Reduce motion' : 'Animate tour'}<Icon name="arrow" size={12} /></button>}</div>
          <div className="epv-travel-progress" aria-hidden="true"><i style={animated ? undefined : { transform: `scaleX(${(activeIndex + 1) / 4})` }} /></div>
        </div>
      </div>
    </div>
  </section>;
}

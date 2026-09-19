import { useEffect, useRef } from 'react';

// Fixed geometry keeps the animation independent of scrolling and React renders.
const contours = Array.from({ length: 12 }, (_, index) => {
  const offset = index * 28;
  return `M ${-240 + offset} -100 C ${610 + offset} 80, ${-410 + offset} 400, ${80 + offset} 620 S ${850 + offset} 660, ${670 + offset} 1100`;
});

export default function EtherealBackground({ paused = false }) {
  const ref = useRef(null);
  useEffect(() => {
    const update = () => {
      if (ref.current) ref.current.dataset.paused = String(paused || document.hidden);
    };
    update();
    document.addEventListener('visibilitychange', update);
    return () => document.removeEventListener('visibilitychange', update);
  }, [paused]);
  return <div className="vortex-atmosphere" ref={ref} data-paused="false" aria-hidden="true">
    {['near', 'far'].map((layer) => <svg
      key={layer}
      className={`vortex-contours vortex-contours-${layer}`}
      viewBox="0 0 1440 960"
      preserveAspectRatio="none"
      focusable="false"
    >
      <path className="vortex-contour-ribbon" d={contours[5]} vectorEffect="non-scaling-stroke" />
      {contours.map((path, index) => <path
        key={index}
        d={path}
        className="vortex-contour-line"
        vectorEffect="non-scaling-stroke"
        opacity={index % 3 === 0 ? 1 : 0.55}
      />)}
    </svg>)}
  </div>;
}

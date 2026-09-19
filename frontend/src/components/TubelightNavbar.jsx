import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from './Icon';

/** A monochrome, section-aware navigation dock for the public landing page. */
export default function TubelightNavbar({ items, className = '' }) {
  const [activeTab, setActiveTab] = useState(items[0]?.url ?? '');
  useEffect(() => {
    if (!('IntersectionObserver' in window)) return undefined;

    const sections = items
      .filter((item) => item.url.startsWith('#'))
      .map((item) => document.getElementById(item.url.replace(/^#/, '')))
      .filter(Boolean);
    if (!sections.length) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible) setActiveTab(`#${visible.target.id}`);
      },
      { rootMargin: '-18% 0px -62% 0px', threshold: [0, 0.15, 0.35, 0.6] },
    );

    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, [items]);

  return (
    <nav className={`tubelight-nav ${className}`} aria-label="Landing page navigation">
      {items.map((item) => {
        const isActive = activeTab === item.url;
        const isSectionLink = item.url.startsWith('#');
        const Element = isSectionLink ? 'a' : Link;
        const destination = isSectionLink ? { href: item.url } : { to: item.url };
        return (
          <Element
            key={item.name}
            {...destination}
            aria-label={item.name}
            aria-current={isActive ? (isSectionLink ? 'location' : 'page') : undefined}
            className={`tubelight-nav-item${isActive ? ' is-active' : ''}`}
            onClick={() => setActiveTab(item.url)}
          >
            {isActive && (
              <span className="tubelight-active">
                <span className="tubelight-emitter" />
              </span>
            )}
            <span className="tubelight-nav-icon"><Icon name={item.icon} size={17} /></span>
            <span className="tubelight-nav-label">{item.name}</span>
          </Element>
        );
      })}
    </nav>
  );
}

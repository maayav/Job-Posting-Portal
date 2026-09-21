// Adapted from Kokonut UI Smooth Tab (MIT), Dorian Baffier.
// https://kokonutui.com/docs/components/smooth-tab
// See THIRD_PARTY_NOTICES.md. Uses a flat indicator and WAI-ARIA keyboard controls.
import { useId, useRef } from 'react';
import { LayoutGroup, motion } from 'motion/react';

export default function SmoothTabs({ items, value, onChange, label, panelId }) {
  const id = useId();
  const refs = useRef([]);
  function onKeyDown(event, index) {
    let next;
    if (event.key === 'ArrowRight') next = (index + 1) % items.length;
    if (event.key === 'ArrowLeft') next = (index - 1 + items.length) % items.length;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = items.length - 1;
    if (next === undefined) return;
    event.preventDefault();
    onChange(items[next].id);
    refs.current[next]?.focus();
  }
  return <LayoutGroup id={id}>
    <div className="guide-tabs" role="tablist" aria-label={label}>
      {items.map((item, index) => <motion.button
        key={item.id} id={panelId + '-' + item.id} type="button" role="tab"
        aria-controls={panelId} aria-selected={value === item.id}
        tabIndex={value === item.id ? 0 : -1}
        ref={(el) => { refs.current[index] = el; }}
        onClick={() => onChange(item.id)} onKeyDown={(event) => onKeyDown(event, index)}
        whileTap={{ scale: .98 }} whileHover={{ y: -1 }}>
        {value === item.id && <motion.span className="guide-tab-indicator" layoutId="selected"
          transition={{ type: 'spring', stiffness: 400, damping: 30 }} />}
        <span>{item.label}</span>
      </motion.button>)}
    </div>
  </LayoutGroup>;
}

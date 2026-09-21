// Horizontal bar primitive adapted from Bklit UI AnimatedBar (MIT).
// https://github.com/bklit/bklit-ui/blob/main/packages/ui/src/charts/bar.tsx
// See THIRD_PARTY_NOTICES.md. Single-series version, without gradients, blur,
// chart-context dependencies, or a second entrance animation after the reveal.
import { motion } from 'motion/react';

export default function SkillWeightChart({ skills }) {
  return <ol className="skill-weight-chart" aria-label="Skill importance in the role analysis">
    {skills.map((skill) => <li key={skill.name}>
      <span>{skill.name}</span>
      <svg viewBox="0 0 100 8" preserveAspectRatio="none" aria-hidden="true">
        <rect x="0" y="0" width="100" height="8" fill="var(--line)" opacity=".45" />
        <motion.rect initial={false} animate={{ width: skill.weight * 100, height: 8, x: 0, y: 0 }}
          fill="var(--accent)" rx="1" ry="1" transition={{ duration: .3, ease: [.32, .72, 0, 1] }} />
      </svg>
      <span className="skill-weight-value">{skill.weight.toFixed(2)}<span className="sr-only"> out of 1</span></span>
    </li>)}
  </ol>;
}

import { motion } from 'motion/react';

export default function ScoreCard({ score, targetRole, generatedAt }) {
  const color = score >= 80 ? 'good' : score >= 60 ? 'mid' : 'low';
  return (
    <motion.div
      className="card score-card"
      initial={false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
    >
      <div className="score-copy">
        <p className="section-kicker">01 / READINESS SIGNAL</p>
        <h2>Role readiness</h2>
        <p className="score-context">How closely your supported skills match the target role. Your wider profile assessment below looks at each source separately.</p>
        <div className="score-tags">
          <span className="chip">{targetRole}</span>
          <span className="score-status"><i /> Analysis complete</span>
        </div>
        <p className="muted small generated-at">{generatedAt ? `last generated ${new Date(generatedAt).toLocaleString()}` : ''}</p>
      </div>
      <div className={`score-ring ${color}`}>
        <span>{score}</span>
        <small>/100</small>
      </div>
    </motion.div>
  );
}

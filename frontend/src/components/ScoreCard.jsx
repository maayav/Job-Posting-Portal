import { motion } from 'motion/react';

export default function ScoreCard({ score, targetRole, generatedAt }) {
  const color = score >= 80 ? 'good' : score >= 60 ? 'mid' : 'low';
  return (
    <motion.div
      className="card score-card"
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
    >
      <div className="score-copy">
        <p className="section-kicker">01 / READINESS SIGNAL</p>
        <h2>ATS Score</h2>
        <p className="score-context">See how your skills align with your target role.</p>
        <div className="score-tags">
          <span className="chip">{targetRole}</span>
          <span className="score-status"><i /> Profile analyzed</span>
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

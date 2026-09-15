import NavBar from '../components/NavBar';
import { motion } from 'motion/react';

export default function AssistantPage() {
  return (
    <div className="page">
      <NavBar />
      <motion.div
        className="card center assistant-panel"
        initial={{ opacity: 0, scale: 0.98, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.45, ease: 'easeOut' }}
      >
        <h2>AI Assistant</h2>
        <p className="muted">A conversational assistant is not part of this build yet.</p>
        <p className="muted small">
          AI already runs automatically where it matters: resume and GitHub skill extraction with evidence,
          plus the deterministic readiness scoring and study plan. This page is reserved for the assistant
          experience once it is built.
        </p>
      </motion.div>
    </div>
  );
}

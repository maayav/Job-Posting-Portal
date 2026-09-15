import { motion } from 'motion/react';

export default function JobCard({ job, actions }) {
  return (
    <motion.article
      className="card job-card"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
    >
      <div className="job-head">
        <div className="job-head-info">
          <h3>{job.title}</h3>
          <p className="muted small">
            {job.city} · {job.experienceLevel} yr{job.experienceLevel === 1 ? '' : 's'} experience
          </p>
        </div>
        {actions}
      </div>
      <div className="area-chips">
        {job.skills.map((skill) => (
          <span className="chip" key={skill}>
            {skill}
          </span>
        ))}
      </div>
      <p className="job-desc">{job.description}</p>
      <p className="muted small">Posted {new Date(job.createdAt).toLocaleDateString()}</p>
    </motion.article>
  );
}

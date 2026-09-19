import { motion } from 'motion/react';

export default function JobCard({ job, actions }) {
  return (
    <motion.article
      className="card job-card"
      initial={false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
    >
      <div className="job-head">
        <div className="job-identity">
          <span className="company-mark" aria-hidden="true">{(job.company || job.title).slice(0, 1).toUpperCase()}</span>
          <div className="job-head-info">
            {job.company && <p className="job-company">{job.company}</p>}
            <h3>{job.title}</h3>
            <p className="muted small">
              {job.city} · {job.experienceLevel} yr{job.experienceLevel === 1 ? '' : 's'} experience
            </p>
          </div>
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
      <p className="job-posted muted small">Posted {new Date(job.createdAt).toLocaleDateString()}</p>
    </motion.article>
  );
}

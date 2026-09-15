export default function JobCard({ job, actions }) {
  return (
    <div className="card job-card">
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
    </div>
  );
}
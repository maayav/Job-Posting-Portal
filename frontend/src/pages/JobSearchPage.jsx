import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import Icon from '../components/Icon';
import NavBar from '../components/NavBar';
import JobFilters from '../components/JobFilters';
import JobCard from '../components/JobCard';
import ApplyButton from '../components/ApplyButton';
import { useAuth } from '../context/AuthContext';
import { api, errorMessage } from '../api/client';
import '../styles/student-experience.css';

export default function JobSearchPage() {
  const { user } = useAuth();
  const isStudent = user?.role === 'student';
  const [jobs, setJobs] = useState([]);
  const [appliedIds, setAppliedIds] = useState(new Set());
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [filters, setFilters] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const LIMIT = 20;

  const load = useCallback(
    async (f, pageNum) => {
      setLoading(true);
      setError('');
      try {
        const params = { page: pageNum, limit: LIMIT };
        if (f.skills) params.skills = f.skills;
        if (f.experience !== '') params.experience = f.experience;
        if (f.city) params.city = f.city;
        const res = await api.get('/jobs', { params });
        setJobs(res.data.jobs);
        setPage(res.data.page);
        setTotalPages(res.data.totalPages);
      } catch (err) {
        setError(errorMessage(err));
        setJobs([]);
        setTotalPages(0);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    load({}, 1);
  }, [load]);

  // Preload which jobs the student has already applied to, so cards can show "Applied".
  useEffect(() => {
    if (!isStudent) return;
    api
      .get('/applications/me')
      .then((res) => {
        setAppliedIds(new Set((res.data.applications ?? []).map((a) => a.job.id)));
      })
      .catch(() => {});
  }, [isStudent]);

  function handleSearch(f) {
    setFilters(f);
    load(f, 1);
  }

  function handleClear() {
    setFilters({});
    load({}, 1);
  }

  return (
    <div className="page jobs-page student-experience student-jobs-page">
      <NavBar />

      <motion.section
        className="page-hero student-page-hero"
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
      >
        <div className="student-page-hero-copy">
          <p className="hero-kicker"><span className="signal-dot" /> YOUR NEXT CHAPTER</p>
          <h1>Find your next <em>opportunity.</em></h1>
          <p className="hero-copy">Discover roles that fit your skills, experience, and ambitions.</p>
        </div>
        <Link className="student-hero-note" to="/analyze">
          <span className="student-hero-note-index">01 / PROFILE</span>
          <strong>Make every skill count</strong>
          <span>Refresh your analysis to see where you are strongest.</span>
          <span className="student-hero-note-link">Update your profile <Icon name="arrow" size={15} /></span>
        </Link>
      </motion.section>

      <JobFilters onSearch={handleSearch} onClear={handleClear} loading={loading} />

      {error && <p className="error card-error">{error}</p>}

      {loading && (
        <div className="card center">
          <div className="spinner" />
          <p className="muted">Searching jobs…</p>
        </div>
      )}

      {!loading && !error && jobs.length === 0 && (
        <div className="card center">
          <h2>No jobs found</h2>
          <p className="muted">Try different filters, or clear them to see all postings.</p>
        </div>
      )}

      {!loading && jobs.length > 0 && (
        <>
          <div className="results-heading student-results-heading"><div><p className="section-kicker">CURATED FOR YOUR SEARCH</p><h2>Open opportunities</h2></div><span className="muted small">{jobs.length} jobs on this page</span></div>
          <div className="jobs-grid">
          {jobs.map((job) => (
            <JobCard
              key={job.id}
              job={job}
              actions={
                isStudent ? (
                  appliedIds.has(job.id) ? (
                    <span className="badge badge-applied" role="status">Applied</span>
                  ) : (
                    <ApplyButton jobId={job.id} />
                  )
                ) : undefined
              }
            />
          ))}
          </div>
          {totalPages > 1 && (
            <div className="pagination">
              <button className="primary" disabled={page <= 1} onClick={() => load(filters, page - 1)}>
                ← Previous
              </button>
              <span className="muted">
                Page {page} of {totalPages}
              </span>
              <button className="primary" disabled={page >= totalPages} onClick={() => load(filters, page + 1)}>
                Next →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

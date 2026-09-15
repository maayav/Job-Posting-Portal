import { useCallback, useEffect, useState } from 'react';
import { motion } from 'motion/react';
import NavBar from '../components/NavBar';
import JobFilters from '../components/JobFilters';
import JobCard from '../components/JobCard';
import { api, errorMessage } from '../api/client';

export default function JobSearchPage() {
  const [jobs, setJobs] = useState([]);
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

  function handleSearch(f) {
    setFilters(f);
    load(f, 1);
  }

  function handleClear() {
    setFilters({});
    load({}, 1);
  }

  return (
    <div className="page">
      <NavBar />

      <motion.section
        className="page-hero"
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
      >
        <div className="hero-orbit" aria-hidden="true" />
        <p className="hero-kicker">JOBS / DIRECTORY</p>
        <h1>Find your next <em>opportunity.</em></h1>
        <p className="hero-copy">Search roles by the skills you are building, the city you want, and the experience you already own.</p>
        <div className="hero-meta"><span>01</span><span>Skills-first search</span><span>Any authenticated student can browse</span></div>
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
          <p className="muted small">{jobs.length} jobs shown</p>
          {jobs.map((job) => (
            <JobCard key={job.id} job={job} />
          ))}
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

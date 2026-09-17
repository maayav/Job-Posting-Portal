import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { useAuth } from '../context/AuthContext';
import NavBar from '../components/NavBar';
import AdminCandidateDashboard from '../components/AdminCandidateDashboard';
import ScoreCard from '../components/ScoreCard';
import GapList from '../components/GapList';
import StudyPlan from '../components/StudyPlan';
import { api, errorMessage } from '../api/client';

function StudentDashboard() {
  const [report, setReport] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const reportId = localStorage.getItem('report_id');
    if (!reportId) {
      setLoading(false);
      return;
    }
    api
      .get(`/report/${reportId}`)
      .then((res) => setReport(res.data))
      .catch((err) => {
        // A report id can survive a logout/account switch. Treat an inaccessible
        // old report as no current report rather than surfacing a misleading 403.
        if ([403, 404].includes(err.response?.status)) {
          localStorage.removeItem('report_id');
          setReport(null);
          setError('');
          return;
        }
        setError(errorMessage(err));
      })
      .finally(() => setLoading(false));
  }, []);

  function handleToggle(itemId) {
    setReport((prev) => ({
      ...prev,
      study_plan: prev.study_plan.map((it) => (it._id === itemId ? { ...it, done: !it.done } : it)),
    }));
  }

  return (
    <>
      {loading && <p className="muted">Loading report…</p>}

      {error && <p className="error card-error">{error}</p>}

      <motion.section
        className="dashboard-intro"
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: 'easeOut' }}
      >
        <div>
          <p className="hero-kicker">YOUR WORKSPACE</p>
          <h1>A clearer view of <em>what’s next.</em></h1>
          <p className="hero-copy">Your readiness score, skill map, and next learning moves in one place.</p>
        </div>
        <div className="dashboard-intro-rail">
          <span>LATEST ANALYSIS</span>
          <strong>{report ? 'Ready to explore' : 'Get started'}</strong>
          <small>{report ? report.target_role : 'Upload a profile to begin'}</small>
        </div>
      </motion.section>

      {!loading && !report && !error && (
        <div className="card center">
          <h2>No report yet</h2>
          <p className="muted">Upload a resume to get your readiness score.</p>
          <Link to="/analyze" className="primary inline">Start a new analysis</Link>
        </div>
      )}

      {report && (
        <motion.div
          className="dashboard-stack"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.45 }}
        >
          {/* 1. ATS score */}
          <ScoreCard score={report.score} targetRole={report.target_role} generatedAt={report.generated_at} />

          {/* 2. Skill breakdown */}
          <GapList report={report} />

          {/* 3. Study plan */}
          <StudyPlan reportId={report.report_id} items={report.study_plan} onToggle={handleToggle} />

          {/* 4. Role readiness */}
          <div className="card role-readiness">
            <h2>Role readiness</h2>
            <div className="readiness-row">
              <span className="chip">{report.target_role}</span>
              <strong className="readiness-score">{report.score}/100</strong>
            </div>
            <p className="muted small">
              The ATS score above is the weighted readiness for this target role, computed from the role's
              skill ontology.
            </p>
          </div>
        </motion.div>
      )}
    </>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  return (
    <div className="page">
      <NavBar />
      {user?.role === 'admin' ? <AdminCandidateDashboard /> : <StudentDashboard />}
    </div>
  );
}

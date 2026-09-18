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
import Icon from '../components/Icon';
import '../styles/student-experience.css';

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
      {loading && <div className="student-loading-state" role="status"><span className="student-loading-mark" /><span>Bringing your latest report into focus…</span></div>}

      {error && <p className="error card-error">{error}</p>}

      <motion.section
        className="dashboard-intro student-dashboard-intro"
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: 'easeOut' }}
      >
        <div>
          <p className="hero-kicker"><span className="signal-dot" /> YOUR WORKSPACE</p>
          <h1>A clearer view of <em>what’s next.</em></h1>
          <p className="hero-copy">Your readiness score, skill map, and next learning moves in one place.</p>
        </div>
        <div className="dashboard-intro-rail">
          <span>LATEST ANALYSIS</span>
          <strong>{report ? 'Ready to explore' : 'Get started'}</strong>
          <small>{report ? report.target_role : 'Upload a profile to begin'}</small>
        </div>
      </motion.section>

      <nav className="student-dashboard-actions" aria-label="Workspace shortcuts">
        <Link to="/jobs" className="student-shortcut student-shortcut-primary"><span className="student-shortcut-icon"><Icon name="search" size={17} /></span><span><strong>Explore roles</strong><small>Find a position that fits</small></span><Icon name="arrow" size={16} /></Link>
        <Link to="/analyze" className="student-shortcut"><span className="student-shortcut-icon"><Icon name="chart" size={17} /></span><span><strong>New analysis</strong><small>Refresh your readiness</small></span><Icon name="arrow" size={16} /></Link>
        <Link to="/assistant" className="student-shortcut"><span className="student-shortcut-icon"><Icon name="users" size={17} /></span><span><strong>Ask Vortex AI</strong><small>Plan your next move</small></span><Icon name="arrow" size={16} /></Link>
      </nav>

      {!loading && !report && !error && (
        <div className="card center student-empty-report">
          <span className="student-empty-index">YOUR NEXT STEP · 01</span>
          <span className="student-empty-mark"><Icon name="file" size={23} /></span>
          <h2>No report yet</h2>
          <p className="muted">Upload a resume to turn your experience into a role-specific readiness score and practical plan.</p>
          <Link to="/analyze" className="primary inline">Start a new analysis <Icon name="arrow" size={16} /></Link>
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
  const isAdmin = user?.role === 'admin';
  return (
    <div className={`page${isAdmin ? '' : ' student-experience student-dashboard-page'}`}>
      <NavBar />
      {isAdmin ? <AdminCandidateDashboard /> : <StudentDashboard />}
    </div>
  );
}

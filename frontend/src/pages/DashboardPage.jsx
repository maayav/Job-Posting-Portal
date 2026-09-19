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
  const [history, setHistory] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const reportId = localStorage.getItem('report_id');
    if (!reportId) {
      api.get('/report/history')
        .then((res) => {
          const entries = [...(res.data.history ?? [])]
            .sort((a, b) => new Date(b.completed_at) - new Date(a.completed_at));
          setHistory(entries);
          const latest = entries[0];
          if (!latest?.report_id) return null;
          localStorage.setItem('report_id', latest.report_id);
          return api.get(`/report/${latest.report_id}`);
        })
        .then((res) => { if (res?.data?.report_id) setReport(res.data); })
        .catch((err) => setError(errorMessage(err)))
        .finally(() => setLoading(false));
      return;
    }
    api
      .get(`/report/${reportId}`)
      .then((res) => {
        setReport(res.data);
        return api.get('/report/history').then((historyResponse) => {
          const entries = [...(historyResponse.data.history ?? [])]
            .sort((a, b) => new Date(b.completed_at) - new Date(a.completed_at));
          setHistory(entries);
        }).catch(() => {});
      })
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

  async function selectReport(reportId) {
    if (!reportId || reportId === report?.report_id) return;
    setLoading(true);
    setError('');
    try {
      const response = await api.get(`/report/${reportId}`);
      setReport(response.data);
      localStorage.setItem('report_id', reportId);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

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
        initial={false}
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
          {history.length > 1 && <label className="student-report-picker">Saved analyses<select aria-label="Choose a saved analysis" value={report?.report_id ?? ''} onChange={(event) => selectReport(event.target.value)}>{history.map((entry) => <option key={entry.report_id} value={entry.report_id}>{entry.target_role} · {entry.score}/100 · {new Date(entry.completed_at).toLocaleDateString()}</option>)}</select></label>}
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
          initial={false}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.45 }}
        >
          {/* The report score is the single weighted readiness metric for this role. */}
          <ScoreCard score={report.score} targetRole={report.target_role} generatedAt={report.generated_at} />

          {/* 2. Skill breakdown */}
          <GapList report={report} />

          {/* 3. Study plan */}
          <StudyPlan reportId={report.report_id} items={report.study_plan} onToggle={handleToggle} />

          <div className="card role-readiness">
            <h2>Role readiness</h2>
            <div className="readiness-row">
              <span className="chip">{report.target_role}</span>
              <span className="score-status"><i /> Single weighted metric shown above</span>
            </div>
            <p className="muted small">
              The score above combines the evidence, skill coverage, and gaps for this target role. It is not a separate ATS and readiness score.
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

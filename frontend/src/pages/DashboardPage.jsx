import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import NavBar from '../components/NavBar';
import ScoreCard from '../components/ScoreCard';
import GapList from '../components/GapList';
import StudyPlan from '../components/StudyPlan';
import { api, errorMessage } from '../api/client';

export default function DashboardPage() {
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
      .catch((err) => setError(errorMessage(err)))
      .finally(() => setLoading(false));
  }, []);

  function handleToggle(itemId) {
    setReport((prev) => ({
      ...prev,
      study_plan: prev.study_plan.map((it) => (it._id === itemId ? { ...it, done: !it.done } : it)),
    }));
  }

  return (
    <div className="page">
      <NavBar />

      {loading && <p className="muted">Loading report…</p>}

      {error && <p className="error card-error">{error}</p>}

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
    </div>
  );
}

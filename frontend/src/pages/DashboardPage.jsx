import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import ScoreCard from '../components/ScoreCard';
import GapList from '../components/GapList';
import StudyPlan from '../components/StudyPlan';
import { useAuth } from '../context/AuthContext';
import { api, errorMessage } from '../api/client';

export default function DashboardPage() {
  const { user, logout } = useAuth();
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

  function handleToggle(itemId, skill) {
    setReport((prev) => ({
      ...prev,
      study_plan: prev.study_plan.map((it) =>
        it._id === itemId ? { ...it, done: !it.done } : it
      ),
    }));
    // best-effort: no-op; PATCH already applied server-side
    void skill;
  }

  return (
    <div className="page">
      <header className="topbar">
        <div>
          <strong>SkillGap Tracker</strong>
        </div>
        <div className="topbar-user">
          <Link to="/upload">New analysis</Link>
          <span>{user?.name}</span>
          <button className="link" onClick={logout}>Log out</button>
        </div>
      </header>

      {loading && <p className="muted">Loading report…</p>}

      {error && <p className="error card-error">{error}</p>}

      {!loading && !report && !error && (
        <div className="card center">
          <h2>No report yet</h2>
          <p className="muted">Upload a resume to get your readiness score.</p>
          <Link to="/upload" className="primary inline">Go to upload</Link>
        </div>
      )}

      {report && (
        <>
          <ScoreCard score={report.score} targetRole={report.target_role} generatedAt={report.generated_at} />
          <div className="columns">
            <GapList report={report} />
            <StudyPlan
              reportId={report.report_id}
              items={report.study_plan}
              onToggle={handleToggle}
            />
          </div>
        </>
      )}
    </div>
  );
}
import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import NavBar from '../components/NavBar';
import AdminCandidateDashboard from '../components/AdminCandidateDashboard';
import ScoreCard from '../components/ScoreCard';
import StudyPlan from '../components/StudyPlan';
import ApplyButton from '../components/ApplyButton';
import SaveButton from '../components/SaveButton';
import { api, errorMessage } from '../api/client';
import roleCatalog from '../data/role-catalog.json';

// Recharts is heavy and only needed for the trend card, so it loads separately.
const ProgressChart = lazy(() => import('../components/ProgressChart'));

const CATALOG_BY_ROLE = new Map((roleCatalog.roles ?? []).map((role) => [role.id, role]));

function StudentDashboard() {
  const { user } = useAuth();
  const [report, setReport] = useState(null);
  const [history, setHistory] = useState([]);
  const [roadmaps, setRoadmaps] = useState([]);
  const [roleOptions, setRoleOptions] = useState([]);
  const [selectedRole, setSelectedRole] = useState(null);
  const [applications, setApplications] = useState([]);
  const [wishlist, setWishlist] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    // Everything the dashboard needs is fetched concurrently (each request is a
    // round trip, and the deployed API can cold-start).
    const storedId = localStorage.getItem('report_id');
    const reportRequest = storedId ? api.get(`/report/${storedId}`) : Promise.resolve(null);

    Promise.allSettled([
      reportRequest,
      api.get('/report/history'),
      api.get('/report/roadmap'),
      api.get('/applications/me'),
      api.get('/wishlist'),
      api.get('/roles'),
    ]).then(async ([reportRes, historyRes, roadmapRes, appsRes, wishRes, rolesRes]) => {
      if (cancelled) return;

      const reports = historyRes.status === 'fulfilled' ? historyRes.value.data.history ?? [] : [];
      setHistory(reports);
      const loadedRoadmaps = roadmapRes.status === 'fulfilled' ? roadmapRes.value.data.roadmaps ?? [] : [];
      setRoadmaps(loadedRoadmaps);
      if (appsRes.status === 'fulfilled') setApplications(appsRes.value.data.applications ?? []);
      if (wishRes.status === 'fulfilled') setWishlist(wishRes.value.data.items ?? []);

      // Every available role appears in the selector; analyzed roles keep their
      // own ordering from the API and roles that only exist in older reports are
      // appended so no stored roadmap becomes unreachable.
      const options = rolesRes.status === 'fulfilled'
        ? (rolesRes.value.data.roles ?? []).map((role) => ({ id: role.id, label: role.label }))
        : [];
      for (const roadmap of loadedRoadmaps) {
        if (!options.some((option) => option.id === roadmap.target_role)) {
          options.push({ id: roadmap.target_role, label: roadmap.target_role });
        }
      }
      setRoleOptions(options);
      setSelectedRole((current) => (
        current && options.some((option) => option.id === current)
          ? current
          : loadedRoadmaps[0]?.target_role ?? options[0]?.id ?? null
      ));

      if (reportRes.status === 'fulfilled' && reportRes.value) {
        setReport(reportRes.value.data);
        return;
      }
      if (reportRes.status === 'rejected' && [403, 404].includes(reportRes.reason?.response?.status)) {
        localStorage.removeItem('report_id');
      }

      // Fall back to the account's latest completed report (works after re-login).
      const latestId = reports.length ? reports[reports.length - 1].report_id : null;
      if (latestId) {
        try {
          const res = await api.get(`/report/${latestId}`);
          if (cancelled) return;
          setReport(res.data);
          localStorage.setItem('report_id', latestId);
        } catch (err) {
          if (!cancelled && ![403, 404].includes(err.response?.status)) setError(errorMessage(err));
        }
      }
    }).finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [reloadKey]);

  // Skills to study, indexed for matching against the jobs applied to.
  const planIndex = useMemo(() => {
    const map = new Map();
    for (const roadmap of roadmaps) {
      for (const item of roadmap.study_plan ?? []) {
        const key = item.skill.trim().toLowerCase();
        if (!map.has(key)) {
          map.set(key, { skill: item.skill, role: roadmap.target_role, resources: item.resources ?? [] });
        }
      }
    }
    return map;
  }, [roadmaps]);

  const activeRole = roleOptions.find((option) => option.id === selectedRole);
  const activeRoadmap = roadmaps.find((roadmap) => roadmap.target_role === selectedRole);
  const catalogRole = selectedRole ? CATALOG_BY_ROLE.get(selectedRole) : null;
  const openPlanCount = (activeRoadmap?.study_plan ?? []).filter((item) => !item.done).length;

  function handleRoadmapToggle(reportId, itemId) {
    setRoadmaps((current) => current.map((roadmap) => (
      roadmap.report_id === reportId
        ? { ...roadmap, study_plan: roadmap.study_plan.map((item) => (item._id === itemId ? { ...item, done: !item.done } : item)) }
        : roadmap
    )));
  }

  function handleAppliedFromWishlist(jobId) {
    setWishlist((current) => current.filter((item) => item.job.id !== jobId));
  }

  function handleRemovedFromWishlist(jobId) {
    setWishlist((current) => current.filter((item) => item.job.id !== jobId));
  }

  function roleOptionLabel(option) {
    const roadmap = roadmaps.find((entry) => entry.target_role === option.id);
    if (!roadmap) return `${option.label} · not analyzed`;
    if (roadmap.status === 'completed') {
      const open = (roadmap.study_plan ?? []).filter((item) => !item.done).length;
      return `${option.label} · ${roadmap.score ?? '—'}/100 · ${open} open`;
    }
    if (roadmap.status === 'failed') return `${option.label} · analysis failed`;
    return `${option.label} · analysis in progress`;
  }

  function renderRoadmapBody() {
    if (!activeRole) return null;

    if (!activeRoadmap || activeRoadmap.status !== 'completed') {
      const isPending = activeRoadmap && ['queued', 'processing'].includes(activeRoadmap.status);
      const isFailed = activeRoadmap?.status === 'failed';
      return (
        <div className="card roadmap-empty">
          <p className="section-kicker">{isPending ? 'ANALYSIS IN PROGRESS' : isFailed ? 'ANALYSIS FAILED' : 'NO ANALYSIS YET'}</p>
          <h2>{activeRole.label}</h2>
          {isPending ? (
            <p className="muted">We are still preparing the readiness report and study roadmap for this role. Refresh in a moment.</p>
          ) : isFailed ? (
            <p className="muted">The last analysis for this role did not complete. Start a new analysis to get a study roadmap.</p>
          ) : (
            <p className="muted">You have not analyzed your profile for this role yet. Start an analysis to get a readiness score and a study roadmap.</p>
          )}
          {!isPending && catalogRole?.skills?.length > 0 && (
            <p className="muted small roadmap-skill-preview">
              This role expects {catalogRole.skills.length} skills, including {catalogRole.skills.slice(0, 4).map((skill) => skill.name).join(', ')}.
            </p>
          )}
          <div className="actions">
            {isPending
              ? <button className="primary" onClick={() => { setLoading(true); setReloadKey((key) => key + 1); }}>Refresh</button>
              : <Link className="primary inline" to={`/analyze?role=${encodeURIComponent(activeRole.id)}`}>{isFailed ? 'Retry analysis' : 'Start analysis'}</Link>}
          </div>
        </div>
      );
    }

    return (
      <StudyPlan
        key={activeRoadmap.report_id}
        reportId={activeRoadmap.report_id}
        items={activeRoadmap.study_plan}
        title={`${activeRole.label} roadmap`}
        kicker={`SCORE ${activeRoadmap.score ?? '—'}/100 · ${activeRoadmap.gap_count ?? 0} GAP${activeRoadmap.gap_count === 1 ? '' : 'S'}`}
        note={`${openPlanCount} open`}
        onToggle={(itemId) => handleRoadmapToggle(activeRoadmap.report_id, itemId)}
      />
    );
  }

  return (
    <>
      <div className="page-title-row">
        <div>
          <p className="section-kicker">YOUR DASHBOARD</p>
          <h1>Your readiness at a glance.</h1>
        </div>
      </div>

      {loading && <p className="muted">Loading dashboard…</p>}

      {error && <p className="error card-error">{error}</p>}

      {!loading && (
        <div className="dashboard-stack">
          {report ? (
            <ScoreCard score={report.score} targetRole={report.target_role} generatedAt={report.generated_at} />
          ) : (
            !error && (
              <div className="card center">
                <h2>No report yet</h2>
                <p className="muted">Upload a resume to get your readiness score and study roadmap.</p>
                <Link to="/analyze" className="primary inline">Start a new analysis</Link>
              </div>
            )
          )}

          {activeRole && (
            <section className="dashboard-roadmaps" aria-label="Study roadmaps">
              <div className="page-title-row dashboard-section-title">
                <div>
                  <p className="section-kicker">ROADMAPS</p>
                  <h2>What to study for your target roles</h2>
                </div>
                <label className="roadmap-role-picker">
                  Role
                  <select
                    aria-label="Choose role for study plan"
                    value={activeRole.id}
                    onChange={(event) => setSelectedRole(event.target.value)}
                  >
                    {roleOptions.map((option) => (
                      <option key={option.id} value={option.id}>
                        {roleOptionLabel(option)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              {renderRoadmapBody()}
            </section>
          )}

          <div className="card applied-prep">
            <div className="section-heading">
              <div>
                <p className="section-kicker">APPLICATIONS</p>
                <h2>Prepare for the roles you applied to</h2>
              </div>
              <span className="section-note">{applications.length} application{applications.length === 1 ? '' : 's'}</span>
            </div>

            {applications.length === 0 ? (
              <p className="muted small">
                Apply to a job from the <Link to="/jobs">Jobs page</Link> and the skills to prepare show up here.
              </p>
            ) : (
              <ul className="applied-prep-list">
                {applications.map((application) => {
                  const prep = (application.job.skills ?? [])
                    .map((skill) => planIndex.get(skill.trim().toLowerCase()))
                    .filter(Boolean);
                  return (
                    <li key={application.id}>
                      <div className="applied-prep-head">
                        <div className="saved-job-info">
                          <strong>{application.job.title}</strong>
                          <span className="muted small">
                            {application.job.company || 'Company'} · {application.job.city} · status: {application.status.replace(/_/g, ' ')}
                          </span>
                        </div>
                        <Link to="/applications" className="landing-text-link">Track <span aria-hidden="true">→</span></Link>
                      </div>
                      {prep.length > 0 ? (
                        <div className="area-chips">
                          {prep.map((entry) => (
                            <span className="chip low" key={`${application.id}-${entry.skill}`}>
                              <span>{entry.skill}</span>
                              <strong>study</strong>
                            </span>
                          ))}
                          <span className="muted small">
                            from your {prep[0].role} roadmap
                          </span>
                        </div>
                      ) : (
                        <p className="muted small">
                          {planIndex.size === 0
                            ? 'Run a New Analysis to get a study plan for this role.'
                            : 'Your current roadmap does not flag these skills as gaps — re-run an analysis for this role to be sure.'}
                        </p>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="card dashboard-stat">
            <div>
              <p className="section-kicker">APPLICATIONS</p>
              <h2>Jobs applied</h2>
            </div>
            <div className="dashboard-stat-value">
              <strong>{applications.length}</strong>
              <Link to="/applications" className="landing-text-link">View applications <span aria-hidden="true">→</span></Link>
            </div>
          </div>

          <div className="card saved-jobs">
            <div className="section-heading">
              <div>
                <p className="section-kicker">WISHLIST</p>
                <h2>Saved jobs</h2>
              </div>
              <span className="section-note">{wishlist.length} saved</span>
            </div>

            {wishlist.length === 0 ? (
              <p className="muted small">
                Save a job from the <Link to="/jobs">Jobs page</Link> to keep it here for later.
              </p>
            ) : (
              <ul className="saved-jobs-list">
                {wishlist.map((item) => (
                  <li key={item.id}>
                    <div className="saved-job-info">
                      <strong>{item.job.title}</strong>
                      <span className="muted small">
                        {item.job.company || 'Company'} · {item.job.city} · {item.job.experienceLevel} yr
                      </span>
                    </div>
                    <div className="job-actions">
                      <ApplyButton job={item.job} user={user} onApplied={handleAppliedFromWishlist} />
                      <SaveButton jobId={item.job.id} saved onToggle={handleRemovedFromWishlist} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <Suspense fallback={<div className="card center"><div className="spinner" /><p className="muted">Loading progress…</p></div>}>
            <ProgressChart history={history} />
          </Suspense>
        </div>
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

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { api, errorMessage } from '../api/client';
import { APPLICATION_STATUSES, STATUS_LABELS } from '../utils/statuses';
import { safeExternalUrl } from '../utils/links';
import '../styles/admin-experience.css';

const STAGE_LABELS = {
  applied: 'Applied',
  under_review: 'Under Review',
  shortlisted: 'Under Review',
  interview_scheduled: 'Under Review',
  selected: 'Selected',
  rejected: 'Rejected',
};
const FLOW_TABS = ['total', 'applied', 'review'];
const FLOW_LABELS = { total: 'Total', applied: 'Applied', review: 'Review' };
const REVIEW_STAGES = ['applied', 'under_review', 'selected', 'rejected'];

const REVIEW_STAGE_LABELS = {
  applied: 'Applied',
  under_review: 'Under Review',
  selected: 'Selected',
  rejected: 'Rejected',
};

function Score({ label, value }) {
  return <div className="candidate-score"><span>{label}</span><strong>{value == null ? '—' : value + '/100'}</strong></div>;
}

function SkillGroup({ label, items, tone = '' }) {
  if (!items?.length) return null;
  return <div className="candidate-skill-group">
    <span className={'candidate-detail-label ' + tone}>{label}</span>
    <div className="area-chips">{items.map((item, index) => <span className="chip" key={item.skill + '-' + index}>{item.skill}{item.percent != null && <strong>{item.percent}%</strong>}</span>)}</div>
  </div>;
}

function CandidateFlowCard({ application, changing, selected, onView, onStatusChange, reduceMotion }) {
  const name = application.applicant.name || 'Unknown applicant';
  return (
    <motion.article
      layout={!reduceMotion}
      initial={reduceMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={reduceMotion ? undefined : { y: -2 }}
      transition={{ duration: reduceMotion ? 0 : 0.18, ease: 'easeOut' }}
      className={'candidate-flow-card' + (selected ? ' selected-card' : '')}
    >
      <div className="application-avatar candidate-flow-avatar">{name.slice(0, 1).toUpperCase()}</div>
      <div className="candidate-flow-person">
        <strong>{name}</strong>
        <span>{application.applicant.email}</span>
      </div>
      <div className="candidate-flow-role"><span>ROLE</span><strong>{application.job.title}</strong></div>
      <div className="candidate-flow-applied"><span>APPLIED</span><time dateTime={application.appliedAt}>{new Date(application.appliedAt).toLocaleDateString()}</time></div>
      <div className="candidate-flow-scores">
        <span><small>ATS</small><b>{application.atsScore == null ? '—' : application.atsScore}</b></span>
        <span><small>READY</small><b>{application.roleReadinessScore == null ? '—' : application.roleReadinessScore}</b></span>
      </div>
      <div className="candidate-flow-actions">
        <button type="button" className="link candidate-flow-view" aria-pressed={selected} title={`View ${name}'s profile`} onClick={onView}>View</button>
        <select
          aria-label={`Change review stage for ${name}`}
          value={application.reviewStage}
          disabled={changing}
          onChange={(event) => onStatusChange(event.target.value)}
        >
          {REVIEW_STAGES.map((stage) => <option key={stage} value={stage}>{REVIEW_STAGE_LABELS[stage]}</option>)}
        </select>
      </div>
    </motion.article>
  );
}

function DetailPanel({ application, review, loading, onStatusChange, changing }) {
  if (loading) return <aside className="card candidate-detail-panel"><p className="muted">Loading candidate details…</p></aside>;
  if (!application) return <aside className="card candidate-detail-panel candidate-empty-detail"><div className="candidate-empty-icon">↗</div><h2>Selected candidate</h2><p className="muted">Choose View on an application to inspect the candidate’s profile, AI evaluation, and preparation plan.</p></aside>;

  const { applicant, job } = application;
  const candidateReview = review ?? {};
  const displayStage = STAGE_LABELS[application.status] ?? application.status;
  const resumeUrl = safeExternalUrl(application.resumeUrl);
  const leetcodeUrl = safeExternalUrl(candidateReview.leetcodeUrl ?? candidateReview.leetCodeUrl);
  return <aside className="card candidate-detail-panel" data-lenis-prevent>
    <div className="candidate-detail-heading">
      <div className="application-avatar large">{(applicant.name || '?').slice(0, 1).toUpperCase()}</div>
      <div><p className="section-kicker">SELECTED CANDIDATE</p><h2>{applicant.name || 'Unknown applicant'}</h2><p className="muted small">{applicant.email}</p></div>
    </div>
    <div className="candidate-links">
      {resumeUrl && <a className="candidate-link" href={resumeUrl} target="_blank" rel="noreferrer">Resume ↗</a>}
      {!resumeUrl && candidateReview.resumeFileRef && <span className="candidate-link muted">Resume available</span>}
      {safeExternalUrl(candidateReview.githubUrl) && <a className="candidate-link" href={safeExternalUrl(candidateReview.githubUrl)} target="_blank" rel="noreferrer">GitHub ↗</a>}
      {leetcodeUrl && <a className="candidate-link" href={leetcodeUrl} target="_blank" rel="noreferrer">LeetCode ↗</a>}
      {!resumeUrl && !candidateReview.resumeFileRef && !candidateReview.githubUrl && !leetcodeUrl && <span className="muted small">No external profiles attached</span>}
    </div>
    <div className="candidate-application-meta">
      <span><b>Role</b>{job.title}</span><span><b>Target role</b>{candidateReview.targetRole || job.title}</span><span><b>Company</b>{job.company || '—'}</span><span><b>Applied</b>{new Date(application.appliedAt).toLocaleDateString()}</span><span><b>Requirement</b>{job.experienceLevel} yr{job.experienceLevel === 1 ? '' : 's'} · {job.city}</span>
      {applicant.phone && <span><b>Phone</b>{applicant.phone}</span>}
    </div>
    <div className="candidate-scores"><Score label="ATS score" value={candidateReview.atsScore} /><Score label="Role readiness" value={candidateReview.roleReadinessScore} /></div>
    <section className="candidate-detail-section">
      <div className="section-heading"><h3>AI evaluation</h3><span className={'status-badge status-' + application.status}>{displayStage}</span></div>
      <SkillGroup label="Matched skills" items={candidateReview.strongSkills} tone="good" /><SkillGroup label="Developing skills" items={candidateReview.developingSkills} tone="mid" /><SkillGroup label="Missing skills" items={candidateReview.missingSkills} tone="low" />
      {candidateReview.evidence?.length > 0 && <div className="candidate-evidence"><span className="candidate-detail-label">Evidence</span>{candidateReview.evidence.slice(0, 5).map((item, index) => <p key={item.skill + '-' + index}><b>{item.skill}</b> · {item.source}: “{item.text}”</p>)}</div>}
    </section>
    <section className="candidate-detail-section">
      <div className="section-heading"><h3>Preparation plan</h3><span className="section-note">{candidateReview.studyPlan?.filter((item) => !item.done).length ?? 0} open</span></div>
      {candidateReview.studyPlan?.length ? <ul className="candidate-study-list">{candidateReview.studyPlan.map((item) => { const url = safeExternalUrl(item.resources?.[0]?.url); return <li key={item._id}><span className={item.done ? 'done' : ''}>{item.skill}</span>{url && <a href={url} target="_blank" rel="noreferrer">{item.resources[0].title || item.skill} ↗</a>}</li>; })}</ul> : <p className="muted small">No study plan is available for this candidate.</p>}
    </section>
    <section className="candidate-detail-section candidate-review-control">
      <label htmlFor="candidate-review-stage">Review stage</label>
      <select id="candidate-review-stage" value={['shortlisted', 'interview_scheduled'].includes(application.status) ? 'under_review' : application.status} disabled={changing} onChange={(event) => onStatusChange(event.target.value)}>
        {REVIEW_STAGES.map((stage) => <option key={stage} value={stage}>{STAGE_LABELS[stage]}</option>)}
        {APPLICATION_STATUSES.filter((status) => !REVIEW_STAGES.includes(status)).map((status) => <option key={status} value={status}>{STATUS_LABELS[status]}</option>)}
      </select>
    </section>
  </aside>;
}

export default function AdminCandidateDashboard() {
  const reduceMotion = useReducedMotion();
  const [data, setData] = useState({ totalApplications: 0, roles: [], applications: [] });
  const [filters, setFilters] = useState({ jobId: '', search: '' });
  const [selectedApplicationId, setSelectedApplicationId] = useState(null);
  const [selectedApplication, setSelectedApplication] = useState(null);
  const [review, setReview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [changing, setChanging] = useState(false);
  const [activeStage, setActiveStage] = useState('total');
  const [error, setError] = useState('');
  const detailRef = useRef(null);
  const listRef = useRef(null);
  const requestVersion = useRef(0);

  const loadDashboard = useCallback(async (nextFilters = { jobId: '', search: '' }) => {
    const version = ++requestVersion.current;
    setLoading(true); setError('');
    try {
      const params = { limit: 100 };
      if (nextFilters.jobId) params.jobId = nextFilters.jobId;
      if (nextFilters.search) params.search = nextFilters.search;
      const response = await api.get('/admin/dashboard', { params });
      const pages = await Promise.all(Array.from({ length: Math.max(0, (response.data.totalPages || 1) - 1) }, (_, i) => api.get('/admin/dashboard', { params: { ...params, page: i + 2 } })));
      if (version !== requestVersion.current) return;
      const applications = [...response.data.applications, ...pages.flatMap((page) => page.data.applications)];
      setData({ ...response.data, applications });
      setSelectedApplicationId((current) => applications.some((item) => item.applicationId === current) ? current : null);
    } catch (err) {
      if (version !== requestVersion.current) return;
      setError(errorMessage(err)); setData({ totalApplications: 0, roles: [], applications: [] }); setSelectedApplicationId(null);
    } finally { if (version === requestVersion.current) setLoading(false); }
  }, []);

  useEffect(() => { loadDashboard({ jobId: '', search: '' }); }, [loadDashboard]);
  useEffect(() => {
    if (!selectedApplicationId) { setSelectedApplication(null); setReview(null); return undefined; }
    let cancelled = false;
    setDetailLoading(true);
    api.get('/admin/applications/' + selectedApplicationId)
      .then((response) => { if (!cancelled) { setSelectedApplication(response.data.application); setReview(response.data.review); } })
      .catch((err) => { if (!cancelled) setError(errorMessage(err)); })
      .finally(() => { if (!cancelled) setDetailLoading(false); });
    return () => { cancelled = true; };
  }, [selectedApplicationId]);

  const selectedListItem = useMemo(() => data.applications.find((item) => item.applicationId === selectedApplicationId), [data.applications, selectedApplicationId]);
  function updateFilter(key, value) { const next = { ...filters, [key]: value }; setFilters(next); loadDashboard(next); }
  async function changeStatus(applicationId, status) {
    const currentApplication = selectedApplication?.id === applicationId
      ? selectedApplication
      : data.applications.find((item) => item.applicationId === applicationId);
    if (!applicationId || !currentApplication) return;
    setChanging(true); setError('');
    try {
      const actualStatus = status === 'under_review' && ['shortlisted', 'interview_scheduled'].includes(currentApplication.status) ? currentApplication.status : status;
      if (actualStatus === currentApplication.status) return;
      const response = await api.patch('/admin/applications/' + applicationId + '/status', { status: actualStatus });
      if (selectedApplicationId === applicationId) setSelectedApplication(response.data.application);
      setActiveStage(actualStatus === 'applied' ? 'applied' : 'total');
      await loadDashboard(filters);
    } catch (err) { setError(errorMessage(err)); } finally { setChanging(false); }
  }

  const groupedApplications = useMemo(() => ({
    total: data.applications,
    applied: data.applications.filter((item) => item.status === 'applied'),
    review: data.applications.filter((item) => ['under_review', 'shortlisted', 'interview_scheduled'].includes(item.status)),
  }), [data.applications]);

  return <div className="admin-candidate-dashboard">
    <div className="page-title-row dashboard-admin-heading"><div><p className="section-kicker">ADMIN / CANDIDATE REVIEW</p><h1>Review the people behind the applications.</h1><p className="muted">One focused view for finding, comparing, and moving candidates forward.</p></div></div>
    {error && <p className="error card-error" role="alert">{error}</p>}
    <section className="candidate-dashboard-toolbar card" aria-label="Candidate filters and totals">
      <div className="candidate-total"><span>Total applications received</span><strong>{loading ? '—' : data.totalApplications}</strong></div>
      <label>Role<select aria-label="Filter applications by role" value={filters.jobId} onChange={(event) => updateFilter('jobId', event.target.value)}><option value="">All roles</option>{data.roles.map((role) => <option key={role.jobId} value={role.jobId}>{role.title} · {role.applicationCount}</option>)}</select></label>
      <label className="candidate-search">Candidate<input aria-label="Search candidates" placeholder="Search name or email" value={filters.search} onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))} onKeyDown={(event) => { if (event.key === 'Enter') loadDashboard(filters); }} /></label>
    </section>
    <div className="candidate-dashboard-grid">
      <section ref={listRef} className="card candidate-list-panel" aria-label="Candidate applications">
        <div className="section-heading"><div><p className="section-kicker">02 / CANDIDATE FLOW</p><h2>{filters.jobId ? 'Filtered candidates' : 'All candidates'}</h2></div><span className="section-note">{loading ? 'Loading…' : `${data.total ?? data.applications.length} total records`}</span></div>
        {loading && <p className="muted">Loading applications…</p>}
        {!loading && !data.applications.length && <div className="candidate-empty-list"><h3>No candidates found</h3><p className="muted">Try another role or search term.</p></div>}
        {!loading && data.applications.length > 0 && <div className="candidate-flow-board">
          <div className="candidate-flow-tabs" role="tablist" aria-label="Candidate flow stages">
            {FLOW_TABS.map((stage) => (
              <button
                key={stage}
                type="button"
                role="tab"
                aria-selected={activeStage === stage}
                className={activeStage === stage ? 'active' : ''}
                onClick={() => setActiveStage(stage)}
              >
                <span>{FLOW_LABELS[stage]}</span>
                <strong>{groupedApplications[stage].length}</strong>
              </button>
            ))}
          </div>
          <section className={`candidate-flow-column candidate-flow-${activeStage}`} role="tabpanel" aria-label={`${FLOW_LABELS[activeStage]} candidates`}>
            <div className="candidate-flow-column-header"><div><span>{FLOW_LABELS[activeStage]}</span><small>Use View to inspect the full candidate profile</small></div><strong>{groupedApplications[activeStage].length}</strong></div>
            <div className="candidate-flow-cards" data-lenis-prevent>
              {groupedApplications[activeStage].map((application) => (
                <CandidateFlowCard
                  key={application.applicationId}
                  application={application}
                  changing={changing}
                  selected={selectedApplicationId === application.applicationId}
                  reduceMotion={reduceMotion}
                  onView={() => { setSelectedApplicationId(application.applicationId); if (window.matchMedia?.('(max-width: 950px)')?.matches) detailRef.current?.scrollIntoView({ block: 'start' }); }}
                  onStatusChange={(nextStage) => changeStatus(application.applicationId, nextStage)}
                />
              ))}
              {!groupedApplications[activeStage].length && <p className="candidate-flow-empty">No candidates in this stage.</p>}
            </div>
          </section>
        </div>}
      </section>
      <div ref={detailRef} className="candidate-detail-anchor">
        <button className="link candidate-back" onClick={() => listRef.current?.scrollIntoView({ block: 'start' })}>← Back to candidates</button>
        <DetailPanel application={selectedApplication ?? selectedListItem} review={review} loading={detailLoading} changing={changing} onStatusChange={(status) => selectedApplicationId && changeStatus(selectedApplicationId, status)} />
      </div>
    </div>
  </div>;
}

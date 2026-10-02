import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import NavBar from '../components/NavBar';
import UploadForm from '../components/UploadForm';
import ExtractedSkillReview from '../components/ExtractedSkillReview';
import { api, errorMessage } from '../api/client';
import { motion, useReducedMotion } from 'motion/react';
import Icon from '../components/Icon';
import AnalysisActivity from '../components/AnalysisActivity';
import '../styles/student-experience.css';

const POLL_MS = 4000;

export default function UploadPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const prefersReducedMotion = useReducedMotion();

  const [phase, setPhase] = useState('upload'); // upload | review | analyzing
  const [submission, setSubmission] = useState(null);
  const [skills, setSkills] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [stage, setStage] = useState('queued');
  const pollCancelled = useRef(false);

  const poll = useCallback(async (id) => {
    for (let i = 0; i < 40; i += 1) {
      await new Promise((r) => setTimeout(r, POLL_MS));
      if (pollCancelled.current) return;
      const res = await api.get(`/analyze/${id}/status`);
      const status = res.data.status;
      setStage(res.data.stage ?? status);
      if (status === 'completed') {
        localStorage.setItem('report_id', id);
        localStorage.removeItem('analysis_report_id');
        localStorage.removeItem('analysis_submission_id');
        navigate('/dashboard');
        return;
      }
      if (status === 'failed') {
        setError(`Analysis failed: ${res.data.errorCode ?? 'unknown error'}.`);
        setPhase('review');
        localStorage.removeItem('analysis_report_id');
        return;
      }
    }
    setError('Analysis is taking too long. Please refresh and try again.');
    setPhase('review');
    localStorage.removeItem('analysis_report_id');
  }, [navigate]);

  useEffect(() => {
    pollCancelled.current = false;
    const savedSubmissionId = localStorage.getItem('analysis_submission_id');
    const savedReportId = localStorage.getItem('analysis_report_id');
    if (savedSubmissionId) {
      api.get(`/profile/${savedSubmissionId}`)
        .then((res) => {
          if (pollCancelled.current) return;
          setSubmission(res.data);
          setSkills(res.data.extracted_skills ?? []);
          setPhase(savedReportId ? 'analyzing' : 'review');
        })
        .catch(() => localStorage.removeItem('analysis_submission_id'));
    }
    if (savedReportId) {
      setPhase('analyzing');
      poll(savedReportId).catch((err) => { if (!pollCancelled.current) { setError(errorMessage(err)); setPhase('review'); } });
    }
    return () => { pollCancelled.current = true; };
  }, [poll]);

  useEffect(() => {
    if (phase !== 'analyzing' || !submission?.id) return;
    let cancelled = false;
    let timer;
    async function watch() {
      try {
        const { data } = await api.get(`/analyze/submission/${submission.id}/status`);
        if (!cancelled && data?.stage) setStage(data.stage);
      } catch { /* The analysis request owns error handling; monitoring is optional. */ }
      if (!cancelled) timer = setTimeout(watch, POLL_MS);
    }
    watch();
    return () => { cancelled = true; clearTimeout(timer); };
  }, [phase, submission?.id]);

  async function handleUpload(file, github, linkedinUrl, linkedinSummaryText, leetcode, role, extra = {}) {
    setError('');
    setLoading(true);
    setPhase('upload');
    try {
      const form = new FormData();
      form.append('resume', file);
      form.append('github_username', github);
      form.append('linkedinUrl', linkedinUrl);
      form.append('linkedinSummaryText', linkedinSummaryText);
      form.append('leetcode_username', leetcode);
      form.append('target_role', role);
      form.append('codingProfileUrl', extra.codingProfileUrl ?? '');
      form.append('codingSummaryText', extra.codingSummaryText ?? '');

      const res = await api.post('/profile', form);
      const submissionId = res.data.id;
      localStorage.setItem('analysis_submission_id', submissionId);

      const profile = await api.get(`/profile/${submissionId}`);
      setSubmission(profile.data);
      setSkills(profile.data.extracted_skills ?? []);
      setPhase('review');
      if (res.data.extraction_status === 'failed') {
        setError('We could not extract skills yet. Retry below using your saved resume.');
      }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  async function retryExtraction() {
    setLoading(true); setError('');
    try {
      const { data } = await api.post(`/profile/${submission.id}/retry-extraction`);
      setSubmission(data); setSkills(data.extracted_skills || []);
    } catch (err) { setError(errorMessage(err)); }
    finally { setLoading(false); }
  }

  async function handleAnalyze() {
    setError('');
    setPhase('analyzing');
    setStage('queued');
    try {
      const res = await api.post('/analyze', { submission_id: submission.id });
      const id = res.data.report_id;
      localStorage.setItem('analysis_report_id', id);

      if (res.status === 202 && res.data.status === 'completed') {
        localStorage.setItem('report_id', id);
        localStorage.removeItem('analysis_report_id');
        localStorage.removeItem('analysis_submission_id');
        navigate('/dashboard');
        return;
      }

      await poll(id);
    } catch (err) {
      if (err.response?.status === 429) {
        const data = err.response.data;
        setError(`${data.message} (retry in ${data.retryAfterSeconds}s).`);
      } else {
        setError(errorMessage(err));
      }
      setPhase('review');
    }
  }

  return (
    <div className="page student-experience student-analysis-page">
      <NavBar />
      <div className="page-title-row student-analysis-heading"><div><p className="section-kicker">BUILD YOUR NEXT STEP</p><h1>Understand your potential.</h1><p className="muted">Start with your resume. Leave with a clearer plan.</p></div><span className="student-analysis-heading-note"><Icon name="file" size={18} /> A focused review, built around your experience.</span></div>
      <ol className="student-analysis-steps" aria-label="Analysis progress">
        {[
          { id: 'upload', number: '01', label: 'Add your profile' },
          { id: 'review', number: '02', label: 'Review your skills' },
          { id: 'analyzing', number: '03', label: 'Get your plan' },
        ].map((step, index) => {
          const activeIndex = phase === 'upload' ? 0 : phase === 'review' ? 1 : 2;
          const state = index < activeIndex ? 'complete' : index === activeIndex ? 'active' : 'upcoming';
          return <li key={step.id} className={`student-analysis-step is-${state}`} aria-current={state === 'active' ? 'step' : undefined}><span>{state === 'complete' ? <Icon name="check" size={15} /> : step.number}</span><strong>{step.label}</strong></li>;
        })}
      </ol>
      <div className="analysis-content student-analysis-content">
        <div className="student-analysis-main">
          <motion.div
            key={phase}
            className="student-analysis-phase"
            initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.28, ease: 'easeOut' }}
          >
            {phase === 'upload' && (
              <>
                {loading && <AnalysisActivity extracting />}
                <div hidden={loading}><UploadForm requestedRole={searchParams.get('role')} onSubmit={handleUpload} loading={loading} /></div>
                {error && <p className="error card-error">{error}</p>}
              </>
            )}

            {phase === 'review' && (
              <>
                {loading && <AnalysisActivity extracting />}
                <ExtractedSkillReview skills={skills} extractionError={submission?.extraction_status === 'failed' ? submission?.extraction_error : null} />
                {['unavailable', 'not_found'].includes(submission?.leetcode_status) && <p className="muted small">The public LeetCode profile could not be retrieved. The analysis uses your other available evidence.</p>}
                {error && <p className="error card-error">{error}</p>}
                <div className="actions card student-analysis-actions">
                  {submission?.extraction_status === 'failed' && <button className="primary" disabled={loading} onClick={retryExtraction}>{loading ? 'Retrying extraction…' : 'Retry skill extraction'}</button>}
                  <button className="primary" onClick={handleAnalyze} disabled={loading || submission?.extraction_status === 'failed'}>
                    Analyze &amp; score for {submission?.target_role} <Icon name="arrow" size={16} />
                  </button>
                  <button className="link" onClick={() => setPhase('upload')}>
                    Upload a different resume
                  </button>
                </div>
              </>
            )}

            {phase === 'analyzing' && (
              <AnalysisActivity stage={stage} role={submission?.target_role} />
            )}
          </motion.div>
        </div>
        <aside className="student-analysis-aside">
          <p className="section-kicker">WHAT YOU’LL GET</p>
          <h2>Evidence into direction.</h2>
          <p className="muted">Vortex maps what you already know to the role you want, then turns the gaps into practical next moves.</p>
          <div className="student-analysis-benefit"><span>01</span><div><strong>A skill map</strong><small>See strengths, developing areas, and gaps.</small></div></div>
          <div className="student-analysis-benefit"><span>02</span><div><strong>Readiness and profile scores</strong><small>Compare role skills, project evidence, and coding practice with clear source coverage.</small></div></div>
          <div className="student-analysis-benefit"><span>03</span><div><strong>A practical plan</strong><small>What to study, projects to build, problems to practice, and ideas to share on LinkedIn.</small></div></div>
           <div className="student-analysis-note"><Icon name="check" size={15} /> PDF resume required · external profiles are supplementary</div>
        </aside>
      </div>
    </div>
  );
}

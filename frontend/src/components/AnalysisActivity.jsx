import '../styles/profile-report.css';

const stages = [
  ['evidence', 'Read the evidence', 'Use your resume and the profile sources you supplied.'],
  ['matching', 'Compare role skills', 'Separate supported skills, gaps, and source coverage.'],
  ['planning', 'Prepare your next steps', 'Build the learning plan, project ideas, and practice suggestions.'],
];
export default function AnalysisActivity({ stage = 'queued', extracting = false, role }) {
  const active = stage === 'completed' ? stages.length : stages.findIndex(([id]) => id === stage);
  return <section className="card analysis-activity" aria-busy="true" aria-label={extracting ? 'Reading profile evidence' : 'Preparing analysis'}>
    <div className="analysis-signal" aria-hidden="true"><span /><span /><span /><span /><span /></div>
    <p className="section-kicker">{extracting ? 'READING YOUR PROFILE' : 'ANALYSIS IN PROGRESS'}</p>
    <h2>{extracting ? 'Finding the evidence in your profile…' : 'Turning your evidence into a plan…'}</h2>
    <p className="muted" role="status">{extracting ? 'Reading the PDF and available profile sources. Optional sources may be unavailable.' : stage === 'completed' ? 'Your report is ready.' : active < 0 ? 'Waiting for the analysis to start.' : `${stages[active][1]}${role ? ` for ${role}` : ''}.`}</p>
    {!extracting && <ol>{stages.map(([id, title, detail], index) => <li key={id} className={active === index ? 'is-current' : active > index ? 'is-done' : ''} aria-current={active === index ? 'step' : undefined}><span className="analysis-step-mark" aria-hidden="true">{active > index ? '✓' : index + 1}</span><div><strong>{title}</strong><p className="muted small">{detail}</p></div></li>)}</ol>}
    <p className="muted small">{extracting ? 'Keep this page open while extraction finishes.' : 'Stages reflect server updates. Timing depends on the available sources and AI services.'}</p>
  </section>;
}

import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import ThemeToggle from '../components/ThemeToggle';
import Icon from '../components/Icon';

const steps = [
  {
    icon: 'search',
    title: 'Find your fit',
    copy: 'Discover roles that match your skills, experience, and preferred city.',
  },
  {
    icon: 'chart',
    title: 'Know where you stand',
    copy: 'Turn your resume and project experience into a clear picture of your strengths and skill gaps.',
  },
  {
    icon: 'file',
    title: 'Build your next chapter',
    copy: 'Follow a focused study plan and track your applications as you move forward.',
  },
];

export default function LandingPage() {
  const { user } = useAuth();
  const primaryHref = user ? '/jobs' : '/login';
  const secondaryHref = user ? '/dashboard' : '/login';

  return (
    <main className="landing-page">
      <header className="landing-nav">
        <Link
          className="brand-lockup"
          to={user ? '/dashboard' : '/'}
          aria-label="Vortex home"
        >
          <span className="brand-mark">V</span>
          <span>
            Vortex<span className="brand-period">.</span>
          </span>
        </Link>
        <nav aria-label="Landing navigation">
          <a href="#how-it-works">How it works</a>
          <a href="#for-you">For students & teams</a>
          <ThemeToggle />
          <Link className="landing-login" to={primaryHref}>
            {user ? 'Open workspace' : 'Log in'}
            <Icon name="arrow" size={16} />
          </Link>
        </nav>
      </header>

      <section className="landing-hero">
        <div className="landing-hero-copy">
          <p className="hero-kicker">
            <span className="signal-dot" /> AI-ASSISTED CAREER CLARITY
          </p>
          <h1>
            Let AI turn your <br />
            experience into a{' '}
            <em>
              clearer next step.
            </em>
          </h1>
          <p className="landing-lede">
            Upload your profile, discover roles that fit, and get an evidence-backed plan for the skills that move you forward.
          </p>
          <div className="landing-actions">
            <Link className="primary landing-cta" to={primaryHref}>
              Explore opportunities
              <Icon name="arrow" />
            </Link>
            <Link className="landing-text-link" to={secondaryHref}>
              See your readiness
              <Icon name="arrow" size={16} />
            </Link>
          </div>
          <p className="hero-footnote">
            <Icon name="check" size={15} /> Your skills. Your progress. One
            place.
          </p>
        </div>

        <div
          className="workspace-preview"
          aria-label="Illustrative career overview with sample data"
        >
          <div className="preview-topbar">
            <span>
              <span className="preview-dot" /> Your career, in focus
            </span>
            <span className="preview-label">PREVIEW</span>
          </div>
          <div className="preview-body">
            <div className="preview-greeting">
              <div>
                <p className="section-kicker">YOUR NEXT CHAPTER</p>
                <h2>A little more ready.</h2>
              </div>
              <span className="preview-avatar">V</span>
            </div>
            <div className="preview-readiness">
              <div>
                <span>Role readiness</span>
                <h3>Data Scientist</h3>
                <p>A strong foundation to build on.</p>
                <span className="preview-score-label">
                  <Icon name="chart" size={14} /> Sample skill analysis
                </span>
              </div>
              <div className="preview-score">
                <strong>
                  84<span>/100</span>
                </strong>
              </div>
            </div>
            <div className="preview-skills">
              <div className="preview-row-heading">
                <strong>Your skill snapshot</strong>
                <span>Strength</span>
              </div>
              {[
                { name: 'Python', value: 90 },
                { name: 'Data analysis', value: 78 },
                { name: 'Machine learning', value: 62 },
              ].map(({ name, value }) => (
                <div className="preview-skill" key={name}>
                  <span>{name}</span>
                  <div>
                    <i style={{ width: `${value}%` }} />
                  </div>
                  <small>{value}%</small>
                </div>
              ))}
            </div>
            <div className="preview-next">
              <span className="preview-next-icon">
                <Icon name="file" />
              </span>
              <div>
                <strong>One step forward</strong>
                <span>Explore your personalized study plan</span>
              </div>
              <Icon name="arrow" size={17} />
            </div>
          </div>
          <div className="preview-footer">
            <span className="signal-dot" /> Built around your potential
          </div>
        </div>
      </section>

      <div className="landing-feature-strip">
        <span>FROM POSSIBILITY TO PROGRESS</span>
        <p>
          <Icon name="briefcase" /> Relevant opportunities
        </p>
        <p>
          <Icon name="chart" /> Skill insights
        </p>
        <p>
          <Icon name="file" /> Practical study plans
        </p>
      </div>

      <section className="landing-section" id="how-it-works">
        <div className="section-intro">
          <p className="section-kicker">A CLEARER WAY FORWARD</p>
          <h2>
            Big ambitions.
            <br />
            <em>Simple next steps.</em>
          </h2>
          <p>
            Everything you need to move from “what next?” to a plan you can act
            on.
          </p>
        </div>
        <div className="steps-grid">
          {steps.map((step, index) => (
            <article className="step-card" key={step.title}>
              <div className="step-top">
                <span className="step-icon">
                  <Icon name={step.icon} size={22} />
                </span>
                <span>0{index + 1}</span>
              </div>
              <h3>{step.title}</h3>
              <p>{step.copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-section split-section" id="for-you">
        <div className="split-statement">
          <p className="section-kicker">MADE FOR YOUR NEXT MOVE</p>
          <h2>
            Individual ambition.
            <br />
            <em>Shared progress.</em>
          </h2>
        </div>
        <div className="split-copy">
          <p>
            For students, a clearer path from skills to opportunities. For
            placement teams, one place to manage roles, review applications, and
            keep candidates moving.
          </p>
          <Link className="landing-text-link" to={primaryHref}>
            Find your starting point
            <Icon name="arrow" size={16} />
          </Link>
        </div>
      </section>

      <section className="landing-endcap">
        <div>
          <p className="section-kicker">YOUR NEXT CHAPTER STARTS HERE</p>
          <h2>
            Give your potential
            <br />a place to go.
          </h2>
        </div>
        <Link className="primary landing-cta" to={primaryHref}>
          Get started
          <Icon name="arrow" />
        </Link>
      </section>
      <footer className="landing-footer">
        <Link className="brand-lockup" to="/">
          <span className="brand-mark">V</span>Vortex.
        </Link>
        <span>A clearer path to your next role.</span>
        <a href="#how-it-works">
          How it works
          <Icon name="arrow" size={14} />
        </a>
      </footer>
    </main>
  );
}

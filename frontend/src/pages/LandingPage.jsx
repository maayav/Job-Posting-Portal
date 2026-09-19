import { useEffect, useLayoutEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import ThemeToggle from '../components/ThemeToggle';
import Icon from '../components/Icon';
import TubelightNavbar from '../components/TubelightNavbar';
import ExplodedProductView from '../components/ExplodedProductView';
import Reveal from '../components/ScrollReveal';
import EtherealBackground from '../components/EtherealBackground';
import { LandingMotionContext } from '../context/LandingMotionContext';
import '../styles/landing-page.css';
import '../styles/landing-atmosphere.css';
import { loadGsap } from '../utils/gsapRuntime';

const landingNavItems = [
  { name: 'Home', url: '#home', icon: 'home' },
  { name: 'Product tour', url: '#product-tour', icon: 'chart' },
  { name: 'How it works', url: '#how-it-works', icon: 'chart' },
  { name: 'For you', url: '#for-you', icon: 'users' },
  { name: 'Get started', url: '/login', icon: 'arrow' },
];

const startOptions = [
  { icon: 'briefcase', label: 'Explore opportunities', detail: 'Find roles that fit', to: '/jobs' },
  { icon: 'chart', label: 'Understand my skills', detail: 'Get a clearer profile', to: '/analysis/new' },
  { icon: 'file', label: 'Build a focused plan', detail: 'See what to do next', to: '/assistant' },
];

const features = [
  {
    number: '01', icon: 'briefcase', label: 'ROLE DISCOVERY', title: 'Opportunities with context.',
    copy: 'Search roles by the skills you bring, the experience you have, and the place you want to work.', to: '/jobs',
  },
  {
    number: '02', icon: 'file', label: 'PROFILE ANALYSIS', title: 'Make your experience visible.',
    copy: 'Turn your resume and projects into a useful view of your strengths and areas to build.', to: '/analysis/new',
  },
  {
    number: '03', icon: 'chart', label: 'AI CAREER SUPPORT', title: 'Move forward with a plan.',
    copy: 'Ask career questions and get practical guidance connected to your goals and skills.', to: '/assistant',
  },
  {
    number: '04', icon: 'check', label: 'APPLICATIONS', title: 'Keep each step in view.',
    copy: 'Track the roles you apply for and see where each opportunity stands.', to: '/applications',
  },
];

const steps = [
  {
    icon: 'file', title: 'Bring your experience',
    copy: 'Upload a resume or add project and skill details to build a starting profile.',
  },
  {
    icon: 'search', title: 'See your options clearly',
    copy: 'Explore roles and understand how your existing experience connects to them.',
  },
  {
    icon: 'chart', title: 'Take the next useful step',
    copy: 'Use readiness insights, focused guidance, and application tracking to keep momentum.',
  },
];

const faqs = [
  {
    question: 'What can I do with Vortex?',
    answer: 'Explore job opportunities, analyze your experience, ask the AI career assistant for guidance, and track your applications in one workspace.',
  },
  {
    question: 'Do I need to know my next role already?',
    answer: 'No. You can start by reviewing your skills, browsing opportunities, or asking the assistant to help you think through possible next steps.',
  },
  {
    question: 'Can placement teams use Vortex too?',
    answer: 'Yes. Admin workspaces include job management and an application review flow for keeping candidate progress organized.',
  },
];

export default function LandingPage() {
  const { user } = useAuth();
  const location = useLocation();
  const progressRef = useRef(null);
  const primaryHref = user ? '/jobs' : '/login';

  useLayoutEffect(() => {
    const previousRestoration = window.history.scrollRestoration;
    window.history.scrollRestoration = 'manual';
    // A fresh landing visit is a new starting point. Preserve intentional
    // section links such as /#product-tour.
    if (!window.location.hash && window.scrollY > 0) {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    }
    return () => {
      window.history.scrollRestoration = previousRestoration;
    };
  }, []);

  function handleBrandClick(event) {
    if (location.pathname !== '/') return;
    event.preventDefault();
    window.history.replaceState(null, '', '/#home');
    window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
  }

  useEffect(() => {
    const progressBar = progressRef.current;
    if (!progressBar) return undefined;
    let cancelled = false;
    let trigger;
    loadGsap().then(({ gsap, ScrollTrigger }) => {
      if (cancelled) return;
      trigger = ScrollTrigger.create({
        start: 0,
        end: () => Math.max(1, ScrollTrigger.maxScroll(window)),
        onUpdate: ({ progress }) => gsap.set(progressBar, { scaleX: progress }),
        onRefresh: ({ progress }) => gsap.set(progressBar, { scaleX: progress }),
      });
    }).catch(() => {});
    return () => {
      cancelled = true;
      trigger?.kill();
    };
  }, []);

  return (
    <LandingMotionContext.Provider value={true}>
    <div className="vortex-landing-shell">
      <TubelightNavbar items={landingNavItems} />
    <main className="landing-page vortex-site" data-motion="enabled">
      <EtherealBackground />
      <div
        className="landing-scroll-progress"
        ref={progressRef}
        aria-hidden="true"
      />

      <header className="landing-header">
        <Link className="brand-lockup" to="/" onClick={handleBrandClick} aria-label="Vortex home">
          <span className="brand-mark">V</span>
          <span>Vortex<span className="brand-period">.</span></span>
        </Link>
        <div className="landing-header-actions">
          <ThemeToggle />
          <Link className="landing-login" to={primaryHref}>
            {user ? 'Open workspace' : 'Log in'}
            <Icon name="arrow" size={16} />
          </Link>
        </div>
      </header>

      <section className="vortex-hero" id="home" aria-labelledby="vortex-hero-title">
        <div className="vortex-hero-glow" aria-hidden="true" />
        <Reveal className="vortex-hero-content" stagger>
          <p className="vortex-eyebrow"><span className="vortex-eyebrow-dot" /> YOUR NEXT MOVE, IN FOCUS</p>
          <h1 id="vortex-hero-title">
            Let AI turn your experience into a <em>clearer next step.</em>
          </h1>
          <p className="vortex-hero-copy">
            Find roles that fit, understand what you bring, and make a practical plan for what comes next.
          </p>
          <div className="vortex-hero-actions">
            <Link className="vortex-primary-action" to={primaryHref}>
              Get started <Icon name="arrow" size={17} />
            </Link>
            <a className="vortex-quiet-action" href="#product-tour">
              Explore the product <Icon name="arrow" size={16} />
            </a>
          </div>
          <p className="vortex-hero-note">
            <Icon name="check" size={15} /> Your skills, opportunities, and progress — together.
          </p>
        </Reveal>

        <Reveal className="vortex-start-panel" delay={0.08}>
          <div className="vortex-start-heading">
            <div>
              <span className="vortex-start-label">A GOOD PLACE TO BEGIN</span>
              <h2>What would you like to work on?</h2>
            </div>
            <span className="vortex-start-index">01 <i /> 03</span>
          </div>
          <div className="vortex-start-options">
            {startOptions.map((option) => (
              <Link className="vortex-start-option" to={user ? option.to : '/login'} key={option.label}>
                <span className="vortex-start-icon"><Icon name={option.icon} size={18} /></span>
                <span className="vortex-start-option-copy">
                  <strong>{option.label}</strong>
                  <small>{option.detail}</small>
                </span>
                <Icon name="arrow" size={16} />
              </Link>
            ))}
          </div>
          <div className="vortex-start-footer">
            <span><i /> VORTEX CAREER WORKSPACE</span>
            <span>MADE FOR YOUR NEXT MOVE</span>
          </div>
        </Reveal>
      </section>

      <section className="vortex-capabilities" id="capabilities" aria-labelledby="capabilities-title">
        <Reveal className="vortex-section-heading" direction="left">
          <div>
            <p className="vortex-section-kicker">ONE SPACE. A CLEARER WAY FORWARD.</p>
            <h2 id="capabilities-title">Everything for your <em>next move.</em></h2>
          </div>
          <span className="vortex-section-count">01 — 04</span>
        </Reveal>
        <div className="vortex-feature-rail" aria-label="Vortex features">
          {features.map((feature, index) => (
            <Reveal className="vortex-feature-reveal" direction={index % 2 === 0 ? "left" : "right"} delay={index * 0.07} key={feature.number}>
              <Link className="vortex-feature-card" to={user ? feature.to : '/login'}>
                <div className="vortex-feature-top">
                  <span className="vortex-feature-icon"><Icon name={feature.icon} size={19} /></span>
                  <span>{feature.number}</span>
                </div>
                <p className="vortex-feature-label">{feature.label}</p>
                <h3>{feature.title}</h3>
                <p className="vortex-feature-copy">{feature.copy}</p>
                <span className="vortex-feature-link">Explore <Icon name="arrow" size={15} /></span>
              </Link>
            </Reveal>
          ))}
        </div>
        <p className="vortex-rail-hint"><span /> One profile. A more connected journey. <span /></p>
      </section>

      <ExplodedProductView />

      <section className="vortex-process-section" id="how-it-works" aria-labelledby="process-title">
        <Reveal className="vortex-section-heading" direction="left">
          <div>
            <p className="vortex-section-kicker">FROM POSSIBILITY TO PROGRESS</p>
            <h2 id="process-title">A big goal, made <em>actionable.</em></h2>
            <p className="vortex-section-copy">A few connected steps help you move from “what next?” to a plan you can act on.</p>
          </div>
          <span className="vortex-section-count">THREE SIMPLE STEPS</span>
        </Reveal>
        <div className="vortex-steps-grid">
          {steps.map((step, index) => (
            <Reveal as="article" direction={["left", "up", "right"][index]} className="vortex-step-card" key={step.title} delay={index * 0.07}>
              <div className="vortex-step-top">
                <span className="vortex-step-icon"><Icon name={step.icon} size={20} /></span>
                <span>0{index + 1}</span>
              </div>
              <h3>{step.title}</h3>
              <p>{step.copy}</p>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="vortex-audience-section" id="for-you" aria-labelledby="audience-title">
        <Reveal className="vortex-audience-heading" direction="left">
          <p className="vortex-section-kicker">MADE FOR YOUR NEXT MOVE</p>
          <h2 id="audience-title">Individual ambition.<br /><em>Shared progress.</em></h2>
          <p>Useful for the person building a path and the teams helping them take the next step.</p>
        </Reveal>
        <Reveal className="vortex-audience-cards" direction="right" stagger>
          <article className="vortex-audience-card">
            <span className="vortex-audience-number">01 / STUDENTS</span>
            <span className="vortex-audience-icon"><Icon name="users" size={20} /></span>
            <h3>Make your potential easier to act on.</h3>
            <p>Connect your skills to opportunities, get a grounded view of your readiness, and keep your applications organized.</p>
            <Link to={primaryHref}>Explore your workspace <Icon name="arrow" size={15} /></Link>
          </article>
          <article className="vortex-audience-card">
            <span className="vortex-audience-number">02 / PLACEMENT TEAMS</span>
            <span className="vortex-audience-icon"><Icon name="briefcase" size={20} /></span>
            <h3>Keep candidate progress in view.</h3>
            <p>Manage roles and review applications through a focused candidate flow designed for placement teams.</p>
            <Link to="/login">Open the team workspace <Icon name="arrow" size={15} /></Link>
          </article>
        </Reveal>
      </section>

      <Reveal as="section" direction="right" className="vortex-faq-section" aria-labelledby="faq-title">
        <div className="vortex-faq-intro">
          <p className="vortex-section-kicker">A FEW USEFUL DETAILS</p>
          <h2 id="faq-title">Questions, <em>answered.</em></h2>
        </div>
        <div className="vortex-faq-list">
          {faqs.map((faq, index) => (
            <details className="vortex-faq-item" key={faq.question} open={index === 0}>
              <summary><span>{faq.question}</span><i aria-hidden="true" /></summary>
              <p>{faq.answer}</p>
            </details>
          ))}
        </div>
      </Reveal>

      <Reveal as="section" direction="up" className="landing-endcap vortex-endcap" id="get-started">
        <div className="vortex-endcap-orbit" aria-hidden="true" />
        <div className="vortex-endcap-copy">
          <p className="vortex-section-kicker">YOUR NEXT CHAPTER STARTS HERE</p>
          <h2>Turn what you have into <em>what’s next.</em></h2>
          <p>Start with your profile, explore your options, and build momentum one useful step at a time.</p>
        </div>
        <Link className="vortex-primary-action" to="/login">Get started <Icon name="arrow" size={17} /></Link>
      </Reveal>

      <footer className="vortex-footer">
        <Link className="brand-lockup" to="/" onClick={handleBrandClick} aria-label="Vortex home">
          <span className="brand-mark">V</span><span>Vortex<span className="brand-period">.</span></span>
        </Link>
        <span>A clearer path to your next role.</span>
        <a href="#home">Back to top <Icon name="arrow" size={14} /></a>
      </footer>
    </main>
    </div>
    </LandingMotionContext.Provider>
  );
}

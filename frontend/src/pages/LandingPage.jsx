import { motion } from 'motion/react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

const reveal = {
  initial: { opacity: 0, y: 42 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: false, amount: 0.22 },
  transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] },
};

const partners = ['STUDENT COMMUNITIES', 'PLACEMENT OFFICES', 'CAREER MENTORS', 'HIRING TEAMS', 'CAMPUS NETWORKS'];

function Reveal({ children, className = '' }) {
  return (
    <motion.div className={className} {...reveal}>
      {children}
    </motion.div>
  );
}

export default function LandingPage() {
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const primaryHref = user ? '/jobs' : '/login';
  const secondaryHref = user ? '/dashboard' : '/login';

  return (
    <main className="landing-page">
      <header className="landing-nav">
        <Link className="brand-lockup" to={user ? '/dashboard' : '/'}>
          <span className="brand-mark">V</span>
          <span>Vortex</span>
        </Link>
        <nav aria-label="Landing navigation">
          <a href="#how-it-works">How it works</a>
          <a href="#for-you">For your next move</a>
          <button className="theme-toggle" onClick={toggleTheme}>
            {theme === 'dark' ? 'Light' : 'Dark'}
          </button>
          <Link className="landing-login" to={primaryHref}>{user ? 'Open workspace' : 'Log in'}</Link>
        </nav>
      </header>

      <section className="landing-hero">
        <div className="landing-hero-copy">
          <motion.p className="hero-kicker" {...reveal}>
            VORTEX / CAREER MOVEMENT
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
          >
            Your next role is closer than your <em>current signal.</em>
          </motion.h1>
          <motion.p
            className="landing-lede"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2 }}
          >
            Vortex connects the work you have done with the work you want next — jobs, skills, evidence,
            and a practical route forward.
          </motion.p>
          <motion.div
            className="landing-actions"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.32 }}
          >
            <Link className="primary landing-cta" to={primaryHref}>Explore opportunities <span>↗</span></Link>
            <Link className="landing-text-link" to={secondaryHref}>See your readiness <span>→</span></Link>
          </motion.div>
        </div>

        <motion.div
          className="landing-visual"
          initial={{ opacity: 0, scale: 0.92, rotate: 2 }}
          animate={{ opacity: 1, scale: 1, rotate: 0 }}
          transition={{ duration: 1, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="landing-visual-grid" />
          <div className="orbit orbit-one" />
          <div className="orbit orbit-two" />
          <div className="visual-card visual-score">
            <span className="visual-label">ROLE READINESS</span>
            <strong>84</strong>
            <small>/100 · Data Scientist</small>
          </div>
          <div className="visual-card visual-skill">
            <span className="visual-label">SKILL SIGNAL</span>
            <strong>Python</strong>
            <span className="visual-bar"><i /></span>
            <small>evidence-backed</small>
          </div>
          <div className="visual-stamp">MOVE<br />WITH<br />PROOF</div>
        </motion.div>
      </section>

      <div className="landing-scroll-note"><span /> Scroll to explore</div>

      <section className="marquee-section" aria-label="Vortex is designed for">
        <p className="section-kicker">TRUSTED BY</p>
        <div className="marquee-window">
          <div className="marquee-track">
            {[...partners, ...partners].map((partner, index) => (
              <span key={`${partner}-${index}`}>{partner}<b>✳</b></span>
            ))}
          </div>
        </div>
      </section>

      <section className="landing-section" id="how-it-works">
        <Reveal className="section-intro">
          <p className="section-kicker">01 / HOW IT WORKS</p>
          <h2>Less guessing.<br /><em>More direction.</em></h2>
          <p>Vortex turns scattered career information into a sequence you can actually act on.</p>
        </Reveal>
        <div className="steps-grid">
          <Reveal className="step-card"><span>01</span><h3>Find the right room</h3><p>Search live roles by the skills, place, and experience you already have.</p></Reveal>
          <Reveal className="step-card"><span>02</span><h3>Read your signal</h3><p>Upload your profile and see what your evidence says about a target role.</p></Reveal>
          <Reveal className="step-card"><span>03</span><h3>Close the distance</h3><p>Use a prioritized study plan to turn gaps into your next credible proof point.</p></Reveal>
        </div>
      </section>

      <section className="landing-section split-section" id="for-you">
        <Reveal className="split-statement"><p className="section-kicker">02 / FOR YOUR NEXT MOVE</p><h2>Not another dashboard.<br /><em>A clearer starting point.</em></h2></Reveal>
        <Reveal className="split-copy"><p>For students, Vortex gives the search and the self-knowledge the search needs. For placement teams, it creates a shared language around readiness without turning people into a single number.</p><Link className="landing-text-link" to={primaryHref}>Enter Vortex <span>↗</span></Link></Reveal>
      </section>

      <section className="landing-endcap">
        <Reveal>
          <p className="section-kicker">03 / START HERE</p>
          <h2>Make the next move<br /><em>visible.</em></h2>
          <Link className="primary landing-cta" to={primaryHref}>Open Vortex <span>↗</span></Link>
        </Reveal>
      </section>

      <footer className="landing-footer"><span>Vortex / placement intelligence</span><span>Built for the next chapter</span></footer>
    </main>
  );
}

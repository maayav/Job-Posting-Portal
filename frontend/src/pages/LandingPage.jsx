import { useLayoutEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { useAuth } from '../context/AuthContext';
import ThemeToggle from '../components/ThemeToggle';
import Reveal from '../components/ScrollReveal';
import RoleGuide from '../components/RoleGuide';
import LandingBackground from '../components/LandingBackground';
import { LandingMotionContext } from '../context/LandingMotionContext';
import catalog from '../data/role-catalog.json';
import '../styles/landing-page.css';

const MotionLink = motion.create(Link);
const faqs = [
  ['What do I need to get started?', 'Create an account and upload your resume as a PDF, up to 5 MB. You can also add your public GitHub and LeetCode profiles. Choose a role, then review the skills Vortex found before you run the analysis.'],
  ['What does the readiness score mean?', 'It compares the skills found in your profile with the skills in your chosen role guide. It can help you choose what to study next. It is not a prediction of whether you will get hired.'],
  ['Where do the learning links come from?', 'The study plan uses a curated catalog of documentation, courses, and tutorials matched to each skill. You can open those same links in the role guide above.'],
  ['Can a placement team use it?', 'Yes. Admins can post and close jobs, review applications, change candidate statuses, and ask the assistant questions about their workspace. Students have their own job search, analysis, and application history.'],
];

export default function LandingPage() {
  const { user } = useAuth();
  useLayoutEffect(() => {
    const previous = history.scrollRestoration;
    history.scrollRestoration = 'manual';
    if (!window.location.hash) window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    return () => { history.scrollRestoration = previous; };
  }, []);
  function home(event) {
    event.preventDefault();
    history.replaceState(null, '', '/');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  return <LandingMotionContext.Provider value={true}>
    <div className="vortex-landing-shell landing-editorial">
      <LandingBackground />
      <header className="landing-masthead">
        <Link className="landing-brand" to="/" onClick={home} aria-label="Vortex home"><span>V</span>Vortex</Link>
        <nav aria-label="Landing page navigation">
          <a href="#product-tour">Role guide</a>
          <a href="#how-it-works">How it works</a>
          <a href="#for-you">For teams</a>
          <Link to="/login">Get started</Link>
        </nav>
        <div className="landing-header-tools"><ThemeToggle /><Link to={user ? '/jobs' : '/login'}>{user ? 'Workspace' : 'Log in'} <span aria-hidden="true">↗</span></Link></div>
      </header>
      <main className="landing-page vortex-site" data-motion="enabled">
        <section className="landing-intro" id="home" aria-labelledby="landing-title">
          <Reveal className="landing-intro-copy" stagger>
            <p className="landing-label">Jobs, skills, and a plan to get there.</p>
            <h1 id="landing-title">Find a role.<br />See what you<br /><span>need to learn.</span></h1>
            <p className="landing-lede">Bring your resume. Vortex helps you see which skills you already have, what to work on next, and where to apply.</p>
            <div className="landing-actions">
              <MotionLink className="landing-action" to="/login" whileHover={{ y: -2 }} whileTap={{ scale: .98 }}>Get started <span aria-hidden="true">↗</span></MotionLink>
              <motion.a className="landing-text-link" href="#product-tour" whileHover={{ x: 3 }}>Try the role guide <span aria-hidden="true">↓</span></motion.a>
            </div>
            <p className="landing-small">Browse the guide below. Sign in when you’re ready to check your own skills.</p>
          </Reveal>
          <Reveal as="aside" className="landing-index" direction="right">
            <span className="landing-label">What you can do here</span>
            <a href="#product-tour"><span>01</span><strong>Explore a role</strong><span aria-hidden="true">↗</span></a>
            <a href="#how-it-works"><span>02</span><strong>Check your resume</strong><span aria-hidden="true">↗</span></a>
            <Link to="/jobs"><span>03</span><strong>Find jobs and apply</strong><span aria-hidden="true">↗</span></Link>
            <p>Start with one role.<br />You don’t need to have it all figured out.</p>
          </Reveal>
        </section>
        <Reveal className="landing-catalog-facts">
          <p>Already in the<br /><strong>Vortex role guide</strong></p>
          <dl>
            <div><dt>Built-in roles</dt><dd>{catalog.roles.length}</dd></div>
            <div><dt>Skills covered</dt><dd>{catalog.skillCount}</dd></div>
            <div><dt>Learning links</dt><dd>{catalog.resourceCount}</dd></div>
          </dl>
        </Reveal>

        <section className="landing-section" id="product-tour" aria-labelledby="guide-title">
          <Reveal className="landing-section-heading">
            <p className="landing-label">01 / Try it here</p>
            <h2 id="guide-title">What does your next role actually need?</h2>
            <p>Choose a role. See the skills in its analysis and follow the links to start learning. These are the actual guides built into Vortex.</p>
          </Reveal>
          <Reveal><RoleGuide /></Reveal>
        </section>

        <section className="landing-section landing-workflow" id="how-it-works" aria-labelledby="workflow-title">
          <Reveal className="landing-section-heading" direction="left">
            <p className="landing-label">02 / Your own analysis</p>
            <h2 id="workflow-title">From your resume<br />to a study plan.</h2>
            <p>You stay in control. Review what Vortex found before it compares your skills with a role.</p>
            <Link className="landing-text-link" to="/analysis/new">Start an analysis <span aria-hidden="true">↗</span></Link>
          </Reveal>
          <ol className="landing-workflow-list">
            {[
              ['Upload your resume', 'Add a PDF and choose your target role. GitHub and LeetCode profiles are optional.'],
              ['Check the extracted skills', 'Correct anything that looks wrong or add missing skills before you continue.'],
              ['Work through your plan', 'See your strengths and gaps, open learning resources, and mark off what you finish.'],
              ['Find a role and keep track', 'Search jobs by skill, experience, and location. Keep your applications and their statuses in one place.'],
            ].map(([title, copy], index) => <Reveal as="li" key={title} direction="right">
              <span>{String(index + 1).padStart(2, '0')}</span><div><h3>{title}</h3><p>{copy}</p></div>
            </Reveal>)}
          </ol>
        </section>

        <section className="landing-section landing-teams" id="for-you" aria-labelledby="teams-title">
          <Reveal className="landing-section-heading">
            <p className="landing-label">03 / For placement teams</p>
            <h2 id="teams-title">Keep applications in one place.</h2>
            <p>Post open roles, review candidates, and update their application status. The admin assistant can answer questions about the jobs and applications in your workspace.</p>
          </Reveal>
          <Reveal className="landing-team-note" direction="right">
            <span className="landing-label">Students and admins have separate workspaces</span>
            <p>Students can see their own progress. Admins can see who applied, which roles are open, and what needs a review.</p>
            <Link className="landing-text-link" to="/login">Log in to your workspace <span aria-hidden="true">↗</span></Link>
          </Reveal>
        </section>

        <section className="landing-section landing-questions" aria-labelledby="faq-title">
          <Reveal className="landing-section-heading"><p className="landing-label">Before you start</p><h2 id="faq-title">A few useful answers.</h2></Reveal>
          <div>{faqs.map(([question, answer]) => <Reveal key={question}>
            <details className="landing-question"><summary>{question}<span aria-hidden="true">+</span></summary><p>{answer}</p></details>
          </Reveal>)}</div>
        </section>

        <Reveal as="section" className="landing-section landing-endcap" id="get-started">
          <div><p className="landing-label">Start with what you know</p><h2>Let’s see where<br />your skills can take you.</h2><p>Your resume is enough to begin.</p></div>
          <MotionLink className="landing-action" to="/login" whileHover={{ y: -2 }} whileTap={{ scale: .98 }}>Get started <span aria-hidden="true">↗</span></MotionLink>
        </Reveal>
        <Reveal as="footer" className="landing-footer">
          <Link className="landing-brand" to="/" onClick={home} aria-label="Vortex home"><span>V</span>Vortex</Link>
          <p>Find a role. Make a plan. Keep going.</p>
          <a href="#home" onClick={home}>Back to top ↑</a>
        </Reveal>
      </main>
    </div>
  </LandingMotionContext.Provider>;
}

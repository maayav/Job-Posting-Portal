import { useState } from 'react';
import { motion } from 'motion/react';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import ThemeToggle from '../components/ThemeToggle';
import { errorMessage } from '../api/client';

export default function LoginPage() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (mode === 'login') {
        await login(email, password);
      } else {
        await register(name, email, password);
      }
      window.location.href = '/dashboard';
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-wrap">
      <header className="auth-nav">
        <Link className="brand-lockup" to="/" aria-label="Vortex home">
          <span className="brand-mark">V</span>Vortex.
        </Link>
        <nav aria-label="Authentication navigation">
          <a href="/#how-it-works">How it works</a>
          <Link to="/">Back home</Link>
          <ThemeToggle />
        </nav>
      </header>
      <motion.div
        className="auth-layout"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: 'easeOut' }}
      >
        <section className="auth-story">
          <span className="auth-product">A CLEARER PATH FORWARD</span>
          <p className="hero-kicker">YOUR CAREER, IN FOCUS</p>
          <h1>
            Turn your profile into your <em>next move.</em>
          </h1>
          <p>
            One clear space for job discovery, readiness, and the work between
            where you are and where you want to go.
          </p>
          <div className="auth-story-grid">
            <div>
              <strong>01</strong>
              <span>Find relevant roles</span>
            </div>
            <div>
              <strong>02</strong>
              <span>See your real gaps</span>
            </div>
            <div>
              <strong>03</strong>
              <span>Build momentum</span>
            </div>
          </div>
        </section>

        <form className="card auth-card" onSubmit={handleSubmit}>
          <p className="section-kicker">YOUR WORKSPACE</p>
          <h2 className="brand">
            {mode === 'login' ? 'Welcome back' : 'Your next chapter'}
          </h2>
          <p className="subtitle">
            {mode === 'login'
              ? 'Log in to pick up where you left off.'
              : 'Create an account to get started.'}
          </p>

          <div className="tabs">
            <button
              type="button"
              className={mode === 'login' ? 'active' : ''}
              onClick={() => {
                setMode('login');
                setError('');
              }}
            >
              Log in
            </button>
            <button
              type="button"
              className={mode === 'register' ? 'active' : ''}
              onClick={() => {
                setMode('register');
                setError('');
              }}
            >
              Sign up
            </button>
          </div>

          {mode === 'register' && (
            <label>
              Name
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoComplete="name"
              />
            </label>
          )}
          <label>
            Email
            <input
              placeholder="you@example.com"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </label>
          <label>
            Password
            <input
              placeholder="At least 6 characters"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              autoComplete={
                mode === 'login' ? 'current-password' : 'new-password'
              }
            />
          </label>

          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}

          <button className="primary" disabled={loading}>
            {loading
              ? 'Please wait…'
              : mode === 'login'
                ? 'Log in'
                : 'Create account'}
          </button>
        </form>
      </motion.div>
    </div>
  );
}

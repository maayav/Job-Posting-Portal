import { useState } from 'react';
import { motion } from 'motion/react';
import { useAuth } from '../context/AuthContext';
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
      window.location.href = '/';
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-wrap">
      <motion.div
        className="auth-layout"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: 'easeOut' }}
      >
        <section className="auth-story">
          <h2 className="auth-product">SkillGap Tracker</h2>
          <p className="hero-kicker"><span className="signal-dot" />Signal-based career navigation</p>
          <h1>Turn your profile into your <em>next move.</em></h1>
          <p>One console for job discovery, readiness signals, and the work between where you are and where you want to go.</p>
          <div className="auth-story-grid">
            <div><strong>01</strong><span>Find relevant roles</span></div>
            <div><strong>02</strong><span>See your real gaps</span></div>
            <div><strong>03</strong><span>Build momentum</span></div>
          </div>
        </section>

        <form className="card auth-card" onSubmit={handleSubmit}>
          <p className="section-kicker">ACCESS / STUDENT CONSOLE</p>
          <h2 className="brand">Welcome back</h2>
          <p className="subtitle">AI-assisted placement readiness</p>

        <div className="tabs">
          <button type="button" className={mode === 'login' ? 'active' : ''} onClick={() => { setMode('login'); setError(''); }}>
            Log in
          </button>
          <button type="button" className={mode === 'register' ? 'active' : ''} onClick={() => { setMode('register'); setError(''); }}>
            Sign up
          </button>
        </div>

        {mode === 'register' && (
          <label>
            Name
            <input value={name} onChange={(e) => setName(e.target.value)} required autoComplete="name" />
          </label>
        )}
        <label>
          Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
        </label>
        <label>
          Password
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} autoComplete="current-password" />
        </label>

        {error && <p className="error">{error}</p>}

        <button className="primary" disabled={loading}>
          {loading ? 'Please wait…' : mode === 'login' ? 'Log in' : 'Create account'}
        </button>
        </form>
      </motion.div>
    </div>
  );
}

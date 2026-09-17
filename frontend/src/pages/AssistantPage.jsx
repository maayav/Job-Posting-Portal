import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import Icon from '../components/Icon';
import NavBar from '../components/NavBar';
import { api, errorMessage } from '../api/client';

const SUGGESTIONS = [
  'What is my biggest skill gap?',
  'What should I learn first?',
  'Why is my readiness score low?',
  'Suggest a project for my missing skills.',
];

export default function AssistantPage() {
  const [context, setContext] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    api.get('/assistant/context')
      .then((response) => { if (active) setContext(response.data); })
      .catch((err) => { if (active && err.response?.status !== 409) setError(errorMessage(err)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const hasAnalysis = !!context?.analysisId;
  const latestQuestion = useMemo(() => messages.filter((item) => item.role === 'user').at(-1)?.content, [messages]);

  async function sendMessage(value = input) {
    const message = value.trim();
    if (!message || sending || !hasAnalysis) return;
    setError('');
    setInput('');
    const nextMessages = [...messages, { role: 'user', content: message }];
    setMessages(nextMessages);
    setSending(true);
    try {
      const response = await api.post('/assistant/chat', { message, analysisId: context.analysisId, history: nextMessages.slice(-8) });
      setMessages((current) => [...current, { role: 'assistant', content: response.data.reply }]);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSending(false);
    }
  }

  function clearConversation() {
    setMessages([]);
    setError('');
    setInput('');
  }

  return (
    <div className="page assistant-page">
      <NavBar />
      <motion.div className="assistant-shell" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: 'easeOut' }}>
        <header className="assistant-header">
          <div>
            <p className="section-kicker">AI CAREER PREPARATION</p>
            <h1>AI Assistant</h1>
            <p className="assistant-lede muted">Ask better questions about your next move, grounded in your latest role analysis, evidence, gaps, and study plan.</p>
          </div>
          {context && <div className="assistant-context-chip"><span>Target role</span><strong>{context.targetRole}</strong><small>{context.roleReadinessScore ?? '—'} readiness</small></div>}
        </header>

        {loading && <div className="card center" role="status"><div className="spinner" /><p className="muted">Loading your analysis context…</p></div>}

        {!loading && !hasAnalysis && (
          <section className="card assistant-empty-state">
            <span className="assistant-icon"><Icon name="chart" size={28} /></span>
            <h2>Complete an analysis first</h2>
            <p className="muted">The assistant needs a saved target role, scores, and verified skill gaps before it can give grounded advice.</p>
            <Link className="primary inline" to="/analyze">Start a new analysis <Icon name="arrow" size={16} /></Link>
          </section>
        )}

        {!loading && hasAnalysis && (
          <section className="assistant-workspace">
            <div className="card assistant-thread" aria-live="polite">
              <div className="assistant-thread-heading"><div><span className="signal-dot" /> Grounded conversation</div><button className="link" onClick={clearConversation} disabled={!messages.length}>Clear</button></div>
              {!messages.length && <div className="assistant-welcome"><span className="assistant-icon"><Icon name="chart" size={25} /></span><h2>What would you like to work on?</h2><p className="muted">Ask about your score, gaps, learning order, or a project that would create stronger evidence.</p></div>}
              {messages.map((message, index) => <div className={`assistant-message assistant-message-${message.role}`} key={`${message.role}-${index}`}><span>{message.role === 'user' ? 'You' : 'Vortex AI'}</span><p>{message.content}</p></div>)}
              {sending && <div className="assistant-message assistant-message-assistant"><span>Vortex AI</span><p className="muted">Thinking from your analysis…</p></div>}
              {error && <div className="card-error assistant-error"><p className="error">{error}</p><button className="link" onClick={() => latestQuestion && sendMessage(latestQuestion)}>Retry</button></div>}
              <div className="assistant-composer"><textarea aria-label="Message the AI assistant" rows="2" value={input} placeholder="Ask about your readiness or next step…" onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); sendMessage(); } }} /><button className="primary" onClick={() => sendMessage()} disabled={!input.trim() || sending}>Send <Icon name="arrow" size={16} /></button></div>
            </div>
            <aside className="card assistant-suggestions"><div className="section-heading"><div><p className="section-kicker">START HERE</p><h2>Useful prompts</h2></div></div>{SUGGESTIONS.map((suggestion) => <button className="assistant-suggestion" key={suggestion} onClick={() => sendMessage(suggestion)} disabled={sending}>{suggestion}<Icon name="arrow" size={15} /></button>)}</aside>
          </section>
        )}
      </motion.div>
    </div>
  );
}

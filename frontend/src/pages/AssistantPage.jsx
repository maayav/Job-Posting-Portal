import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import Icon from '../components/Icon';
import NavBar from '../components/NavBar';
import { api, errorMessage } from '../api/client';
import '../styles/assistant-answer.css';
import '../styles/student-experience.css';

const SUGGESTIONS = [
  'What is my biggest skill gap?',
  'What should I learn first?',
  'Why is my readiness score low?',
  'Suggest a project for my missing skills.',
];

const ADMIN_SUGGESTIONS = [
  'How many people applied to each open role?',
  'Which roles are open and which have the most applicants?',
  'Show candidates currently under review.',
  'Give me a quick summary of the latest candidates.',
];

function safeAssistantHref(value) {
  try {
    const url = new URL(value, window.location.origin);
    return ['http:', 'https:', 'mailto:'].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

function renderInlineMarkdown(text) {
  const pattern = /(\[[^\]]+\]\([^)]+\)|https?:\/\/[^\s<]+|`[^`]+`|\*\*[^*\n]+\*\*|__[^_\n]+__|~~[^~\n]+~~|\*[^*\n]+\*|_[^_\n]+_)/g;
  const output = [];
  let cursor = 0;
  let match;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > cursor) output.push(text.slice(cursor, match.index));
    const token = match[0];
    const key = `inline-${match.index}`;
    const markdownLink = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);

    if (markdownLink) {
      const href = safeAssistantHref(markdownLink[2].trim());
      output.push(href
        ? <a key={key} href={href} target="_blank" rel="noreferrer">{markdownLink[1]}</a>
        : markdownLink[1]);
    } else if (/^https?:\/\//i.test(token)) {
      const trailing = token.match(/[.,!?;:]+$/)?.[0] ?? '';
      const visibleUrl = trailing ? token.slice(0, -trailing.length) : token;
      const href = safeAssistantHref(visibleUrl);
      output.push(href
        ? <a key={key} href={href} target="_blank" rel="noreferrer">{visibleUrl}</a>
        : token);
      if (trailing) output.push(trailing);
    } else if (token.startsWith('`')) {
      output.push(<code key={key}>{token.slice(1, -1)}</code>);
    } else if (token.startsWith('**') || token.startsWith('__')) {
      output.push(<strong key={key}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith('~~')) {
      output.push(<del key={key}>{token.slice(2, -2)}</del>);
    } else {
      output.push(<em key={key}>{token.slice(1, -1)}</em>);
    }
    cursor = pattern.lastIndex;
  }

  if (cursor < text.length) output.push(text.slice(cursor));
  return output;
}

export function AssistantAnswer({ content }) {
  const lines = String(content ?? '').replace(/\r\n?/g, '\n').split('\n');
  const blocks = [];
  let paragraph = [];
  let index = 0;
  let paragraphKey = 0;

  function flushParagraph() {
    if (!paragraph.length) return;
    blocks.push(<p key={`paragraph-${paragraphKey++}`}>{renderInlineMarkdown(paragraph.join(' '))}</p>);
    paragraph = [];
  }

  while (index < lines.length) {
    const line = lines[index];
    const trimmed = line.trim();

    if (!trimmed) {
      flushParagraph();
      index += 1;
      continue;
    }

    const fence = trimmed.match(/^```([\w+-]*)\s*$/);
    if (fence) {
      flushParagraph();
      const code = [];
      index += 1;
      while (index < lines.length && !/^\s*```\s*$/.test(lines[index])) {
        code.push(lines[index]);
        index += 1;
      }
      if (index < lines.length) index += 1;
      blocks.push(<pre key={`code-${index}`}><code data-language={fence[1] || undefined}>{code.join('\n')}</code></pre>);
      continue;
    }

    const heading = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      flushParagraph();
      const Heading = `h${heading[1].length}`;
      blocks.push(<Heading key={`heading-${index}`}>{renderInlineMarkdown(heading[2])}</Heading>);
      index += 1;
      continue;
    }

    if (/^\s*(?:[-*_]\s*){3,}$/.test(line)) {
      flushParagraph();
      blocks.push(<hr key={`rule-${index}`} />);
      index += 1;
      continue;
    }

    // Keep compact Markdown tables readable inside the answer bubble. The
    // parser intentionally accepts plain text cells only; links and emphasis
    // still go through the safe inline renderer.
    if (line.includes('|') && index + 1 < lines.length && /^\s*\|?\s*:?-{3,}/.test(lines[index + 1])) {
      flushParagraph();
      const cells = (value) => value.trim().replace(/^\||\|$/g, '').split('|').map((cell) => cell.trim());
      const headers = cells(line);
      index += 2;
      const rows = [];
      while (index < lines.length && lines[index].includes('|') && lines[index].trim()) {
        rows.push(cells(lines[index]));
        index += 1;
      }
      blocks.push(<div className="assistant-table-wrap" key={`table-${index}`}><table><thead><tr>{headers.map((cell, cellIndex) => <th key={cellIndex}>{renderInlineMarkdown(cell)}</th>)}</tr></thead><tbody>{rows.map((row, rowIndex) => <tr key={rowIndex}>{headers.map((_, cellIndex) => <td key={cellIndex}>{renderInlineMarkdown(row[cellIndex] ?? '')}</td>)}</tr>)}</tbody></table></div>);
      continue;
    }

    const quote = trimmed.match(/^>\s?(.*)$/);
    if (quote) {
      flushParagraph();
      const quoteLines = [];
      while (index < lines.length) {
        const currentQuote = lines[index].trim().match(/^>\s?(.*)$/);
        if (!currentQuote) break;
        quoteLines.push(currentQuote[1]);
        index += 1;
      }
      blocks.push(<blockquote key={`quote-${index}`}>{renderInlineMarkdown(quoteLines.join(' '))}</blockquote>);
      continue;
    }

    const unordered = line.match(/^\s*[-*+]\s+(.+)$/);
    const ordered = line.match(/^\s*(\d+)[.)]\s+(.+)$/);
    if (unordered || ordered) {
      flushParagraph();
      const isOrdered = !!ordered;
      const items = [];
      const start = ordered ? Number(ordered[1]) : 1;
      while (index < lines.length) {
        const current = isOrdered
          ? lines[index].match(/^\s*(\d+)[.)]\s+(.+)$/)
          : lines[index].match(/^\s*[-*+]\s+(.+)$/);
        if (!current) break;
        items.push(isOrdered ? current[2] : current[1]);
        index += 1;
      }
      const List = isOrdered ? 'ol' : 'ul';
      blocks.push(<List key={`list-${index}`} start={isOrdered ? start : undefined}>{items.map((item, itemIndex) => <li key={`item-${itemIndex}`}>{renderInlineMarkdown(item)}</li>)}</List>);
      continue;
    }

    paragraph.push(trimmed);
    index += 1;
  }

  flushParagraph();
  return <div className="assistant-answer">{blocks}</div>;
}

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

  const isAdminAssistant = context?.role === 'admin';
  const hasAnalysis = !!context?.analysisId;
  const canChat = isAdminAssistant || hasAnalysis;
  const suggestions = isAdminAssistant ? ADMIN_SUGGESTIONS : SUGGESTIONS;
  const latestQuestion = useMemo(() => messages.filter((item) => item.role === 'user').at(-1)?.content, [messages]);

  async function sendMessage(value = input) {
    const message = value.trim();
    if (!message || sending || !canChat) return;
    setError('');
    setInput('');
    const nextMessages = [...messages, { role: 'user', content: message }];
    setMessages(nextMessages);
    setSending(true);
    try {
      const payload = { message, history: messages.slice(-8) };
      if (context.analysisId) payload.analysisId = context.analysisId;
      const response = await api.post('/assistant/chat', payload);
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
    <div className="page assistant-page student-experience student-assistant-page">
      <NavBar />
      <motion.div className="assistant-shell" initial={false} animate={{ opacity: 1, y: 0 }}>
        <header className="assistant-header student-assistant-header">
          <div>
            <p className="section-kicker">{isAdminAssistant ? 'AI PLACEMENT OPERATIONS' : 'AI CAREER PREPARATION'}</p>
            <h1>{isAdminAssistant ? 'Workspace assistant' : 'AI Assistant'}</h1>
            <p className="assistant-lede muted">{isAdminAssistant
              ? 'Ask about open roles, application volume, candidate progress, and the evidence available to your placement team.'
              : 'Ask better questions about your next move, grounded in your latest role analysis, evidence, gaps, and study plan.'}</p>
          </div>
          {context && (isAdminAssistant
            ? <div className="assistant-context-chip"><span>PLACEMENT WORKSPACE</span><strong>{context.stats.openJobs} open roles</strong><small>{context.stats.totalApplications} applications · {context.stats.totalCandidates} candidates</small></div>
            : <div className="assistant-context-chip"><span>YOUR CURRENT FOCUS</span><strong>{context.targetRole}</strong><small>{context.roleReadinessScore ?? '—'} readiness</small>{context.roleReadinessScore != null && <div className="student-readiness-track" role="img" aria-label={`Role readiness ${context.roleReadinessScore} out of 100`}><span style={{ width: `${Math.max(0, Math.min(100, Number(context.roleReadinessScore) || 0))}%` }} /></div>}</div>)}
        </header>

        {loading && <div className="card center" role="status"><div className="spinner" /><p className="muted">Loading {isAdminAssistant ? 'the placement workspace' : 'your analysis context'}…</p></div>}

        {!loading && !context && error && (
          <section className="card assistant-empty-state">
            <span className="assistant-icon"><Icon name="alert" size={28} /></span>
            <h2>Workspace context unavailable</h2>
            <p className="muted">We could not load the data needed for this assistant. Retry when the API is available.</p>
            <button className="primary inline" onClick={() => window.location.reload()}>Retry context</button>
          </section>
        )}

        {!loading && context && !isAdminAssistant && !hasAnalysis && (
          <section className="card assistant-empty-state">
            <span className="assistant-icon"><Icon name="chart" size={28} /></span>
            <h2>Complete an analysis first</h2>
            <p className="muted">The assistant needs a saved target role, scores, and verified skill gaps before it can give grounded advice.</p>
            <Link className="primary inline" to="/analyze">Start a new analysis <Icon name="arrow" size={16} /></Link>
          </section>
        )}

        {!loading && canChat && (
          <section className="assistant-workspace">
            <div className="card assistant-thread">
              <div className="assistant-thread-heading"><div><span className="signal-dot" /> Grounded conversation</div><button className="link" onClick={clearConversation} disabled={!messages.length}>Clear conversation</button></div>
              <div className="student-assistant-log" role="log" aria-live="polite" aria-relevant="additions text">
                {!messages.length && <div className="assistant-welcome"><span className="assistant-icon"><Icon name={isAdminAssistant ? 'users' : 'chart'} size={25} /></span><h2>{isAdminAssistant ? 'What do you need to know about the workspace?' : 'What would you like to work on?'}</h2><p className="muted">{isAdminAssistant ? 'Ask for role totals, pipeline counts, candidate summaries, or the latest application activity.' : 'Ask about your score, gaps, learning order, or a project that would create stronger evidence.'}</p></div>}
                {messages.map((message, index) => <div className={`assistant-message assistant-message-${message.role}`} key={`${message.role}-${index}`}><span>{message.role === 'user' ? 'You' : 'Vortex AI'}</span>{message.role === 'assistant' ? <AssistantAnswer content={message.content} /> : <p className="assistant-user-copy">{message.content}</p>}</div>)}
                {sending && <div className="assistant-message assistant-message-assistant"><span>Vortex AI</span><p className="muted">Thinking from your {isAdminAssistant ? 'workspace data' : 'analysis'}…</p></div>}
              </div>
              {error && <div className="card-error assistant-error" role="alert"><p className="error">{error}</p><button className="link" onClick={() => latestQuestion && sendMessage(latestQuestion)}>Retry</button></div>}
              <div className="assistant-composer"><textarea aria-label="Message the AI assistant" rows="2" value={input} placeholder={isAdminAssistant ? 'Ask about roles, applications, or candidates…' : 'Ask about your readiness or next step…'} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); sendMessage(); } }} /><button className="primary" onClick={() => sendMessage()} disabled={!input.trim() || sending}>Send <Icon name="arrow" size={16} /></button></div>
            </div>
            <aside className="card assistant-suggestions">
              {isAdminAssistant && <>
                <div className="assistant-admin-stats" aria-label="Admin workspace totals">
                  <div><span>Open roles</span><strong>{context.stats.openJobs}</strong></div>
                  <div><span>Applications</span><strong>{context.stats.totalApplications}</strong></div>
                  <div><span>Candidates</span><strong>{context.stats.totalCandidates}</strong></div>
                </div>
                <div className="assistant-admin-roles">
                  <div className="section-heading"><div><p className="section-kicker">ROLE ACTIVITY</p><h2>Open roles</h2></div></div>
                  {context.openRoles.slice(0, 5).map((role) => <div className="assistant-admin-role" key={role.jobId}><span><strong>{role.title}</strong><small>{role.city} · {role.skills.slice(0, 3).join(' · ')}</small></span><b>{role.applicationCount}</b></div>)}
                  {!context.openRoles.length && <p className="muted small">No open roles have been added yet.</p>}
                </div>
                <div className="assistant-admin-candidates">
                  <div className="section-heading"><div><p className="section-kicker">RECENT ACTIVITY</p><h2>Latest candidates</h2></div></div>
                  {context.candidates.slice(0, 4).map((candidate) => <div className="assistant-admin-candidate" key={candidate.applicationId}><span><strong>{candidate.applicant.name}</strong><small>{candidate.role}</small></span><b>{candidate.statusLabel}</b></div>)}
                  {!context.candidates.length && <p className="muted small">No applications have been received yet.</p>}
                </div>
              </>}
              <div className="section-heading"><div><p className="section-kicker">{isAdminAssistant ? 'ASK VORTEX' : 'START HERE'}</p><h2>Useful prompts</h2></div></div>
              {suggestions.map((suggestion) => <button className="assistant-suggestion" key={suggestion} onClick={() => sendMessage(suggestion)} disabled={sending}>{suggestion}<Icon name="arrow" size={15} /></button>)}
            </aside>
          </section>
        )}
      </motion.div>
    </div>
  );
}

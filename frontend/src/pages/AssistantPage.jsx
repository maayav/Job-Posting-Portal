import NavBar from '../components/NavBar';

export default function AssistantPage() {
  return (
    <div className="page">
      <NavBar />
      <div className="card center">
        <h2>AI Assistant</h2>
        <p className="muted">A conversational assistant is not part of this build yet.</p>
        <p className="muted small">
          AI already runs automatically where it matters: resume and GitHub skill extraction with evidence,
          plus the deterministic readiness scoring and study plan. This page is reserved for the assistant
          experience once it is built.
        </p>
      </div>
    </div>
  );
}
export default function ScoreCard({ score, targetRole, generatedAt }) {
  const color = score >= 80 ? 'good' : score >= 60 ? 'mid' : 'low';
  return (
    <div className="card score-card">
      <div>
        <h2>Role-Readiness Score</h2>
        <p className="muted">{targetRole}</p>
        <p className="muted small">{generatedAt ? `generated ${new Date(generatedAt).toLocaleString()}` : ''}</p>
      </div>
      <div className={`score-ring ${color}`}>
        <span>{score}</span>
        <small>/100</small>
      </div>
    </div>
  );
}
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

export default function ProgressChart({ history }) {
  if (!history?.length) return null;
  if (history.length < 2) {
    return (
      <div className="card">
        <h2>Progress</h2>
        <p className="muted">
          Upload an updated resume and re-analyze to start tracking your score trend.
        </p>
      </div>
    );
  }

  const data = history.map((h) => ({
    label: new Date(h.completed_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
    score: h.score,
    role: h.target_role,
  }));

  return (
    <div className="card">
      <h2>Score trend</h2>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: -20 }}>
          <CartesianGrid stroke="#2a3052" strokeDasharray="3 3" />
          <XAxis dataKey="label" stroke="#9aa3c0" fontSize={12} />
          <YAxis domain={[0, 100]} stroke="#9aa3c0" fontSize={12} />
          <Tooltip
            contentStyle={{ background: '#171b2e', border: '1px solid #2a3052', borderRadius: 8 }}
            labelStyle={{ color: '#e7eaf6' }}
            formatter={(value, _name, props) => [`${value}% (${props.payload.role})`, 'Score']}
          />
          <Line type="monotone" dataKey="score" stroke="#7c6cff" strokeWidth={2.5} dot={{ r: 4 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
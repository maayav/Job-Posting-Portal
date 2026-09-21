import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

export default function ProgressChart({ history, title = 'Readiness trend' }) {
  const points = (Array.isArray(history) ? history : []).filter((entry) => entry?.score != null);

  const data = points.map((entry) => ({
    label: new Date(entry.completed_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
    score: entry.score,
    role: entry.target_role,
  }));

  return (
    <div className="card progress-card">
      <h2>{title}</h2>
      {data.length < 2 ? (
        <p className="muted">
          Analyze another version of your resume to see how your readiness score changes over time.
        </p>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: -20 }}>
            <CartesianGrid stroke="#444442" strokeDasharray="3 3" />
            <XAxis dataKey="label" stroke="#999995" fontSize={12} />
            <YAxis domain={[0, 100]} stroke="#999995" fontSize={12} />
            <Tooltip
              contentStyle={{ background: '#252523', border: '1px solid #444442', borderRadius: 8 }}
              labelStyle={{ color: '#eeeeea' }}
              formatter={(value, _name, props) => [`${value}% (${props.payload.role})`, 'Score']}
            />
            <Line type="monotone" dataKey="score" stroke="#d0d0ca" strokeWidth={2.5} dot={{ r: 4 }} />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
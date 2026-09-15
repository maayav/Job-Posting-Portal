function Area({ title, items, tone, percentField = 'percent' }) {
  if (!items?.length) return null;
  return (
    <div className="area-block">
      <h3 className={tone}>{title} <span className="count">{items.length}</span></h3>
      <div className="area-chips">
        {items.map((it, i) => (
          <div className={`chip ${tone}`} key={`${it.skill}-${i}`}>
            <span>{it.skill}</span>
            <strong>{it[percentField]}%</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function GapList({ report }) {
  return (
    <div className="card breakdown-card">
      <div className="section-heading">
        <div>
          <p className="section-kicker">02 / PROFILE MAP</p>
          <h2>Skill breakdown</h2>
        </div>
        <span className="section-note">{report.gaps?.length ?? 0} gaps identified</span>
      </div>
      <Area title="Strong" tone="good" items={report.strong_areas} />
      <Area title="Developing" tone="mid" items={report.developing_areas} />
      <Area title="Gaps" tone="low" items={report.gaps} percentField="percent" />
    </div>
  );
}

export function KpiCard({ label, value, sub, color = 'blue' }) {
  return (
    <div className={`kpi ${color}`}>
      <div className="kpi-accent" />
      <div className="kpi-glow" />
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{value}</div>
      {sub && <div className="kpi-sub">{sub}</div>}
    </div>
  )
}

export function Card({ title, children, titleRight, style }) {
  return (
    <div className="card" style={style}>
      {title && (
        <div className="card-title">
          <span>{title}</span>
          {titleRight && <span className="card-title-accent">{titleRight}</span>}
        </div>
      )}
      {children}
    </div>
  )
}

export function Tag({ children, color = 'blue' }) {
  return <span className={`tag tag-${color}`}>{children}</span>
}

export function StatusTag({ value }) {
  if (!value) return <Tag color="blue">—</Tag>
  const v = value.trim().toLowerCase()
  if (v === 'delay')   return <Tag color="red">Delay</Tag>
  if (v === 'on time') return <Tag color="green">On Time</Tag>
  return <Tag color="blue">{value}</Tag>
}

export function RateTag({ rate }) {
  const n = parseFloat(rate)
  if (isNaN(n))  return <Tag color="blue">—</Tag>
  if (n > 30)    return <Tag color="red">{n}%</Tag>
  if (n > 10)    return <Tag color="amber">{n}%</Tag>
  return              <Tag color="green">{n}%</Tag>
}

export function ProgressBar({ name, value, max, color }) {
  const pct = max > 0 ? (value / max * 100) : 0
  const col = color ?? (pct > 40 ? 'var(--red)' : pct > 20 ? 'var(--amber)' : 'var(--green)')
  return (
    <div>
      <div className="progress-meta">
        <span className="progress-name">{name}</span>
        <span className="progress-val" style={{ color: col }}>{value.toLocaleString()} ({pct.toFixed(1)}%)</span>
      </div>
      <div className="progress-track">
        <div className="progress-fill" style={{ width: `${pct}%`, background: col }} />
      </div>
    </div>
  )
}

export function NoteBox({ children }) {
  return <div className="note-box">⚠ <span>{children}</span></div>
}
export function InfoBox({ children }) {
  return <div className="info-box">ℹ <span>{children}</span></div>
}

export function EmptyState({ icon = '📭', title = 'No data yet', sub = 'Upload a CSV to get started.' }) {
  return (
    <div className="empty-state">
      <div className="empty-icon">{icon}</div>
      <div className="empty-title">{title}</div>
      <div className="empty-sub">{sub}</div>
    </div>
  )
}

export function Spinner() {
  return <div className="spinner" />
}

export function FilterRow({ label, options, active, onChange }) {
  return (
    <div className="filter-row">
      {label && <span className="filter-label">{label}:</span>}
      {options.map(o => (
        <button
          key={o.value}
          className={`fbtn ${active === o.value ? 'active' : ''}`}
          onClick={() => onChange(o.value)}
        >{o.label}</button>
      ))}
    </div>
  )
}

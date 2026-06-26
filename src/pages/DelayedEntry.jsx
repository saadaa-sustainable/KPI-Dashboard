import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useChart, pc } from '../hooks/useChart'
import { KpiCard, Card, NoteBox, FilterRow, Tag, Spinner, EmptyState } from '../components/UI'

const SHORT_PO = s => (s || '')
  .replace('E-FOB (Paid for fabric in start of PO)', 'E-FOB')
  .replace('PRODUCTION ORDER (FOB)', 'FOB')
  .replace('JOB ORDER (CMTP Charge)', 'CMTP')
  .replace('Fabrication (PO - PO settlement of fabric Invoice)', 'Fab Settle')

const SHORT_ASSOC = s => (s || '')
  .replace(' Partner', '')
  .replace('Fabric (Greige / Dyed) Supply', 'Fabric Supply')

export default function DelayedEntry() {
  const [tat,      setTat]      = useState([])
  const [months,   setMonths]   = useState([])
  const [month,    setMonth]    = useState('all')
  const [loading,  setLoading]  = useState(true)

  const refPerson  = useRef(null)
  const refMonthly = useRef(null)
  const refPOType  = useRef(null)
  const refAssoc   = useRef(null)

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    const { data } = await supabase
      .from('ap_invoice_tat')
      .select('*')
      .order('submitted_at')
    const rows = data ?? []
    const ms = [...new Set(rows.map(r => r.month_label).filter(Boolean))]
      .sort((a, b) => new Date('01 ' + a) - new Date('01 ' + b))
    setTat(rows)
    setMonths(ms)
    setLoading(false)
  }

  const filtered = month === 'all' ? tat : tat.filter(r => r.month_label === month)

  // By person
  const byPerson = {}
  filtered.forEach(r => {
    if (!r.added_by) return
    if (!byPerson[r.added_by]) byPerson[r.added_by] = { total: 0, delay: 0, ontime: 0, tatVals: [] }
    byPerson[r.added_by].total++
    if (r.remark === 'Delay') { byPerson[r.added_by].delay++; if (r.tat) byPerson[r.added_by].tatVals.push(r.tat) }
    else byPerson[r.added_by].ontime++
  })
  const pNames = Object.keys(byPerson).sort((a, b) => byPerson[b].total - byPerson[a].total)

  // Monthly
  const byMonth = {}
  tat.forEach(r => {
    if (!r.month_label) return
    if (!byMonth[r.month_label]) byMonth[r.month_label] = { total: 0, delay: 0 }
    byMonth[r.month_label].total++
    if (r.remark === 'Delay') byMonth[r.month_label].delay++
  })
  const mKeys = Object.keys(byMonth).sort((a, b) => new Date('01 ' + a) - new Date('01 ' + b))

  // By PO type
  const byPO = {}
  filtered.forEach(r => {
    const k = SHORT_PO(r.po_type) || 'Unknown'
    if (!byPO[k]) byPO[k] = { ontime: 0, delay: 0 }
    r.remark === 'Delay' ? byPO[k].delay++ : byPO[k].ontime++
  })

  // By association
  const byAssoc = {}
  filtered.forEach(r => {
    const k = SHORT_ASSOC(r.association) || 'Unknown'
    if (!byAssoc[k]) byAssoc[k] = { ontime: 0, delay: 0 }
    r.remark === 'Delay' ? byAssoc[k].delay++ : byAssoc[k].ontime++
  })

  const totalDelayed = filtered.filter(r => r.remark === 'Delay').length
  const totalOntime  = filtered.filter(r => r.remark === 'On Time').length
  const totalInv     = filtered.length
  const topDelayer   = pNames.sort((a, b) => byPerson[b].delay / byPerson[b].total - byPerson[a].delay / byPerson[a].total)[0]
  const bestPerson   = [...pNames].filter(n => byPerson[n].total >= 5).sort((a, b) => byPerson[a].delay / byPerson[a].total - byPerson[b].delay / byPerson[b].total)[0]

  // Charts
  useChart(refPerson, pNames.length > 0 ? {
    type: 'bar', labels: pNames,
    datasets: [
      { label: 'On Time', data: pNames.map(n => byPerson[n].ontime), backgroundColor: 'rgba(61,214,140,0.2)', borderColor: '#3dd68c', borderWidth: 1, borderRadius: 4 },
      { label: 'Delayed', data: pNames.map(n => byPerson[n].delay),  backgroundColor: 'rgba(242,92,92,0.25)', borderColor: '#f25c5c', borderWidth: 1, borderRadius: 4 },
    ],
    options: { legend: true },
  } : null, [filtered.length, month])

  useChart(refMonthly, mKeys.length > 0 ? {
    type: 'line', labels: mKeys,
    datasets: [{
      label: 'Delay %',
      data: mKeys.map(m => (byMonth[m].delay / byMonth[m].total * 100).toFixed(1)),
      borderColor: '#f25c5c', backgroundColor: 'rgba(242,92,92,0.08)', fill: true, tension: 0.4,
      pointBackgroundColor: mKeys.map(m => byMonth[m].delay / byMonth[m].total > 0.1 ? '#f25c5c' : '#3dd68c'), pointRadius: 5,
    }],
    options: { pct: true, legend: true },
  } : null, [tat.length])

  useChart(refPOType, Object.keys(byPO).length > 0 ? {
    type: 'bar', labels: Object.keys(byPO),
    datasets: [
      { label: 'On Time', data: Object.values(byPO).map(v => v.ontime), backgroundColor: 'rgba(61,214,140,0.2)', borderColor: '#3dd68c', borderWidth: 1, borderRadius: 4 },
      { label: 'Delayed', data: Object.values(byPO).map(v => v.delay),  backgroundColor: 'rgba(242,92,92,0.25)', borderColor: '#f25c5c', borderWidth: 1, borderRadius: 4 },
    ],
    options: { legend: true },
  } : null, [filtered.length, month])

  useChart(refAssoc, Object.keys(byAssoc).length > 0 ? {
    type: 'bar', labels: Object.keys(byAssoc),
    datasets: [
      { label: 'On Time', data: Object.values(byAssoc).map(v => v.ontime), backgroundColor: 'rgba(61,214,140,0.2)', borderColor: '#3dd68c', borderWidth: 1, borderRadius: 4 },
      { label: 'Delayed', data: Object.values(byAssoc).map(v => v.delay),  backgroundColor: 'rgba(242,92,92,0.25)', borderColor: '#f25c5c', borderWidth: 1, borderRadius: 4 },
    ],
    options: { legend: true },
  } : null, [filtered.length, month])

  if (loading) return <div style={{ padding: 40, textAlign: 'center' }}><Spinner /></div>
  if (tat.length === 0) return <EmptyState icon="⏱" title="No TAT data" sub="Upload the AP Invoice TAT Working CSV to see delay analysis." />

  const monthOptions = [{ value: 'all', label: 'All Months' }, ...months.map(m => ({ value: m, label: m }))]

  return (
    <>
      <div className="page-title">Delayed Entry</div>
      <div className="page-sub">Invoice entry TAT analysis — on-time vs delayed by person, month, PO type</div>

      <NoteBox>TAT data is available from the date the Google Form tracking started. Only Invoice rows carry delay flags; Debit/Credit Notes are all on-time.</NoteBox>

      <div className="kpi-row">
        <KpiCard label="Highest Delay Rate" value={topDelayer ? `${(byPerson[topDelayer].delay / byPerson[topDelayer].total * 100).toFixed(1)}%` : '—'} sub={topDelayer ? `${topDelayer} (${byPerson[topDelayer].delay}/${byPerson[topDelayer].total})` : ''} color="red" />
        <KpiCard label="Best Performer" value={bestPerson ? `${(byPerson[bestPerson].delay / byPerson[bestPerson].total * 100).toFixed(1)}%` : '—'} sub={bestPerson ? `${bestPerson} delay rate` : ''} color="green" />
        <KpiCard label="Total Delayed" value={totalDelayed} sub={`${totalInv > 0 ? (totalDelayed / totalInv * 100).toFixed(1) : 0}% of invoices`} color="amber" />
        <KpiCard label="Total On Time" value={totalOntime} sub={`${totalInv > 0 ? (totalOntime / totalInv * 100).toFixed(1) : 0}% on-time rate`} color="blue" />
      </div>

      <FilterRow label="Month" options={monthOptions} active={month} onChange={setMonth} />

      <div className="grid-65 mb">
        <Card title="On-Time vs Delayed by Person">
          <div className="chart-wrap" style={{ height: 230 }}><canvas ref={refPerson} /></div>
        </Card>
        <Card title="Monthly Delay Rate (All Time)">
          <div className="chart-wrap" style={{ height: 230 }}><canvas ref={refMonthly} /></div>
        </Card>
      </div>

      <div className="grid-2 mb">
        <Card title="Delay by PO Type">
          <div className="chart-wrap" style={{ height: 190 }}><canvas ref={refPOType} /></div>
        </Card>
        <Card title="Delay by Vendor Association">
          <div className="chart-wrap" style={{ height: 190 }}><canvas ref={refAssoc} /></div>
        </Card>
      </div>

      <Card title="Person Summary">
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Person</th><th>Total</th><th>On Time</th><th>Delayed</th><th>Delay Rate</th><th>Avg TAT (delayed days)</th><th>Status</th></tr>
            </thead>
            <tbody>
              {pNames.map(n => {
                const d = byPerson[n]
                const rate = (d.delay / d.total * 100).toFixed(1)
                const avgTat = d.tatVals.length > 0 ? (d.tatVals.reduce((a, b) => a + b, 0) / d.tatVals.length).toFixed(1) + ' days' : '—'
                const badge = rate > 30 ? 'red' : rate > 10 ? 'amber' : 'green'
                const label = rate > 30 ? 'Critical' : rate > 10 ? 'Review' : 'Good'
                return (
                  <tr key={n}>
                    <td><strong>{n}</strong></td>
                    <td className="mono">{d.total}</td>
                    <td className="mono" style={{ color: 'var(--green)' }}>{d.ontime}</td>
                    <td className="mono" style={{ color: 'var(--red)' }}>{d.delay}</td>
                    <td className="mono">{rate}%</td>
                    <td className="mono">{avgTat}</td>
                    <td><Tag color={badge}>{label}</Tag></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  )
}

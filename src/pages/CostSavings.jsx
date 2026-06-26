import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useChart } from '../hooks/useChart'
import { KpiCard, Card, NoteBox, FilterRow, Tag, Spinner, EmptyState } from '../components/UI'

const fmt = n => n != null ? `₹${Number(n).toLocaleString('en-IN', { maximumFractionDigits: 0 })}` : '—'
const pct  = n => n != null ? `${Number(n).toFixed(2)}%` : '—'

export default function CostSavings() {
  const [rows,    setRows]    = useState([])
  const [cat,     setCat]     = useState('all')
  const [loading, setLoading] = useState(true)

  const refBar   = useRef(null)
  const refTrend = useRef(null)

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    const { data } = await supabase
      .from('ap_cost_saved')
      .select('*')
      .order('month_date')
    setRows(data ?? [])
    setLoading(false)
  }

  const filtered = cat === 'all' ? rows : rows.filter(r => r.category === cat)
  const months   = [...new Set(rows.map(r => r.month_label).filter(Boolean))]
    .sort((a, b) => new Date('01 ' + a) - new Date('01 ' + b))

  // Totals
  const totalInvoice = filtered.reduce((a, r) => a + (r.invoice_amt || 0), 0)
  const totalSaving  = filtered.reduce((a, r) => a + (r.saving_amt  || 0), 0)
  const totalCredit  = filtered.reduce((a, r) => a + (r.credit_note_amt || 0), 0)
  const overallPct   = totalInvoice > 0 ? (totalSaving / totalInvoice * 100).toFixed(2) : 0

  // By sub_category
  const bySub = {}
  filtered.forEach(r => {
    const k = r.sub_category || r.vendor || 'Other'
    if (!bySub[k]) bySub[k] = { invoice: 0, saving: 0 }
    bySub[k].invoice += r.invoice_amt || 0
    bySub[k].saving  += r.saving_amt  || 0
  })
  const subKeys = Object.keys(bySub).sort((a, b) => bySub[b].saving - bySub[a].saving)

  // Monthly trend
  const byMonthCat = {}
  rows.forEach(r => {
    const k = r.month_label
    if (!k) return
    if (!byMonthCat[k]) byMonthCat[k] = { AP: { invoice: 0, saving: 0 }, AR: { invoice: 0, saving: 0 } }
    const c = r.category || 'AP'
    byMonthCat[k][c].invoice += r.invoice_amt || 0
    byMonthCat[k][c].saving  += r.saving_amt  || 0
  })

  // Charts
  useChart(refBar, subKeys.length > 0 ? {
    type: 'bar', labels: subKeys,
    datasets: [
      { label: 'Invoice Amt', data: subKeys.map(k => bySub[k].invoice), backgroundColor: 'rgba(79,142,247,0.25)', borderColor: '#4f8ef7', borderWidth: 1, borderRadius: 4 },
      { label: 'Saving Amt',  data: subKeys.map(k => bySub[k].saving),  backgroundColor: 'rgba(61,214,140,0.25)', borderColor: '#3dd68c', borderWidth: 1, borderRadius: 4 },
    ],
    options: { legend: true },
  } : null, [filtered.length, cat])

  useChart(refTrend, months.length > 0 ? {
    type: 'line', labels: months,
    datasets: [
      {
        label: 'AP Saving %',
        data: months.map(m => {
          const d = byMonthCat[m]?.AP
          return d && d.invoice > 0 ? (d.saving / d.invoice * 100).toFixed(2) : 0
        }),
        borderColor: '#4f8ef7', backgroundColor: 'rgba(79,142,247,0.08)', fill: true, tension: 0.4, pointRadius: 4,
      },
      {
        label: 'AR Saving %',
        data: months.map(m => {
          const d = byMonthCat[m]?.AR
          return d && d.invoice > 0 ? (d.saving / d.invoice * 100).toFixed(2) : 0
        }),
        borderColor: '#3dd68c', backgroundColor: 'rgba(61,214,140,0.08)', fill: true, tension: 0.4, pointRadius: 4,
      },
    ],
    options: { legend: true, pct: true },
  } : null, [rows.length])

  if (loading) return <div style={{ padding: 40, textAlign: 'center' }}><Spinner /></div>
  if (rows.length === 0) return <EmptyState icon="₹" title="No cost savings data" sub="Upload the Cost Saved Achieved CSV to see savings analysis." />

  const catOptions = [
    { value: 'all', label: 'All' },
    { value: 'AP',  label: 'AP (DN Savings)' },
    { value: 'AR',  label: 'AR (Logistics)' },
  ]

  return (
    <>
      <div className="page-title">Cost Savings</div>
      <div className="page-sub">AP debit note recoveries and AR logistics deductions</div>

      <div className="kpi-row">
        <KpiCard label="Total Invoice Value" value={fmt(totalInvoice)} sub="across selected period" color="blue" />
        <KpiCard label="Total Savings" value={fmt(totalSaving)} sub="via DN / credit notes" color="green" />
        <KpiCard label="Total Credit Notes" value={fmt(totalCredit)} sub="issued" color="purple" />
        <KpiCard label="Overall Saving %" value={`${overallPct}%`} sub="savings ÷ invoice value" color="amber" />
      </div>

      <FilterRow label="Category" options={catOptions} active={cat} onChange={setCat} />

      <div className="grid-65 mb">
        <Card title="Invoice vs Saving by Sub-Category">
          <div className="chart-wrap" style={{ height: 230 }}><canvas ref={refBar} /></div>
        </Card>
        <Card title="Monthly Saving % Trend">
          <div className="chart-wrap" style={{ height: 230 }}><canvas ref={refTrend} /></div>
        </Card>
      </div>

      <Card title="Savings Breakdown">
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Month</th><th>Category</th><th>Sub-Category / Vendor</th><th>Invoice Amt</th><th>Credit Note</th><th>Saving</th><th>Saving %</th></tr>
            </thead>
            <tbody>
              {filtered.map((r, i) => (
                <tr key={i}>
                  <td className="mono">{r.month_label}</td>
                  <td><Tag color={r.category === 'AP' ? 'blue' : 'purple'}>{r.category}</Tag></td>
                  <td>{r.sub_category || r.vendor || '—'}</td>
                  <td className="mono">{fmt(r.invoice_amt)}</td>
                  <td className="mono">{fmt(r.credit_note_amt)}</td>
                  <td className="mono" style={{ color: 'var(--green)' }}>{fmt(r.saving_amt)}</td>
                  <td><Tag color={r.saving_pct > 5 ? 'green' : 'amber'}>{pct(r.saving_pct)}</Tag></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  )
}

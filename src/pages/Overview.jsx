import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useChart, pc } from '../hooks/useChart'
import { KpiCard, Card, EmptyState, Spinner } from '../components/UI'

export default function Overview() {
  const [data, setData]     = useState(null)
  const [loading, setLoading] = useState(true)

  // Chart refs
  const refModPerson  = useRef(null)
  const refDelayDonut = useRef(null)
  const refModQtr     = useRef(null)
  const refDelayMonth = useRef(null)

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    const [modRes, tatRes] = await Promise.all([
      supabase.from('ap_voucher_modify').select('vch_no, modified_by, quarter, month_label').order('modified_at'),
      supabase.from('ap_invoice_tat').select('remark, added_by, month_label, quarter'),
    ])
    const modUnique = dedupeByVch(modRes.data ?? [])
    setData({ modUnique, tat: tatRes.data ?? [] })
    setLoading(false)
  }

  function dedupeByVch(rows) {
    const seen = new Set()
    return rows.filter(r => { if (seen.has(r.vch_no)) return false; seen.add(r.vch_no); return true })
  }

  // ── Charts ────────────────────────────────────────────────
  useChart(refModPerson, data && (() => {
    const byP = {}
    data.modUnique.forEach(r => { byP[r.modified_by] = (byP[r.modified_by] || 0) + 1 })
    const names = Object.keys(byP).sort((a, b) => byP[b] - byP[a])
    return {
      type: 'bar', labels: names,
      datasets: [{ data: names.map(n => byP[n]), backgroundColor: names.map(n => pc(n) + '55'), borderColor: names.map(n => pc(n)), borderWidth: 1, borderRadius: 4 }],
    }
  })(), [data])

  useChart(refDelayDonut, data && (() => {
    const ontime = data.tat.filter(r => r.remark === 'On Time').length
    const delay  = data.tat.filter(r => r.remark === 'Delay').length
    return {
      type: 'doughnut', labels: ['On Time', 'Delayed'],
      datasets: [{ data: [ontime, delay], backgroundColor: ['rgba(61,214,140,0.25)', 'rgba(242,92,92,0.25)'], borderColor: ['#3dd68c', '#f25c5c'], borderWidth: 2 }],
      options: { legend: true, extra: { cutout: '70%' } },
    }
  })(), [data])

  useChart(refModQtr, data && (() => {
    const byQ = {}
    data.modUnique.forEach(r => { byQ[r.quarter] = (byQ[r.quarter] || 0) + 1 })
    const qtrs = Object.keys(byQ).sort()
    return {
      type: 'bar', labels: qtrs.map(q => q.replace(/(\d{4})Q(\d)/, 'Q$2 $1')),
      datasets: [{ data: qtrs.map(q => byQ[q]), backgroundColor: 'rgba(79,142,247,0.25)', borderColor: '#4f8ef7', borderWidth: 1, borderRadius: 4 }],
    }
  })(), [data])

  useChart(refDelayMonth, data && (() => {
    const byM = {}
    data.tat.forEach(r => {
      if (!r.month_label) return
      if (!byM[r.month_label]) byM[r.month_label] = { total: 0, delay: 0 }
      byM[r.month_label].total++
      if (r.remark === 'Delay') byM[r.month_label].delay++
    })
    const months = Object.keys(byM).sort((a, b) => new Date('01 ' + a) - new Date('01 ' + b))
    return {
      type: 'line', labels: months,
      datasets: [{
        data: months.map(m => (byM[m].delay / byM[m].total * 100).toFixed(1)),
        borderColor: '#f25c5c', backgroundColor: 'rgba(242,92,92,0.08)', fill: true, tension: 0.4,
        pointBackgroundColor: months.map(m => byM[m].delay / byM[m].total > 0.1 ? '#f25c5c' : '#3dd68c'), pointRadius: 5,
      }],
      options: { pct: true },
    }
  })(), [data])

  if (loading) return <div style={{ padding: 40, textAlign: 'center' }}><Spinner /></div>
  if (!data || (data.modUnique.length === 0 && data.tat.length === 0)) {
    return <EmptyState icon="📊" title="No data loaded" sub="Upload CSVs via the Upload page to populate the dashboard." />
  }

  const totalMod   = data.modUnique.length
  const delayed    = data.tat.filter(r => r.remark === 'Delay').length
  const ontime     = data.tat.filter(r => r.remark === 'On Time').length
  const totalTat   = data.tat.length
  const delayRate  = totalTat > 0 ? (delayed / totalTat * 100).toFixed(1) : '—'

  return (
    <>
      <div className="page-title">Overview</div>
      <div className="page-sub">Accounts payable KPIs across all uploaded periods</div>

      <div className="kpi-row">
        <KpiCard label="Total Vouchers Modified" value={totalMod.toLocaleString()} sub="unique vouchers" color="blue" />
        <KpiCard label="Delay Rate" value={`${delayRate}%`} sub={`${delayed} of ${totalTat} invoices`} color="amber" />
        <KpiCard label="On-Time Entry" value={ontime.toLocaleString()} sub={`${totalTat > 0 ? (ontime / totalTat * 100).toFixed(1) : 0}% of invoices`} color="green" />
        <KpiCard label="Total Delayed" value={delayed} sub="invoices past SLA" color="red" />
      </div>

      <div className="grid-65 mb">
        <Card title="Modifications by Person">
          <div className="chart-wrap" style={{ height: 220 }}><canvas ref={refModPerson} /></div>
        </Card>
        <Card title="On-Time vs Delayed">
          <div className="chart-wrap" style={{ height: 220 }}><canvas ref={refDelayDonut} /></div>
        </Card>
      </div>

      <div className="grid-2">
        <Card title="Modifications by Quarter">
          <div className="chart-wrap" style={{ height: 190 }}><canvas ref={refModQtr} /></div>
        </Card>
        <Card title="Monthly Delay Rate">
          <div className="chart-wrap" style={{ height: 190 }}><canvas ref={refDelayMonth} /></div>
        </Card>
      </div>
    </>
  )
}

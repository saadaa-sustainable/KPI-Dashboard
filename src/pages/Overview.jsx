import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useChart, pc } from '../hooks/useChart'
import { useQtr } from '../components/AppShell'
import { KpiCard, Card, EmptyState, Spinner } from '../components/UI'

export default function Overview() {
  const { qtr } = useQtr()
  const [mod, setMod] = useState([])
  const [tat, setTat] = useState([])
  const [loading, setLoading] = useState(true)

  const refModPerson  = useRef(null)
  const refDonut      = useRef(null)
  const refModQtr     = useRef(null)
  const refDelayMonth = useRef(null)

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    const [m, t] = await Promise.all([
      supabase.from('ap_voucher_modify').select('vch_no, modified_by, quarter, month_label'),
      supabase.from('ap_invoice_tat').select('remark, added_by, month_label, quarter'),
    ])
    // Dedupe modify by vch_no
    const seen = new Set()
    const deduped = (m.data ?? []).filter(r => { if (seen.has(r.vch_no)) return false; seen.add(r.vch_no); return true })
    setMod(deduped)
    setTat(t.data ?? [])
    setLoading(false)
  }

  const filtMod = qtr === 'all' ? mod : mod.filter(r => r.quarter === qtr)
  const filtTat = qtr === 'all' ? tat : tat.filter(r => r.quarter === qtr)

  const delayed = filtTat.filter(r => r.remark === 'Delay').length
  const ontime  = filtTat.filter(r => r.remark === 'On Time').length

  // Charts
  useChart(refModPerson, filtMod.length > 0 ? (() => {
    const byP = {}
    filtMod.forEach(r => { byP[r.modified_by] = (byP[r.modified_by] || 0) + 1 })
    const names = Object.keys(byP).sort((a,b) => byP[b]-byP[a])
    return { type:'bar', labels:names, datasets:[{ data:names.map(n=>byP[n]), backgroundColor:names.map(n=>pc(n)+'44'), borderColor:names.map(n=>pc(n)), borderWidth:1, borderRadius:6 }] }
  })() : null, [filtMod.length, qtr])

  useChart(refDonut, filtTat.length > 0 ? (() => ({
    type:'doughnut', labels:['On Time','Delayed'],
    datasets:[{ data:[ontime,delayed], backgroundColor:['rgba(54,200,122,0.2)','rgba(240,84,94,0.2)'], borderColor:['#36c87a','#f0545e'], borderWidth:2, hoverOffset:4 }],
    options:{ legend:true, extra:{ cutout:'72%' } }
  }))() : null, [filtTat.length, qtr])

  useChart(refModQtr, mod.length > 0 ? (() => {
    const byQ = {}
    mod.forEach(r => { byQ[r.quarter]=(byQ[r.quarter]||0)+1 })
    const qtrs = Object.keys(byQ).sort()
    return { type:'bar', labels:qtrs.map(q=>q.replace(/(\d{4})Q(\d)/, (_, yr, qn) => `Q${qn} '${yr.slice(-2)}` )),
      datasets:[{ data:qtrs.map(q=>byQ[q]), backgroundColor:qtrs.map(q=>q===qtr?'rgba(91,141,238,0.5)':'rgba(91,141,238,0.2)'), borderColor:'#5b8dee', borderWidth:1, borderRadius:6 }] }
  })() : null, [mod.length, qtr])

  useChart(refDelayMonth, tat.length > 0 ? (() => {
    const byM = {}
    const filtered = qtr === 'all' ? tat : tat.filter(r => r.quarter === qtr)
    filtered.forEach(r => {
      if (!r.month_label) return
      if (!byM[r.month_label]) byM[r.month_label] = { total:0, delay:0 }
      byM[r.month_label].total++
      if (r.remark === 'Delay') byM[r.month_label].delay++
    })
    const months = Object.keys(byM).sort((a,b) => new Date('01 '+a)-new Date('01 '+b))
    return { type:'line', labels:months,
      datasets:[{ data:months.map(m=>(byM[m].delay/byM[m].total*100).toFixed(1)),
        borderColor:'#f0545e', backgroundColor:'rgba(240,84,94,0.06)', fill:true, tension:0.4,
        pointBackgroundColor:months.map(m=>byM[m].delay/byM[m].total>0.1?'#f0545e':'#36c87a'), pointRadius:5, pointBorderWidth:0 }],
      options:{ pct:true } }
  })() : null, [tat.length, qtr])

  if (loading) return <div style={{padding:60,textAlign:'center'}}><Spinner /></div>
  if (!mod.length && !tat.length) return <EmptyState icon="📊" title="No data loaded" sub="Upload CSVs via the Upload page to populate the dashboard." />

  const delayRate = filtTat.length > 0 ? (delayed/filtTat.length*100).toFixed(1) : '—'
  const qtrLabel = qtr === 'all' ? 'All Quarters' : qtr.replace(/(\d{4})Q(\d)/,'Q$2 $1')

  return (
    <>
      <div className="page-header">
        <div className="page-title">Overview</div>
        <div className="page-sub">Accounts payable KPIs · {qtrLabel}</div>
      </div>

      <div className="kpi-row mb">
        <KpiCard label="Vouchers Modified" value={filtMod.length.toLocaleString()} sub="unique vouchers" color="blue" />
        <KpiCard label="Delay Rate" value={`${delayRate}%`} sub={`${delayed} of ${filtTat.length} invoices`} color="amber" />
        <KpiCard label="On-Time Entry" value={ontime.toLocaleString()} sub={`${filtTat.length>0?(ontime/filtTat.length*100).toFixed(1):0}% of invoices`} color="green" />
        <KpiCard label="Total Delayed" value={delayed} sub="invoices past SLA" color="red" />
      </div>

      <div className="grid-65 mb">
        <Card title="Modifications by Person">
          <div className="chart-wrap" style={{height:220}}><canvas ref={refModPerson}/></div>
        </Card>
        <Card title="On-Time vs Delayed">
          <div className="chart-wrap" style={{height:220}}><canvas ref={refDonut}/></div>
        </Card>
      </div>

      <div className="grid-2">
        <Card title="Modifications by Quarter" titleRight={qtr !== 'all' ? qtr : ''}>
          <div className="chart-wrap" style={{height:190}}><canvas ref={refModQtr}/></div>
        </Card>
        <Card title="Monthly Delay Rate">
          <div className="chart-wrap" style={{height:190}}><canvas ref={refDelayMonth}/></div>
        </Card>
      </div>
    </>
  )
}

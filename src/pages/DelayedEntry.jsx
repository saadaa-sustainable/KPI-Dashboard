import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useChart } from '../hooks/useChart'
import { useQtr } from '../components/AppShell'
import { KpiCard, Card, NoteBox, Tag, Spinner, EmptyState } from '../components/UI'

const shortPO = s => (s||'').replace('E-FOB (Paid for fabric in start of PO)','E-FOB').replace('PRODUCTION ORDER (FOB)','FOB').replace('JOB ORDER (CMTP Charge)','CMTP').replace('Fabrication (PO - PO settlement of fabric Invoice)','Fab Settle')
const shortA  = s => (s||'').replace(' Partner','').replace('Fabric (Greige / Dyed) Supply','Fabric Supply')

export default function DelayedEntry() {
  const { qtr } = useQtr()
  const [tat, setTat] = useState([])
  const [loading, setLoading] = useState(true)

  const refPerson  = useRef(null)
  const refMonthly = useRef(null)
  const refPO      = useRef(null)
  const refAssoc   = useRef(null)

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    const { data } = await supabase.from('ap_invoice_tat').select('*').order('submitted_at')
    setTat(data ?? [])
    setLoading(false)
  }

  const filtered = qtr === 'all' ? tat : tat.filter(r => r.quarter === qtr)

  const byPerson = {}
  filtered.forEach(r => {
    if (!r.added_by) return
    if (!byPerson[r.added_by]) byPerson[r.added_by] = { total:0, delay:0, ontime:0, tatVals:[] }
    byPerson[r.added_by].total++
    if (r.remark==='Delay') { byPerson[r.added_by].delay++; if(r.tat) byPerson[r.added_by].tatVals.push(r.tat) }
    else byPerson[r.added_by].ontime++
  })
  const pNames = Object.keys(byPerson).sort((a,b)=>byPerson[b].total-byPerson[a].total)

  // Monthly (always use full tat but filtered by qtr)
  const byMonth = {}
  filtered.forEach(r => {
    if (!r.month_label) return
    if (!byMonth[r.month_label]) byMonth[r.month_label]={total:0,delay:0}
    byMonth[r.month_label].total++
    if (r.remark==='Delay') byMonth[r.month_label].delay++
  })
  const mKeys = Object.keys(byMonth).sort((a,b)=>new Date('01 '+a)-new Date('01 '+b))

  const byPO = {}
  filtered.forEach(r => { const k=shortPO(r.po_type)||'Unknown'; if(!byPO[k]) byPO[k]={on:0,d:0}; r.remark==='Delay'?byPO[k].d++:byPO[k].on++ })

  const byAssoc = {}
  filtered.forEach(r => { const k=shortA(r.association)||'Unknown'; if(!byAssoc[k]) byAssoc[k]={on:0,d:0}; r.remark==='Delay'?byAssoc[k].d++:byAssoc[k].on++ })

  const totalDelay  = filtered.filter(r=>r.remark==='Delay').length
  const totalOntime = filtered.filter(r=>r.remark==='On Time').length
  const topDelayer  = [...pNames].sort((a,b)=>(byPerson[b].delay/byPerson[b].total)-(byPerson[a].delay/byPerson[a].total))[0]
  const best        = [...pNames].filter(n=>byPerson[n].total>=5).sort((a,b)=>(byPerson[a].delay/byPerson[a].total)-(byPerson[b].delay/byPerson[b].total))[0]

  useChart(refPerson, pNames.length > 0 ? {
    type:'bar', labels:pNames,
    datasets:[
      { label:'On Time', data:pNames.map(n=>byPerson[n].ontime), backgroundColor:'rgba(54,200,122,0.2)', borderColor:'#36c87a', borderWidth:1, borderRadius:6 },
      { label:'Delayed', data:pNames.map(n=>byPerson[n].delay),  backgroundColor:'rgba(240,84,94,0.2)',  borderColor:'#f0545e', borderWidth:1, borderRadius:6 },
    ], options:{legend:true}
  } : null, [filtered.length, qtr])

  useChart(refMonthly, mKeys.length > 0 ? {
    type:'line', labels:mKeys,
    datasets:[{ label:'Delay %', data:mKeys.map(m=>(byMonth[m].delay/byMonth[m].total*100).toFixed(1)),
      borderColor:'#f0545e', backgroundColor:'rgba(240,84,94,0.06)', fill:true, tension:0.4,
      pointBackgroundColor:mKeys.map(m=>byMonth[m].delay/byMonth[m].total>0.1?'#f0545e':'#36c87a'), pointRadius:5, pointBorderWidth:0
    }], options:{pct:true, legend:true}
  } : null, [filtered.length, qtr])

  useChart(refPO, Object.keys(byPO).length > 0 ? {
    type:'bar', labels:Object.keys(byPO),
    datasets:[
      { label:'On Time', data:Object.values(byPO).map(v=>v.on), backgroundColor:'rgba(54,200,122,0.2)', borderColor:'#36c87a', borderWidth:1, borderRadius:6 },
      { label:'Delayed', data:Object.values(byPO).map(v=>v.d),  backgroundColor:'rgba(240,84,94,0.2)',  borderColor:'#f0545e', borderWidth:1, borderRadius:6 },
    ], options:{legend:true}
  } : null, [filtered.length, qtr])

  useChart(refAssoc, Object.keys(byAssoc).length > 0 ? {
    type:'bar', labels:Object.keys(byAssoc),
    datasets:[
      { label:'On Time', data:Object.values(byAssoc).map(v=>v.on), backgroundColor:'rgba(54,200,122,0.2)', borderColor:'#36c87a', borderWidth:1, borderRadius:6 },
      { label:'Delayed', data:Object.values(byAssoc).map(v=>v.d),  backgroundColor:'rgba(240,84,94,0.2)',  borderColor:'#f0545e', borderWidth:1, borderRadius:6 },
    ], options:{legend:true}
  } : null, [filtered.length, qtr])

  if (loading) return <div style={{padding:60,textAlign:'center'}}><Spinner /></div>
  if (!tat.length) return <EmptyState icon="⏱" title="No TAT data" sub="Upload the AP Invoice TAT Working CSV to see delay analysis." />

  const qtrLabel = qtr === 'all' ? 'All Quarters' : qtr.replace(/(\d{4})Q(\d)/,'Q$2 $1')

  return (
    <>
      <div className="page-header">
        <div className="page-title">Delayed Entry</div>
        <div className="page-sub">Invoice TAT analysis · {qtrLabel}</div>
      </div>

      <NoteBox>TAT data available from the date tracking started. Only Invoice rows carry delay flags.</NoteBox>

      <div className="kpi-row mb">
        <KpiCard label="Highest Delay Rate" value={topDelayer?`${(byPerson[topDelayer].delay/byPerson[topDelayer].total*100).toFixed(1)}%`:'—'} sub={topDelayer?`${topDelayer}`:'no data'} color="red" />
        <KpiCard label="Best Performer"  value={best?`${(byPerson[best].delay/byPerson[best].total*100).toFixed(1)}%`:'—'} sub={best||'no data'} color="green" />
        <KpiCard label="Total Delayed"   value={totalDelay}  sub={`${filtered.length>0?(totalDelay/filtered.length*100).toFixed(1):0}% of invoices`} color="amber" />
        <KpiCard label="Total On Time"   value={totalOntime} sub={`${filtered.length>0?(totalOntime/filtered.length*100).toFixed(1):0}%`} color="blue" />
      </div>

      <div className="grid-65 mb">
        <Card title="On-Time vs Delayed by Person">
          <div className="chart-wrap" style={{height:230}}><canvas ref={refPerson}/></div>
        </Card>
        <Card title="Monthly Delay Rate">
          <div className="chart-wrap" style={{height:230}}><canvas ref={refMonthly}/></div>
        </Card>
      </div>

      <div className="grid-2 mb">
        <Card title="Delay by PO Type">
          <div className="chart-wrap" style={{height:190}}><canvas ref={refPO}/></div>
        </Card>
        <Card title="Delay by Vendor Association">
          <div className="chart-wrap" style={{height:190}}><canvas ref={refAssoc}/></div>
        </Card>
      </div>

      <Card title="Person Summary">
        <div className="table-wrap">
          <table>
            <thead><tr><th>Person</th><th>Total</th><th>On Time</th><th>Delayed</th><th>Delay Rate</th><th>Avg TAT (delayed)</th><th>Status</th></tr></thead>
            <tbody>
              {pNames.map(n => {
                const d = byPerson[n]
                const rate = (d.delay/d.total*100).toFixed(1)
                const avg  = d.tatVals.length > 0 ? (d.tatVals.reduce((a,b)=>a+b,0)/d.tatVals.length).toFixed(1)+' days' : '—'
                return <tr key={n}>
                  <td><strong>{n}</strong></td>
                  <td className="mono">{d.total}</td>
                  <td className="mono" style={{color:'var(--green)'}}>{d.ontime}</td>
                  <td className="mono" style={{color:'var(--red)'}}>{d.delay}</td>
                  <td><Tag color={rate>30?'red':rate>10?'amber':'green'}>{rate}%</Tag></td>
                  <td className="mono">{avg}</td>
                  <td><Tag color={rate>30?'red':rate>10?'amber':'green'}>{rate>30?'Critical':rate>10?'Review':'Good'}</Tag></td>
                </tr>
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  )
}

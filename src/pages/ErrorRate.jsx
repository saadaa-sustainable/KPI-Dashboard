import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useChart, pc } from '../hooks/useChart'
import { useQtr } from '../components/AppShell'
import { Card, InfoBox, NoteBox, ProgressBar, Tag, Spinner, EmptyState } from '../components/UI'

export default function ErrorRate() {
  const { qtr } = useQtr()
  const [modData,  setModData]  = useState([])
  const [hasAdd,   setHasAdd]   = useState(false)
  const [loading,  setLoading]  = useState(true)
  const refBar    = useRef(null)
  const refSeries = useRef(null)

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    const [modRes, addRes] = await Promise.all([
      supabase.from('ap_voucher_modify').select('vch_no, modified_by, quarter, month_label, series, type'),
      supabase.from('ap_voucher_add').select('vch_no').limit(1),
    ])
    const seen = new Set()
    const deduped = (modRes.data??[]).filter(r => { if(seen.has(r.vch_no)) return false; seen.add(r.vch_no); return true })
    setModData(deduped)
    setHasAdd((addRes.data??[]).length > 0)
    setLoading(false)
  }

  const filtered = qtr === 'all' ? modData : modData.filter(r => r.quarter === qtr)
  const total    = filtered.length

  const byPerson = {}
  filtered.forEach(r => { byPerson[r.modified_by] = (byPerson[r.modified_by]||0)+1 })
  const pNames = Object.keys(byPerson).sort((a,b) => byPerson[b]-byPerson[a])

  const bySeries = {}
  filtered.forEach(r => { bySeries[r.series] = (bySeries[r.series]||0)+1 })
  const topSeries = Object.entries(bySeries).sort((a,b)=>b[1]-a[1]).slice(0,10)

  // Quarter × person table
  const quarters = [...new Set(modData.map(r=>r.quarter).filter(Boolean))].sort()
  const tableRows = []
  const displayQtrs = qtr === 'all' ? quarters : [qtr]
  displayQtrs.forEach(q => {
    const qRows  = modData.filter(r => r.quarter === q)
    const qTotal = qRows.length
    const byP = {}
    qRows.forEach(r => { byP[r.modified_by]=(byP[r.modified_by]||0)+1 })
    const byType = {}
    qRows.forEach(r => { byType[r.series]=(byType[r.series]||0)+1 })
    Object.entries(byP).forEach(([name,cnt]) => {
      const pTop = Object.entries(byType).sort((a,b)=>b[1]-a[1])[0]
      tableRows.push({ name, qtr:q, cnt, share: qTotal>0?(cnt/qTotal*100).toFixed(1):0, topSeries: pTop?.[0]||'—' })
    })
  })

  useChart(refBar, pNames.length > 0 ? {
    type:'bar', labels:pNames,
    datasets:[{ data:pNames.map(n=>byPerson[n]), backgroundColor:pNames.map(n=>pc(n)+'44'), borderColor:pNames.map(n=>pc(n)), borderWidth:1, borderRadius:6 }]
  } : null, [filtered.length, qtr])

  useChart(refSeries, topSeries.length > 0 ? {
    type:'bar', labels:topSeries.map(s=>s[0]),
    datasets:[{ data:topSeries.map(s=>s[1]), backgroundColor:'rgba(159,122,234,0.2)', borderColor:'#9f7aea', borderWidth:1, borderRadius:6 }]
  } : null, [filtered.length, qtr])

  if (loading) return <div style={{padding:60,textAlign:'center'}}><Spinner /></div>
  if (!modData.length) return <EmptyState icon="✎" title="No modification data" sub="Upload the Modify CSV to see error rate analysis." />

  const qtrLabel = qtr === 'all' ? 'All Quarters' : qtr.replace(/(\d{4})Q(\d)/,'Q$2 $1')

  return (
    <>
      <div className="page-header">
        <div className="page-title">Error Rate</div>
        <div className="page-sub">Voucher modification volume by person · {qtrLabel}</div>
      </div>

      {!hasAdd
        ? <NoteBox>Add CSV not uploaded yet — showing modification volume only. Upload Add CSV for true error rate (modifications ÷ vouchers created).</NoteBox>
        : <InfoBox>True error rate = vouchers modified ÷ vouchers created per person. Lower is better.</InfoBox>
      }

      <div className="kpi-row mb">
        {pNames.slice(0,4).map(n => {
          const pct = total > 0 ? (byPerson[n]/total*100).toFixed(1) : 0
          const color = pct > 40 ? 'red' : pct > 20 ? 'amber' : 'green'
          return <div key={n} className={`kpi ${color}`}>
            <div className="kpi-accent"/><div className="kpi-glow"/>
            <div className="kpi-label">{n}</div>
            <div className="kpi-value">{byPerson[n].toLocaleString()}</div>
            <div className="kpi-sub">{pct}% of modifications</div>
          </div>
        })}
      </div>

      <div className="grid-65 mb">
        <Card title={`Modification Volume · ${qtrLabel}`}>
          <div className="chart-wrap" style={{height:240}}><canvas ref={refBar}/></div>
        </Card>
        <Card title="Share of Total">
          <div className="progress-list">
            {pNames.map(n => <ProgressBar key={n} name={n} value={byPerson[n]} max={total} />)}
          </div>
        </Card>
      </div>

      <Card title={`Modification by Series · ${qtrLabel}`} style={{marginBottom:14}}>
        <div className="chart-wrap" style={{height:200}}><canvas ref={refSeries}/></div>
      </Card>

      <Card title="Person × Quarter Breakdown">
        <div className="table-wrap">
          <table>
            <thead><tr><th>Person</th><th>Quarter</th><th>Modifications</th><th>Share</th><th>Top Series</th></tr></thead>
            <tbody>
              {tableRows.map((r,i) => (
                <tr key={i}>
                  <td><strong>{r.name}</strong></td>
                  <td className="mono">{r.qtr.replace(/(\d{4})Q(\d)/,'Q$2 $1')}</td>
                  <td className="mono">{r.cnt.toLocaleString()}</td>
                  <td><Tag color={r.share>40?'red':r.share>20?'amber':'green'}>{r.share}%</Tag></td>
                  <td className="mono" style={{color:'var(--muted)'}}>{r.topSeries}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  )
}

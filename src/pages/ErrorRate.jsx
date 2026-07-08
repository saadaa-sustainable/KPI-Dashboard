import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useChart, pc } from '../hooks/useChart'
import { useQtr } from '../components/AppShell'
import { Card, InfoBox, NoteBox, ProgressBar, Tag, Spinner, EmptyState } from '../components/UI'

function uniqueBy(rows, keyFn) {
  const seen = new Set()
  return rows.filter(r => {
    const key = keyFn(r)
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function rateColor(rate) {
  if (rate > 30) return 'red'
  if (rate > 10) return 'amber'
  return 'green'
}

export default function ErrorRate() {
  const { qtr } = useQtr()
  const [addData, setAddData] = useState([])
  const [modData, setModData] = useState([])
  const [loading, setLoading] = useState(true)
  const refRate = useRef(null)
  const refSeries = useRef(null)

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    const [addRes, modRes] = await Promise.all([
      supabase.from('ap_voucher_add').select('vch_no, added_by, quarter, month_label, series, type'),
      supabase.from('ap_voucher_modify').select('vch_no, modified_by, quarter, month_label, series, type'),
    ])
    setAddData(uniqueBy(addRes.data ?? [], r => r.vch_no))
    setModData(uniqueBy(modRes.data ?? [], r => r.vch_no))
    setLoading(false)
  }

  const filteredAdd = qtr === 'all' ? addData : addData.filter(r => r.quarter === qtr)
  const filteredMod = qtr === 'all' ? modData : modData.filter(r => r.quarter === qtr)

  const modifiedVoucherSet = new Set(filteredMod.map(r => r.vch_no).filter(Boolean))
  const byPerson = {}
  filteredAdd.forEach(r => {
    const name = r.added_by || 'Unknown'
    if (!byPerson[name]) byPerson[name] = { added: 0, modified: 0 }
    byPerson[name].added++
    if (modifiedVoucherSet.has(r.vch_no)) byPerson[name].modified++
  })

  const names = Object.keys(byPerson).sort((a, b) => {
    const ar = byPerson[a].added ? byPerson[a].modified / byPerson[a].added : 0
    const br = byPerson[b].added ? byPerson[b].modified / byPerson[b].added : 0
    return br - ar
  })

  const bySeries = {}
  filteredMod.forEach(r => {
    const key = r.series || 'Unknown'
    bySeries[key] = (bySeries[key] || 0) + 1
  })
  const topSeries = Object.entries(bySeries).sort((a, b) => b[1] - a[1]).slice(0, 10)

  const quarters = [...new Set([...addData, ...modData].map(r => r.quarter).filter(Boolean))].sort()
  const displayQtrs = qtr === 'all' ? quarters : [qtr]
  const tableRows = []
  displayQtrs.forEach(q => {
    const qAdd = addData.filter(r => r.quarter === q)
    const qModSet = new Set(modData.filter(r => r.quarter === q).map(r => r.vch_no).filter(Boolean))
    const qByPerson = {}
    qAdd.forEach(r => {
      const name = r.added_by || 'Unknown'
      if (!qByPerson[name]) qByPerson[name] = { added: 0, modified: 0 }
      qByPerson[name].added++
      if (qModSet.has(r.vch_no)) qByPerson[name].modified++
    })
    Object.entries(qByPerson).forEach(([name, d]) => {
      const rate = d.added > 0 ? d.modified / d.added * 100 : 0
      tableRows.push({ name, qtr: q, ...d, rate: rate.toFixed(1) })
    })
  })

  useChart(refRate, names.length > 0 ? {
    type: 'bar',
    labels: names,
    datasets: [{
      label: 'Modification Rate %',
      data: names.map(n => (byPerson[n].modified / byPerson[n].added * 100).toFixed(1)),
      backgroundColor: names.map(n => pc(n) + '44'),
      borderColor: names.map(n => pc(n)),
      borderWidth: 1,
      borderRadius: 6,
    }],
    options: { pct: true, legend: true }
  } : null, [filteredAdd.length, filteredMod.length, qtr])

  useChart(refSeries, topSeries.length > 0 ? {
    type: 'bar',
    labels: topSeries.map(s => s[0]),
    datasets: [{ data: topSeries.map(s => s[1]), backgroundColor: 'rgba(159,122,234,0.2)', borderColor: '#9f7aea', borderWidth: 1, borderRadius: 6 }]
  } : null, [filteredMod.length, qtr])

  if (loading) return <div style={{ padding: 60, textAlign: 'center' }}><Spinner /></div>
  if (!addData.length && !modData.length) return <EmptyState icon="!" title="No voucher data" sub="Upload Add and Modify CSVs to see error rate analysis." />

  const totalAdded = filteredAdd.length
  const totalModified = modifiedVoucherSet.size
  const totalRate = totalAdded > 0 ? (totalModified / totalAdded * 100).toFixed(1) : '0.0'
  const qtrLabel = qtr === 'all' ? 'All Quarters' : qtr.replace(/(\d{4})Q(\d)/, 'Q$2 $1')

  return (
    <>
      <div className="page-header">
        <div className="page-title">Error Rate</div>
        <div className="page-sub">Modified vouchers divided by added vouchers - {qtrLabel}</div>
      </div>

      {!addData.length
        ? <NoteBox>Add CSV not uploaded yet - showing modification volume only.</NoteBox>
        : <InfoBox>Error rate = unique added vouchers that were later modified / unique vouchers added.</InfoBox>
      }

      <div className="kpi-row mb">
        <div className={`kpi ${rateColor(Number(totalRate))}`}>
          <div className="kpi-accent" /><div className="kpi-glow" />
          <div className="kpi-label">Overall Error Rate</div>
          <div className="kpi-value">{totalRate}%</div>
          <div className="kpi-sub">{totalModified.toLocaleString()} of {totalAdded.toLocaleString()} vouchers</div>
        </div>
        {names.slice(0, 3).map(n => {
          const rate = byPerson[n].added > 0 ? (byPerson[n].modified / byPerson[n].added * 100).toFixed(1) : '0.0'
          return <div key={n} className={`kpi ${rateColor(Number(rate))}`}>
            <div className="kpi-accent" /><div className="kpi-glow" />
            <div className="kpi-label">{n}</div>
            <div className="kpi-value">{rate}%</div>
            <div className="kpi-sub">{byPerson[n].modified} modified / {byPerson[n].added} added</div>
          </div>
        })}
      </div>

      <div className="grid-65 mb">
        <Card title={`Error Rate by Person - ${qtrLabel}`}>
          <div className="chart-wrap" style={{ height: 240 }}><canvas ref={refRate} /></div>
        </Card>
        <Card title="Voucher Adds by Person">
          <div className="progress-list">
            {names.map(n => <ProgressBar key={n} name={n} value={byPerson[n].added} max={totalAdded} />)}
          </div>
        </Card>
      </div>

      <Card title={`Modification by Series - ${qtrLabel}`} style={{ marginBottom: 14 }}>
        <div className="chart-wrap" style={{ height: 200 }}><canvas ref={refSeries} /></div>
      </Card>

      <Card title="Person x Quarter Breakdown">
        <div className="table-wrap">
          <table>
            <thead><tr><th>Person</th><th>Quarter</th><th>Added</th><th>Modified</th><th>Error Rate</th><th>Status</th></tr></thead>
            <tbody>
              {tableRows.map((r, i) => (
                <tr key={i}>
                  <td><strong>{r.name}</strong></td>
                  <td className="mono">{r.qtr.replace(/(\d{4})Q(\d)/, 'Q$2 $1')}</td>
                  <td className="mono">{r.added.toLocaleString()}</td>
                  <td className="mono">{r.modified.toLocaleString()}</td>
                  <td><Tag color={rateColor(Number(r.rate))}>{r.rate}%</Tag></td>
                  <td><Tag color={rateColor(Number(r.rate))}>{Number(r.rate) > 30 ? 'Critical' : Number(r.rate) > 10 ? 'Review' : 'Good'}</Tag></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  )
}

import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useChart, pc } from '../hooks/useChart'
import { Card, InfoBox, NoteBox, FilterRow, ProgressBar, Tag, Spinner, EmptyState } from '../components/UI'

export default function ErrorRate() {
  const [modData,  setModData]  = useState([])
  const [addData,  setAddData]  = useState([])
  const [hasAdd,   setHasAdd]   = useState(false)
  const [quarters, setQuarters] = useState([])
  const [qtr,      setQtr]      = useState('all')
  const [loading,  setLoading]  = useState(true)

  const refBar    = useRef(null)
  const refSeries = useRef(null)

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    const [modRes, addRes] = await Promise.all([
      supabase.from('ap_voucher_modify').select('vch_no, modified_by, quarter, month_label, series, type'),
      supabase.from('ap_voucher_add').select('vch_no, added_by, quarter').limit(1),
    ])
    const mod = modRes.data ?? []
    const modUnique = dedupeByVch(mod)
    const add = addRes.data ?? []
    const qtrs = [...new Set(modUnique.map(r => r.quarter).filter(Boolean))].sort()

    setModData(modUnique)
    setHasAdd(add.length > 0)
    setQuarters(qtrs)
    setLoading(false)
  }

  function dedupeByVch(rows) {
    const seen = new Set()
    return rows.filter(r => { if (seen.has(r.vch_no)) return false; seen.add(r.vch_no); return true })
  }

  const filtered = qtr === 'all' ? modData : modData.filter(r => r.qtr === qtr || r.quarter === qtr)

  // By person
  const byPerson = {}
  filtered.forEach(r => { byPerson[r.modified_by] = (byPerson[r.modified_by] || 0) + 1 })
  const total    = filtered.length
  const pNames   = Object.keys(byPerson).sort((a, b) => byPerson[b] - byPerson[a])

  // By series (always full data for context)
  const bySeries = {}
  modData.forEach(r => { bySeries[r.series] = (bySeries[r.series] || 0) + 1 })
  const topSeries = Object.entries(bySeries).sort((a, b) => b[1] - a[1]).slice(0, 10)

  // Table: person × quarter
  const tableRows = []
  quarters.forEach(q => {
    const qRows = modData.filter(r => r.quarter === q)
    const qTotal = qRows.length
    const byP = {}
    qRows.forEach(r => { byP[r.modified_by] = (byP[r.modified_by] || 0) + 1 })
    Object.entries(byP).forEach(([name, cnt]) => {
      const pRows   = qRows.filter(r => r.modified_by === name)
      const byType  = {}
      pRows.forEach(r => { byType[r.series] = (byType[r.series] || 0) + 1 })
      const topType = Object.entries(byType).sort((a, b) => b[1] - a[1])[0]
      tableRows.push({ name, qtr: q, cnt, share: qTotal > 0 ? (cnt / qTotal * 100).toFixed(1) : 0, topSeries: topType?.[0] ?? '—' })
    })
  })
  const tableFiltered = qtr === 'all' ? tableRows : tableRows.filter(r => r.qtr === qtr)

  // Charts
  useChart(refBar, pNames.length > 0 ? {
    type: 'bar', labels: pNames,
    datasets: [{ data: pNames.map(n => byPerson[n]), backgroundColor: pNames.map(n => pc(n) + '55'), borderColor: pNames.map(n => pc(n)), borderWidth: 1, borderRadius: 4 }],
  } : null, [filtered.length, qtr])

  useChart(refSeries, topSeries.length > 0 ? {
    type: 'bar', labels: topSeries.map(s => s[0]),
    datasets: [{ data: topSeries.map(s => s[1]), backgroundColor: 'rgba(167,139,250,0.25)', borderColor: '#a78bfa', borderWidth: 1, borderRadius: 4 }],
  } : null, [modData.length])

  if (loading) return <div style={{ padding: 40, textAlign: 'center' }}><Spinner /></div>
  if (modData.length === 0) return <EmptyState icon="✎" title="No modification data" sub="Upload the Modify CSV to see error rate analysis." />

  const qtrOptions = [{ value: 'all', label: 'All' }, ...quarters.map(q => ({ value: q, label: q.replace(/(\d{4})Q(\d)/, 'Q$2 $1') }))]

  return (
    <>
      <div className="page-title">Error Rate</div>
      <div className="page-sub">Voucher modification volume by person and quarter</div>

      {!hasAdd
        ? <NoteBox>Add CSV not uploaded yet. Error rate shown as share of total modifications. Upload the Add CSV for true error rate (modifications ÷ vouchers created).</NoteBox>
        : <InfoBox>True error rate = vouchers modified ÷ vouchers created per person. Lower is better.</InfoBox>
      }

      <FilterRow label="Quarter" options={qtrOptions} active={qtr} onChange={setQtr} />

      <div className="grid-65 mb">
        <Card title={`Modification Volume by Person ${qtr !== 'all' ? `(${qtr.replace(/(\d{4})Q(\d)/, 'Q$2 $1')})` : ''}`}>
          <div className="chart-wrap" style={{ height: 240 }}><canvas ref={refBar} /></div>
        </Card>
        <Card title="Share of Total Modifications">
          <div className="progress-list">
            {pNames.map(n => (
              <ProgressBar key={n} name={n} value={byPerson[n]} max={total} />
            ))}
          </div>
        </Card>
      </div>

      <Card title="Modification by Accounting Series (All Periods)" className="mb">
        <div className="chart-wrap" style={{ height: 200 }}><canvas ref={refSeries} /></div>
      </Card>

      <div className="mt">
        <Card title="Person × Quarter Breakdown">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Person</th>
                  <th>Quarter</th>
                  <th>Modifications</th>
                  <th>Share of Quarter</th>
                  <th>Top Series</th>
                </tr>
              </thead>
              <tbody>
                {tableFiltered.map((r, i) => (
                  <tr key={i}>
                    <td><strong>{r.name}</strong></td>
                    <td className="mono">{r.qtr.replace(/(\d{4})Q(\d)/, 'Q$2 $1')}</td>
                    <td className="mono">{r.cnt.toLocaleString()}</td>
                    <td>
                      <Tag color={r.share > 40 ? 'red' : r.share > 20 ? 'amber' : 'green'}>{r.share}%</Tag>
                    </td>
                    <td className="mono" style={{ color: 'var(--muted)' }}>{r.topSeries}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </>
  )
}

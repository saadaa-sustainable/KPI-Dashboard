import { useMemo, useRef } from 'react'
import { useChart, pc } from '../hooks/useChart'
import { useQtr } from '../components/AppShell'
import { Card, InfoBox, NoteBox, ProgressBar, Tag, Spinner, EmptyState, HelpButton } from '../components/UI'
import { buildVoucherSummary, quarterMatchesSelection, qtrText, rateColor, rowFiscalQuarter, rowMatchesSelection } from '../lib/insights'

const HELP = {
  title: 'Error Rate',
  terms: [
    { term: 'Add By', meaning: 'The person in the Name column of the Add CSV for the unique voucher.' },
    { term: 'Added', meaning: 'Count of unique voucher numbers created in Busy by that person.' },
    { term: 'Modified', meaning: 'Count of those added vouchers that later appear in the Modify CSV.' },
    { term: 'Error Rate', meaning: 'The percentage of added vouchers that needed modification.' },
    { term: 'Series', meaning: 'Busy voucher series, such as TRIMS, MAIN, MFG, or RM.' },
  ],
  formulas: [
    { name: 'Unique Vouchers', formula: 'UNIQUE(Add!F:F)' },
    { name: 'Add By Lookup', formula: 'XLOOKUP(Vch No, Add!F:F, Add!N:N)' },
    { name: 'Modify By Lookup', formula: 'XLOOKUP(Vch No, Modify!F:F, Modify!N:N)' },
    { name: 'Error Rate', formula: 'modified vouchers / added vouchers * 100' },
    { name: 'Overall Error Rate', formula: 'total modified unique vouchers / total added unique vouchers * 100' },
  ],
  notes: [
    'This matches the OG Entry Summary pivot: Count of Modify By divided by Count of Vch No, grouped by Add By.',
    'Voucher matching is done by normalized voucher number so numeric-looking values like 9.0 and 9 match.',
  ],
}

export default function ErrorRate() {
  const { selectedYears, selectedQuarters, filterLabel, data, dataLoading, dataError } = useQtr()
  const addData = data.add
  const modData = data.mod
  const refRate = useRef(null)
  const refSeries = useRef(null)

  const voucherSummary = useMemo(() => buildVoucherSummary(addData, modData), [addData, modData])
  const summaryRows = voucherSummary.rows.filter(r => rowMatchesSelection(r, selectedYears, selectedQuarters))
  const filteredMod = voucherSummary.modifyUnique.filter(r => rowMatchesSelection(r, selectedYears, selectedQuarters))

  const byPerson = {}
  summaryRows.forEach(r => {
    const name = r.added_by || 'Unknown'
    if (!byPerson[name]) byPerson[name] = { added: 0, modified: 0 }
    byPerson[name].added++
    if (r.is_modified) byPerson[name].modified++
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

  const quarters = [...new Set([...addData, ...modData].map(rowFiscalQuarter).filter(Boolean))].sort()
  const displayQtrs = quarters.filter(q => quarterMatchesSelection(q, selectedYears, selectedQuarters))
  const tableRows = []
  displayQtrs.forEach(q => {
    const qRows = voucherSummary.rows.filter(r => r.quarter === q)
    const qByPerson = {}
    qRows.forEach(r => {
      const name = r.added_by || 'Unknown'
      if (!qByPerson[name]) qByPerson[name] = { added: 0, modified: 0 }
      qByPerson[name].added++
      if (r.is_modified) qByPerson[name].modified++
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
  } : null, [summaryRows.length, filteredMod.length, filterLabel])

  useChart(refSeries, topSeries.length > 0 ? {
    type: 'bar',
    labels: topSeries.map(s => s[0]),
    datasets: [{ data: topSeries.map(s => s[1]), backgroundColor: 'rgba(159,122,234,0.2)', borderColor: '#9f7aea', borderWidth: 1, borderRadius: 6 }]
  } : null, [filteredMod.length, filterLabel])

  if (dataLoading) return <div style={{ padding: 60, textAlign: 'center' }}><Spinner /></div>
  if (dataError) return <EmptyState icon="!" title="Could not load voucher data" sub={dataError.message} />
  if (!addData.length && !modData.length) return <EmptyState icon="!" title="No voucher data" sub="Upload Add and Modify CSVs to see error rate analysis." />

  const totalAdded = summaryRows.length
  const totalModified = summaryRows.filter(r => r.is_modified).length
  const totalRate = totalAdded > 0 ? (totalModified / totalAdded * 100).toFixed(1) : '0.0'
  const qtrLabel = filterLabel

  return (
    <>
      <div className="page-header">
        <div className="page-title-row">
          <div className="page-title">Error Rate</div>
          <HelpButton {...HELP} />
        </div>
        <div className="page-sub">Modified vouchers divided by added vouchers - {qtrLabel}</div>
      </div>

      {!addData.length
        ? <NoteBox>Add CSV not uploaded yet - showing modification volume only.</NoteBox>
        : <InfoBox>Matches the OG Entry Summary pivot: Count of Modify By / Count of Vch No, grouped by Add By.</InfoBox>
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
            <thead><tr><th>Person</th><th>Quarter</th><th>Added</th><th>Modified</th><th>Error Rate</th></tr></thead>
            <tbody>
              {tableRows.map((r, i) => (
                <tr key={i}>
                  <td><strong>{r.name}</strong></td>
                  <td className="mono">{qtrText(r.qtr)}</td>
                  <td className="mono">{r.added.toLocaleString()}</td>
                  <td className="mono">{r.modified.toLocaleString()}</td>
                  <td><Tag color={rateColor(Number(r.rate))}>{r.rate}%</Tag></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  )
}

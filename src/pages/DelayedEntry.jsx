import { useMemo, useRef } from 'react'
import { useChart, pc } from '../hooks/useChart'
import { useQtr } from '../components/AppShell'
import { KpiCard, Card, Tag, Spinner, EmptyState, InfoBox, HelpButton } from '../components/UI'
import { buildInvoiceTatRows, monthSort, rateColor, rowMatchesSelection, TAT_DELAY_DAYS } from '../lib/insights'

const HELP = {
  title: 'Invoice TAT',
  terms: [
    { term: 'Timestamp', meaning: 'Invoice submission date from the Invoice Data CSV.' },
    { term: 'Add In Busy', meaning: 'Busy entry date found by matching Invoice Number to Vch No in the Add CSV.' },
    { term: 'If Modify', meaning: 'Modify date found by matching Invoice Number to Vch No in the Modify CSV.' },
    { term: 'TAT', meaning: 'Number of days between invoice submission and Busy entry.' },
    { term: 'Remark', meaning: 'On Time or Delay status based on the TAT threshold.' },
    { term: 'Unmatched Invoices', meaning: 'Invoice rows whose invoice number could not be found in the Add CSV.' },
  ],
  formulas: [
    { name: 'Add In Busy', formula: 'XLOOKUP(Invoice Number, Add!F:F, Add!B:B)' },
    { name: 'If Modify', formula: 'XLOOKUP(Invoice Number, Modify!F:F, Modify!B:B)' },
    { name: 'TAT', formula: 'Add In Busy date - Timestamp date' },
    { name: 'Remark', formula: 'Delay if TAT > 5 days; otherwise On Time' },
    { name: '% On Time', formula: 'On Time count / Grand Total * 100' },
    { name: '% Delay', formula: 'Delay count / Grand Total * 100' },
    { name: 'Avg TAT', formula: 'sum(TAT days) / matched invoice count' },
  ],
  notes: [
    'This recreates the OG AP INVOICE TAT Working tab from the three CSV inputs.',
    'Rows without a matching Add voucher are excluded from TAT rate calculations and shown as unmatched.',
  ],
}

function avg(values) {
  const clean = values.filter(v => typeof v === 'number' && !isNaN(v))
  return clean.length ? clean.reduce((a, b) => a + b, 0) / clean.length : null
}

export default function DelayedEntry() {
  const { selectedYears, selectedQuarters, filterLabel, data, dataLoading, dataError } = useQtr()
  const invoiceRows = data.inv
  const addRows = data.add
  const modifyRows = data.mod

  const refPerson = useRef(null)
  const refMonthly = useRef(null)
  const refPO = useRef(null)
  const refRemark = useRef(null)

  const enriched = useMemo(() => buildInvoiceTatRows(invoiceRows, addRows, modifyRows), [invoiceRows, addRows, modifyRows])
  const filtered = enriched.filter(r => rowMatchesSelection(r, selectedYears, selectedQuarters))
  const withTat = filtered.filter(r => r.remark)

  const byPerson = {}
  withTat.forEach(r => {
    const name = r.added_by || 'Not Entered'
    if (!byPerson[name]) byPerson[name] = { total: 0, delay: 0, ontime: 0, tatVals: [] }
    byPerson[name].total++
    byPerson[name].tatVals.push(r.tat)
    if (r.remark === 'Delay') byPerson[name].delay++
    else byPerson[name].ontime++
  })
  const personNames = Object.keys(byPerson).sort((a, b) => byPerson[b].total - byPerson[a].total)

  const byMonth = {}
  withTat.forEach(r => {
    if (!r.month_label) return
    if (!byMonth[r.month_label]) byMonth[r.month_label] = { total: 0, delay: 0 }
    byMonth[r.month_label].total++
    if (r.remark === 'Delay') byMonth[r.month_label].delay++
  })
  const months = Object.keys(byMonth).sort(monthSort)

  const byPO = {}
  withTat.forEach(r => {
    const key = r.po_type || 'Unknown'
    if (!byPO[key]) byPO[key] = { total: 0, delay: 0 }
    byPO[key].total++
    if (r.remark === 'Delay') byPO[key].delay++
  })
  const poLabels = Object.keys(byPO).sort((a, b) => byPO[b].total - byPO[a].total).slice(0, 8)

  const delayed = withTat.filter(r => r.remark === 'Delay').length
  const ontime = withTat.filter(r => r.remark === 'On Time').length
  const delayRate = withTat.length ? (delayed / withTat.length * 100).toFixed(2) : '0.00'
  const avgTat = avg(withTat.map(r => r.tat))

  useChart(refPerson, personNames.length > 0 ? {
    type: 'bar',
    labels: personNames,
    datasets: [
      { label: 'On Time', data: personNames.map(n => byPerson[n].ontime), backgroundColor: 'rgba(54,200,122,0.2)', borderColor: '#36c87a', borderWidth: 1, borderRadius: 6 },
      { label: 'Delay', data: personNames.map(n => byPerson[n].delay), backgroundColor: 'rgba(240,84,94,0.2)', borderColor: '#f0545e', borderWidth: 1, borderRadius: 6 },
    ],
    options: { legend: true, stacked: true }
  } : null, [withTat.length, filterLabel])

  useChart(refMonthly, months.length > 0 ? {
    type: 'line',
    labels: months,
    datasets: [{
      label: 'Delay %',
      data: months.map(m => (byMonth[m].delay / byMonth[m].total * 100).toFixed(2)),
      borderColor: '#f0545e',
      backgroundColor: 'rgba(240,84,94,0.06)',
      fill: true,
      tension: 0.35,
      pointRadius: 4,
    }],
    options: { pct: true, legend: true }
  } : null, [withTat.length, filterLabel])

  useChart(refPO, poLabels.length > 0 ? {
    type: 'bar',
    labels: poLabels,
    datasets: [
      { label: 'On Time', data: poLabels.map(k => byPO[k].total - byPO[k].delay), backgroundColor: 'rgba(54,200,122,0.2)', borderColor: '#36c87a', borderWidth: 1, borderRadius: 6 },
      { label: 'Delay', data: poLabels.map(k => byPO[k].delay), backgroundColor: 'rgba(240,84,94,0.2)', borderColor: '#f0545e', borderWidth: 1, borderRadius: 6 },
    ],
    options: { legend: true, stacked: true }
  } : null, [withTat.length, filterLabel])

  useChart(refRemark, withTat.length > 0 ? {
    type: 'doughnut',
    labels: ['On Time', 'Delay'],
    datasets: [{ data: [ontime, delayed], backgroundColor: ['rgba(54,200,122,0.2)', 'rgba(240,84,94,0.2)'], borderColor: ['#36c87a', '#f0545e'], borderWidth: 2 }],
    options: { legend: true, extra: { cutout: '68%' } }
  } : null, [withTat.length, filterLabel])

  if (dataLoading) return <div style={{ padding: 60, textAlign: 'center' }}><Spinner /></div>
  if (dataError) return <EmptyState icon="!" title="Could not load invoice TAT data" sub={dataError.message} />
  if (!invoiceRows.length) return <EmptyState icon="[]" title="No invoice data" sub="Upload Invoice Data, Add, and Modify CSVs to recreate the OG TAT insights." />

  return (
    <>
      <div className="page-header">
        <div className="page-title-row">
          <div className="page-title">Invoice TAT</div>
          <HelpButton {...HELP} />
        </div>
        <div className="page-sub">Recreated from Invoice Data + Add + Modify CSVs - {filterLabel}</div>
      </div>

      <InfoBox>OG rule matched: TAT = Add In Busy date - invoice timestamp; Delay when TAT is greater than {TAT_DELAY_DAYS} days.</InfoBox>

      <div className="kpi-row mb">
        <KpiCard label="Delay Rate" value={`${delayRate}%`} sub={`${delayed.toLocaleString()} of ${withTat.length.toLocaleString()} matched invoices`} color={rateColor(Number(delayRate))} />
        <KpiCard label="On-Time Entry" value={ontime.toLocaleString()} sub={`${withTat.length ? (ontime / withTat.length * 100).toFixed(2) : '0.00'}%`} color="green" />
        <KpiCard label="Avg TAT" value={avgTat === null ? '-' : avgTat.toFixed(1)} sub="days from timestamp to Busy entry" color="blue" />
        <KpiCard label="Unmatched Invoices" value={(filtered.length - withTat.length).toLocaleString()} sub="invoice no not found in Add" color={filtered.length - withTat.length ? 'amber' : 'green'} />
      </div>

      <div className="grid-65 mb">
        <Card title="On-Time vs Delay by Add By">
          <div className="chart-wrap" style={{ height: 240 }}><canvas ref={refPerson} /></div>
        </Card>
        <Card title="On-Time vs Delay">
          <div className="chart-wrap" style={{ height: 240 }}><canvas ref={refRemark} /></div>
        </Card>
      </div>

      <div className="grid-2 mb">
        <Card title="Monthly Delay Rate">
          <div className="chart-wrap" style={{ height: 200 }}><canvas ref={refMonthly} /></div>
        </Card>
        <Card title="Delay by PO Type">
          <div className="chart-wrap" style={{ height: 200 }}><canvas ref={refPO} /></div>
        </Card>
      </div>

      <Card title="Entry Summary - Add By x Remark">
        <div className="table-wrap">
          <table>
            <thead><tr><th>Add By</th><th>Delay</th><th>On Time</th><th>Grand Total</th><th>% On Time</th><th>% Delay</th><th>Avg TAT</th></tr></thead>
            <tbody>
              {personNames.map(name => {
                const d = byPerson[name]
                const pDelay = d.total ? (d.delay / d.total * 100).toFixed(2) : '0.00'
                const pOn = d.total ? (d.ontime / d.total * 100).toFixed(2) : '0.00'
                const pAvg = avg(d.tatVals)
                return <tr key={name}>
                  <td><strong>{name}</strong></td>
                  <td className="mono" style={{ color: 'var(--red)' }}>{d.delay.toLocaleString()}</td>
                  <td className="mono" style={{ color: 'var(--green)' }}>{d.ontime.toLocaleString()}</td>
                  <td className="mono">{d.total.toLocaleString()}</td>
                  <td><Tag color={Number(pOn) >= 90 ? 'green' : Number(pOn) >= 70 ? 'amber' : 'red'}>{pOn}%</Tag></td>
                  <td><Tag color={rateColor(Number(pDelay))}>{pDelay}%</Tag></td>
                  <td className="mono">{pAvg === null ? '-' : pAvg.toFixed(1)}</td>
                </tr>
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  )
}

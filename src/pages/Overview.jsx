import { useMemo, useRef } from 'react'
import { useChart, pc } from '../hooks/useChart'
import { useQtr } from '../components/AppShell'
import { KpiCard, Card, EmptyState, Spinner, HelpButton, Tag } from '../components/UI'
import { buildInvoiceTatRows, buildVoucherSummary, monthSort, qtrText, rateColor, rowFiscalQuarter } from '../lib/insights'

const HELP = {
  title: 'Overview',
  terms: [
    { term: 'Invoices Submitted', meaning: 'Count of invoice submission rows from the Invoice Data CSV for the selected quarter.' },
    { term: 'Vouchers Added', meaning: 'Unique Busy voucher numbers from the Add CSV.' },
    { term: 'Vouchers Modified', meaning: 'Unique added vouchers that have a matching voucher number in the Modify CSV.' },
    { term: 'Delay Rate', meaning: 'Share of matched invoices where Busy entry happened after the allowed TAT window.' },
    { term: '% Of Modify', meaning: 'Same metric as the OG Entry Summary pivot: Count of Modify By divided by Count of Vch No.' },
  ],
  formulas: [
    { name: 'Voucher Summary', formula: 'Vch No = UNIQUE(Add!F:F); Add By = XLOOKUP(Vch No, Add!F:F, Add!N:N); Modify By = XLOOKUP(Vch No, Add!F:F, Add!P:P)' },
    { name: '% Of Modify', formula: 'modified unique vouchers / added unique vouchers * 100' },
    { name: 'TAT', formula: 'Add In Busy date - Invoice Timestamp date' },
    { name: 'Delay Rate', formula: 'Delay invoices / matched invoices * 100, where Delay means TAT > 5 days' },
  ],
}

function avg(values) {
  const clean = values.filter(v => typeof v === 'number' && !isNaN(v))
  return clean.length ? clean.reduce((a, b) => a + b, 0) / clean.length : null
}

export default function Overview() {
  const { qtr, data, dataLoading, dataError } = useQtr()
  const add = data.add
  const mod = data.mod
  const inv = data.inv

  const refAddMod = useRef(null)
  const refInvoiceMonth = useRef(null)
  const refPO = useRef(null)
  const refPerson = useRef(null)

  const voucherSummary = useMemo(() => buildVoucherSummary(add, mod), [add, mod])
  const summaryRows = qtr === 'all' ? voucherSummary.rows : voucherSummary.rows.filter(r => r.quarter === qtr)
  const filtAdd = summaryRows
  const filtMod = summaryRows.filter(r => r.is_modified)
  const filtInv = qtr === 'all' ? inv : inv.filter(r => rowFiscalQuarter(r) === qtr)
  const tatRows = useMemo(() => buildInvoiceTatRows(inv, add, mod), [inv, add, mod])
  const filtTat = qtr === 'all' ? tatRows : tatRows.filter(r => r.quarter === qtr)
  const matchedTat = filtTat.filter(r => r.remark)
  const delayed = matchedTat.filter(r => r.remark === 'Delay').length
  const delayRate = matchedTat.length ? (delayed / matchedTat.length * 100).toFixed(2) : '0.00'

  const modificationRate = filtAdd.length > 0 ? (filtMod.length / filtAdd.length * 100).toFixed(2) : '0.00'
  const vendors = new Set(filtInv.map(r => r.vendor_code).filter(Boolean))
  const personMap = {}
  filtAdd.forEach(r => {
    const name = r.added_by || 'Unknown'
    if (!personMap[name]) personMap[name] = { person: name, added: 0, modified: 0, invoices: 0, ontime: 0, delay: 0, tatVals: [] }
    personMap[name].added++
    if (r.is_modified) personMap[name].modified++
  })
  matchedTat.forEach(r => {
    const name = r.added_by || 'Not Entered'
    if (!personMap[name]) personMap[name] = { person: name, added: 0, modified: 0, invoices: 0, ontime: 0, delay: 0, tatVals: [] }
    personMap[name].invoices++
    personMap[name].tatVals.push(r.tat)
    if (r.remark === 'Delay') personMap[name].delay++
    else personMap[name].ontime++
  })
  const personRows = Object.values(personMap).sort((a, b) => (b.added + b.invoices) - (a.added + a.invoices))

  useChart(refAddMod, (filtAdd.length || filtMod.length) ? (() => {
    const months = [...new Set([...filtAdd, ...filtMod].map(r => r.month_label).filter(Boolean))].sort(monthSort)
    const byAdd = Object.fromEntries(months.map(m => [m, 0]))
    const byMod = Object.fromEntries(months.map(m => [m, 0]))
    filtAdd.forEach(r => { if (r.month_label) byAdd[r.month_label]++ })
    filtMod.forEach(r => { if (r.month_label) byMod[r.month_label]++ })
    return {
      type: 'bar',
      labels: months,
      datasets: [
        { label: 'Added', data: months.map(m => byAdd[m]), backgroundColor: 'rgba(54,200,122,0.2)', borderColor: '#36c87a', borderWidth: 1, borderRadius: 6 },
        { label: 'Modified', data: months.map(m => byMod[m]), backgroundColor: 'rgba(240,84,94,0.2)', borderColor: '#f0545e', borderWidth: 1, borderRadius: 6 },
      ],
      options: { legend: true }
    }
  })() : null, [filtAdd.length, filtMod.length, qtr])

  useChart(refInvoiceMonth, filtInv.length ? (() => {
    const byM = {}
    filtInv.forEach(r => { if (r.month_label) byM[r.month_label] = (byM[r.month_label] || 0) + 1 })
    const months = Object.keys(byM).sort(monthSort)
    return {
      type: 'line',
      labels: months,
      datasets: [{ label: 'Invoices', data: months.map(m => byM[m]), borderColor: '#4b7cf3', backgroundColor: 'rgba(75,124,243,0.08)', fill: true, tension: 0.35, pointRadius: 4 }],
      options: { legend: true }
    }
  })() : null, [filtInv.length, qtr])

  useChart(refPO, filtInv.length ? (() => {
    const byPO = {}
    filtInv.forEach(r => {
      const key = r.po_type || 'Unknown'
      byPO[key] = (byPO[key] || 0) + 1
    })
    const labels = Object.keys(byPO).sort((a, b) => byPO[b] - byPO[a]).slice(0, 8)
    return { type: 'bar', labels, datasets: [{ data: labels.map(l => byPO[l]), backgroundColor: 'rgba(20,184,166,0.18)', borderColor: '#0f9888', borderWidth: 1, borderRadius: 6 }] }
  })() : null, [filtInv.length, qtr])

  useChart(refPerson, personRows.length ? (() => {
    const names = personRows.map(r => r.person)
    return {
      type: 'bar',
      labels: names,
      datasets: [
        { label: 'Added', data: personRows.map(r => r.added), backgroundColor: 'rgba(54,200,122,0.2)', borderColor: '#36c87a', borderWidth: 1, borderRadius: 6 },
        { label: 'Modified', data: personRows.map(r => r.modified), backgroundColor: 'rgba(240,84,94,0.2)', borderColor: '#f0545e', borderWidth: 1, borderRadius: 6 },
        { label: 'Invoices Entered', data: personRows.map(r => r.invoices), backgroundColor: names.map(n => pc(n) + '33'), borderColor: names.map(n => pc(n)), borderWidth: 1, borderRadius: 6 },
      ],
      options: { legend: true }
    }
  })() : null, [personRows.length, filtAdd.length, matchedTat.length, qtr])

  if (dataLoading) return <div style={{ padding: 60, textAlign: 'center' }}><Spinner /></div>
  if (dataError) return <EmptyState icon="!" title="Could not load dashboard data" sub={dataError.message} />
  if (!add.length && !mod.length && !inv.length) return <EmptyState icon="[]" title="No data loaded" sub="Upload Add, Modify, and Invoice Data CSVs to populate the dashboard." />

  return (
    <>
      <div className="page-header">
        <div className="page-title-row">
          <div className="page-title">Overview</div>
          <HelpButton {...HELP} />
        </div>
        <div className="page-sub">AP activity from Add, Modify, and Invoice Data CSVs - {qtrText(qtr)}</div>
      </div>

      <div className="kpi-row mb">
        <KpiCard label="Invoices Submitted" value={filtInv.length.toLocaleString()} sub={`${vendors.size.toLocaleString()} vendors`} color="blue" />
        <KpiCard label="Vouchers Added" value={filtAdd.length.toLocaleString()} sub="unique Busy vouchers" color="green" />
        <KpiCard label="Vouchers Modified" value={filtMod.length.toLocaleString()} sub="unique Busy vouchers" color="amber" />
        <KpiCard label="Delay Rate" value={`${delayRate}%`} sub={`${delayed.toLocaleString()} of ${matchedTat.length.toLocaleString()} matched invoices`} color={rateColor(Number(delayRate))} />
      </div>

      <div className="grid-65 mb">
        <Card title="Added vs Modified Vouchers">
          <div className="chart-wrap" style={{ height: 230 }}><canvas ref={refAddMod} /></div>
        </Card>
        <Card title="Invoice Submission Trend">
          <div className="chart-wrap" style={{ height: 230 }}><canvas ref={refInvoiceMonth} /></div>
        </Card>
      </div>

      <div className="grid-2">
        <Card title="Invoices by PO Type">
          <div className="chart-wrap" style={{ height: 200 }}><canvas ref={refPO} /></div>
        </Card>
        <Card title={`Person Workload - % Of Modify: ${modificationRate}%`}>
          <div className="chart-wrap" style={{ height: 200 }}><canvas ref={refPerson} /></div>
        </Card>
      </div>

      <Card title="Person Work Summary" style={{ marginTop: 14 }}>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Person</th><th>Vouchers Added</th><th>Vouchers Modified</th><th>% Modify</th><th>Invoices Entered</th><th>On Time</th><th>Delay</th><th>% Delay</th><th>Avg TAT</th></tr>
            </thead>
            <tbody>
              {personRows.map(r => {
                const modPct = r.added ? (r.modified / r.added * 100).toFixed(2) : '0.00'
                const delayPct = r.invoices ? (r.delay / r.invoices * 100).toFixed(2) : '0.00'
                const avgTat = avg(r.tatVals)
                return (
                  <tr key={r.person}>
                    <td><strong>{r.person}</strong></td>
                    <td className="mono">{r.added.toLocaleString()}</td>
                    <td className="mono">{r.modified.toLocaleString()}</td>
                    <td><Tag color={rateColor(Number(modPct))}>{modPct}%</Tag></td>
                    <td className="mono">{r.invoices.toLocaleString()}</td>
                    <td className="mono" style={{ color: 'var(--green)' }}>{r.ontime.toLocaleString()}</td>
                    <td className="mono" style={{ color: 'var(--red)' }}>{r.delay.toLocaleString()}</td>
                    <td><Tag color={rateColor(Number(delayPct))}>{delayPct}%</Tag></td>
                    <td className="mono">{avgTat === null ? '-' : avgTat.toFixed(1)}</td>
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

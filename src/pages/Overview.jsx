import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useChart, pc } from '../hooks/useChart'
import { useQtr } from '../components/AppShell'
import { KpiCard, Card, EmptyState, Spinner, HelpButton } from '../components/UI'
import { buildInvoiceTatRows, buildVoucherSummary, monthSort, qtrText, rateColor } from '../lib/insights'

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

export default function Overview() {
  const { qtr } = useQtr()
  const [add, setAdd] = useState([])
  const [mod, setMod] = useState([])
  const [inv, setInv] = useState([])
  const [loading, setLoading] = useState(true)

  const refAddMod = useRef(null)
  const refInvoiceMonth = useRef(null)
  const refPO = useRef(null)
  const refPerson = useRef(null)

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    const [a, m, i] = await Promise.all([
      supabase.from('ap_voucher_add').select('vch_no, entry_date, added_by, quarter, month_label, series, type'),
      supabase.from('ap_voucher_modify').select('vch_no, modified_at, modified_by, quarter, month_label, series, type'),
      supabase.from('ap_invoice_data').select('invoice_no, vendor_code, po_type, doc_type, submitted_at, quarter, month_label'),
    ])

    setAdd(a.data ?? [])
    setMod(m.data ?? [])
    setInv(i.data ?? [])
    setLoading(false)
  }

  const voucherSummary = buildVoucherSummary(add, mod)
  const summaryRows = qtr === 'all' ? voucherSummary.rows : voucherSummary.rows.filter(r => r.quarter === qtr)
  const filtAdd = summaryRows
  const filtMod = summaryRows.filter(r => r.is_modified)
  const filtInv = qtr === 'all' ? inv : inv.filter(r => r.quarter === qtr)
  const tatRows = buildInvoiceTatRows(inv, add, mod)
  const filtTat = qtr === 'all' ? tatRows : tatRows.filter(r => r.quarter === qtr)
  const matchedTat = filtTat.filter(r => r.remark)
  const delayed = matchedTat.filter(r => r.remark === 'Delay').length
  const delayRate = matchedTat.length ? (delayed / matchedTat.length * 100).toFixed(2) : '0.00'

  const modificationRate = filtAdd.length > 0 ? (filtMod.length / filtAdd.length * 100).toFixed(2) : '0.00'
  const vendors = new Set(filtInv.map(r => r.vendor_code).filter(Boolean))

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

  useChart(refPerson, filtMod.length ? (() => {
    const byP = {}
    filtMod.forEach(r => { byP[r.modify_by || 'Unknown'] = (byP[r.modify_by || 'Unknown'] || 0) + 1 })
    const names = Object.keys(byP).sort((a, b) => byP[b] - byP[a])
    return { type: 'bar', labels: names, datasets: [{ data: names.map(n => byP[n]), backgroundColor: names.map(n => pc(n) + '44'), borderColor: names.map(n => pc(n)), borderWidth: 1, borderRadius: 6 }] }
  })() : null, [filtMod.length, qtr])

  if (loading) return <div style={{ padding: 60, textAlign: 'center' }}><Spinner /></div>
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
        <Card title={`% Of Modify: ${modificationRate}%`}>
          <div className="chart-wrap" style={{ height: 200 }}><canvas ref={refPerson} /></div>
        </Card>
      </div>
    </>
  )
}

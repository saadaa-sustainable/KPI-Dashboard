import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useChart } from '../hooks/useChart'
import { useQtr } from '../components/AppShell'
import { KpiCard, Card, Tag, Spinner, EmptyState } from '../components/UI'

const shortPO = s => (s || '')
  .replace('E-FOB (Paid for fabric in start of PO)', 'E-FOB')
  .replace('PRODUCTION ORDER (FOB)', 'FOB')
  .replace('JOB ORDER (Fabrication)', 'Fabrication')
  .replace('JOB ORDER (CMTP Charge)', 'CMTP')
  .replace('Fabrication (PO - PO settlement of fabric Invoice)', 'Fab Settle')

const shortAssociation = s => (s || '')
  .replace(' Partner', '')
  .replace('Fabric (Greige / Dyed) Supply', 'Fabric Supply')

function monthSort(a, b) {
  return new Date('01 ' + a) - new Date('01 ' + b)
}

function uniqueBy(rows, keyFn) {
  const seen = new Set()
  return rows.filter(r => {
    const key = keyFn(r)
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export default function DelayedEntry() {
  const { qtr } = useQtr()
  const [invoices, setInvoices] = useState([])
  const [loading, setLoading] = useState(true)

  const refMonthly = useRef(null)
  const refPO = useRef(null)
  const refAssoc = useRef(null)
  const refDoc = useRef(null)

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    const { data } = await supabase
      .from('ap_invoice_data')
      .select('submitted_at, month_label, quarter, email, association, po_no, vendor_code, po_type, doc_type, invoice_no, invoice_date')
      .order('submitted_at')
    setInvoices(uniqueBy(data ?? [], r => `${r.invoice_no}|${r.vendor_code}|${r.submitted_at}`))
    setLoading(false)
  }

  const filtered = qtr === 'all' ? invoices : invoices.filter(r => r.quarter === qtr)

  const byMonth = {}
  filtered.forEach(r => {
    if (!r.month_label) return
    byMonth[r.month_label] = (byMonth[r.month_label] || 0) + 1
  })
  const months = Object.keys(byMonth).sort(monthSort)

  const byPO = {}
  filtered.forEach(r => {
    const k = shortPO(r.po_type) || 'Unknown'
    byPO[k] = (byPO[k] || 0) + 1
  })

  const byAssoc = {}
  filtered.forEach(r => {
    const k = shortAssociation(r.association) || 'Unknown'
    byAssoc[k] = (byAssoc[k] || 0) + 1
  })

  const byDoc = {}
  filtered.forEach(r => {
    const k = r.doc_type || 'Unknown'
    byDoc[k] = (byDoc[k] || 0) + 1
  })

  const byVendor = {}
  filtered.forEach(r => {
    const k = r.vendor_code || 'Unknown'
    byVendor[k] = (byVendor[k] || 0) + 1
  })
  const vendorRows = Object.entries(byVendor).sort((a, b) => b[1] - a[1]).slice(0, 15)

  const topPO = Object.entries(byPO).sort((a, b) => b[1] - a[1])[0]
  const topAssoc = Object.entries(byAssoc).sort((a, b) => b[1] - a[1])[0]
  const vendors = new Set(filtered.map(r => r.vendor_code).filter(Boolean))
  const missingVendor = filtered.filter(r => !r.vendor_code).length

  useChart(refMonthly, months.length > 0 ? {
    type: 'line',
    labels: months,
    datasets: [{
      label: 'Invoices',
      data: months.map(m => byMonth[m]),
      borderColor: '#4b7cf3',
      backgroundColor: 'rgba(75,124,243,0.08)',
      fill: true,
      tension: 0.35,
      pointRadius: 4,
    }],
    options: { legend: true }
  } : null, [filtered.length, qtr])

  useChart(refPO, Object.keys(byPO).length > 0 ? {
    type: 'bar',
    labels: Object.keys(byPO),
    datasets: [{ data: Object.values(byPO), backgroundColor: 'rgba(54,200,122,0.2)', borderColor: '#36c87a', borderWidth: 1, borderRadius: 6 }]
  } : null, [filtered.length, qtr])

  useChart(refAssoc, Object.keys(byAssoc).length > 0 ? {
    type: 'bar',
    labels: Object.keys(byAssoc),
    datasets: [{ data: Object.values(byAssoc), backgroundColor: 'rgba(20,184,166,0.18)', borderColor: '#0f9888', borderWidth: 1, borderRadius: 6 }]
  } : null, [filtered.length, qtr])

  useChart(refDoc, Object.keys(byDoc).length > 0 ? {
    type: 'doughnut',
    labels: Object.keys(byDoc),
    datasets: [{ data: Object.values(byDoc), backgroundColor: ['rgba(75,124,243,0.2)', 'rgba(240,84,94,0.2)', 'rgba(245,158,11,0.2)', 'rgba(159,122,234,0.2)'], borderColor: ['#4b7cf3', '#f0545e', '#b7791f', '#9f7aea'], borderWidth: 2 }],
    options: { legend: true, extra: { cutout: '68%' } }
  } : null, [filtered.length, qtr])

  if (loading) return <div style={{ padding: 60, textAlign: 'center' }}><Spinner /></div>
  if (!invoices.length) return <EmptyState icon="[]" title="No invoice data" sub="Upload the Invoice Data CSV to see invoice submission insights." />

  const qtrLabel = qtr === 'all' ? 'All Quarters' : qtr.replace(/(\d{4})Q(\d)/, 'Q$2 $1')

  return (
    <>
      <div className="page-header">
        <div className="page-title">Invoice Insights</div>
        <div className="page-sub">Invoice submission mix by month, PO type, vendor, and association - {qtrLabel}</div>
      </div>

      <div className="kpi-row mb">
        <KpiCard label="Invoices Submitted" value={filtered.length.toLocaleString()} sub={qtrLabel} color="blue" />
        <KpiCard label="Active Vendors" value={vendors.size.toLocaleString()} sub="with vendor code" color="teal" />
        <KpiCard label="Top PO Type" value={topPO?.[1]?.toLocaleString() || '0'} sub={topPO?.[0] || 'no data'} color="green" />
        <KpiCard label="Missing Vendor Code" value={missingVendor.toLocaleString()} sub={`${filtered.length ? (missingVendor / filtered.length * 100).toFixed(1) : 0}% of invoices`} color={missingVendor ? 'amber' : 'green'} />
      </div>

      <div className="grid-65 mb">
        <Card title="Monthly Invoice Submissions">
          <div className="chart-wrap" style={{ height: 230 }}><canvas ref={refMonthly} /></div>
        </Card>
        <Card title="Document Mix">
          <div className="chart-wrap" style={{ height: 230 }}><canvas ref={refDoc} /></div>
        </Card>
      </div>

      <div className="grid-2 mb">
        <Card title="Invoices by PO Type">
          <div className="chart-wrap" style={{ height: 200 }}><canvas ref={refPO} /></div>
        </Card>
        <Card title="Invoices by Association" titleRight={topAssoc?.[0]}>
          <div className="chart-wrap" style={{ height: 200 }}><canvas ref={refAssoc} /></div>
        </Card>
      </div>

      <Card title="Top Vendors by Invoice Count">
        <div className="table-wrap">
          <table>
            <thead><tr><th>Vendor Code</th><th>Invoices</th><th>Share</th><th>Status</th></tr></thead>
            <tbody>
              {vendorRows.map(([vendor, count]) => {
                const share = filtered.length ? (count / filtered.length * 100).toFixed(1) : '0.0'
                return <tr key={vendor}>
                  <td><strong>{vendor}</strong></td>
                  <td className="mono">{count.toLocaleString()}</td>
                  <td><Tag color={share > 20 ? 'amber' : 'blue'}>{share}%</Tag></td>
                  <td><Tag color={vendor === 'Unknown' ? 'red' : 'green'}>{vendor === 'Unknown' ? 'Missing Code' : 'Mapped'}</Tag></td>
                </tr>
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  )
}

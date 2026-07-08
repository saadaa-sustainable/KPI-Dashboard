import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useChart, pc } from '../hooks/useChart'
import { useQtr } from '../components/AppShell'
import { KpiCard, Card, EmptyState, Spinner } from '../components/UI'

function qtrText(qtr) {
  return qtr === 'all' ? 'All Quarters' : qtr.replace(/(\d{4})Q(\d)/, 'Q$2 $1')
}

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
      supabase.from('ap_voucher_add').select('vch_no, added_by, quarter, month_label, series, type'),
      supabase.from('ap_voucher_modify').select('vch_no, modified_by, quarter, month_label, series, type'),
      supabase.from('ap_invoice_data').select('invoice_no, vendor_code, po_type, doc_type, quarter, month_label, association'),
    ])

    setAdd(uniqueBy(a.data ?? [], r => r.vch_no))
    setMod(uniqueBy(m.data ?? [], r => r.vch_no))
    setInv(uniqueBy(i.data ?? [], r => `${r.invoice_no}|${r.vendor_code}`))
    setLoading(false)
  }

  const filtAdd = qtr === 'all' ? add : add.filter(r => r.quarter === qtr)
  const filtMod = qtr === 'all' ? mod : mod.filter(r => r.quarter === qtr)
  const filtInv = qtr === 'all' ? inv : inv.filter(r => r.quarter === qtr)

  const modVouchers = new Set(filtMod.map(r => r.vch_no).filter(Boolean))
  const addedVouchers = new Set(filtAdd.map(r => r.vch_no).filter(Boolean))
  const modificationRate = addedVouchers.size > 0 ? (modVouchers.size / addedVouchers.size * 100).toFixed(1) : '0.0'
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
    filtMod.forEach(r => { byP[r.modified_by || 'Unknown'] = (byP[r.modified_by || 'Unknown'] || 0) + 1 })
    const names = Object.keys(byP).sort((a, b) => byP[b] - byP[a])
    return { type: 'bar', labels: names, datasets: [{ data: names.map(n => byP[n]), backgroundColor: names.map(n => pc(n) + '44'), borderColor: names.map(n => pc(n)), borderWidth: 1, borderRadius: 6 }] }
  })() : null, [filtMod.length, qtr])

  if (loading) return <div style={{ padding: 60, textAlign: 'center' }}><Spinner /></div>
  if (!add.length && !mod.length && !inv.length) return <EmptyState icon="[]" title="No data loaded" sub="Upload Add, Modify, and Invoice Data CSVs to populate the dashboard." />

  return (
    <>
      <div className="page-header">
        <div className="page-title">Overview</div>
        <div className="page-sub">AP activity from Add, Modify, and Invoice Data CSVs - {qtrText(qtr)}</div>
      </div>

      <div className="kpi-row mb">
        <KpiCard label="Invoices Submitted" value={filtInv.length.toLocaleString()} sub={`${vendors.size.toLocaleString()} vendors`} color="blue" />
        <KpiCard label="Vouchers Added" value={filtAdd.length.toLocaleString()} sub="unique Busy vouchers" color="green" />
        <KpiCard label="Vouchers Modified" value={filtMod.length.toLocaleString()} sub="unique Busy vouchers" color="amber" />
        <KpiCard label="Modification Rate" value={`${modificationRate}%`} sub="modified / added vouchers" color={Number(modificationRate) > 30 ? 'red' : 'teal'} />
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
        <Card title="Modifications by Person">
          <div className="chart-wrap" style={{ height: 200 }}><canvas ref={refPerson} /></div>
        </Card>
      </div>
    </>
  )
}

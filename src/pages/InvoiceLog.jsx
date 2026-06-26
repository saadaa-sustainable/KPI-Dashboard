import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { Card, FilterRow, Tag, StatusTag, Spinner, EmptyState } from '../components/UI'

const PAGE = 100
const SHORT_PO = s => (s || '')
  .replace('E-FOB (Paid for fabric in start of PO)', 'E-FOB')
  .replace('PRODUCTION ORDER (FOB)', 'FOB')
  .replace('JOB ORDER (CMTP Charge)', 'CMTP')
  .replace('Fabrication (PO - PO settlement of fabric Invoice)', 'Fab Settle')

export default function InvoiceLog() {
  const [rows,    setRows]    = useState([])
  const [total,   setTotal]   = useState(0)
  const [page,    setPage]    = useState(0)
  const [month,   setMonth]   = useState('all')
  const [remark,  setRemark]  = useState('all')
  const [search,  setSearch]  = useState('')
  const [months,  setMonths]  = useState([])
  const [loading, setLoading] = useState(true)

  // Fetch months once
  useEffect(() => {
    supabase.from('ap_invoice_tat').select('month_label').then(({ data }) => {
      const ms = [...new Set((data ?? []).map(r => r.month_label).filter(Boolean))]
        .sort((a, b) => new Date('01 ' + a) - new Date('01 ' + b))
      setMonths(ms)
    })
  }, [])

  const fetchRows = useCallback(async () => {
    setLoading(true)
    let q = supabase
      .from('ap_invoice_tat')
      .select('*', { count: 'exact' })
      .order('submitted_at', { ascending: false })
      .range(page * PAGE, page * PAGE + PAGE - 1)

    if (month  !== 'all') q = q.eq('month_label', month)
    if (remark !== 'all') q = q.eq('remark', remark)
    if (search.trim())    q = q.or(`invoice_no.ilike.%${search}%,vendor_code.ilike.%${search}%,po_no.ilike.%${search}%,added_by.ilike.%${search}%`)

    const { data, count } = await q
    setRows(data ?? [])
    setTotal(count ?? 0)
    setLoading(false)
  }, [page, month, remark, search])

  useEffect(() => { fetchRows() }, [fetchRows])

  // Reset page on filter change
  useEffect(() => { setPage(0) }, [month, remark, search])

  const totalPages = Math.ceil(total / PAGE)
  const monthOptions  = [{ value: 'all', label: 'All Months' }, ...months.map(m => ({ value: m, label: m }))]
  const remarkOptions = [{ value: 'all', label: 'All' }, { value: 'On Time', label: 'On Time' }, { value: 'Delay', label: 'Delayed' }]

  return (
    <>
      <div className="page-title">Invoice Log</div>
      <div className="page-sub">{total.toLocaleString()} total records — searchable TAT submission history</div>

      <div className="filter-row" style={{ flexWrap: 'wrap', gap: 12 }}>
        <FilterRow label="Month"  options={monthOptions}  active={month}  onChange={setMonth} />
        <FilterRow label="Status" options={remarkOptions} active={remark} onChange={setRemark} />
      </div>

      <div style={{ marginBottom: 14 }}>
        <input
          type="search"
          placeholder="Search invoice number, vendor code, PO, person..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      <Card title={`Invoice Records`} titleRight={<span style={{ color: 'var(--accent)', fontSize: 10 }}>{total.toLocaleString()} records</span>}>
        {loading
          ? <div style={{ padding: 32, textAlign: 'center' }}><Spinner /></div>
          : rows.length === 0
          ? <EmptyState icon="📭" title="No records match" sub="Try adjusting filters or search." />
          : (
          <>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Invoice No</th>
                    <th>Vendor</th>
                    <th>PO Type</th>
                    <th>Document</th>
                    <th>Added By</th>
                    <th>TAT (days)</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i}>
                      <td className="mono" style={{ whiteSpace: 'nowrap' }}>{r.submitted_at || '—'}</td>
                      <td className="mono">{r.invoice_no || '—'}</td>
                      <td><Tag color="blue">{r.vendor_code || '—'}</Tag></td>
                      <td style={{ color: 'var(--muted)', fontSize: 10 }}>{SHORT_PO(r.po_type)}</td>
                      <td style={{ color: 'var(--muted)', fontSize: 10 }}>{r.doc_type || '—'}</td>
                      <td><strong>{r.added_by || '—'}</strong></td>
                      <td className="mono" style={{ color: r.tat > 0 ? 'var(--red)' : 'var(--green)' }}>{r.tat ?? '—'}</td>
                      <td><StatusTag value={r.remark} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 14 }}>
                <button
                  className="fbtn"
                  disabled={page === 0}
                  onClick={() => setPage(p => p - 1)}
                >← Prev</button>
                <span style={{ fontSize: 11, color: 'var(--muted)', alignSelf: 'center' }}>
                  Page {page + 1} of {totalPages}
                </span>
                <button
                  className="fbtn"
                  disabled={page >= totalPages - 1}
                  onClick={() => setPage(p => p + 1)}
                >Next →</button>
              </div>
            )}
          </>
        )}
      </Card>
    </>
  )
}

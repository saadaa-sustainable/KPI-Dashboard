import { useEffect, useMemo, useState } from 'react'
import { useQtr } from '../components/AppShell'
import { Card, Tag, Spinner, EmptyState, StatusTag, HelpButton } from '../components/UI'
import { buildInvoiceTatRows, rowMatchesSelection } from '../lib/insights'

const PAGE = 100
const shortPO = s => (s || '')
  .replace('E-FOB (Paid for fabric in start of PO)', 'E-FOB')
  .replace('PRODUCTION ORDER (FOB)', 'FOB')
  .replace('JOB ORDER (Fabrication)', 'Fabrication')
  .replace('JOB ORDER (CMTP Charge)', 'CMTP')
  .replace('Fabrication (PO - PO settlement of fabric Invoice)', 'Fab Settle')

const HELP = {
  title: 'Invoice Log',
  terms: [
    { term: 'Submitted', meaning: 'Invoice form submission date from Invoice Data.' },
    { term: 'Vendor', meaning: 'Vendor Code from the invoice submission.' },
    { term: 'Add In Busy', meaning: 'Date the invoice number was found in the Add CSV.' },
    { term: 'If Modify', meaning: 'Date the same invoice or voucher number was found in the Modify CSV.' },
    { term: 'TAT', meaning: 'Days between Submitted and Add In Busy.' },
    { term: 'Remark', meaning: 'On Time or Delay based on the TAT rule.' },
  ],
  formulas: [
    { name: 'Add In Busy', formula: 'XLOOKUP(Invoice Number, Add!F:F, Add!B:B)' },
    { name: 'If Modify', formula: 'XLOOKUP(Invoice Number, Modify!F:F, Modify!B:B)' },
    { name: 'TAT', formula: 'Add In Busy date - Submitted date' },
    { name: 'Remark', formula: 'Delay if TAT > 5 days; otherwise On Time' },
  ],
  notes: [
    'The table is paginated 100 invoice rows at a time.',
    'Search checks invoice number, vendor code, PO number, and email.',
  ],
}

export default function InvoiceLog() {
  const { selectedYears, selectedQuarters, filterLabel, data, dataLoading, dataError } = useQtr()
  const [page, setPage] = useState(0)
  const [docType, setDocType] = useState('all')
  const [search, setSearch] = useState('')

  useEffect(() => { setPage(0) }, [selectedYears, selectedQuarters, docType, search])

  const filteredRows = useMemo(() => {
    const term = search.trim().toLowerCase()
    return data.inv
      .filter(r => rowMatchesSelection(r, selectedYears, selectedQuarters))
      .filter(r => docType === 'all' || r.doc_type === docType)
      .filter(r => !term || [r.invoice_no, r.vendor_code, r.po_no, r.email].some(v => String(v || '').toLowerCase().includes(term)))
      .sort((a, b) => new Date(b.submitted_at || 0) - new Date(a.submitted_at || 0))
  }, [data.inv, selectedYears, selectedQuarters, docType, search])

  const docOptions = [
    { value: 'all', label: 'All' },
    { value: 'INVOICE', label: 'Invoice' },
    { value: 'CREDIT NOTE', label: 'Credit Note' },
    { value: 'DEBIT NOTE', label: 'Debit Note' },
  ]
  const total = filteredRows.length
  const rows = useMemo(() => filteredRows.slice(page * PAGE, page * PAGE + PAGE), [filteredRows, page])
  const totalPages = Math.ceil(total / PAGE)
  const displayRows = useMemo(() => buildInvoiceTatRows(rows, data.add, data.mod), [rows, data.add, data.mod])

  return (
    <>
      <div className="page-header">
        <div className="page-title-row">
          <div className="page-title">Invoice Log</div>
          <HelpButton {...HELP} />
        </div>
        <div className="page-sub">{total.toLocaleString()} records - {filterLabel}</div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        <span className="filter-label">Document:</span>
        {docOptions.map(o => <button key={o.value} className={`fbtn ${docType === o.value ? 'active' : ''}`} onClick={() => setDocType(o.value)}>{o.label}</button>)}
      </div>

      <div style={{ marginBottom: 14 }}>
        <input type="search" placeholder="Search invoice number, vendor code, PO, email..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <Card title="Invoice Records" titleRight={`${total.toLocaleString()} records`}>
        {dataLoading
          ? <div style={{ padding: 32, textAlign: 'center' }}><Spinner /></div>
          : dataError
          ? <EmptyState icon="!" title="Could not load invoice records" sub={dataError.message} />
          : rows.length === 0
          ? <EmptyState icon="[]" title="No records match" sub="Try adjusting filters or search." />
          : <>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Submitted</th><th>Invoice No</th><th>Vendor</th><th>PO No</th><th>Add In Busy</th><th>If Modify</th><th>TAT</th><th>Add BY</th><th>Modify By</th><th>Remark</th></tr></thead>
                <tbody>
                  {displayRows.map((r, i) => (
                    <tr key={i}>
                      <td className="mono" style={{ whiteSpace: 'nowrap' }}>{r.submitted_at ? new Date(r.submitted_at).toLocaleDateString('en-IN') : '-'}</td>
                      <td className="mono">{r.invoice_no || '-'}</td>
                      <td><Tag color={r.vendor_code ? 'teal' : 'red'}>{r.vendor_code || 'Missing'}</Tag></td>
                      <td className="mono">{r.po_no || '-'}</td>
                      <td className="mono" style={{ whiteSpace: 'nowrap' }}>{r.add_in_busy ? new Date(r.add_in_busy).toLocaleDateString('en-IN') : '-'}</td>
                      <td className="mono" style={{ whiteSpace: 'nowrap' }}>{r.if_modify ? new Date(r.if_modify).toLocaleDateString('en-IN') : 'Not Modify'}</td>
                      <td className="mono" style={{ color: r.tat > 5 ? 'var(--red)' : 'var(--green)' }}>{r.tat ?? '-'}</td>
                      <td><strong>{r.added_by || '-'}</strong></td>
                      <td>{r.modify_by || 'Not Modify'}</td>
                      <td><StatusTag value={r.remark} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {totalPages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 14, alignItems: 'center' }}>
                <button className="fbtn" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Prev</button>
                <span style={{ fontSize: 11, color: 'var(--muted)' }}>Page {page + 1} of {totalPages}</span>
                <button className="fbtn" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>Next</button>
              </div>
            )}
          </>
        }
      </Card>
    </>
  )
}

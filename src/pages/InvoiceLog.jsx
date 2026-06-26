import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useQtr } from '../components/AppShell'
import { Card, Tag, StatusTag, Spinner, EmptyState } from '../components/UI'

const PAGE = 100
const shortPO = s => (s||'').replace('E-FOB (Paid for fabric in start of PO)','E-FOB').replace('PRODUCTION ORDER (FOB)','FOB').replace('JOB ORDER (CMTP Charge)','CMTP').replace('Fabrication (PO - PO settlement of fabric Invoice)','Fab Settle')

export default function InvoiceLog() {
  const { qtr } = useQtr()
  const [rows,   setRows]   = useState([])
  const [total,  setTotal]  = useState(0)
  const [page,   setPage]   = useState(0)
  const [remark, setRemark] = useState('all')
  const [search, setSearch] = useState('')
  const [loading,setLoading]= useState(true)

  const fetchRows = useCallback(async () => {
    setLoading(true)
    let q = supabase.from('ap_invoice_tat').select('*',{count:'exact'})
      .order('submitted_at',{ascending:false})
      .range(page*PAGE, page*PAGE+PAGE-1)

    if (qtr !== 'all')    q = q.eq('quarter', qtr)
    if (remark !== 'all') q = q.eq('remark', remark)
    if (search.trim())    q = q.or(`invoice_no.ilike.%${search}%,vendor_code.ilike.%${search}%,po_no.ilike.%${search}%,added_by.ilike.%${search}%`)

    const { data, count } = await q
    setRows(data??[])
    setTotal(count??0)
    setLoading(false)
  }, [page, qtr, remark, search])

  useEffect(() => { fetchRows() }, [fetchRows])
  useEffect(() => { setPage(0) }, [qtr, remark, search])

  const remarkOptions = [{value:'all',label:'All'},{value:'On Time',label:'On Time'},{value:'Delay',label:'Delayed'}]
  const totalPages = Math.ceil(total/PAGE)
  const qtrLabel = qtr === 'all' ? 'All Quarters' : qtr.replace(/(\d{4})Q(\d)/,'Q$2 $1')

  return (
    <>
      <div className="page-header">
        <div className="page-title">Invoice Log</div>
        <div className="page-sub">{total.toLocaleString()} records · {qtrLabel}</div>
      </div>

      <div style={{display:'flex', gap:8, marginBottom:14, flexWrap:'wrap', alignItems:'center'}}>
        <span className="filter-label">Status:</span>
        {remarkOptions.map(o => <button key={o.value} className={`fbtn ${remark===o.value?'active':''}`} onClick={()=>setRemark(o.value)}>{o.label}</button>)}
      </div>

      <div style={{marginBottom:14}}>
        <input type="search" placeholder="Search invoice number, vendor code, PO, person..." value={search} onChange={e=>setSearch(e.target.value)} />
      </div>

      <Card title="Invoice Records" titleRight={`${total.toLocaleString()} records`}>
        {loading
          ? <div style={{padding:32,textAlign:'center'}}><Spinner /></div>
          : rows.length === 0
          ? <EmptyState icon="📭" title="No records match" sub="Try adjusting filters or search." />
          : <>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Date</th><th>Invoice No</th><th>Vendor</th><th>PO Type</th><th>Document</th><th>Added By</th><th>Quarter</th><th>TAT</th><th>Status</th></tr></thead>
                <tbody>
                  {rows.map((r,i) => (
                    <tr key={i}>
                      <td className="mono" style={{whiteSpace:'nowrap'}}>{r.submitted_at||'—'}</td>
                      <td className="mono">{r.invoice_no||'—'}</td>
                      <td><Tag color="teal">{r.vendor_code||'—'}</Tag></td>
                      <td style={{color:'var(--muted)',fontSize:10}}>{shortPO(r.po_type)}</td>
                      <td style={{color:'var(--muted)',fontSize:10}}>{r.doc_type||'—'}</td>
                      <td><strong>{r.added_by||'—'}</strong></td>
                      <td className="mono" style={{color:'var(--muted)'}}>{r.quarter||'—'}</td>
                      <td className="mono" style={{color:r.tat>0?'var(--red)':'var(--green)'}}>{r.tat??'—'}</td>
                      <td><StatusTag value={r.remark}/></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {totalPages > 1 && (
              <div style={{display:'flex',justifyContent:'center',gap:8,marginTop:14,alignItems:'center'}}>
                <button className="fbtn" disabled={page===0} onClick={()=>setPage(p=>p-1)}>← Prev</button>
                <span style={{fontSize:11,color:'var(--muted)'}}>Page {page+1} of {totalPages}</span>
                <button className="fbtn" disabled={page>=totalPages-1} onClick={()=>setPage(p=>p+1)}>Next →</button>
              </div>
            )}
          </>
        }
      </Card>
    </>
  )
}

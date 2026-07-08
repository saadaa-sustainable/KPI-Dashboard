import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useChart } from '../hooks/useChart'
import { useQtr } from '../components/AppShell'
import { KpiCard, Card, NoteBox, Tag, Spinner, EmptyState, HelpButton } from '../components/UI'

const fmt = n => n!=null ? `₹${Number(n).toLocaleString('en-IN',{maximumFractionDigits:0})}` : '—'
const pct  = n => n!=null ? `${Number(n).toFixed(2)}%` : '—'

const HELP = {
  title: 'Cost Savings',
  terms: [
    { term: 'Invoice Value', meaning: 'Base invoice amount used for savings percentage calculation.' },
    { term: 'Savings', meaning: 'Recovered or saved amount, typically from debit notes or credit notes.' },
    { term: 'Credit Notes', meaning: 'Credit note amount issued or recovered for the selected category.' },
    { term: 'AP', meaning: 'Accounts Payable savings categories such as debit note recoveries.' },
    { term: 'AR', meaning: 'Accounts Receivable deductions, usually logistics or customer-side recoveries.' },
  ],
  formulas: [
    { name: 'Total Invoice Value', formula: 'sum(invoice_amt)' },
    { name: 'Total Savings', formula: 'sum(saving_amt)' },
    { name: 'Total Credit Notes', formula: 'sum(credit_note_amt)' },
    { name: 'Overall Saving %', formula: 'total savings / total invoice value * 100' },
    { name: 'Monthly Saving %', formula: 'monthly saving amount / monthly invoice amount * 100' },
  ],
  notes: [
    'This tab depends on the Cost Saved table, which is separate from the three primary CSVs.',
    'The OG workbook had some manual purchase/invoice inputs for this tab, so this page only reflects rows present in ap_cost_saved.',
  ],
}

export default function CostSavings() {
  const { qtr } = useQtr()
  const [rows, setRows] = useState([])
  const [cat,  setCat]  = useState('all')
  const [loading, setLoading] = useState(true)
  const refBar   = useRef(null)
  const refTrend = useRef(null)

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    const { data } = await supabase.from('ap_cost_saved').select('*').order('month_date')
    setRows(data ?? [])
    setLoading(false)
  }

  // Cost saved doesn't have quarter — filter by month_date range if needed
  const filtered = rows.filter(r => cat === 'all' || r.category === cat)

  const totalInvoice = filtered.reduce((a,r)=>a+(r.invoice_amt||0),0)
  const totalSaving  = filtered.reduce((a,r)=>a+(r.saving_amt||0),0)
  const totalCredit  = filtered.reduce((a,r)=>a+(r.credit_note_amt||0),0)
  const overallPct   = totalInvoice > 0 ? (totalSaving/totalInvoice*100).toFixed(2) : 0

  const bySub = {}
  filtered.forEach(r => {
    const k = r.sub_category||r.vendor||'Other'
    if (!bySub[k]) bySub[k]={invoice:0,saving:0}
    bySub[k].invoice += r.invoice_amt||0
    bySub[k].saving  += r.saving_amt||0
  })
  const subKeys = Object.keys(bySub).sort((a,b)=>bySub[b].saving-bySub[a].saving)

  const months = [...new Set(rows.map(r=>r.month_label).filter(Boolean))].sort((a,b)=>new Date('01 '+a)-new Date('01 '+b))
  const byMonthCat = {}
  rows.forEach(r => {
    if (!r.month_label) return
    if (!byMonthCat[r.month_label]) byMonthCat[r.month_label]={AP:{invoice:0,saving:0},AR:{invoice:0,saving:0}}
    const c = r.category||'AP'
    if (byMonthCat[r.month_label][c]) {
      byMonthCat[r.month_label][c].invoice += r.invoice_amt||0
      byMonthCat[r.month_label][c].saving  += r.saving_amt||0
    }
  })

  useChart(refBar, subKeys.length > 0 ? {
    type:'bar', labels:subKeys,
    datasets:[
      { label:'Invoice', data:subKeys.map(k=>bySub[k].invoice), backgroundColor:'rgba(91,141,238,0.2)', borderColor:'#5b8dee', borderWidth:1, borderRadius:6 },
      { label:'Saving',  data:subKeys.map(k=>bySub[k].saving),  backgroundColor:'rgba(54,200,122,0.2)', borderColor:'#36c87a', borderWidth:1, borderRadius:6 },
    ], options:{legend:true}
  } : null, [filtered.length, cat])

  useChart(refTrend, months.length > 0 ? {
    type:'line', labels:months,
    datasets:[
      { label:'AP Saving %', data:months.map(m=>{const d=byMonthCat[m]?.AP; return d&&d.invoice>0?(d.saving/d.invoice*100).toFixed(2):0}), borderColor:'#5b8dee', backgroundColor:'rgba(91,141,238,0.06)', fill:true, tension:0.4, pointRadius:4 },
      { label:'AR Saving %', data:months.map(m=>{const d=byMonthCat[m]?.AR; return d&&d.invoice>0?(d.saving/d.invoice*100).toFixed(2):0}), borderColor:'#36c87a', backgroundColor:'rgba(54,200,122,0.06)', fill:true, tension:0.4, pointRadius:4 },
    ], options:{legend:true, pct:true}
  } : null, [rows.length])

  if (loading) return <div style={{padding:60,textAlign:'center'}}><Spinner /></div>
  if (!rows.length) return <EmptyState icon="₹" title="No cost savings data" sub="Upload the Cost Saved Achieved CSV." />

  const catOptions = [{value:'all',label:'All'},{value:'AP',label:'AP (DN Savings)'},{value:'AR',label:'AR (Logistics)'}]

  return (
    <>
      <div className="page-header">
        <div className="page-title-row">
          <div className="page-title">Cost Savings</div>
          <HelpButton {...HELP} />
        </div>
        <div className="page-sub">AP debit note recoveries and AR logistics deductions</div>
      </div>

      <div className="kpi-row mb">
        <KpiCard label="Total Invoice Value" value={fmt(totalInvoice)} sub="selected period" color="blue" />
        <KpiCard label="Total Savings"       value={fmt(totalSaving)}  sub="via DN / credit notes" color="green" />
        <KpiCard label="Total Credit Notes"  value={fmt(totalCredit)}  sub="issued" color="purple" />
        <KpiCard label="Overall Saving %"    value={`${overallPct}%`}  sub="savings ÷ invoice" color="amber" />
      </div>

      <div className="filter-row">
        <span className="filter-label">Category:</span>
        {catOptions.map(o => <button key={o.value} className={`fbtn ${cat===o.value?'active':''}`} onClick={()=>setCat(o.value)}>{o.label}</button>)}
      </div>

      <div className="grid-65 mb">
        <Card title="Invoice vs Saving by Sub-Category">
          <div className="chart-wrap" style={{height:230}}><canvas ref={refBar}/></div>
        </Card>
        <Card title="Monthly Saving % Trend">
          <div className="chart-wrap" style={{height:230}}><canvas ref={refTrend}/></div>
        </Card>
      </div>

      <Card title="Savings Breakdown">
        <div className="table-wrap">
          <table>
            <thead><tr><th>Month</th><th>Category</th><th>Sub-Category / Vendor</th><th>Invoice Amt</th><th>Credit Note</th><th>Saving</th><th>Saving %</th></tr></thead>
            <tbody>
              {filtered.map((r,i) => (
                <tr key={i}>
                  <td className="mono">{r.month_label}</td>
                  <td><Tag color={r.category==='AP'?'blue':'purple'}>{r.category}</Tag></td>
                  <td>{r.sub_category||r.vendor||'—'}</td>
                  <td className="mono">{fmt(r.invoice_amt)}</td>
                  <td className="mono">{fmt(r.credit_note_amt)}</td>
                  <td className="mono" style={{color:'var(--green)'}}>{fmt(r.saving_amt)}</td>
                  <td><Tag color={r.saving_pct>5?'green':'amber'}>{pct(r.saving_pct)}</Tag></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  )
}

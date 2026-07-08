import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { uploadCSV } from '../lib/upload'
import { Card, NoteBox, Tag, Spinner, HelpButton } from '../components/UI'

const FILE_CONFIGS = {
  add: { icon: '+', label: 'Add Log', hint: 'KPI Dashboard - Add.csv', table: 'ap_voucher_add' },
  modify: { icon: '*', label: 'Modify Log', hint: 'KPI Dashboard - Modify.csv', table: 'ap_voucher_modify' },
  invoice_data: { icon: '#', label: 'Invoice Data', hint: 'KPI Dashboard - Invoice Data.csv', table: 'ap_invoice_data' },
}

const HELP = {
  title: 'Upload CSV Data',
  terms: [
    { term: 'Add Log', meaning: 'Busy export containing voucher creation events. It feeds voucher counts, Add By, and Add In Busy date.' },
    { term: 'Modify Log', meaning: 'Busy export containing voucher modification events. It feeds Modify By and If Modify date.' },
    { term: 'Invoice Data', meaning: 'Vendor invoice form export. It feeds invoice number, timestamp, vendor, PO type, and document type.' },
    { term: 'Upsert', meaning: 'Insert new rows and update existing rows when the configured conflict key already exists.' },
    { term: 'Upload History', meaning: 'Audit log of file uploads, row counts, status, and errors.' },
  ],
  formulas: [
    { name: 'Add conflict key', formula: 'vch_no + account + entry_date' },
    { name: 'Modify conflict key', formula: 'vch_no + account + modified_at + modified_by' },
    { name: 'Invoice Data conflict key', formula: 'invoice_no + vendor_code + submitted_at' },
    { name: 'Quarter', formula: 'year(submitted/entry date) + Q + calendar quarter number' },
    { name: 'Month Label', formula: 'MMM YYYY from submitted/entry date' },
  ],
  notes: [
    'Invoice Data files may contain a preamble row; ingestion scans for the real header row.',
    'Busy dates are parsed as day-first dates to avoid month/day swaps.',
  ],
}

function UploadZone({ fileType, onUpload }) {
  const [state, setState] = useState('idle')
  const [progress, setProgress] = useState(0)
  const [total, setTotal] = useState(0)
  const [done, setDone] = useState(0)
  const [error, setError] = useState(null)
  const inputRef = useRef(null)
  const cfg = FILE_CONFIGS[fileType]

  async function handleFile(file) {
    if (!file) return
    setState('loading')
    setProgress(0)
    setError(null)

    try {
      const res = await uploadCSV(file, ({ processed, total: t }) => {
        setTotal(t)
        setDone(processed)
        setProgress(t > 0 ? Math.round(processed / t * 100) : 100)
      })
      setState('done')
      setTotal(res.total)
      onUpload?.()
    } catch (err) {
      setError(err.message)
      setState('error')
    }
  }

  function reset() {
    setState('idle')
    setError(null)
    setProgress(0)
    setTotal(0)
    setDone(0)
  }

  return (
    <div
      className={`upload-zone ${state === 'done' ? 'done' : state === 'error' ? 'error' : ''}`}
      onDragOver={e => e.preventDefault()}
      onDrop={e => { e.preventDefault(); if (state === 'idle') handleFile(e.dataTransfer.files[0]) }}
      onClick={() => state === 'idle' && inputRef.current?.click()}
      style={{ cursor: state === 'idle' ? 'pointer' : 'default' }}
    >
      <input ref={inputRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={e => handleFile(e.target.files[0])} />

      <div className="upload-zone-icon">{cfg.icon}</div>

      {state === 'idle' && (
        <>
          <div className="upload-zone-title">{cfg.label}</div>
          <div className="upload-zone-sub">{cfg.hint}</div>
        </>
      )}

      {state === 'loading' && (
        <>
          <div className="upload-zone-title" style={{ color: 'var(--accent)' }}>
            Uploading... {progress}%
          </div>
          <div className="upload-zone-sub">{done.toLocaleString()} / {total.toLocaleString()} rows</div>
          <div className="upload-progress" style={{ marginTop: 8 }}>
            <div className="upload-progress-fill" style={{ width: `${progress}%` }} />
          </div>
        </>
      )}

      {state === 'done' && (
        <>
          <div className="upload-zone-title">Upload complete</div>
          <div className="upload-zone-sub">{total.toLocaleString()} rows processed</div>
          <button className="fbtn" style={{ marginTop: 8 }} onClick={e => { e.stopPropagation(); reset() }}>Upload again</button>
        </>
      )}

      {state === 'error' && (
        <>
          <div className="upload-zone-title">Upload failed</div>
          <div className="upload-zone-sub" style={{ color: 'var(--red)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{error}</div>
          <button className="fbtn" style={{ marginTop: 8 }} onClick={e => { e.stopPropagation(); reset() }}>Try again</button>
        </>
      )}
    </div>
  )
}

export default function Upload() {
  const [log, setLog] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchLog() }, [])

  async function fetchLog() {
    setLoading(true)
    const { data, error } = await supabase
      .from('ap_upload_log')
      .select('*')
      .order('uploaded_at', { ascending: false })
      .limit(50)
    if (error) console.error('Log fetch error:', error)
    setLog(data ?? [])
    setLoading(false)
  }

  return (
    <>
      <div className="page-header">
        <div className="page-title-row">
          <div className="page-title">Upload CSV Data</div>
          <HelpButton {...HELP} />
        </div>
        <div className="page-sub">Upload the 3 primary source files. Files are auto-detected - duplicates are skipped, changed rows are updated.</div>
      </div>

      <NoteBox>
        Upload Add, Modify, and Invoice Data CSVs one file at a time. Large Add/Modify files can take several minutes - keep the tab open.
      </NoteBox>

      <div className="upload-grid mb">
        {Object.keys(FILE_CONFIGS).map(ft => (
          <UploadZone key={ft} fileType={ft} onUpload={fetchLog} />
        ))}
      </div>

      <Card title="Upload History">
        {loading
          ? <div style={{ textAlign: 'center', padding: 24 }}><Spinner /></div>
          : log.length === 0
          ? <div style={{ textAlign: 'center', padding: 24, color: 'var(--muted)', fontSize: 12 }}>No uploads yet.</div>
          : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Time</th><th>File</th><th>Table</th><th>By</th><th>Rows</th><th>Status</th><th>Error</th></tr>
              </thead>
              <tbody>
                {log.map((r, i) => (
                  <tr key={i}>
                    <td className="mono" style={{ fontSize: 10, whiteSpace: 'nowrap' }}>{new Date(r.uploaded_at).toLocaleString('en-IN')}</td>
                    <td style={{ fontSize: 10, color: 'var(--muted)', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.file_name}</td>
                    <td><Tag color="blue">{r.table_name}</Tag></td>
                    <td style={{ fontSize: 11 }}>{r.email}</td>
                    <td className="mono">{(r.rows_inserted || 0).toLocaleString()}</td>
                    <td><Tag color={r.status === 'success' ? 'green' : 'red'}>{r.status}</Tag></td>
                    <td style={{ fontSize: 10, color: 'var(--red)', maxWidth: 200 }}>{r.error_msg || ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  )
}

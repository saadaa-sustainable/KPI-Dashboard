import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { uploadCSV, detectFileType } from '../lib/upload'
import { Card, NoteBox, Tag, Spinner } from '../components/UI'
import Papa from 'papaparse'

const FILE_CONFIGS = {
  tat:          { icon: '📋', label: 'AP Invoice TAT Working', hint: 'KPI_Dashboard_-_AP_INVOICE_TAT_Working_.csv', table: 'ap_invoice_tat' },
  modify:       { icon: '✎',  label: 'Modify Log',             hint: 'KPI_Dashboard_-_Modify.csv',                 table: 'ap_voucher_modify' },
  add:          { icon: '➕',  label: 'Add Log',                hint: 'KPI_Dashboard_-_Add.csv',                    table: 'ap_voucher_add' },
  invoice_data: { icon: '🗂',  label: 'Invoice Data',           hint: 'KPI_Dashboard_-_Invoice_Data.csv',           table: 'ap_invoice_data' },
  cost_saved:   { icon: '₹',  label: 'Cost Saved Achieved',    hint: 'KPI_Dashboard_-_Cost_saved_achieved.csv',    table: 'ap_cost_saved' },
}

function UploadZone({ fileType, onUpload }) {
  const [state,    setState]    = useState('idle')
  const [progress, setProgress] = useState(0)
  const [total,    setTotal]    = useState(0)
  const [done,     setDone]     = useState(0)
  const [error,    setError]    = useState(null)
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
        setProgress(Math.round(processed / t * 100))
      })
      setState('done')
      setTotal(res.total)
      onUpload?.()
    } catch (err) {
      setError(err.message)
      setState('error')
    }
  }

  function reset() { setState('idle'); setError(null); setProgress(0); setTotal(0); setDone(0) }

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
          <div className="upload-zone-title">✓ Upload complete</div>
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
  const [log,     setLog]     = useState([])
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
      <div className="page-title">Upload CSV Data</div>
      <div className="page-sub">Upload any of the 5 supported files. Files are auto-detected — duplicates are skipped, changed rows are updated.</div>

      <NoteBox>
        Export each sheet from KPI_Dashboard.xlsx as CSV. Upload one file at a time. Large files (Add Log = 143k rows) take 8-10 mins — keep the tab open.
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

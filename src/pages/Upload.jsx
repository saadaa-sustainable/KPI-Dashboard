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
  const [state,    setState]    = useState('idle') // idle | loading | done | error
  const [progress, setProgress] = useState(0)
  const [result,   setResult]   = useState(null)
  const [error,    setError]    = useState(null)
  const inputRef = useRef(null)
  const cfg = FILE_CONFIGS[fileType]

  async function handleFile(file) {
    if (!file) return
    // Quick peek at headers to validate
    const peek = await new Promise(res => Papa.parse(file, { preview: 1, header: true, complete: res }))
    const detected = detectFileType(peek.meta.fields ?? [])
    if (detected && detected !== fileType) {
      setError(`Wrong file — detected as "${FILE_CONFIGS[detected]?.label}". Expected "${cfg.label}".`)
      setState('error')
      return
    }

    setState('loading')
    setProgress(0)
    setError(null)
    try {
      const res = await uploadCSV(file, ({ processed, total }) => {
        setProgress(Math.round(processed / total * 100))
      })
      setResult(res)
      setState('done')
      onUpload?.()
    } catch (err) {
      setError(err.message)
      setState('error')
    }
  }

  function reset() { setState('idle'); setResult(null); setError(null); setProgress(0) }

  return (
    <div
      className={`upload-zone ${state === 'done' ? 'done' : state === 'error' ? 'error' : ''}`}
      onDragOver={e => e.preventDefault()}
      onDrop={e => { e.preventDefault(); handleFile(e.dataTransfer.files[0]) }}
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
          <div className="upload-zone-title" style={{ color: 'var(--accent)' }}>Uploading... {progress}%</div>
          <div className="upload-progress">
            <div className="upload-progress-fill" style={{ width: `${progress}%` }} />
          </div>
        </>
      )}

      {state === 'done' && (
        <>
          <div className="upload-zone-title">✓ Upload complete</div>
          <div className="upload-zone-sub">{result?.total.toLocaleString()} rows processed</div>
          <button className="fbtn" style={{ marginTop: 8 }} onClick={e => { e.stopPropagation(); reset() }}>Upload again</button>
        </>
      )}

      {state === 'error' && (
        <>
          <div className="upload-zone-title">Upload failed</div>
          <div className="upload-zone-sub" style={{ color: 'var(--red)' }}>{error}</div>
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
    const { data } = await supabase
      .from('ap_upload_log')
      .select('*')
      .order('uploaded_at', { ascending: false })
      .limit(50)
    setLog(data ?? [])
    setLoading(false)
  }

  return (
    <>
      <div className="page-title">Upload CSV Data</div>
      <div className="page-sub">Upload any of the 5 supported files. Files are auto-detected — duplicates are skipped, changed rows are updated.</div>

      <NoteBox>
        Export each sheet from KPI_Dashboard.xlsx as CSV. You can upload any file independently — partial uploads are safe.
        Rows with identical data are skipped. If a row changed (e.g. Remark updated), it will be updated in the database.
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
                <tr><th>Time</th><th>File</th><th>Table</th><th>Uploaded By</th><th>Rows</th><th>Status</th></tr>
              </thead>
              <tbody>
                {log.map((r, i) => (
                  <tr key={i}>
                    <td className="mono" style={{ whiteSpace: 'nowrap', fontSize: 10 }}>{new Date(r.uploaded_at).toLocaleString('en-IN')}</td>
                    <td style={{ fontSize: 10, color: 'var(--muted)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.file_name}</td>
                    <td><Tag color="blue">{r.table_name}</Tag></td>
                    <td style={{ fontSize: 11 }}>{r.email}</td>
                    <td className="mono">{(r.rows_inserted || 0).toLocaleString()}</td>
                    <td>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span className={`status-dot ${r.status === 'success' ? 'dot-green' : 'dot-red'}`} />
                        <Tag color={r.status === 'success' ? 'green' : 'red'}>{r.status}</Tag>
                      </span>
                    </td>
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

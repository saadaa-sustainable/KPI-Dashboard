import Papa from 'papaparse'
import { supabase } from './supabase'

// ── Helpers ────────────────────────────────────────────────────────────────

function parseDate(s) {
  if (!s || String(s).trim() === '') return null
  const raw = String(s).trim()
  if (/^\d+(\.\d+)?$/.test(raw)) {
    const serial = Number(raw)
    if (serial > 20000 && serial < 80000) {
      const d = new Date(Date.UTC(1899, 11, 30) + serial * 86400000)
      if (!isNaN(d)) return d
    }
  }
  const dayFirst = raw.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})(?:\s+(.+))?$/)
  if (dayFirst) {
    const [, dd, mm, yyyy, time = ''] = dayFirst
    const year = yyyy.length === 2 ? `20${yyyy}` : yyyy
    const d = new Date(`${year}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}${time ? ` ${time}` : ''}`)
    if (!isNaN(d)) return d
  }
  const d = new Date(raw)
  if (!isNaN(d)) return d
  return null
}

function toDateStr(s) {
  const d = parseDate(s)
  return d ? d.toISOString().split('T')[0] : null
}

function toTsStr(s) {
  const d = parseDate(s)
  return d ? d.toISOString() : null
}

function toNum(s) {
  if (s === null || s === undefined || String(s).trim() === '') return null
  const n = parseFloat(String(s).replace(/,/g, ''))
  return isNaN(n) ? null : n
}

function quarterLabel(dateStr) {
  if (!dateStr) return null
  const d = new Date(dateStr)
  if (isNaN(d)) return null
  const m = d.getMonth()
  const q = m < 3 ? 4 : m < 6 ? 1 : m < 9 ? 2 : 3
  const fiscalYear = m < 3 ? d.getFullYear() : d.getFullYear() + 1
  return `${fiscalYear}Q${q}`
}

function monthLabel(dateStr) {
  if (!dateStr) return null
  const d = new Date(dateStr)
  if (isNaN(d)) return null
  return d.toLocaleString('en-IN', { month: 'short', year: 'numeric' })
}

function rowHash(obj) {
  const str = JSON.stringify(obj)
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i)
    hash |= 0
  }
  return String(Math.abs(hash))
}

// ── File type detection ────────────────────────────────────────────────────

export function detectFileType(headers) {
  const h = headers.map(x => (x || '').trim().toLowerCase())
  if (h.some(x => x.includes('your association with saadaa')) && (h.includes('remark') || h.includes('tat') || h.includes('add in busy'))) return 'tat'
  if (h.includes('action') && h.includes('name')) return 'busy_log'
  if (h.some(x => x.includes('invoice number')) && h.some(x => x.includes('po type')) && (h.includes('timestamp') || h.includes('email address'))) return 'invoice_data'
  if (h.some(x => x.includes('saving_amt')) || h.some(x => x.includes('saving amt'))) return 'cost_saved'
  return null
}

function normaliseParsedRows(rows) {
  const matrix = rows.filter(r => Array.isArray(r) && r.some(c => String(c ?? '').trim() !== ''))
  const headerIndex = matrix.findIndex(r => detectFileType(r))
  if (headerIndex === -1) {
    return { headers: matrix[0] || [], data: [], fileType: null }
  }

  const headers = matrix[headerIndex].map(h => String(h ?? '').trim())
  let fileType = detectFileType(headers)
  const data = matrix.slice(headerIndex + 1).map(row => {
    const obj = {}
    headers.forEach((h, i) => {
      if (h) obj[h] = row[i]
    })
    return obj
  })
  if (fileType === 'busy_log') {
    const action = data.map(r => String(r.Action || '').trim().toLowerCase()).find(Boolean)
    fileType = action === 'modify' ? 'modify' : action === 'add' ? 'add' : null
  }

  return { headers, data, fileType }
}

// ── Transformers ───────────────────────────────────────────────────────────

function transformTAT(row) {
  const submittedAt = toDateStr(row['Timestamp'])
  const base = {
    submitted_at: submittedAt,
    month_label:  monthLabel(submittedAt),
    quarter:      quarterLabel(submittedAt),
    email:        (row['Email address'] || '').trim() || null,
    association:  (row['Your Association with SAADAA'] || '').trim() || null,
    po_no:        (row['PO No. issued by SAADAA'] || '').trim() || null,
    vendor_code:  (row['Vendor Code'] || '').trim() || null,
    po_type:      (row['PO Type'] || '').trim() || null,
    doc_type:     (row['TYPE OF DOCUMENT`'] || row['TYPE OF DOCUMENT'] || '').trim() || null,
    invoice_no:   (row['Invoice Number'] || '').trim() || null,
    invoice_date: toDateStr(row['Invoice Date']),
    add_in_busy:  toDateStr(row['Add In Busy']),
    if_modify:    (row['If modify'] || '').trim() || null,
    tat:          toNum(row['TAT']),
    actual_tat:   toNum(row['Actual TAT']),
    added_by:     (row['Add BY'] || '').trim() || null,
    modify_by:    (row['Modify By'] || '').trim() || null,
    remark:       (row['Remark'] || '').trim() || null,
  }
  return { ...base, row_hash: rowHash(base) }
}

function transformModify(row) {
  const modifiedAt = toTsStr(row['Date & Time'])
  const base = {
    vch_no:       (row['Vch No'] || '').trim() || null,
    vch_date:     toDateStr(row['Vch Date']),
    modified_at:  modifiedAt,
    quarter:      quarterLabel(modifiedAt),
    month_label:  monthLabel(modifiedAt),
    modified_by:  (row['Name'] || '').trim() || null,
    type:         (row['Type'] || '').trim() || null,
    series:       (row['Series'] || '').trim() || null,
    account:      (row['Account'] || '').trim() || null,
    org_amt:      toNum(row['Org.Vch.Amt.']),
    final_amt:    toNum(row['Final Vch.Amt.']),
    computer_name:(row['Computer Name'] || '').trim() || null,
  }
  return { ...base, row_hash: rowHash(base) }
}

function transformAdd(row) {
  const entryDate = toTsStr(row['Date & Time'])
  const base = {
    vch_no:       (row['Vch No'] || '').trim() || null,
    vch_date:     toDateStr(row['Vch Date']),
    entry_date:   entryDate,
    quarter:      quarterLabel(entryDate),
    month_label:  monthLabel(entryDate),
    type:         (row['Type'] || '').trim() || null,
    series:       (row['Series'] || '').trim() || null,
    account:      (row['Account'] || '').trim() || null,
    debit:        toNum(row['Debit']),
    credit:       toNum(row['Credit']),
    narration:    (row['Short Narration'] || '').trim() || null,
    added_by:     (row['Name'] || '').trim() || null,
    computer_name:(row['Computer Name'] || '').trim() || null,
  }
  return { ...base, row_hash: rowHash(base) }
}

function transformInvoiceData(row) {
  const submittedAt = toTsStr(row['Timestamp'] || row['Submitted At'] || row['Date'])
  const base = {
    submitted_at: submittedAt,
    month_label:  monthLabel(submittedAt),
    quarter:      quarterLabel(submittedAt),
    email:        (row['Email address'] || row['Email'] || '').trim() || null,
    invoice_no:   (row['Invoice Number'] || '').trim() || null,
    vendor_code:  (row['Vendor Code'] || '').trim() || null,
    po_no:        (row['PO No'] || row['PO No.'] || row['PO No. issued by SAADAA'] || '').trim() || null,
    po_type:      (row['PO Type'] || '').trim() || null,
    doc_type:     (row['TYPE OF DOCUMENT`'] || row['Document Type'] || row['TYPE OF DOCUMENT'] || '').trim() || null,
    invoice_date: toDateStr(row['Invoice Date']),
    amount:       toNum(row['Amount'] || row['Invoice Amount']),
  }
  return { ...base, row_hash: rowHash(base) }
}

function transformCostSaved(row) {
  const monthStr = (row['month_label'] || row['Month'] || '').trim()
  const monthDate = monthStr ? toDateStr('01 ' + monthStr) : null
  const base = {
    month_label:     monthStr || null,
    month_date:      monthDate,
    category:        (row['category'] || row['Category'] || '').trim() || null,
    sub_category:    (row['sub_category'] || row['Sub Category'] || '').trim() || null,
    vendor:          (row['vendor'] || row['Vendor'] || '').trim() || null,
    invoice_amt:     toNum(row['invoice_amt'] || row['Invoice Amount']),
    credit_note_amt: toNum(row['credit_note_amt'] || row['Credit Note Amount']),
    saving_amt:      toNum(row['saving_amt'] || row['Saving Amount']),
    saving_pct:      toNum(row['saving_pct'] || row['Saving %']),
  }
  return { ...base, row_hash: rowHash(base) }
}

const CONFIGS = {
  tat:          { fn: transformTAT,         table: 'ap_invoice_tat',    conflict: 'invoice_no, vendor_code, submitted_at' },
  modify:       { fn: transformModify,      table: 'ap_voucher_modify', conflict: 'vch_no, account, modified_at, modified_by' },
  add:          { fn: transformAdd,         table: 'ap_voucher_add',    conflict: 'vch_no, account, entry_date' },
  invoice_data: { fn: transformInvoiceData, table: 'ap_invoice_data',   conflict: 'invoice_no, vendor_code, submitted_at' },
  cost_saved:   { fn: transformCostSaved,   table: 'ap_cost_saved',     conflict: 'month_label, category, sub_category_key, vendor_key', ignoreDuplicates: true },
}

// ── Main upload function ───────────────────────────────────────────────────

const BATCH_SIZE = 2000

export async function uploadCSV(file, onProgress) {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: false,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          const { headers, data, fileType } = normaliseParsedRows(results.data || [])

          if (!fileType) {
            return reject(new Error(
              `Could not detect file type.\nHeaders found: ${headers.slice(0,5).join(', ')}\n\nExpected one of: TAT Working, Modify, Add, Invoice Data, Cost Saved CSV.`
            ))
          }

          const cfg = CONFIGS[fileType]
          const rawRows = data
            .map(cfg.fn)
            .filter(r => r !== null && r.row_hash)

          // Deduplicate within file by conflict key to avoid "ON CONFLICT affect row twice" error
          const CONFLICT_KEYS = {
            tat:          r => `${r.invoice_no}|${r.vendor_code}|${r.submitted_at}`,
            modify:       r => `${r.vch_no}|${r.account}|${r.modified_at}|${r.modified_by}`,
            add:          r => `${r.vch_no}|${r.account}|${r.entry_date}`,
            invoice_data: r => `${r.invoice_no}|${r.vendor_code}|${r.submitted_at}`,
            cost_saved:   r => `${r.month_label}|${r.category}|${r.sub_category}|${r.vendor}`,
          }
          const keyFn = CONFLICT_KEYS[fileType]
          const seen = new Set()
          const rows = rawRows.filter(r => {
            const k = keyFn(r)
            if (seen.has(k)) return false
            seen.add(k)
            return true
          })

          const total = rows.length
          let processed = 0

          for (let i = 0; i < rows.length; i += BATCH_SIZE) {
            const batch = rows.slice(i, i + BATCH_SIZE)

            const { error } = await supabase
              .from(cfg.table)
              .upsert(batch, {
                onConflict: cfg.conflict,
                ignoreDuplicates: cfg.ignoreDuplicates ?? false,
              })

            if (error) {
              console.error('Supabase upsert error:', error)
              throw new Error(`DB error on batch ${Math.floor(i/BATCH_SIZE)+1}: ${error.message}`)
            }

            processed += batch.length
            onProgress?.({ processed, total, fileType, table: cfg.table })
          }

          // Log upload
          try {
            const { data: { user } } = await supabase.auth.getUser()
            await supabase.from('ap_upload_log').insert({
              uploaded_by:   user?.id,
              email:         user?.email,
              file_name:     file.name,
              table_name:    cfg.table,
              rows_inserted: total,
              status:        'success',
            })
          } catch (_) {}

          resolve({ fileType, table: cfg.table, total })
        } catch (err) {
          try {
            const { data: { user } } = await supabase.auth.getUser()
            await supabase.from('ap_upload_log').insert({
              uploaded_by: user?.id,
              email:       user?.email,
              file_name:   file.name,
              table_name:  'unknown',
              status:      'error',
              error_msg:   err.message,
            })
          } catch (_) {}
          reject(err)
        }
      },
      error: (err) => reject(new Error('CSV parse error: ' + err.message)),
    })
  })
}

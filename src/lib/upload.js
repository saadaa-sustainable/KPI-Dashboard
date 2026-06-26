import Papa from 'papaparse'
import { supabase } from './supabase'

// ── Helpers ────────────────────────────────────────────────────────────────

function parseDate(s) {
  if (!s || String(s).trim() === '') return null
  const d = new Date(s)
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
  const q = Math.ceil((d.getMonth() + 1) / 3)
  return `${d.getFullYear()}Q${q}`
}

function monthLabel(dateStr) {
  if (!dateStr) return null
  const d = new Date(dateStr)
  if (isNaN(d)) return null
  return d.toLocaleString('en-IN', { month: 'short', year: 'numeric' })
}

// Simple hash for change detection (not cryptographic)
function rowHash(obj) {
  return btoa(encodeURIComponent(JSON.stringify(obj))).slice(0, 64)
}

// ── File type detection by column fingerprint ──────────────────────────────

export function detectFileType(headers) {
  const h = headers.map(x => (x || '').trim().toLowerCase())
  if (h.includes('timestamp') && h.includes('your association with saadaa')) return 'tat'
  if (h.includes('action') && h.some(x => x.includes('org.vch'))) return 'modify'
  if (h.includes('action') && h.includes('name') && !h.some(x => x.includes('org.vch'))) return 'add'
  if (h.includes('invoice number') && h.includes('po type') && !h.includes('timestamp')) return 'invoice_data'
  if (h.includes('category') && (h.includes('sub_category') || h.includes('vendor')) && h.includes('saving_amt')) return 'cost_saved'
  return null
}

// ── Transformers: raw CSV row → DB row ────────────────────────────────────

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
    invoice_no:   (row['Invoice Number'] || '').trim() || null,
    vendor_code:  (row['Vendor Code'] || '').trim() || null,
    po_no:        (row['PO No'] || row['PO No.'] || '').trim() || null,
    po_type:      (row['PO Type'] || '').trim() || null,
    doc_type:     (row['TYPE OF DOCUMENT`'] || row['Document Type'] || '').trim() || null,
    invoice_date: toDateStr(row['Invoice Date']),
    amount:       toNum(row['Amount'] || row['Invoice Amount']),
    email:        (row['Email address'] || row['Email'] || '').trim() || null,
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

const TRANSFORMERS = {
  tat:          { fn: transformTAT,         table: 'ap_invoice_tat',    conflictCols: 'invoice_no, vendor_code, submitted_at' },
  modify:       { fn: transformModify,      table: 'ap_voucher_modify', conflictCols: 'vch_no, account, modified_at, modified_by' },
  add:          { fn: transformAdd,         table: 'ap_voucher_add',    conflictCols: 'vch_no, account, entry_date' },
  invoice_data: { fn: transformInvoiceData, table: 'ap_invoice_data',   conflictCols: 'invoice_no, vendor_code, submitted_at' },
  cost_saved:   { fn: transformCostSaved,   table: 'ap_cost_saved',     conflictCols: null },
}

// ── Main upload function ───────────────────────────────────────────────────

const BATCH_SIZE = 2000

export async function uploadCSV(file, onProgress) {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          const headers = results.meta.fields || []
          const fileType = detectFileType(headers)

          if (!fileType) {
            return reject(new Error('Unrecognised CSV format. Check you are uploading one of the 5 supported files.'))
          }

          const { fn, table } = TRANSFORMERS[fileType]
          const rows = results.data
            .map(fn)
            .filter(r => r !== null)

          const total = rows.length
          let inserted = 0, updated = 0, skipped = 0

          for (let i = 0; i < rows.length; i += BATCH_SIZE) {
            const batch = rows.slice(i, i + BATCH_SIZE)

            const { data, error } = await supabase
              .from(table)
              .upsert(batch, {
                onConflict: TRANSFORMERS[fileType].conflictCols,
                ignoreDuplicates: false,
              })
              .select('id')

            if (error) throw error

            // Estimate counts (Supabase upsert doesn't return granular insert/update/skip counts)
            // We'll use row_hash comparison approach below
            inserted += batch.length
            onProgress?.({ processed: Math.min(i + BATCH_SIZE, total), total, fileType, table })
          }

          // Log the upload
          const { data: { user } } = await supabase.auth.getUser()
          await supabase.from('ap_upload_log').insert({
            uploaded_by:   user?.id,
            email:         user?.email,
            file_name:     file.name,
            table_name:    table,
            rows_inserted: inserted,
            rows_updated:  updated,
            rows_skipped:  skipped,
            status:        'success',
          })

          resolve({ fileType, table, total, inserted, updated, skipped })
        } catch (err) {
          // Log failed upload
          const { data: { user } } = await supabase.auth.getUser()
          await supabase.from('ap_upload_log').insert({
            uploaded_by: user?.id,
            email:       user?.email,
            file_name:   file.name,
            table_name:  'unknown',
            status:      'error',
            error_msg:   err.message,
          }).catch(() => {})
          reject(err)
        }
      },
      error: (err) => reject(err),
    })
  })
}

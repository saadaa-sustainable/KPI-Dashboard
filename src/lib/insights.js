export const TAT_DELAY_DAYS = 5

export function normalizeVoucherKey(value) {
  const raw = String(value ?? '').trim()
  if (!raw) return ''
  if (/^\d+(\.0+)?$/.test(raw)) return String(parseInt(raw, 10))
  if (/^\d+\.\d+$/.test(raw)) return raw.replace(/0+$/, '').replace(/\.$/, '')
  return raw.toUpperCase()
}

export function voucherKeyCandidates(value) {
  const raw = String(value ?? '').trim()
  const primary = normalizeVoucherKey(raw)
  if (!primary) return []

  const candidates = [primary]
  const parts = raw.split('/').map(p => p.trim()).filter(Boolean)
  const last = parts[parts.length - 1]
  if (last && /^\d+(\.0+)?$/.test(last)) {
    const suffix = normalizeVoucherKey(last)
    if (suffix && !candidates.includes(suffix)) candidates.push(suffix)
  }

  return candidates
}

export function uniqueBy(rows, keyFn) {
  const seen = new Set()
  return rows.filter(r => {
    const key = keyFn(r)
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export function monthSort(a, b) {
  return new Date('01 ' + a) - new Date('01 ' + b)
}

export function qtrText(qtr) {
  if (qtr === 'all') return 'All Quarters'
  const match = String(qtr).match(/^(\d{4})Q([1-4])$/)
  if (!match) return String(qtr)
  const fyEnd = Number(match[1])
  const q = match[2]
  return `FY${String(fyEnd - 1).slice(-2)}-${String(fyEnd).slice(-2)} Q${q}`
}

export function fiscalQuarterLabel(value) {
  if (!value) return null
  const d = new Date(value)
  if (isNaN(d)) return null
  const month = d.getMonth()
  const quarter = month < 3 ? 4 : month < 6 ? 1 : month < 9 ? 2 : 3
  const fiscalYear = month < 3 ? d.getFullYear() : d.getFullYear() + 1
  return `${fiscalYear}Q${quarter}`
}

export function rowFiscalQuarter(row) {
  return fiscalQuarterLabel(row?.submitted_at)
    || fiscalQuarterLabel(row?.entry_date)
    || fiscalQuarterLabel(row?.modified_at)
    || fiscalQuarterLabel(row?.month_date)
    || fiscalQuarterLabel(row?.month_label ? '01 ' + row.month_label : null)
    || row?.quarter
    || null
}

function startOfDay(value) {
  if (!value) return null
  const d = new Date(value)
  if (isNaN(d)) return null
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

export function daysBetween(start, end) {
  const a = startOfDay(start)
  const b = startOfDay(end)
  if (!a || !b) return null
  return Math.round((b - a) / 86400000)
}

function addCandidate(map, key, row) {
  if (!key) return
  const rows = map.get(key) || []
  rows.push(row)
  map.set(key, rows)
}

function bestVoucherMatch(candidates, map, submittedAt = null) {
  for (const key of candidates) {
    const rows = map.get(key) || []
    if (rows.length === 0) continue
    if (!submittedAt || rows.length === 1) return rows[0]

    return [...rows].sort((a, b) => {
      const aDays = daysBetween(submittedAt, a.entry_date || a.modified_at)
      const bDays = daysBetween(submittedAt, b.entry_date || b.modified_at)
      const aScore = aDays === null ? Number.MAX_SAFE_INTEGER : aDays >= 0 ? aDays : Math.abs(aDays) + 100000
      const bScore = bDays === null ? Number.MAX_SAFE_INTEGER : bDays >= 0 ? bDays : Math.abs(bDays) + 100000
      return aScore - bScore
    })[0]
  }
  return null
}

export function buildVoucherSummary(addRows, modifyRows) {
  const addUnique = uniqueBy(addRows, r => normalizeVoucherKey(r.vch_no))
  const modifyByVoucher = new Map()
  const modifyUnique = uniqueBy(modifyRows, r => normalizeVoucherKey(r.vch_no)).map(r => ({
    ...r,
    quarter: rowFiscalQuarter(r),
  }))

  modifyUnique.forEach(r => {
    const match = {
      modified_at: r.modified_at,
      modified_by: r.modified_by || 'Not Modify',
    }
    voucherKeyCandidates(r.vch_no).forEach(key => addCandidate(modifyByVoucher, key, match))
  })

  const rows = addUnique.map(r => {
    const key = normalizeVoucherKey(r.vch_no)
    const mod = bestVoucherMatch(voucherKeyCandidates(r.vch_no), modifyByVoucher)
    return {
      vch_no: r.vch_no,
      key,
      added_by: r.added_by || 'Unknown',
      entry_date: r.entry_date,
      quarter: rowFiscalQuarter(r),
      month_label: r.month_label,
      series: r.series,
      type: r.type,
      modify_date: mod?.modified_at || null,
      modify_by: mod?.modified_by || 'Not Modify',
      is_modified: Boolean(mod),
    }
  })

  return { rows, addUnique, modifyUnique, modifyByVoucher }
}

export function buildInvoiceTatRows(invoiceRows, addRows, modifyRows) {
  const { modifyByVoucher } = buildVoucherSummary(addRows, modifyRows)
  const addByVoucher = new Map()
  const addMatches = uniqueBy(
    addRows,
    r => `${normalizeVoucherKey(r.vch_no)}|${r.entry_date || ''}|${r.added_by || ''}`
  ).map(r => ({
    vch_no: r.vch_no,
    key: normalizeVoucherKey(r.vch_no),
    added_by: r.added_by || 'Unknown',
    entry_date: r.entry_date,
    quarter: rowFiscalQuarter(r),
    month_label: r.month_label,
    series: r.series,
    type: r.type,
  }))

  addMatches.forEach(r => {
    voucherKeyCandidates(r.vch_no).forEach(key => addCandidate(addByVoucher, key, r))
  })

  return invoiceRows.map(inv => {
    const candidates = voucherKeyCandidates(inv.invoice_no)
    const key = candidates[0] || ''
    const add = bestVoucherMatch(candidates, addByVoucher, inv.submitted_at)
    const mod = bestVoucherMatch(candidates, modifyByVoucher, inv.submitted_at)
    const tat = add?.entry_date ? daysBetween(inv.submitted_at, add.entry_date) : null
    const remark = tat === null ? null : tat > TAT_DELAY_DAYS ? 'Delay' : 'On Time'

    return {
      ...inv,
      key,
      quarter: rowFiscalQuarter(inv),
      add_in_busy: add?.entry_date || null,
      if_modify: mod?.modified_at || null,
      tat,
      actual_tat: tat,
      added_by: add?.added_by || 'Not Entered',
      modify_by: mod?.modified_by || 'Not Modify',
      remark,
    }
  })
}

export function rateColor(rate) {
  if (rate > 30) return 'red'
  if (rate > 10) return 'amber'
  return 'green'
}

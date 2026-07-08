export const TAT_DELAY_DAYS = 5

export function normalizeVoucherKey(value) {
  const raw = String(value ?? '').trim()
  if (!raw) return ''
  if (/^\d+(\.0+)?$/.test(raw)) return String(parseInt(raw, 10))
  if (/^\d+\.\d+$/.test(raw)) return raw.replace(/0+$/, '').replace(/\.$/, '')
  return raw.toUpperCase()
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
  return qtr === 'all' ? 'All Quarters' : qtr.replace(/(\d{4})Q(\d)/, 'Q$2 $1')
}

export function fiscalQuarterLabel(value) {
  if (!value) return null
  const d = new Date(value)
  if (isNaN(d)) return null
  const month = d.getMonth()
  const quarter = month < 3 ? 4 : month < 6 ? 1 : month < 9 ? 2 : 3
  return `${d.getFullYear()}Q${quarter}`
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

export function buildVoucherSummary(addRows, modifyRows) {
  const addUnique = uniqueBy(addRows, r => normalizeVoucherKey(r.vch_no))
  const modifyByVoucher = new Map()
  const modifyUnique = uniqueBy(modifyRows, r => normalizeVoucherKey(r.vch_no)).map(r => ({
    ...r,
    quarter: rowFiscalQuarter(r),
  }))

  modifyUnique.forEach(r => {
    const key = normalizeVoucherKey(r.vch_no)
    if (!key) return
    modifyByVoucher.set(key, {
      modified_at: r.modified_at,
      modified_by: r.modified_by || 'Not Modify',
    })
  })

  const rows = addUnique.map(r => {
    const key = normalizeVoucherKey(r.vch_no)
    const mod = modifyByVoucher.get(key)
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
  const { rows: vouchers, modifyByVoucher } = buildVoucherSummary(addRows, modifyRows)
  const addByVoucher = new Map()

  vouchers.forEach(r => {
    if (r.key) addByVoucher.set(r.key, r)
  })

  return invoiceRows.map(inv => {
    const key = normalizeVoucherKey(inv.invoice_no)
    const add = addByVoucher.get(key)
    const mod = modifyByVoucher.get(key)
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

export async function fetchAllRows(queryFactory, pageSize = 1000) {
  const rows = []

  for (let from = 0; ; from += pageSize) {
    const to = from + pageSize - 1
    const { data, error } = await queryFactory().range(from, to)
    if (error) throw error
    const batch = data ?? []
    rows.push(...batch)
    if (batch.length < pageSize) break
  }

  return rows
}

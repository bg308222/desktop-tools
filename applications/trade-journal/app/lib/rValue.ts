/** 逐筆 R 的加總（四捨五入到兩位小數） */
export const sumR = (rs: number[]) => Math.round(rs.reduce((a, b) => a + b, 0) * 100) / 100

/** +2.5 / -1 / 0 */
export const fmtR = (r: number) => (r > 0 ? '+' : '') + String(r)

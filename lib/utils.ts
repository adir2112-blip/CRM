export function businessDaysBetween(d1: Date, d2: Date): number {
  const start = new Date(Math.min(d1.getTime(), d2.getTime()))
  const end = new Date(Math.max(d1.getTime(), d2.getTime()))
  let count = 0
  const cur = new Date(start)
  cur.setDate(cur.getDate() + 1)
  while (cur <= end) {
    const dow = cur.getDay()
    if (dow !== 5 && dow !== 6) count++
    cur.setDate(cur.getDate() + 1)
  }
  return count
}

export function isOverdue(c: any): boolean {
  if (!c) return false
  if (c.status_name === 'טופל' || c.status_name === 'טופל לאחר שיחת מנהל') return false
  // Check business days from last update until today
  return businessDaysBetween(new Date(c.updated_at), new Date()) > 2
}

export function isMgrWaitOverdue(c: any): boolean {
  if (c.status_name !== 'הועבר לשיחת מנהל' && c.status_name !== 'ממתין לשיחת מנהל') return false
  return businessDaysBetween(new Date(c.updated_at), new Date()) > 2
}

export function isMgrActiveOverdue(c: any): boolean {
  if (c.status_name !== 'בטיפול בשיחת מנהל' && c.status_name !== 'בטיפול לאחר שיחת מנהל') return false
  return businessDaysBetween(new Date(c.updated_at), new Date()) > 2
}

export function fmt(d: string | null): string {
  if (!d) return ''
  const dt = new Date(d)
  return dt.toLocaleDateString('he-IL') + ' ' + dt.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })
}

export function statusBadgeClass(s: string): string {
  const m: Record<string, string> = {
    'טופל': 'b-green',
    'בטיפול נציג': 'b-blue',
    'אין מענה': 'b-amber',
    'הועבר לשיחת מנהל': 'b-purple',
    'בטיפול בשיחת מנהל': 'b-purple',
    'טופל לאחר שיחת מנהל': 'b-teal',
  }
  return m[s] || 'b-gray'
}

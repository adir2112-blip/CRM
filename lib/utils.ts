export function businessDaysBetween(d1: Date, d2: Date): number {
  const start = new Date(d1)
  const end = new Date(d2)
  start.setHours(0, 0, 0, 0)
  end.setHours(0, 0, 0, 0)
  if (start >= end) return 0
  let count = 0
  const cur = new Date(start)
  cur.setDate(cur.getDate() + 1)
  while (cur <= end) {
    const dow = cur.getDay()
    if (dow !== 5 && dow !== 6) count++ // skip Friday(5) and Saturday(6)
    cur.setDate(cur.getDate() + 1)
  }
  return count
}

const CLOSED_STATUSES = ['טופל', 'טופל לאחר שיחת מנהל']
const MGR_WAIT_STATUSES = ['הועבר לשיחת מנהל', 'ממתין לשיחת מנהל']
const MGR_ACTIVE_STATUSES = ['בטיפול בשיחת מנהל', 'בטיפול לאחר שיחת מנהל']
const MGR_ALL_STATUSES = [...MGR_WAIT_STATUSES, ...MGR_ACTIVE_STATUSES]

export function isOverdue(c: any): boolean {
  if (!c) return false
  if (CLOSED_STATUSES.includes(c.status_name)) return false
  if (MGR_ALL_STATUSES.includes(c.status_name)) return false // handled separately
  return businessDaysBetween(new Date(c.updated_at), new Date()) >= 2
}

export function isMgrWaitOverdue(c: any): boolean {
  if (!MGR_WAIT_STATUSES.includes(c.status_name)) return false
  return businessDaysBetween(new Date(c.updated_at), new Date()) >= 2
}

export function isMgrActiveOverdue(c: any): boolean {
  if (!MGR_ACTIVE_STATUSES.includes(c.status_name)) return false
  return businessDaysBetween(new Date(c.updated_at), new Date()) >= 2
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

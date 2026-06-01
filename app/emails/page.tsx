'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useUser } from '@/lib/useUser'
import Topbar from '@/components/Topbar'

// Map department identifiers to org names
const DEPT_MAP: Record<string, string> = {
  '972523481937': 'כללית אקטיב+',
  'active@movement4life.co.il': 'כללית אקטיב+',
  'Active@movement4life.co.il': 'כללית אקטיב+',
  '972559983925': 'כללית אקטיב+',
}

export default function EmailsPage() {
  const { profile, loading } = useUser()
  const supabase = createClient()
  const [stats, setStats] = useState<any[]>([])
  const [dataLoading, setDataLoading] = useState(true)
  const [selectedDept, setSelectedDept] = useState<string | null>(null)
  const [tickets, setTickets] = useState<any[]>([])

  useEffect(() => {
    if (!profile) return
    loadStats()
  }, [profile])

  async function loadStats() {
    setDataLoading(true)
    // Get open tickets from glassix_messages grouped by department
    const { data } = await supabase
      .from('glassix_messages')
      .select('ticket_id, department, channel, created_at, ticket_status, sender_name, sender_type')
      .ilike('channel', '%mail%')
      .order('created_at', { ascending: true })

    if (!data) { setDataLoading(false); return }

    // Group by ticket_id — get unique tickets (ignore bot-only tickets)
    const ticketMap: Record<string, any> = {}
    data.forEach((m: any) => {
      if (!ticketMap[m.ticket_id]) {
        ticketMap[m.ticket_id] = {
          ticket_id: m.ticket_id,
          department: m.department || 'לא ידוע',
          channel: m.channel || 'WhatsApp',
          first_msg: m.created_at,
          status: m.ticket_status || 'Open',
          hasHuman: false
        }
      }
      // Update status if newer info
      if (m.ticket_status) ticketMap[m.ticket_id].status = m.ticket_status
      // Mark if has human agent (not bot)
      if (m.sender_type === 'Agent' && m.sender_name && m.sender_name !== 'בוט' && m.sender_name !== 'Bot' && !m.sender_name?.toLowerCase().includes('bot')) {
        ticketMap[m.ticket_id].hasHuman = true
      }
    })

    // Only show tickets that had human agent involvement OR are from client only
    const allTickets = Object.values(ticketMap)

    // Group by department
    const deptMap: Record<string, { name: string, total: number, open: number, oldest: string }> = {}
    allTickets.forEach((t: any) => {
      const deptKey = t.department || 'לא ידוע'
      const deptName = DEPT_MAP[deptKey] || deptKey
      if (!deptMap[deptName]) deptMap[deptName] = { name: deptName, total: 0, open: 0, oldest: t.first_msg }
      deptMap[deptName].total++
      if (t.status !== 'Closed' && t.status !== 'closed') deptMap[deptName].open++
      if (t.first_msg < deptMap[deptName].oldest) deptMap[deptName].oldest = t.first_msg
    })

    setStats(Object.values(deptMap).sort((a, b) => b.open - a.open))
    setDataLoading(false)
  }

  async function loadDeptTickets(dept: string) {
    setSelectedDept(dept)
    const { data } = await supabase
      .from('glassix_messages')
      .select('ticket_id, department, channel, created_at, text, sender_name, sender_type')
      .ilike('channel', '%mail%')
      .order('created_at', { ascending: true })

    if (!data) return

    const ticketMap: Record<string, any> = {}
    data.forEach((m: any) => {
      const deptName = DEPT_MAP[m.department || ''] || m.department || 'לא ידוע'
      if (deptName !== dept) return
      if (!ticketMap[m.ticket_id]) {
        ticketMap[m.ticket_id] = { ticket_id: m.ticket_id, first_msg: m.created_at, last_msg: m.created_at, subject: m.text?.slice(0,60) || '', channel: m.channel }
      }
      if (m.created_at > ticketMap[m.ticket_id].last_msg) ticketMap[m.ticket_id].last_msg = m.created_at
    })

    setTickets(Object.values(ticketMap).sort((a, b) => new Date(a.first_msg).getTime() - new Date(b.first_msg).getTime()))
  }

  function fmt(d: string) {
    return new Date(d).toLocaleString('he-IL', { timeZone:'Asia/Jerusalem', day:'2-digit', month:'2-digit', year:'2-digit', hour:'2-digit', minute:'2-digit' })
  }

  function businessDaysSince(dateStr: string): number {
    const start = new Date(dateStr)
    const end = new Date()
    start.setHours(0,0,0,0)
    end.setHours(0,0,0,0)
    if (start >= end) return 0
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

  function slaColor(days: number) {
    if (days === 0) return { bg:'#f0fdf4', color:'#16a34a', border:'#86efac' }
    if (days === 1) return { bg:'#fefce8', color:'#ca8a04', border:'#fde047' }
    if (days === 2) return { bg:'#fff7ed', color:'#ea580c', border:'#fdba74' }
    return { bg:'#fef2f2', color:'#dc2626', border:'#fca5a5' }
  }

  if (loading || !profile) return null

  return (
    <>
      <Topbar userName={profile.full_name||''} userRole={profile.role||'agent'} userEmail={profile.email||''} />
      <div style={{ padding:'22px 26px' }}>
        <div className="page-header">
          <div className="page-title">📧 מיילים ושיחות פתוחות</div>
          <button className="btn btn-xs" onClick={loadStats}>🔄 רענן</button>
        </div>

        {/* Stats table */}
        <div className="card" style={{ padding:0, marginBottom:16 }}>
          <table>
            <thead>
              <tr>
                <th>ארגון / מחלקה</th>
                <th style={{ textAlign:'center' }}>סה"כ טיקטים</th>
                <th style={{ textAlign:'center' }}>פתוחים</th>
                <th>הישן ביותר</th>
                <th>ימים פתוח</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {dataLoading ? <tr><td colSpan={6} style={{ textAlign:'center', padding:'2rem', color:'var(--text3)' }}>טוען...</td></tr>
              : stats.length === 0 ? <tr><td colSpan={6} style={{ textAlign:'center', padding:'2rem', color:'var(--text3)' }}>אין נתונים — Webhook צריך לשלוח הודעות</td></tr>
              : stats.map(s => {
                const days = businessDaysSince(s.oldest)
                const sla = slaColor(days)
                return (
                  <tr key={s.name}>
                    <td style={{ fontWeight:700 }}>{s.name}</td>
                    <td style={{ textAlign:'center' }}><span className="badge b-gray">{s.total}</span></td>
                    <td style={{ textAlign:'center' }}>
                      <span className={`badge ${s.open > 0 ? 'b-red' : 'b-green'}`}>{s.open}</span>
                    </td>
                    <td style={{ fontSize:12 }}>{fmt(s.oldest)}</td>
                    <td>
                      <span style={{ fontSize:13, fontWeight:800, padding:'3px 12px', borderRadius:999, background:sla.bg, color:sla.color, border:`1px solid ${sla.border}` }}>
                        {days === 0 ? '✅ היום' : `${days} ימים`}
                      </span>
                    </td>
                    <td>
                      <button className="btn btn-xs" onClick={() => loadDeptTickets(s.name)}>פירוט</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Detail modal */}
        {selectedDept && (
          <div className="modal-overlay" onClick={e => { if(e.target===e.currentTarget) setSelectedDept(null) }}>
            <div className="modal">
              <div className="modal-header">
                <div className="modal-title">📧 {selectedDept} — טיקטים פתוחים ({tickets.length})</div>
                <button className="close-btn" onClick={() => setSelectedDept(null)}>✕</button>
              </div>
              <div className="table-wrap">
                <table>
                  <thead><tr><th>טיקט ID</th><th>נושא</th><th>ערוץ</th><th>נפתח</th><th>עדכון אחרון</th><th>ימים</th></tr></thead>
                  <tbody>
                    {tickets.map(t => {
                      const days = businessDaysSince(t.first_msg)
                      const sla = slaColor(days)
                      return (
                        <tr key={t.ticket_id}>
                          <td className="td-muted">#{t.ticket_id}</td>
                          <td style={{ fontSize:12, maxWidth:200, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{t.subject}</td>
                          <td><span className="badge b-blue" style={{ fontSize:10 }}>{t.channel}</span></td>
                          <td style={{ fontSize:11 }}>{fmt(t.first_msg)}</td>
                          <td style={{ fontSize:11, color:'var(--text3)' }}>{fmt(t.last_msg)}</td>
                          <td>
                            <span style={{ fontSize:12, fontWeight:800, padding:'2px 10px', borderRadius:999, background:sla.bg, color:sla.color, border:`1px solid ${sla.border}` }}>
                              {days === 0 ? 'היום' : `${days} ימים`}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}

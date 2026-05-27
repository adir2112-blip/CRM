'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useUser } from '@/lib/useUser'
import Topbar from '@/components/Topbar'
import { fmt } from '@/lib/utils'

const SUPER_ADMIN = 'adir2112@gmail.com'

export default function CalendarPage() {
  const { profile, loading } = useUser()
  const supabase = createClient()
  const isAdmin = profile?.role === 'admin'
  const isSuperAdmin = profile?.email === SUPER_ADMIN

  const [reminders, setReminders] = useState<any[]>([])
  const [orgs, setOrgs] = useState<any[]>([])
  const [fOrg, setFOrg] = useState('')
  const [fAgent, setFAgent] = useState('')
  const [fFrom, setFFrom] = useState('')
  const [fTo, setFTo] = useState('')
  const [agents, setAgents] = useState<any[]>([])
  const [toast, setToast] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [newReminder, setNewReminder] = useState({ remind_at: '', note: '', customer_name: '', org_name: '' })

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(''), 2500) }

  useEffect(() => {
    if (!profile) return
    loadReminders()
    if (isAdmin) {
      supabase.from('organizations').select('*').order('name').then(({ data }) => setOrgs(data || []))
      supabase.from('profiles').select('*').eq('active', true).order('full_name').then(({ data }) => setAgents(data || []))
    }
  }, [profile])

  async function loadReminders() {
    let q = supabase.from('reminders').select('*').order('remind_at', { ascending: true })
    if (!isAdmin) q = q.eq('agent_id', profile.id)
    if (fOrg) q = q.eq('org_name', fOrg)
    if (fAgent) q = q.eq('agent_id', fAgent)
    if (fFrom) q = q.gte('remind_at', fFrom)
    if (fTo) q = q.lte('remind_at', fTo + 'T23:59:59')
    const { data } = await q
    setReminders(data || [])
  }

  async function markDone(id: string) {
    await supabase.from('reminders').update({ is_done: true }).eq('id', id)
    loadReminders()
    showToast('תזכורת סומנה כטופלה ✓')
  }

  async function deleteReminder(id: string) {
    if (!confirm('למחוק תזכורת?')) return
    await supabase.from('reminders').delete().eq('id', id)
    loadReminders()
  }

  async function addReminder() {
    if (!newReminder.remind_at || !newReminder.note) { alert('חובה: תאריך+שעה והערה'); return }
    await supabase.from('reminders').insert({
      agent_id: profile.id,
      agent_name: profile.full_name,
      customer_name: newReminder.customer_name,
      org_name: newReminder.org_name,
      remind_at: newReminder.remind_at,
      note: newReminder.note,
    })
    setNewReminder({ remind_at: '', note: '', customer_name: '', org_name: '' })
    setShowAdd(false)
    loadReminders()
    showToast('תזכורת נוספה ✓')
  }

  if (loading) return null

  const now = new Date()
  const upcoming = reminders.filter(r => !r.is_done && new Date(r.remind_at) >= now)
  const overdue = reminders.filter(r => !r.is_done && new Date(r.remind_at) < now)
  const done = reminders.filter(r => r.is_done)

  function ReminderCard({ r, showAgent }: { r: any, showAgent?: boolean }) {
    const isOver = new Date(r.remind_at) < now && !r.is_done
    return (
      <div style={{
        background: r.is_done ? '#f9fafb' : isOver ? '#fff5f5' : '#fff',
        border: `1px solid ${r.is_done ? '#e5e7eb' : isOver ? '#fca5a5' : '#dde1eb'}`,
        borderRight: isOver && !r.is_done ? '3px solid #b91c1c' : undefined,
        borderRadius: 10, padding: '12px 14px', marginBottom: 8,
        opacity: r.is_done ? 0.6 : 1,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: 13, color: r.is_done ? '#9ca3af' : '#111827' }}>
              {r.customer_name || 'תזכורת כללית'}
            </div>
            {showAgent && <div style={{ fontSize: 11, color: '#9ca3af' }}>נציג: {r.agent_name}</div>}
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <span style={{
              fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 999,
              background: isOver && !r.is_done ? '#fef2f2' : r.is_done ? '#f0fdf4' : '#eff4ff',
              color: isOver && !r.is_done ? '#b91c1c' : r.is_done ? '#15803d' : '#2563eb',
              border: `1px solid ${isOver && !r.is_done ? '#fca5a5' : r.is_done ? '#bbf7d0' : '#bfdbfe'}`
            }}>
              {fmt(r.remind_at)}
            </span>
          </div>
        </div>
        <div style={{ fontSize: 13, color: '#4b5568', marginBottom: 8 }}>{r.note}</div>
        {r.org_name && <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 8 }}>פעילות: {r.org_name}</div>}
        {!r.is_done && (
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="btn btn-xs" style={{ background: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0' }} onClick={() => markDone(r.id)}>✓ טופל</button>
            <button className="btn btn-xs btn-danger" onClick={() => deleteReminder(r.id)}>מחק</button>
          </div>
        )}
        {r.is_done && <span style={{ fontSize: 11, color: '#15803d' }}>✓ טופל</span>}
      </div>
    )
  }

  return (
    <>
      <Topbar userName={profile?.full_name || ''} userRole={profile?.role || 'agent'} userEmail={profile?.email || ''} />
      <div style={{ padding: '22px 26px' }}>
        <div className="page-header">
          <div className="page-title">📅 יומן תזכורות</div>
          <button className="btn btn-primary" onClick={() => setShowAdd(true)}>+ תזכורת חדשה</button>
        </div>

        {/* Filters — admin only */}
        {isAdmin && (
          <div className="card card-pad" style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div className="form-group" style={{ marginBottom: 0, minWidth: 160 }}>
                <label className="form-label">פעילות</label>
                <select className="form-input" value={fOrg} onChange={e => setFOrg(e.target.value)}>
                  <option value="">כל הפעילויות</option>
                  {orgs.map(o => <option key={o.id}>{o.name}</option>)}
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: 0, minWidth: 160 }}>
                <label className="form-label">נציג</label>
                <select className="form-input" value={fAgent} onChange={e => setFAgent(e.target.value)}>
                  <option value="">כל הנציגים</option>
                  {agents.map(a => <option key={a.id} value={a.id}>{a.full_name}</option>)}
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">מ</label>
                <input className="form-input" type="date" value={fFrom} onChange={e => setFFrom(e.target.value)} />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">עד</label>
                <input className="form-input" type="date" value={fTo} onChange={e => setFTo(e.target.value)} />
              </div>
              <button className="btn btn-primary btn-sm" onClick={loadReminders}>סנן</button>
              <button className="btn btn-sm" onClick={() => { setFOrg(''); setFAgent(''); setFFrom(''); setFTo(''); setTimeout(loadReminders, 50) }}>נקה</button>
            </div>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {/* Overdue */}
          <div className="card">
            <div className="card-header">
              <div className="card-title" style={{ color: '#b91c1c' }}>🔴 חריגות — עבר המועד ({overdue.length})</div>
            </div>
            <div style={{ padding: '10px 14px', maxHeight: 400, overflowY: 'auto' }}>
              {overdue.length ? overdue.map(r => <ReminderCard key={r.id} r={r} showAgent={isAdmin} />) :
                <div style={{ textAlign: 'center', padding: '2rem', color: '#9ca3af', fontSize: 13 }}>אין חריגות</div>}
            </div>
          </div>

          {/* Upcoming */}
          <div className="card">
            <div className="card-header">
              <div className="card-title" style={{ color: '#2563eb' }}>📋 קרובות ({upcoming.length})</div>
            </div>
            <div style={{ padding: '10px 14px', maxHeight: 400, overflowY: 'auto' }}>
              {upcoming.length ? upcoming.map(r => <ReminderCard key={r.id} r={r} showAgent={isAdmin} />) :
                <div style={{ textAlign: 'center', padding: '2rem', color: '#9ca3af', fontSize: 13 }}>אין תזכורות קרובות</div>}
            </div>
          </div>
        </div>

        {/* Done */}
        {done.length > 0 && (
          <div className="card" style={{ marginTop: 16 }}>
            <div className="card-header">
              <div className="card-title" style={{ color: '#15803d' }}>✓ טופלו ({done.length})</div>
            </div>
            <div style={{ padding: '10px 14px', maxHeight: 200, overflowY: 'auto' }}>
              {done.map(r => <ReminderCard key={r.id} r={r} showAgent={isAdmin} />)}
            </div>
          </div>
        )}
      </div>

      {/* Add reminder modal */}
      {showAdd && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowAdd(false) }}>
          <div className="modal modal-sm">
            <div className="modal-header">
              <div className="modal-title">+ תזכורת חדשה</div>
              <button className="close-btn" onClick={() => setShowAdd(false)}>✕</button>
            </div>
            <div className="form-group">
              <label className="form-label">שם לקוח (אופציונלי)</label>
              <input className="form-input" value={newReminder.customer_name} onChange={e => setNewReminder(p => ({ ...p, customer_name: e.target.value }))} placeholder="שם לקוח" />
            </div>
            <div className="form-group">
              <label className="form-label">פעילות (אופציונלי)</label>
              <select className="form-input" value={newReminder.org_name} onChange={e => setNewReminder(p => ({ ...p, org_name: e.target.value }))}>
                <option value="">בחר פעילות</option>
                {isAdmin ? orgs.map(o => <option key={o.id}>{o.name}</option>) : null}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">תאריך ושעה *</label>
              <input className="form-input" type="datetime-local" value={newReminder.remind_at} onChange={e => setNewReminder(p => ({ ...p, remind_at: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">הערה *</label>
              <textarea className="form-input" rows={3} value={newReminder.note} onChange={e => setNewReminder(p => ({ ...p, note: e.target.value }))} placeholder="תוכן התזכורת..." />
            </div>
            <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={addReminder}>שמור תזכורת</button>
          </div>
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}
    </>
  )
}

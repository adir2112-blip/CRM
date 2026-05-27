'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useUser } from '@/lib/useUser'
import Topbar from '@/components/Topbar'
import { fmt, statusBadgeClass, isOverdue } from '@/lib/utils'

export default function CasesPage() {
  const { profile, loading } = useUser()
  const supabase = createClient()
  const [cases, setCases] = useState<any[]>([])
  const [filtered, setFiltered] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [fStatus, setFStatus] = useState('')
  const [fOrg, setFOrg] = useState('')
  const [fFrom, setFFrom] = useState('')
  const [fTo, setFTo] = useState('')
  const [statuses, setStatuses] = useState<any[]>([])
  const [orgs, setOrgs] = useState<any[]>([])
  const [selectedCase, setSelectedCase] = useState<any>(null)
  const [logs, setLogs] = useState<any[]>([])
  const [newLog, setNewLog] = useState('')
  const [editStatus, setEditStatus] = useState('')
  const [toast, setToast] = useState('')
  const isSuperAdmin = profile?.email === 'adir2112@gmail.com'

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(''), 2500) }

  async function loadCases() {
    const { data } = await supabase.from('cases').select('*').order('updated_at', { ascending: false })
    setCases(data || [])
  }

  useEffect(() => {
    if (!profile) return
    loadCases()
    supabase.from('statuses').select('*').order('sort_order').then(({ data }) => setStatuses(data || []))
    supabase.from('organizations').select('*').order('name').then(({ data }) => setOrgs(data || []))
  }, [profile])

  useEffect(() => {
    const q = search.toLowerCase()
    setFiltered(cases.filter(c => {
      if (fStatus && c.status_name !== fStatus) return false
      if (fOrg && c.org_name !== fOrg) return false
      if (fFrom && c.created_at < fFrom) return false
      if (fTo && c.created_at > fTo + 'T23:59:59') return false
      if (q && !c.customer_name?.toLowerCase().includes(q) && !c.phone?.includes(q) && !c.id_number?.includes(q)) return false
      return true
    }))
  }, [search, fStatus, fOrg, fFrom, fTo, cases])

  async function openCase(c: any) {
    setSelectedCase(c)
    setEditStatus(c.status_name)
    const { data } = await supabase.from('case_logs').select('*').eq('case_id', c.id).order('created_at')
    setLogs(data || [])
  }

  async function saveStatus() {
    const st = statuses.find((s: any) => s.name === editStatus)
    await supabase.from('cases').update({ status_name: editStatus, status_id: st?.id, last_editor_id: profile.id, last_editor_name: profile.full_name }).eq('id', selectedCase.id)
    setSelectedCase({ ...selectedCase, status_name: editStatus })
    setCases(cases.map(c => c.id === selectedCase.id ? { ...c, status_name: editStatus } : c))
    showToast('סטטוס עודכן ✓')
  }

  async function addLog() {
    if (!newLog.trim()) return
    await supabase.from('case_logs').insert({ case_id: selectedCase.id, author_id: profile.id, author_name: profile.full_name, content: newLog })
    await supabase.from('cases').update({ last_editor_id: profile.id, last_editor_name: profile.full_name }).eq('id', selectedCase.id)
    const { data } = await supabase.from('case_logs').select('*').eq('case_id', selectedCase.id).order('created_at')
    setLogs(data || [])
    setNewLog('')
    showToast('תיעוד נוסף ✓')
  }

  async function deleteCase(id: number) {
    if (!confirm('למחוק פניה לצמיתות?')) return
    await supabase.from('reminders').delete().eq('case_id', id)
    await supabase.from('case_logs').delete().eq('case_id', id)
    await supabase.from('cases').delete().eq('id', id)
    setSelectedCase(null)
    loadCases()
    showToast('פניה נמחקה ✓')
  }

  if (loading) return null
  if (profile?.role !== 'admin') return <div style={{ padding: 40 }}>אין הרשאה</div>

  const total = cases.length
  const open = cases.filter(c => c.status_name === 'בטיפול נציג').length
  const none = cases.filter(c => c.status_name === 'אין מענה').length
  const done = cases.filter(c => c.status_name?.includes('טופל')).length

  return (
    <>
      <Topbar userName={profile?.full_name || ''} userRole={profile?.role || 'agent'} userEmail={profile?.email || ''} onOpenCase={openCase} />
      <div style={{ padding: '22px 26px' }}>
        <div className="page-header">
          <div className="page-title">כל הפניות</div>
          <a href="/new-case" className="btn btn-primary">＋ פניה חדשה</a>
        </div>

        <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(4,1fr)' }}>
          {[['📋', total, 'var(--accent)', 'סה"כ'], ['⏳', open, '#3b82f6', 'בטיפול נציג'], ['📵', none, 'var(--amber)', 'אין מענה'], ['✅', done, 'var(--green)', 'טופל']].map(([icon, num, color, lbl]) => (
            <div key={String(lbl)} className="stat-card">
              <div className="stat-icon" style={{ background: 'var(--bg4)' }}>{icon}</div>
              <div className="stat-num" style={{ color: String(color) }}>{num}</div>
              <div className="stat-lbl">{lbl}</div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          <input className="form-input" value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 שם, טלפון, ת״ז..." style={{ maxWidth: 220 }} />
          <select className="form-input" value={fStatus} onChange={e => setFStatus(e.target.value)} style={{ width: 180 }}>
            <option value="">כל הסטטוסים</option>
            {statuses.map(s => <option key={s.id}>{s.name}</option>)}
          </select>
          <select className="form-input" value={fOrg} onChange={e => setFOrg(e.target.value)} style={{ width: 170 }}>
            <option value="">כל הארגונים</option>
            {orgs.map(o => <option key={o.id}>{o.name}</option>)}
          </select>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 12, color: 'var(--text2)', whiteSpace: 'nowrap' }}>תאריך:</span>
            <input className="form-input" type="date" value={fFrom} onChange={e => setFFrom(e.target.value)} style={{ width: 140 }} />
            <span style={{ fontSize: 12, color: 'var(--text2)' }}>—</span>
            <input className="form-input" type="date" value={fTo} onChange={e => setFTo(e.target.value)} style={{ width: 140 }} />
            {(fFrom || fTo) && <button className="btn btn-xs" onClick={() => { setFFrom(''); setFTo('') }}>נקה תאריך</button>}
          </div>
          <span style={{ fontSize: 12, color: 'var(--text3)', marginRight: 'auto' }}>{filtered.length} פניות</span>
        </div>

        <div className="card" style={{ padding: 0 }}>
          <div className="table-wrap">
            <table>
              <thead><tr>
                <th>#</th><th>שם לקוח</th><th>טלפון</th><th>ת״ז</th><th>ארגון</th>
                <th>סיווג 1</th><th>סיווג 2</th><th>סיווג 3</th>
                <th>סטטוס</th><th>נציג</th><th>נוצר</th><th>עודכן</th>
              </tr></thead>
              <tbody>
                {filtered.length ? filtered.map(c => (
                  <tr key={c.id} className={isOverdue(c) ? 'overdue-row' : ''} style={{ cursor: 'pointer' }} onClick={() => openCase(c)}>
                    <td className="td-muted">#{c.id}</td>
                    <td style={{ fontWeight: 600, color: 'var(--accent)' }}>
                      {c.customer_name}
                      {isOverdue(c) && <span className="overdue-label" style={{ marginRight: 6 }}>חריגה</span>}
                    </td>
                    <td className="td-mono">{c.phone}</td>
                    <td className="td-muted">{c.id_number}</td>
                    <td><span className="badge b-gray" style={{ fontSize: 10 }}>{(c.org_name || '').split(' ')[0]}</span></td>
                    <td>{c.cat1_name || '—'}</td>
                    <td>{c.cat2_name || '—'}</td>
                    <td>{c.cat3_name || '—'}</td>
                    <td><span className={`badge ${statusBadgeClass(c.status_name)}`}>{c.status_name}</span></td>
                    <td style={{ color: 'var(--text2)' }}>{c.agent_name}</td>
                    <td className="td-muted" style={{ whiteSpace: 'nowrap' }}>{fmt(c.created_at)}</td>
                    <td className="td-muted" style={{ whiteSpace: 'nowrap' }}>{fmt(c.updated_at)}</td>
                  </tr>
                )) : (
                  <tr><td colSpan={12} style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text3)' }}>אין פניות</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Case modal */}
      {selectedCase && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setSelectedCase(null) }}>
          <div className="modal">
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div className="modal-title">פניה #{selectedCase.id} — {selectedCase.customer_name}</div>
                {isSuperAdmin && (
                  <button className="btn btn-xs btn-danger" onClick={() => deleteCase(selectedCase.id)}>🗑 מחק</button>
                )}
              </div>
              <button className="close-btn" onClick={() => setSelectedCase(null)}>✕</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
              {[['שם לקוח', selectedCase.customer_name], ['ארגון', selectedCase.org_name], ['טלפון', selectedCase.phone], ['ת״ז', selectedCase.id_number], ['סיווג 1', selectedCase.cat1_name], ['סיווג 2', selectedCase.cat2_name], ['סיווג 3', selectedCase.cat3_name], ['נציג', selectedCase.agent_name]].map(([l, v]) => v ? (
                <div key={l} style={{ background: 'var(--bg3)', borderRadius: 'var(--radius-sm)', padding: '10px 13px' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 3 }}>{l}</div>
                  <div style={{ fontSize: 13 }}>{v}</div>
                </div>
              ) : null)}
            </div>
            {selectedCase.content && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', marginBottom: 6 }}>תוכן הפניה</div>
                <div style={{ background: 'var(--bg3)', borderRadius: 'var(--radius-sm)', padding: '10px 12px', fontSize: 13, color: 'var(--text2)', lineHeight: 1.6 }}>{selectedCase.content}</div>
              </div>
            )}
            <div style={{ height: 1, background: 'var(--border)', margin: '14px 0' }} />
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 8 }}>סטטוס</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
              {statuses.map(s => {
                const colorMap: Record<string, { bg: string, activeBg: string, color: string, border: string }> = {
                  'טופל': { bg: '#f0fdf4', activeBg: '#16a34a', color: '#15803d', border: '#86efac' },
                  'טופל לאחר שיחת מנהל': { bg: '#f0fdfa', activeBg: '#0d9488', color: '#0f766e', border: '#5eead4' },
                  'בטיפול נציג': { bg: '#eff4ff', activeBg: '#2563eb', color: '#1d4ed8', border: '#bfdbfe' },
                  'בטיפול בשיחת מנהל': { bg: '#f5f3ff', activeBg: '#7c3aed', color: '#6d28d9', border: '#ddd6fe' },
                  'הועבר לשיחת מנהל': { bg: '#fdf4ff', activeBg: '#a855f7', color: '#9333ea', border: '#e9d5ff' },
                  'אין מענה': { bg: '#fffbeb', activeBg: '#d97706', color: '#b45309', border: '#fde68a' },
                }
                const style = colorMap[s.name] || { bg: '#f9fafb', activeBg: '#6b7280', color: '#374151', border: '#e5e7eb' }
                const isSelected = editStatus === s.name
                return (
                  <button key={s.id} onClick={() => setEditStatus(s.name)} style={{
                    padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: isSelected ? 700 : 500,
                    cursor: 'pointer', fontFamily: 'Heebo, sans-serif', transition: 'all 0.15s',
                    background: isSelected ? style.activeBg : style.bg,
                    color: isSelected ? '#fff' : style.color,
                    border: `1.5px solid ${isSelected ? style.activeBg : style.border}`,
                    boxShadow: isSelected ? `0 2px 6px ${style.activeBg}40` : 'none', outline: 'none',
                  }}>{s.name}</button>
                )
              })}
            </div>
            <button className="btn btn-primary btn-sm" onClick={saveStatus} style={{ marginBottom: 14 }}>עדכן סטטוס</button>
            <div style={{ height: 1, background: 'var(--border)', margin: '14px 0' }} />
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text2)', textTransform: 'uppercase', marginBottom: 10 }}>📝 תיעוד ידני</div>
            <div style={{ marginBottom: 12, maxHeight: 180, overflowY: 'auto' }}>
              {logs.length ? logs.map(l => (
                <div key={l.id} className="log-entry">
                  <div className="log-meta">{fmt(l.created_at)} — {l.author_name}</div>
                  <div className="log-text">{l.content}</div>
                </div>
              )) : <div style={{ color: 'var(--text3)', fontSize: 12, padding: '8px 0' }}>אין תיעודים</div>}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <textarea className="form-input" rows={2} value={newLog} onChange={e => setNewLog(e.target.value)} placeholder="הוסף הערה..." style={{ flex: 1 }} />
              <button className="btn btn-success btn-sm" style={{ alignSelf: 'flex-start' }} onClick={addLog}>+ הוסף</button>
            </div>
          </div>
        </div>
      )}
      {toast && <div className="toast">{toast}</div>}
    </>
  )
}

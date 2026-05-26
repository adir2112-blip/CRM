'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useUser } from '@/lib/useUser'
import Topbar from '@/components/Topbar'
import { fmt, statusBadgeClass, businessDaysBetween } from '@/lib/utils'

const SUPER_ADMIN = 'adir2112@gmail.com'

export default function AgentsStatusPage() {
  const { profile, loading } = useUser()
  const supabase = createClient()
  const [cases, setCases] = useState<any[]>([])
  const [agents, setAgents] = useState<any[]>([])
  const [selectedCase, setSelectedCase] = useState<any>(null)
  const [logs, setLogs] = useState<any[]>([])
  const [newLog, setNewLog] = useState('')
  const [editStatus, setEditStatus] = useState('')
  const [statuses, setStatuses] = useState<any[]>([])
  const [toast, setToast] = useState('')
  const [expandedAgent, setExpandedAgent] = useState<string | null>(null)

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(''), 2500) }

  useEffect(() => {
    if (!profile) return
    supabase.from('cases').select('*').order('updated_at', { ascending: false }).then(({ data }) => setCases(data || []))
    supabase.from('profiles').select('*').eq('active', true).order('full_name').then(({ data }) => setAgents(data || []))
    supabase.from('statuses').select('*').order('sort_order').then(({ data }) => setStatuses(data || []))
  }, [profile])

  function isOverdue(c: any) {
    if (!c) return false
    if (c.status_name === 'טופל' || c.status_name === 'טופל לאחר שיחת מנהל') return false
    return businessDaysBetween(new Date(c.created_at), new Date(c.updated_at)) > 2
  }

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
    const { data } = await supabase.from('cases').select('*').order('updated_at', { ascending: false })
    setCases(data || [])
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

  if (loading) return null
  if (profile?.role !== 'admin') return <div style={{ padding: 40 }}>אין הרשאה</div>

  // Build agent stats
  const agentStats = agents.map(agent => {
    const agentCases = cases.filter(c => c.agent_id === agent.id)
    const openCases = agentCases.filter(c => c.status_name !== 'טופל' && c.status_name !== 'טופל לאחר שיחת מנהל')
    const overdueCases = openCases.filter(c => isOverdue(c))
    return { ...agent, openCases, overdueCases, totalCases: agentCases.length }
  }).filter(a => a.totalCases > 0 || a.openCases.length > 0)

  return (
    <>
      <Topbar userName={profile?.full_name || ''} userRole={profile?.role || 'agent'} userEmail={profile?.email || ''} />
      <div style={{ padding: '22px 26px' }}>
        <div className="page-header">
          <div className="page-title">בטיפול נציגים</div>
        </div>

        <div className="card" style={{ padding: 0 }}>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>שם נציג</th>
                  <th style={{ textAlign: 'center' }}>סה"כ פניות</th>
                  <th style={{ textAlign: 'center' }}>פתוחות</th>
                  <th style={{ textAlign: 'center' }}>חריגות &gt;2 ימי עסקים</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {agentStats.map(agent => (
                  <>
                    <tr key={agent.id} style={{ background: agent.overdueCases.length > 0 ? '#fff5f5' : undefined }}>
                      <td style={{ fontWeight: 600 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg,#60a5fa,#a78bfa)', color: '#fff', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {agent.full_name.split(' ').map((p: string) => p[0]).join('').slice(0, 2)}
                          </div>
                          {agent.full_name}
                        </div>
                      </td>
                      <td style={{ textAlign: 'center' }}><span className="badge b-gray">{agent.totalCases}</span></td>
                      <td style={{ textAlign: 'center' }}><span className="badge b-blue">{agent.openCases.length}</span></td>
                      <td style={{ textAlign: 'center' }}>
                        {agent.overdueCases.length > 0
                          ? <span className="badge b-red" style={{ fontWeight: 700 }}>⚠ {agent.overdueCases.length}</span>
                          : <span className="badge b-green">✓ 0</span>}
                      </td>
                      <td>
                        {agent.openCases.length > 0 && (
                          <button className="btn btn-sm" onClick={() => setExpandedAgent(expandedAgent === agent.id ? null : agent.id)}>
                            {expandedAgent === agent.id ? 'סגור ▲' : 'פניות פתוחות ▼'}
                          </button>
                        )}
                      </td>
                    </tr>
                    {expandedAgent === agent.id && agent.openCases.map((c: any) => {
                      const bd = businessDaysBetween(new Date(c.created_at), new Date(c.updated_at))
                      const od = isOverdue(c)
                      return (
                        <tr key={c.id} style={{ background: od ? '#fee2e2' : '#f8f9ff', cursor: 'pointer' }} onClick={() => openCase(c)}>
                          <td style={{ paddingRight: 48 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              {od && <span className="overdue-label">⚠ {bd} ימי עסקים</span>}
                              <span style={{ fontWeight: 500 }}>{c.customer_name}</span>
                              <span className="td-muted">#{c.id}</span>
                            </div>
                          </td>
                          <td colSpan={2}>
                            <span className="badge b-gray" style={{ fontSize: 10 }}>{(c.org_name || '').split(' ')[0]}</span>
                            {c.cat1_name && <span style={{ fontSize: 11, color: 'var(--text2)', marginRight: 6 }}>{c.cat1_name}{c.cat2_name ? ' › ' + c.cat2_name : ''}</span>}
                          </td>
                          <td><span className={`badge ${statusBadgeClass(c.status_name)}`}>{c.status_name}</span></td>
                          <td><span style={{ fontSize: 11, color: 'var(--text3)' }}>{fmt(c.updated_at)}</span></td>
                        </tr>
                      )
                    })}
                  </>
                ))}
                {agentStats.length === 0 && (
                  <tr><td colSpan={5} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text3)' }}>אין נתונים</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {selectedCase && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setSelectedCase(null) }}>
          <div className="modal">
            <div className="modal-header">
              <div className="modal-title">פניה #{selectedCase.id} — {selectedCase.customer_name}</div>
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
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 6 }}>תוכן הפניה</div>
                <div style={{ background: 'var(--bg3)', borderRadius: 'var(--radius-sm)', padding: '10px 12px', fontSize: 13, color: 'var(--text2)', lineHeight: 1.6 }}>{selectedCase.content}</div>
              </div>
            )}
            <div style={{ height: 1, background: 'var(--border)', margin: '14px 0' }} />
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 8 }}>סטטוס</div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
              <select className="form-input" value={editStatus} onChange={e => setEditStatus(e.target.value)} style={{ flex: 1 }}>
                {statuses.map((s: any) => <option key={s.id}>{s.name}</option>)}
              </select>
              <button className="btn btn-primary btn-sm" onClick={saveStatus}>עדכן</button>
            </div>
            <div style={{ height: 1, background: 'var(--border)', margin: '14px 0' }} />
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 10 }}>📝 תיעוד ידני</div>
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

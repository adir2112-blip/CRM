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
  const [agentTab, setAgentTab] = useState<'details'|'sms'>('details')
  const [agentSmsTemplates, setAgentSmsTemplates] = useState<any[]>([])
  const [agentSelectedTemplate, setAgentSelectedTemplate] = useState('')
  const [agentSmsText, setAgentSmsText] = useState('')

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
    setAgentTab('details')
    setAgentSmsText('')
    setAgentSelectedTemplate('')
    const { data } = await supabase.from('case_logs').select('*').eq('case_id', c.id).order('created_at')
    setLogs(data || [])
    if (c.org_id) {
      const { data: tmpl } = await supabase.from('sms_templates').select('*').eq('org_id', c.org_id).order('name')
      setAgentSmsTemplates(tmpl || [])
    }
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
            <div className="tabs" style={{ marginBottom: 14 }}>
              <div className={`tab${agentTab==='details'?' active':''}`} onClick={() => setAgentTab('details')}>📋 פרטים</div>
              <div className={`tab${agentTab==='sms'?' active':''}`} onClick={() => setAgentTab('sms')}>💬 SMS</div>
            </div>
            {agentTab === 'details' && <>
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
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 10 }}>סטטוס</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
              {statuses.map((s: any) => {
                const cm: Record<string, any> = {
                  'טופל':                  { bg: '#dcfce7', ab: '#16a34a', c: '#15803d', b: '#86efac' },
                  'טופל לאחר שיחת מנהל': { bg: '#ccfbf1', ab: '#0f766e', c: '#0f766e', b: '#5eead4' },
                  'בטיפול נציג':           { bg: '#dbeafe', ab: '#2563eb', c: '#1d4ed8', b: '#93c5fd' },
                  'הועבר לשיחת מנהל':     { bg: '#ede9fe', ab: '#7c3aed', c: '#6d28d9', b: '#c4b5fd' },
                  'בטיפול בשיחת מנהל':    { bg: '#fae8ff', ab: '#c026d3', c: '#a21caf', b: '#e879f9' },
                  'אין מענה':              { bg: '#fef3c7', ab: '#d97706', c: '#b45309', b: '#fcd34d' },
                }
                const st = cm[s.name] || { bg: '#f3f4f6', ab: '#6b7280', c: '#374151', b: '#d1d5db' }
                const sel = editStatus === s.name
                return (
                  <button key={s.id} onClick={() => setEditStatus(s.name)} style={{
                    padding: '7px 16px', borderRadius: 8, fontSize: 12, fontWeight: sel ? 700 : 500,
                    cursor: 'pointer', fontFamily: 'Heebo, sans-serif', transition: 'all 0.15s',
                    background: sel ? st.ab : st.bg, color: sel ? '#fff' : st.c,
                    border: `1.5px solid ${sel ? st.ab : st.b}`,
                    boxShadow: sel ? `0 3px 10px ${st.ab}50` : '0 1px 2px rgba(0,0,0,0.05)', outline: 'none',
                  }}>{s.name}</button>
                )
              })}
            </div>
            <button onClick={saveStatus} style={{
              width: '100%', padding: '11px 0', borderRadius: 10, border: 'none',
              background: 'linear-gradient(135deg, #1d4ed8, #2563eb)', color: '#fff',
              fontSize: 15, fontWeight: 800, cursor: 'pointer', fontFamily: 'Heebo, sans-serif',
              marginBottom: 16, boxShadow: '0 4px 14px rgba(37,99,235,0.4)'
            }}>✓ עדכן סטטוס</button>
            <div style={{ height: 1, background: 'var(--border)', margin: '0 0 14px 0' }} />
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
            </>}
            {agentTab === 'sms' && (
              <div>
                <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 14 }}>
                  📱 שליחה ל: <strong style={{ color: 'var(--text)', direction: 'ltr', display: 'inline-block' }}>{selectedCase.phone}</strong>
                </div>
                {agentSmsTemplates.length > 0 && (
                  <div className="form-group">
                    <label className="form-label">בחר תבנית</label>
                    <select className="form-input" value={agentSelectedTemplate} onChange={e => {
                      setAgentSelectedTemplate(e.target.value)
                      const tmpl = agentSmsTemplates.find((t: any) => t.id === e.target.value)
                      if (tmpl) setAgentSmsText(tmpl.content.replace('{שם}', selectedCase.customer_name))
                    }}>
                      <option value="">בחר תבנית...</option>
                      {agentSmsTemplates.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                  </div>
                )}
                <div className="form-group">
                  <label className="form-label">תוכן ההודעה</label>
                  <textarea className="form-input" rows={4} value={agentSmsText} onChange={e => setAgentSmsText(e.target.value)} placeholder="הקלד הודעה..." />
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>{agentSmsText.length} תווים</div>
                </div>
                <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={() => {
                  const msg = encodeURIComponent(agentSmsText)
                  const phone = selectedCase.phone.replace(/\D/g, '').replace(/^0/, '972')
                  window.open(`https://wa.me/${phone}?text=${msg}`, '_blank')
                  showToast('נפתח WhatsApp ✓')
                }}>📱 שלח ב-WhatsApp</button>
              </div>
            )}
          </div>
        </div>
      )}
      {toast && <div className="toast">{toast}</div>}
    </>
  )
}

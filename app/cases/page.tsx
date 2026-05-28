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
  const [caseTab, setCaseTab] = useState<'details'|'history'|'files'|'sms'>('details')
  const [smsTemplates, setSmsTemplates] = useState<any[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState('')
  const [smsText, setSmsText] = useState('')
  const [history, setHistory] = useState<any[]>([])
  const [attachments, setAttachments] = useState<any[]>([])
  const [uploading, setUploading] = useState(false)
  const [showAddReminder, setShowAddReminder] = useState(false)
  const [newReminder, setNewReminder] = useState({ remind_at: '', note: '' })
  const [fAgent, setFAgent] = useState('')
  const [agentsList, setAgentsList] = useState<any[]>([])
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
    supabase.from('profiles').select('id,full_name').eq('active', true).order('full_name').then(({ data }) => setAgentsList(data || []))
  }, [profile])

  useEffect(() => {
    const q = search.toLowerCase()
    setFiltered(cases.filter(c => {
      if (fStatus && c.status_name !== fStatus) return false
      if (fOrg && c.org_name !== fOrg) return false
      if (fAgent && c.agent_id !== fAgent) return false
      if (fFrom && c.created_at < fFrom) return false
      if (fTo && c.created_at > fTo + 'T23:59:59') return false
      if (q && !c.customer_name?.toLowerCase().includes(q) && !c.phone?.includes(q) && !c.id_number?.includes(q)) return false
      return true
    }))
  }, [search, fStatus, fOrg, fAgent, fFrom, fTo, cases])

  async function openCase(c: any) {
    setSelectedCase(c)
    setEditStatus(c.status_name)
    setCaseTab('details')
    setSmsText('')
    setSelectedTemplate('')
    setShowAddReminder(false)
    setNewReminder({ remind_at: '', note: '' })
    const { data: logsData } = await supabase.from('case_logs').select('*').eq('case_id', c.id).order('created_at')
    setLogs(logsData || [])
    if (c.org_id) {
      const { data: tmpl } = await supabase.from('sms_templates').select('*').eq('org_id', c.org_id).order('name')
      setSmsTemplates(tmpl || [])
    }
    if (c.phone) {
      const { data: hist } = await supabase.from('cases').select('id,created_at,status_name,cat1_name,cat2_name,agent_name,org_name').neq('id', c.id).eq('phone', c.phone).order('created_at', { ascending: false }).limit(20)
      setHistory(hist || [])
    } else setHistory([])
    const { data: att } = await supabase.from('case_attachments').select('*').eq('case_id', c.id).order('created_at')
    setAttachments(att || [])
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

  async function saveReminder() {
    if (!newReminder.remind_at || !newReminder.note) { alert('חובה: תאריך+שעה והערה'); return }
    await supabase.from('reminders').insert({
      case_id: selectedCase.id, agent_id: profile.id, agent_name: profile.full_name,
      customer_name: selectedCase.customer_name, org_name: selectedCase.org_name,
      remind_at: newReminder.remind_at, note: newReminder.note,
    })
    setShowAddReminder(false)
    setNewReminder({ remind_at: '', note: '' })
    showToast('תזכורת נוספה ✓')
  }

  async function uploadFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !selectedCase) return
    setUploading(true)
    const ext = file.name.split('.').pop() || ''
    const safeName = Date.now() + '_' + file.name.replace(/[^\x00-\x7F]/g, '').replace(/[^a-zA-Z0-9._-]/g, '_') || 'file.' + ext
    const path = `${selectedCase.id}/${safeName}`
    const { error } = await supabase.storage.from('case-attachments').upload(path, file)
    if (!error) {
      await supabase.from('case_attachments').insert({ case_id: selectedCase.id, uploaded_by: profile.id, uploader_name: profile.full_name, file_name: file.name, file_size: file.size, file_type: file.type, storage_path: path })
      const { data } = await supabase.from('case_attachments').select('*').eq('case_id', selectedCase.id).order('created_at')
      setAttachments(data || [])
      showToast('קובץ הועלה ✓')
    } else showToast('שגיאה: ' + error.message)
    setUploading(false)
    e.target.value = ''
  }

  async function downloadFile(att: any) {
    const { data } = await supabase.storage.from('case-attachments').createSignedUrl(att.storage_path, 60)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
  }

  function formatBytes(b: number) { if (!b) return ''; if (b < 1024) return b + ' B'; if (b < 1048576) return (b/1024).toFixed(1)+' KB'; return (b/1048576).toFixed(1)+' MB' }

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
          <select className="form-input" value={fAgent} onChange={e => setFAgent(e.target.value)} style={{ width: 160 }}>
            <option value="">כל הנציגים</option>
            {agentsList.map(a => <option key={a.id} value={a.id}>{a.full_name}</option>)}
          </select>
          <span style={{ fontSize: 12, color: 'var(--text2)', whiteSpace: 'nowrap' }}>תאריך:</span>
          <input className="form-input" type="date" value={fFrom} onChange={e => setFFrom(e.target.value)} style={{ width: 140 }} />
          <span style={{ fontSize: 12, color: 'var(--text2)' }}>—</span>
          <input className="form-input" type="date" value={fTo} onChange={e => setFTo(e.target.value)} style={{ width: 140 }} />
          {(fFrom || fTo) && <button className="btn btn-xs" onClick={() => { setFFrom(''); setFTo('') }}>נקה תאריך</button>}
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
            <div className="tabs" style={{ marginBottom: 14 }}>
              <div className={`tab${caseTab==='details'?' active':''}`} onClick={() => setCaseTab('details')}>📋 פרטים</div>
              <div className={`tab${caseTab==='history'?' active':''}`} onClick={() => setCaseTab('history')}>
                🕐 היסטוריה {history.length > 0 && <span className="badge b-blue" style={{ fontSize: 10, marginRight: 4 }}>{history.length}</span>}
              </div>
              <div className={`tab${caseTab==='files'?' active':''}`} onClick={() => setCaseTab('files')}>
                📎 קבצים {attachments.length > 0 && <span className="badge b-gray" style={{ fontSize: 10, marginRight: 4 }}>{attachments.length}</span>}
              </div>
              <div className={`tab${caseTab==='sms'?' active':''}`} onClick={() => setCaseTab('sms')}>💬 SMS</div>
            </div>
            {caseTab === 'details' && <>
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
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 10 }}>סטטוס</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
              {statuses.map(s => {
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
              marginBottom: 16, boxShadow: '0 4px 14px rgba(37,99,235,0.4)', letterSpacing: '0.3px'
            }}>✓ עדכן סטטוס</button>
            <div style={{ height: 1, background: 'var(--border)', margin: '0 0 14px 0' }} />
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
            <div style={{ height: 1, background: 'var(--border)', margin: '14px 0' }} />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text2)', textTransform: 'uppercase' }}>🔔 תזכורת</div>
              <button className="btn btn-xs" style={{ background: '#eff4ff', color: '#2563eb', border: '1px solid #bfdbfe' }} onClick={() => setShowAddReminder(!showAddReminder)}>{showAddReminder ? 'ביטול' : '+ הוסף'}</button>
            </div>
            {showAddReminder && (
              <div style={{ background: '#eff4ff', borderRadius: 8, padding: '12px 14px', marginBottom: 10 }}>
                <div className="form-row" style={{ marginBottom: 10 }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">תאריך ושעה *</label>
                    <input className="form-input" type="datetime-local" value={newReminder.remind_at} onChange={e => setNewReminder(p => ({ ...p, remind_at: e.target.value }))} />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">הערה *</label>
                    <input className="form-input" value={newReminder.note} onChange={e => setNewReminder(p => ({ ...p, note: e.target.value }))} placeholder="לחזור ללקוח..." />
                  </div>
                </div>
                <button className="btn btn-primary btn-sm" onClick={saveReminder}>שמור תזכורת</button>
              </div>
            )}
            </>}

            {caseTab === 'history' && (
              <div>
                <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 12 }}>כל הפניות הקודמות של {selectedCase.customer_name}</div>
                {history.length === 0 ? <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text3)' }}>אין פניות קודמות</div>
                : history.map(h => (
                  <div key={h.id} style={{ background: 'var(--bg3)', borderRadius: 8, padding: '10px 14px', marginBottom: 8, cursor: 'pointer', border: '1px solid var(--border)' }} onClick={() => openCase(h)}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontWeight: 600, fontSize: 13 }}>פניה #{h.id}</span>
                      <span className={`badge ${statusBadgeClass(h.status_name)}`}>{h.status_name}</span>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text2)' }}>{h.cat1_name}{h.cat2_name?' › '+h.cat2_name:''} | {h.agent_name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 3 }}>{fmt(h.created_at)}</div>
                  </div>
                ))}
              </div>
            )}

            {caseTab === 'files' && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>קבצים ({attachments.length})</div>
                  <label style={{ cursor: 'pointer' }}>
                    <input type="file" style={{ display: 'none' }} onChange={uploadFile} accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.mp3,.mp4,.wav" />
                    <span className="btn btn-primary btn-sm">{uploading ? '⏳ מעלה...' : '+ העלה'}</span>
                  </label>
                </div>
                {attachments.length === 0
                  ? <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text3)' }}><div style={{ fontSize: 28 }}>📎</div><div style={{ fontSize: 13 }}>אין קבצים</div></div>
                  : attachments.map(att => (
                    <div key={att.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'var(--bg3)', borderRadius: 8, marginBottom: 8, border: '1px solid var(--border)' }}>
                      <span style={{ fontSize: 20 }}>{att.file_type?.startsWith('image/') ? '🖼️' : att.file_type === 'application/pdf' ? '📄' : '📎'}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{att.file_name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text3)' }}>{formatBytes(att.file_size)} · {att.uploader_name}</div>
                      </div>
                      <button className="btn btn-xs btn-primary" onClick={() => downloadFile(att)}>הורד</button>
                      {isSuperAdmin && <button className="btn btn-xs btn-danger" onClick={async () => { if(!confirm('למחוק?'))return; await supabase.storage.from('case-attachments').remove([att.storage_path]); await supabase.from('case_attachments').delete().eq('id',att.id); setAttachments(prev=>prev.filter(a=>a.id!==att.id)); showToast('נמחק ✓') }}>מחק</button>}
                    </div>
                  ))
                }
              </div>
            )}
            {caseTab === 'sms' && (
              <div>
                <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 14 }}>
                  📱 שליחה ל: <strong style={{ color: 'var(--text)', direction: 'ltr', display: 'inline-block' }}>{selectedCase.phone}</strong>
                </div>
                {smsTemplates.length > 0 && (
                  <div className="form-group">
                    <label className="form-label">בחר תבנית</label>
                    <select className="form-input" value={selectedTemplate} onChange={e => {
                      setSelectedTemplate(e.target.value)
                      const tmpl = smsTemplates.find((t: any) => t.id === e.target.value)
                      if (tmpl) setSmsText(tmpl.content.replace('{שם}', selectedCase.customer_name))
                    }}>
                      <option value="">בחר תבנית...</option>
                      {smsTemplates.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                  </div>
                )}
                {smsTemplates.length === 0 && (
                  <div style={{ padding: '10px 14px', background: 'var(--amber-lt)', borderRadius: 8, fontSize: 12, color: 'var(--amber)', marginBottom: 12 }}>
                    אין תבניות SMS לארגון זה.
                  </div>
                )}
                <div className="form-group">
                  <label className="form-label">תוכן ההודעה</label>
                  <textarea className="form-input" rows={4} value={smsText} onChange={e => setSmsText(e.target.value)} placeholder="הקלד הודעה..." />
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>{smsText.length} תווים</div>
                </div>
                <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={() => {
                  const msg = encodeURIComponent(smsText)
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

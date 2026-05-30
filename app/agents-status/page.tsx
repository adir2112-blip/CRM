'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useUser } from '@/lib/useUser'
import Topbar from '@/components/Topbar'
import { fmt, statusBadgeClass, businessDaysBetween } from '@/lib/utils'
import * as XLSX from 'xlsx'

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
  const [selectedAgent, setSelectedAgent] = useState<any>(null)
  const [orgFilter, setOrgFilter] = useState('')
  const [allAgents, setAllAgents] = useState<any[]>([])
  const [transferModal, setTransferModal] = useState<{caseId:number, currentAgent:string} | null>(null)
  const [agentTab, setAgentTab] = useState<'details'|'sms'>('details')
  const [agentSmsTemplates, setAgentSmsTemplates] = useState<any[]>([])
  const [agentSmsText, setAgentSmsText] = useState('')
  const [agentSelectedTemplate, setAgentSelectedTemplate] = useState('')

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(''), 2500) }

  useEffect(() => {
    if (!profile) return
    supabase.from('cases').select('*').order('updated_at', { ascending: false }).then(({ data }) => setCases(data || []))
    supabase.from('profiles').select('*').eq('active', true).order('full_name').then(({ data }) => { setAgents(data || []); setAllAgents(data || []) })
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

  const agentStats = agents.map(agent => {
    const agentCases = cases.filter(c => c.agent_id === agent.id)
    const openCases = agentCases.filter(c => c.status_name !== 'טופל' && c.status_name !== 'טופל לאחר שיחת מנהל')
    const overdueCases = openCases.filter(c => isOverdue(c))
    return { ...agent, openCases, overdueCases, totalCases: agentCases.length }
  })

  const CM: Record<string, any> = {
    'טופל':                  { bg:'#dcfce7',ab:'#16a34a',c:'#15803d',b:'#86efac' },
    'טופל לאחר שיחת מנהל': { bg:'#ccfbf1',ab:'#0f766e',c:'#0f766e',b:'#5eead4' },
    'בטיפול נציג':           { bg:'#dbeafe',ab:'#2563eb',c:'#1d4ed8',b:'#93c5fd' },
    'הועבר לשיחת מנהל':     { bg:'#ede9fe',ab:'#7c3aed',c:'#6d28d9',b:'#c4b5fd' },
    'בטיפול בשיחת מנהל':    { bg:'#fae8ff',ab:'#c026d3',c:'#a21caf',b:'#e879f9' },
    'אין מענה':              { bg:'#fef3c7',ab:'#d97706',c:'#b45309',b:'#fcd34d' },
  }

  return (
    <>
      <Topbar userName={profile?.full_name||''} userRole={profile?.role||'agent'} userEmail={profile?.email||''} onOpenCase={openCase} />
      <div style={{ padding:'22px 26px' }}>
        <div className="page-header">
          <div className="page-title">👥 בטיפול נציגים</div>
        </div>

        {/* Available agents table */}
        {(() => {
          const busyIds = new Set(agentStats.filter(a => a.totalCases > 0).map(a => a.id))
          const available = agents.filter(a => !busyIds.has(a.id))
          if (available.length === 0) return null
          return (
            <div className="card card-pad" style={{ marginBottom:16 }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
                <div style={{ fontSize:13, fontWeight:700, color:'#15803d' }}>✅ נציגים פנויים ({available.length})</div>
              </div>
              <div className="card" style={{ padding:0 }}>
                <table>
                  <thead><tr><th>שם נציג</th><th>אימייל</th><th>תפקיד</th></tr></thead>
                  <tbody>
                    {available.map(a => (
                      <tr key={a.id} style={{ background:'#f0fdf4' }}>
                        <td style={{ fontWeight:600 }}>
                          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                            <div style={{ width:28, height:28, borderRadius:'50%', background:'#10b981', color:'#fff', fontSize:11, fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center' }}>
                              {a.full_name.split(' ').map((p:string)=>p[0]).join('').slice(0,2)}
                            </div>
                            {a.full_name}
                          </div>
                        </td>
                        <td style={{ fontSize:12, color:'var(--text3)' }}>{a.email}</td>
                        <td><span className={`badge ${a.role==='admin'?'b-purple':'b-blue'}`}>{a.role==='admin'?'מנהל':'נציג'}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )
        })()}

        <div className="card" style={{ padding:0 }}>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>שם נציג</th>
                  <th style={{ textAlign:'center' }}>סה"כ פניות</th>
                  <th style={{ textAlign:'center' }}>פתוחות</th>
                  <th style={{ textAlign:'center' }}>חריגות &gt;2 ימים</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {agentStats.filter(a => a.totalCases > 0).map(agent => (
                  <tr key={agent.id} style={{ background: agent.overdueCases.length > 0 ? '#fff5f5' : undefined }}>
                    <td style={{ fontWeight:600 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <div style={{ width:32, height:32, borderRadius:'50%', background:'linear-gradient(135deg,#60a5fa,#a78bfa)', color:'#fff', fontSize:12, fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center' }}>
                          {agent.full_name.split(' ').map((p: string) => p[0]).join('').slice(0,2)}
                        </div>
                        {agent.full_name}
                      </div>
                    </td>
                    <td style={{ textAlign:'center' }}><span className="badge b-gray">{agent.totalCases}</span></td>
                    <td style={{ textAlign:'center' }}>
                      <span className="badge b-blue" style={{ cursor: agent.openCases.length>0?'pointer':'default' }}
                        onClick={() => agent.openCases.length > 0 && setSelectedAgent(agent)}>
                        {agent.openCases.length}
                      </span>
                    </td>
                    <td style={{ textAlign:'center' }}>
                      {agent.overdueCases.length > 0
                        ? <span className="badge b-red" style={{ fontWeight:700, cursor:'pointer' }} onClick={() => setSelectedAgent({ ...agent, showOverdueOnly: true })}>⚠ {agent.overdueCases.length}</span>
                        : <span className="badge b-green">✓ 0</span>}
                    </td>
                    <td>
                      {agent.openCases.length > 0 && (
                        <button className="btn btn-sm" onClick={() => setSelectedAgent(agent)}>
                          צפה בפניות ▼
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {agentStats.filter(a => a.totalCases > 0).length === 0 && (
                  <tr><td colSpan={5} style={{ textAlign:'center', padding:'2rem', color:'var(--text3)' }}>אין נתונים</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Agent cases modal */}
      {selectedAgent && (
        <div className="modal-overlay" onClick={e => { if(e.target===e.currentTarget) setSelectedAgent(null) }}>
          <div className="modal" style={{ maxWidth:860 }}>
            <div className="modal-header">
              <div className="modal-title">
                {selectedAgent.showOverdueOnly ? '⚠ חריגות — ' : '📋 פניות פתוחות — '}
                {selectedAgent.full_name}
              </div>
              <button className="close-btn" onClick={() => setSelectedAgent(null)}>✕</button>
            </div>
            <div style={{ maxHeight:460, overflowY:'auto' }}>
              <table>
                <thead><tr><th>#</th><th>שם לקוח</th><th>טלפון</th><th>ארגון</th><th>סיווג</th><th>סטטוס</th><th>ימי עסקים</th><th>עודכן</th><th>העבר</th></tr></thead>
                <tbody>
                  {(selectedAgent.showOverdueOnly ? selectedAgent.overdueCases : selectedAgent.openCases).map((c: any) => {
                    const bd = businessDaysBetween(new Date(c.created_at), new Date(c.updated_at))
                    const od = isOverdue(c)
                    return (
                      <tr key={c.id} style={{ background:od?'#fff5f5':undefined }}>
                        <td className="td-muted" style={{ cursor:'pointer' }} onClick={() => { setSelectedAgent(null); openCase(c) }}>#{c.id}</td>
                        <td style={{ fontWeight:600, color:'var(--accent)', cursor:'pointer' }} onClick={() => { setSelectedAgent(null); openCase(c) }}>{c.customer_name}</td>
                        <td className="td-mono">{c.phone}</td>
                        <td><span className="badge b-gray" style={{ fontSize:10 }}>{(c.org_name||'').split(' ')[0]}</span></td>
                        <td style={{ fontSize:11 }}>{c.cat1_name}{c.cat2_name?' › '+c.cat2_name:''}</td>
                        <td><span className={`badge ${statusBadgeClass(c.status_name)}`}>{c.status_name}</span></td>
                        <td>{od ? <span className="overdue-label">⚠ {bd} ימים</span> : <span style={{ fontSize:11, color:'var(--text3)' }}>{bd}</span>}</td>
                        <td className="td-muted" style={{ whiteSpace:'nowrap', fontSize:11 }}>{fmt(c.updated_at)}</td>
                        <td>
                          <button className="btn btn-xs" style={{ background:'#eff4ff', color:'#2563eb', border:'1px solid #bfdbfe' }}
                            onClick={e => { e.stopPropagation(); setTransferModal({ caseId: c.id, currentAgent: selectedAgent.full_name }) }}>
                            🔄 העבר
                          </button>
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

      {/* Transfer modal */}
      {transferModal && (
        <div className="modal-overlay" onClick={e => { if(e.target===e.currentTarget) setTransferModal(null) }}>
          <div className="modal modal-sm">
            <div className="modal-header">
              <div className="modal-title">🔄 העבר פניה לנציג אחר</div>
              <button className="close-btn" onClick={() => setTransferModal(null)}>✕</button>
            </div>
            <div style={{ fontSize:12, color:'var(--text3)', marginBottom:14 }}>נציג נוכחי: <strong>{transferModal.currentAgent}</strong></div>
            <div className="form-group">
              <label className="form-label">בחר נציג יעד</label>
              <select className="form-input" id="transfer-agent-select">
                <option value="">בחר נציג...</option>
                {allAgents.filter(a => a.full_name !== transferModal.currentAgent).map(a => (
                  <option key={a.id} value={a.id}>{a.full_name}</option>
                ))}
              </select>
            </div>
            <button className="btn btn-primary" style={{ width:'100%', justifyContent:'center' }} onClick={async () => {
              const sel = document.getElementById('transfer-agent-select') as HTMLSelectElement
              if (!sel?.value) return
              const agent = allAgents.find(a => a.id === sel.value)
              if (!agent) return
              await supabase.from('cases').update({ agent_id: agent.id, agent_name: agent.full_name }).eq('id', transferModal.caseId)
              const logMsg = `🔄 פניה הועברה מ-${transferModal.currentAgent} ל-${agent.full_name}`
              await supabase.from('case_logs').insert({ case_id: transferModal.caseId, author_id: profile.id, author_name: profile.full_name, content: logMsg })
              setTransferModal(null)
              setSelectedAgent(null)
              supabase.from('cases').select('*').order('updated_at', { ascending: false }).then(({ data }) => setCases(data || []))
              showToast('פניה הועברה ✓')
            }}>אשר העברה</button>
          </div>
        </div>
      )}

      {/* Case modal */}
      {selectedCase && (
        <div className="modal-overlay" onClick={e => { if(e.target===e.currentTarget) setSelectedCase(null) }}>
          <div className="modal">
            <div className="modal-header">
              <div className="modal-title">פניה #{selectedCase.id} — {selectedCase.customer_name}</div>
              <button className="close-btn" onClick={() => setSelectedCase(null)}>✕</button>
            </div>
            <div className="tabs" style={{ marginBottom:14 }}>
              <div className={`tab${agentTab==='details'?' active':''}`} onClick={() => setAgentTab('details')}>📋 פרטים</div>
              <div className={`tab${agentTab==='sms'?' active':''}`} onClick={() => setAgentTab('sms')}>💬 SMS</div>
            </div>
            {agentTab==='details' && <>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:14 }}>
              {[['שם לקוח',selectedCase.customer_name],['ארגון',selectedCase.org_name],['טלפון',selectedCase.phone],['ת״ז',selectedCase.id_number],['סיווג 1',selectedCase.cat1_name],['סיווג 2',selectedCase.cat2_name],['סיווג 3',selectedCase.cat3_name],['נציג',selectedCase.agent_name]].map(([l,v]) => v ? (
                <div key={l} style={{ background:'var(--bg3)', borderRadius:'var(--radius-sm)', padding:'10px 13px' }}>
                  <div style={{ fontSize:10, fontWeight:700, color:'var(--text3)', textTransform:'uppercase', marginBottom:3 }}>{l}</div>
                  <div style={{ fontSize:13 }}>{v}</div>
                </div>
              ):null)}
            </div>
            {selectedCase.content && <div style={{ marginBottom:14 }}><div style={{ fontSize:10, fontWeight:700, color:'var(--text3)', textTransform:'uppercase', marginBottom:6 }}>תוכן הפניה</div><div style={{ background:'var(--bg3)', borderRadius:'var(--radius-sm)', padding:'10px 12px', fontSize:13, color:'var(--text2)', lineHeight:1.6 }}>{selectedCase.content}</div></div>}
            <div style={{ height:1, background:'var(--border)', margin:'14px 0' }} />
            <div style={{ fontSize:11, fontWeight:700, color:'var(--text2)', textTransform:'uppercase', marginBottom:10 }}>סטטוס</div>
            <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginBottom:16 }}>
              {statuses.map((s:any) => { const st=CM[s.name]||{bg:'#f3f4f6',ab:'#6b7280',c:'#374151',b:'#d1d5db'}; const sel=editStatus===s.name; return <button key={s.id} onClick={() => setEditStatus(s.name)} style={{ padding:'7px 16px', borderRadius:8, fontSize:12, fontWeight:sel?700:500, cursor:'pointer', fontFamily:'Heebo,sans-serif', background:sel?st.ab:st.bg, color:sel?'#fff':st.c, border:`1.5px solid ${sel?st.ab:st.b}`, boxShadow:sel?`0 3px 10px ${st.ab}50`:'none', outline:'none' }}>{s.name}</button> })}
            </div>
            <button onClick={saveStatus} style={{ width:'100%', padding:'11px 0', borderRadius:10, border:'none', background:'linear-gradient(135deg,#059669,#10b981)', color:'#fff', fontSize:15, fontWeight:800, cursor:'pointer', fontFamily:'Heebo,sans-serif', marginBottom:16, boxShadow:'0 4px 14px rgba(5,150,105,0.4)' }}>✓ עדכן סטטוס</button>
            <div style={{ height:1, background:'var(--border)', margin:'0 0 14px 0' }} />
            <div style={{ fontSize:11, fontWeight:700, color:'var(--text2)', textTransform:'uppercase', marginBottom:10 }}>📝 תיעוד ידני</div>
            <div style={{ marginBottom:12, maxHeight:160, overflowY:'auto' }}>
              {logs.length ? logs.map(l => <div key={l.id} className="log-entry"><div className="log-meta">{fmt(l.created_at)} — {l.author_name}</div><div className="log-text">{l.content}</div></div>) : <div style={{ color:'var(--text3)', fontSize:12 }}>אין תיעודים</div>}
            </div>
            <div style={{ display:'flex', gap:8 }}>
              <textarea className="form-input" rows={2} value={newLog} onChange={e => setNewLog(e.target.value)} placeholder="הוסף הערה..." style={{ flex:1 }} />
              <button className="btn btn-success btn-sm" style={{ alignSelf:'flex-start' }} onClick={addLog}>+ הוסף</button>
            </div>
            </>}
            {agentTab==='sms' && <div>
              <div style={{ fontSize:12, color:'var(--text3)', marginBottom:14 }}>📱 שליחה ל: <strong style={{ color:'var(--text)', direction:'ltr', display:'inline-block' }}>{selectedCase.phone}</strong></div>
              {agentSmsTemplates.length>0 && <div className="form-group"><label className="form-label">בחר תבנית</label><select className="form-input" value={agentSelectedTemplate} onChange={e => { setAgentSelectedTemplate(e.target.value); const t=agentSmsTemplates.find((x:any)=>x.id===e.target.value); if(t) setAgentSmsText(t.content.replace('{שם}',selectedCase.customer_name)) }}><option value="">בחר...</option>{agentSmsTemplates.map((t:any) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></div>}
              <div className="form-group"><label className="form-label">תוכן</label><textarea className="form-input" rows={4} value={agentSmsText} onChange={e => setAgentSmsText(e.target.value)} placeholder="הקלד הודעה..." /></div>
              <button className="btn btn-primary" style={{ width:'100%', justifyContent:'center' }} onClick={async () => {
                if (!agentSmsText.trim()) return
                try {
                  const res = await fetch('/api/send-sms', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ to:selectedCase.phone, message:agentSmsText }) })
                  const data = await res.json()
                  if (data.success) { showToast('SMS נשלח ✓'); return }
                } catch {}
                const p = selectedCase.phone.replace(/\D/g,'').replace(/^0/,'972')
                window.open(`https://wa.me/${p}?text=${encodeURIComponent(agentSmsText)}`,'_blank')
                showToast('נפתח WhatsApp ✓')
              }}>📱 שלח SMS</button>
            </div>}
          </div>
        </div>
      )}
      {toast && <div className="toast">{toast}</div>}
    </>
  )
}

'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useUser } from '@/lib/useUser'
import Topbar from '@/components/Topbar'
import { fmt, statusBadgeClass, isOverdue } from '@/lib/utils'

function GlassixItem({ ticket: t }: { ticket: any }) {
  const [expanded, setExpanded] = useState(false)
  const [msgs, setMsgs] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const icons: Record<string,string> = { WhatsApp:'💬', Mail:'📧', Chat:'💭', SMS:'📱' }
  const colors: Record<string,string> = { Open:'#2563eb', Closed:'#16a34a', Pending:'#d97706' }
  async function toggle() {
    if (expanded) { setExpanded(false); return }
    if (msgs.length > 0) { setExpanded(true); return }
    setLoading(true)
    try { const r = await fetch(`/api/glassix-ticket?id=${t.id}`); const d = await r.json(); setMsgs(d.messages || []) } catch {}
    setLoading(false); setExpanded(true)
  }
  return (
    <div style={{ background:'var(--bg3)', borderRadius:10, padding:'12px 14px', marginBottom:10, border:'1px solid var(--border)' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', cursor:'pointer' }} onClick={toggle}>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <span style={{ fontSize:16 }}>{icons[t.channel]||'💬'}</span>
          <span style={{ fontSize:12, fontWeight:600 }}>{t.channel}</span>
          {t.assignee && <span style={{ fontSize:11, color:'var(--text3)' }}> · {t.assignee}</span>}
        </div>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          <span style={{ fontSize:11, fontWeight:600, padding:'2px 8px', borderRadius:999, background:(colors[t.status]||'#6b7280')+'18', color:colors[t.status]||'#6b7280' }}>{t.status}</span>
          <span style={{ fontSize:10, color:'var(--text3)' }}>{t.created?new Date(t.created).toLocaleDateString('he-IL'):''}</span>
          <span style={{ fontSize:12, color:'#2563eb' }}>{loading?'⏳':expanded?'▲':'▼'}</span>
        </div>
      </div>
      {t.clientIdentifier && <div style={{ fontSize:11, color:'var(--text3)', marginTop:4 }}>📞 {t.clientIdentifier}</div>}
      {expanded && (
        <div style={{ borderTop:'1px solid var(--border)', paddingTop:10, marginTop:10, maxHeight:400, overflowY:'auto', display:'flex', flexDirection:'column', gap:8 }}>
          {msgs.length===0 ? <div style={{ fontSize:11, color:'var(--text3)', textAlign:'center' }}>אין הודעות</div>
          : msgs.map((m:any) => {
            const isClient = m.type==='Client'
            return (
              <div key={m.id} style={{ display:'flex', flexDirection:'column', alignItems:isClient?'flex-start':'flex-end' }}>
                <div style={{ fontSize:10, color:'var(--text3)', marginBottom:2 }}>{isClient?'👤':'👨‍💼'} {m.sender}{m.time?` · ${m.time}`:''}</div>
                <div style={{ maxWidth:'82%', padding:'8px 12px', borderRadius:isClient?'4px 12px 12px 12px':'12px 4px 12px 12px', background:isClient?'#dbeafe':'#dcfce7', color:isClient?'#1e3a8a':'#14532d', fontSize:12, lineHeight:1.6, border:`1px solid ${isClient?'#93c5fd':'#86efac'}` }}>{m.text}</div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default function AllCasesAgentPage() {
  const { profile, loading } = useUser()
  const supabase = createClient()
  const [cases, setCases] = useState<any[]>([])
  const [filtered, setFiltered] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [fStatus, setFStatus] = useState('')
  const [fOrg, setFOrg] = useState('')
  const [fAgent, setFAgent] = useState('')
  const [fDate, setFDate] = useState('all')
  const [statuses, setStatuses] = useState<any[]>([])
  const [orgs, setOrgs] = useState<any[]>([])
  const [agents, setAgents] = useState<any[]>([])
  const [selectedCase, setSelectedCase] = useState<any>(null)
  const [logs, setLogs] = useState<any[]>([])
  const [attachments, setAttachments] = useState<any[]>([])
  const [history, setHistory] = useState<any[]>([])
  const [newLog, setNewLog] = useState('')
  const [editStatus, setEditStatus] = useState('')
  const [smsTemplates, setSmsTemplates] = useState<any[]>([])
  const [smsText, setSmsText] = useState('')
  const [selectedTemplate, setSelectedTemplate] = useState('')
  const [caseTab, setCaseTab] = useState<'details'|'history'|'files'|'sms'|'glassix'>('details')
  const [glassixTickets, setGlassixTickets] = useState<any[]>([])
  const [glassixLoading, setGlassixLoading] = useState(false)
  const [glassixTotal, setGlassixTotal] = useState(0)
  const [glassixError, setGlassixError] = useState('')
  const [toast, setToast] = useState('')

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(''), 2500) }

  useEffect(() => {
    if (!profile) return
    async function loadData() {
      const { data: myProfile } = await supabase.from('profiles').select('allowed_orgs').eq('id', profile.id).single()
      const allowedOrgs = myProfile?.allowed_orgs
      let q = supabase.from('cases').select('*').order('updated_at', { ascending: false })
      if (allowedOrgs?.length > 0) q = q.in('org_id', allowedOrgs)
      const { data } = await q
      setCases(data || [])
      const { data: allOrgs } = await supabase.from('organizations').select('*').order('name')
      setOrgs(allowedOrgs?.length > 0 ? (allOrgs || []).filter((o: any) => allowedOrgs.includes(o.id)) : (allOrgs || []))
      const { data: agentsData } = await supabase.from('profiles').select('id,full_name').eq('active', true).order('full_name')
      setAgents(agentsData || [])
    }
    loadData()
    supabase.from('statuses').select('*').order('sort_order').then(({ data }) => setStatuses(data || []))
  }, [profile])

  useEffect(() => {
    const q = search.toLowerCase()
    setFiltered(cases.filter(c => {
      if (fStatus && c.status_name !== fStatus) return false
      if (fOrg && c.org_name !== fOrg) return false
      if (fAgent && c.agent_id !== fAgent) return false
      if (fDate !== 'all') {
        const now = new Date()
        const nowDay = new Date(now.toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' }))
        const dDay = new Date(new Date(c.created_at).toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' }))
        const diff = Math.round((nowDay.getTime() - dDay.getTime()) / 864e5)
        if (fDate === 'today' && diff !== 0) return false
        if (fDate === 'yesterday' && diff !== 1) return false
        if (fDate === 'week' && diff > 7) return false
        if (fDate === 'month' && diff > 30) return false
      }
      if (q && !c.customer_name?.toLowerCase().includes(q) && !c.phone?.includes(q) && !c.id_number?.includes(q)) return false
      return true
    }))
  }, [search, fStatus, fOrg, fAgent, fDate, cases])

  async function openCase(c: any) {
    setSelectedCase(c); setEditStatus(c.status_name); setCaseTab('details')
    setSmsText(''); setSelectedTemplate(''); setGlassixTickets([]); setGlassixTotal(0); setGlassixError('')
    const [logsRes, attRes, histRes] = await Promise.all([
      supabase.from('case_logs').select('*').eq('case_id', c.id).order('created_at'),
      supabase.from('case_attachments').select('*').eq('case_id', c.id).order('created_at'),
      c.phone ? supabase.from('cases').select('id,created_at,status_name,cat1_name,cat2_name,agent_name').neq('id', c.id).eq('phone', c.phone).order('created_at', { ascending: false }).limit(20) : Promise.resolve({ data: [] })
    ])
    setLogs(logsRes.data || [])
    setAttachments(attRes.data || [])
    setHistory(histRes.data || [])
    if (c.org_id) {
      const { data: tmpl } = await supabase.from('sms_templates').select('*').eq('org_id', c.org_id).order('name')
      setSmsTemplates(tmpl || [])
    }
  }

  async function loadGlassix(c: any) {
    setGlassixLoading(true); setGlassixError('')
    try {
      const params = new URLSearchParams()
      if (c.phone) params.set('phone', c.phone)
      if (c.id_number) params.set('id_number', c.id_number)
      const res = await fetch(`/api/glassix?${params}`)
      const data = await res.json()
      if (data.error) { setGlassixError(data.error) } else { setGlassixTickets(data.tickets||[]); setGlassixTotal(data.total||0) }
    } catch { setGlassixError('שגיאה') }
    setGlassixLoading(false)
  }

  async function saveStatus() {
    const st = statuses.find(s => s.name === editStatus)
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
    setLogs(data || []); setNewLog('')
  }

  if (loading || !profile) return null

  return (
    <>
      <Topbar userName={profile.full_name||''} userRole={profile.role||'agent'} userEmail={profile.email||''} onOpenCase={openCase} />
      <div style={{ padding:'22px 26px' }}>
        <div className="page-header">
          <div className="page-title">📋 כל הפניות</div>
          <div style={{ fontSize:12, color:'var(--text3)' }}>{filtered.length} פניות</div>
        </div>

        {/* Filters */}
        <div className="card card-pad" style={{ marginBottom:16 }}>
          <div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'center' }}>
            <input className="form-input" value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 חיפוש..." style={{ width:200 }} />
            <select className="form-input" value={fStatus} onChange={e => setFStatus(e.target.value)} style={{ width:160, fontSize:12 }}>
              <option value="">כל הסטטוסים</option>
              {statuses.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
            </select>
            <select className="form-input" value={fOrg} onChange={e => setFOrg(e.target.value)} style={{ width:160, fontSize:12 }}>
              <option value="">כל הארגונים</option>
              {orgs.map(o => <option key={o.id} value={o.name}>{o.name}</option>)}
            </select>
            <select className="form-input" value={fAgent} onChange={e => setFAgent(e.target.value)} style={{ width:160, fontSize:12 }}>
              <option value="">כל הנציגים</option>
              {agents.map(a => <option key={a.id} value={a.id}>{a.full_name}</option>)}
            </select>
            <select className="form-input" value={fDate} onChange={e => setFDate(e.target.value)} style={{ width:120, fontSize:12 }}>
              {[['all','הכל'],['today','היום'],['yesterday','אתמול'],['week','שבוע'],['month','חודש']].map(([k,v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            {(fStatus||fOrg||fAgent||fDate!=='all'||search) && <button className="btn btn-xs" onClick={() => { setFStatus(''); setFOrg(''); setFAgent(''); setFDate('all'); setSearch('') }}>✕ נקה</button>}
          </div>
        </div>

        {/* Table */}
        <div className="card" style={{ padding:0 }}>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>#</th><th>שם לקוח</th><th>טלפון</th><th>ארגון</th><th>סיווג</th><th>סטטוס</th><th>נציג</th><th>עודכן</th>
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, 100).map(c => (
                  <tr key={c.id} style={{ cursor:'pointer', background:isOverdue(c)?'#fff5f5':undefined }} onClick={() => openCase(c)}>
                    <td className="td-muted">#{c.id}</td>
                    <td style={{ fontWeight:600, color:'var(--accent)' }}>{c.customer_name}</td>
                    <td className="td-mono">{c.phone}</td>
                    <td><span className="badge b-gray" style={{ fontSize:10 }}>{(c.org_name||'').split(' ')[0]}</span></td>
                    <td style={{ fontSize:12 }}>{c.cat1_name}{c.cat2_name?' › '+c.cat2_name:''}</td>
                    <td><span className={`badge ${statusBadgeClass(c.status_name)}`}>{c.status_name}</span></td>
                    <td style={{ fontSize:12, color:'var(--text2)' }}>{c.agent_name}</td>
                    <td className="td-muted" style={{ fontSize:11, whiteSpace:'nowrap' }}>{fmt(c.updated_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Case modal */}
      {selectedCase && (
        <div className="modal-overlay" onClick={e => { if(e.target===e.currentTarget) setSelectedCase(null) }}>
          <div className="modal">
            <div className="modal-header">
              <div className="modal-title">פניה #{selectedCase.id} — {selectedCase.customer_name}</div>
              <button className="close-btn" onClick={() => setSelectedCase(null)}>✕</button>
            </div>
            <div className="tabs">
              <div className={`tab${caseTab==='details'?' active':''}`} onClick={() => setCaseTab('details')}>📋 פרטים</div>
              <div className={`tab${caseTab==='history'?' active':''}`} onClick={() => setCaseTab('history')}>🕐 היסטוריה {history.length>0 && <span className="badge b-blue" style={{ fontSize:10 }}>{history.length}</span>}</div>
              <div className={`tab${caseTab==='files'?' active':''}`} onClick={() => setCaseTab('files')}>📎 קבצים {attachments.length>0 && <span className="badge b-gray" style={{ fontSize:10 }}>{attachments.length}</span>}</div>
              <div className={`tab${caseTab==='sms'?' active':''}`} onClick={() => setCaseTab('sms')}>💬 SMS</div>
              <div className={`tab${caseTab==='glassix'?' active':''}`} onClick={() => { setCaseTab('glassix'); if(!glassixTickets.length&&!glassixLoading) loadGlassix(selectedCase) }}>🟦 Glassix {glassixTotal>0 && <span className="badge b-blue" style={{ fontSize:10 }}>{glassixTotal}</span>}</div>
            </div>

            {caseTab==='details' && (
              <div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:14 }}>
                  {[['שם לקוח',selectedCase.customer_name],['ארגון',selectedCase.org_name],['טלפון',selectedCase.phone],['ת״ז',selectedCase.id_number],['סיווג 1',selectedCase.cat1_name],['סיווג 2',selectedCase.cat2_name],['נציג',selectedCase.agent_name]].map(([l,v]) => v ? (
                    <div key={l} style={{ background:'var(--bg3)', borderRadius:8, padding:'10px 13px' }}>
                      <div style={{ fontSize:10, fontWeight:700, color:'var(--text3)', textTransform:'uppercase', marginBottom:3 }}>{l}</div>
                      <div style={{ fontSize:13 }}>{v}</div>
                    </div>
                  ) : null)}
                </div>
                {selectedCase.content && <div style={{ marginBottom:14, background:'var(--bg3)', borderRadius:8, padding:'10px 12px', fontSize:13 }}>{selectedCase.content}</div>}
                <div style={{ fontSize:11, fontWeight:700, color:'var(--text2)', marginBottom:10 }}>סטטוס</div>
                <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginBottom:12 }}>
                  {statuses.map(s => (
                    <button key={s.id} onClick={() => setEditStatus(s.name)} style={{ padding:'6px 14px', borderRadius:999, border:`2px solid ${editStatus===s.name?'#2563eb':'#e5e7eb'}`, background:editStatus===s.name?'#eff4ff':'#fff', color:editStatus===s.name?'#2563eb':'#374151', fontWeight:editStatus===s.name?700:400, fontSize:12, cursor:'pointer', fontFamily:'Heebo,sans-serif' }}>{s.name}</button>
                  ))}
                </div>
                <button onClick={saveStatus} style={{ width:'100%', padding:'11px 0', borderRadius:10, border:'none', background:'linear-gradient(135deg,#059669,#10b981)', color:'#fff', fontSize:15, fontWeight:800, cursor:'pointer', fontFamily:'Heebo,sans-serif', marginBottom:14 }}>✓ עדכן סטטוס</button>
                <div style={{ fontSize:11, fontWeight:700, color:'var(--text2)', marginBottom:8 }}>📝 תיעוד</div>
                <div style={{ maxHeight:140, overflowY:'auto', marginBottom:10 }}>
                  {logs.map(l => (
                    <div key={l.id} style={{ fontSize:12, padding:'6px 0', borderBottom:'1px solid var(--border)' }}>
                      <span style={{ fontWeight:600, color:'#2563eb' }}>{l.author_name}</span> · <span style={{ color:'var(--text3)', fontSize:11 }}>{fmt(l.created_at)}</span>
                      <div style={{ marginTop:2 }}>{l.content}</div>
                    </div>
                  ))}
                </div>
                <div style={{ display:'flex', gap:8 }}>
                  <input className="form-input" value={newLog} onChange={e => setNewLog(e.target.value)} placeholder="הוסף הערה..." onKeyDown={e => e.key==='Enter' && addLog()} style={{ flex:1 }} />
                  <button className="btn btn-primary" onClick={addLog}>הוסף</button>
                </div>
              </div>
            )}

            {caseTab==='history' && (
              <div>
                {history.length===0 ? <div style={{ textAlign:'center', padding:'2rem', color:'var(--text3)' }}>אין פניות קודמות</div>
                : history.map(h => (
                  <div key={h.id} style={{ padding:'10px 0', borderBottom:'1px solid var(--border)' }}>
                    <div style={{ display:'flex', justifyContent:'space-between' }}>
                      <span style={{ fontWeight:600, fontSize:12 }}>{h.cat1_name}{h.cat2_name?' › '+h.cat2_name:''}</span>
                      <span className={`badge ${statusBadgeClass(h.status_name)}`}>{h.status_name}</span>
                    </div>
                    <div style={{ fontSize:11, color:'var(--text3)', marginTop:3 }}>{fmt(h.created_at)} · {h.agent_name}</div>
                  </div>
                ))}
              </div>
            )}

            {caseTab==='files' && (
              <div>
                {attachments.length===0 ? <div style={{ textAlign:'center', padding:'2rem', color:'var(--text3)' }}>אין קבצים</div>
                : attachments.map(a => (
                  <div key={a.id} style={{ display:'flex', justifyContent:'space-between', padding:'8px 0', borderBottom:'1px solid var(--border)' }}>
                    <span style={{ fontSize:12 }}>{a.file_name}</span>
                    <a href={a.file_url} target="_blank" rel="noreferrer" className="btn btn-xs">הורד</a>
                  </div>
                ))}
              </div>
            )}

            {caseTab==='sms' && (
              <div>
                <select className="form-input" value={selectedTemplate} onChange={e => { setSelectedTemplate(e.target.value); const t=smsTemplates.find(t=>t.name===e.target.value); if(t) setSmsText(t.content) }} style={{ marginBottom:10 }}>
                  <option value="">בחר תבנית...</option>
                  {smsTemplates.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
                </select>
                <textarea className="form-input" rows={4} value={smsText} onChange={e => setSmsText(e.target.value)} placeholder="תוכן ההודעה..." style={{ marginBottom:10 }} />
                <button className="btn btn-primary" style={{ width:'100%', justifyContent:'center' }} onClick={async () => {
                  if (!smsText || !selectedCase.phone) return
                  const res = await fetch('/api/send-sms', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ to: selectedCase.phone, message: smsText, caseId: selectedCase.id, agentName: profile.full_name }) })
                  const d = await res.json()
                  if (d.success) { showToast('SMS נשלח ✓'); setSmsText(''); setSelectedTemplate('') } else showToast('שגיאה: ' + d.error)
                }}>📱 שלח SMS</button>
              </div>
            )}

            {caseTab==='glassix' && (
              <div>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
                  <div style={{ fontSize:13, fontWeight:600 }}>🟦 Glassix {glassixTotal>0 && <span style={{ fontSize:11, color:'var(--text3)' }}>({glassixTotal})</span>}</div>
                  <button className="btn btn-xs" style={{ background:'#fef3c7', color:'#b45309', border:'1px solid #fcd34d' }} onClick={async () => { await fetch('/api/glassix-refresh',{method:'POST'}); loadGlassix(selectedCase) }}>🔄 רענן</button>
                </div>
                {glassixLoading && <div style={{ textAlign:'center', padding:'2rem', color:'var(--text3)' }}>⏳ טוען...</div>}
                {glassixError && <div style={{ padding:'10px', background:'#fef2f2', borderRadius:8, fontSize:12, color:'#b91c1c' }}>⚠️ {glassixError}</div>}
                {!glassixLoading && glassixTickets.length===0 && <div style={{ textAlign:'center', padding:'2rem', color:'var(--text3)' }}>🟦 לא נמצאו שיחות</div>}
                {glassixTickets.map(t => <GlassixItem key={t.id} ticket={t} />)}
              </div>
            )}
          </div>
        </div>
      )}
      {toast && <div className="toast">{toast}</div>}
    </>
  )
}

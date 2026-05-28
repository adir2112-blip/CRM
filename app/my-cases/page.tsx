'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useUser } from '@/lib/useUser'
import Topbar from '@/components/Topbar'
import { fmt, statusBadgeClass, isOverdue } from '@/lib/utils'

const DATE_RANGES: Record<string, string> = {
  all:'הכל', today:'היום', yesterday:'אתמול', week:'שבוע', month:'חודש', '3m':'3 חודשים', year:'שנה'
}

function dateFilter(c: any, range: string): boolean {
  if (range === 'all') return true
  const now = new Date()
  const d = new Date(c.created_at)
  const nowDay = new Date(now.toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' }))
  const dDay = new Date(d.toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' }))
  const diff = Math.round((nowDay.getTime() - dDay.getTime()) / 864e5)
  if (range === 'today') return diff === 0
  if (range === 'yesterday') return diff === 1
  if (range === 'week') return diff <= 7
  if (range === 'month') return diff <= 30
  if (range === '3m') return diff <= 90
  if (range === 'year') return diff <= 365
  return true
}

export default function MyCasesPage() {
  const { profile, loading } = useUser()
  const supabase = createClient()
  const [cases, setCases] = useState<any[]>([])
  const [filtered, setFiltered] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [fStatus, setFStatus] = useState('')
  const [fOrg, setFOrg] = useState('')
  const [fDate, setFDate] = useState('all')
  const [statuses, setStatuses] = useState<any[]>([])
  const [orgs, setOrgs] = useState<any[]>([])
  const [selectedCase, setSelectedCase] = useState<any>(null)
  const [logs, setLogs] = useState<any[]>([])
  const [newLog, setNewLog] = useState('')
  const [editStatus, setEditStatus] = useState('')
  const [smsTemplates, setSmsTemplates] = useState<any[]>([])
  const [smsText, setSmsText] = useState('')
  const [selectedTemplate, setSelectedTemplate] = useState('')
  const [caseTab, setCaseTab] = useState<'details'|'sms'>('details')
  const [toast, setToast] = useState('')

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(''), 2500) }

  useEffect(() => {
    if (!profile) return
    supabase.from('cases').select('*').eq('agent_id', profile.id).order('updated_at', { ascending: false }).then(({ data }) => setCases(data || []))
    supabase.from('statuses').select('*').order('sort_order').then(({ data }) => setStatuses(data || []))
    supabase.from('organizations').select('*').order('name').then(({ data }) => setOrgs(data || []))
  }, [profile])

  useEffect(() => {
    const q = search.toLowerCase()
    setFiltered(cases.filter(c => {
      if (fStatus && c.status_name !== fStatus) return false
      if (fOrg && c.org_name !== fOrg) return false
      if (!dateFilter(c, fDate)) return false
      if (q && !c.customer_name?.toLowerCase().includes(q) && !c.phone?.includes(q) && !c.id_number?.includes(q)) return false
      return true
    }))
  }, [search, fStatus, fOrg, fDate, cases])

  async function openCase(c: any) {
    setSelectedCase(c); setEditStatus(c.status_name); setCaseTab('details'); setSmsText(''); setSelectedTemplate('')
    const { data } = await supabase.from('case_logs').select('*').eq('case_id', c.id).order('created_at')
    setLogs(data || [])
    if (c.org_id) {
      const { data: tmpl } = await supabase.from('sms_templates').select('*').eq('org_id', c.org_id).order('name')
      setSmsTemplates(tmpl || [])
    }
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
    setLogs(data || []); setNewLog(''); showToast('תיעוד נוסף ✓')
  }

  if (loading) return null

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
          <div className="page-title">הפניות שלי בטיפול</div>
          <a href="/new-case" className="btn btn-primary">＋ פניה חדשה</a>
        </div>
        <div style={{ display:'flex', gap:8, marginBottom:16, flexWrap:'wrap', alignItems:'center' }}>
          <input className="form-input" value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 שם, טלפון, ת״ז..." style={{ maxWidth:200 }} />
          <select className="form-input" value={fStatus} onChange={e => setFStatus(e.target.value)} style={{ width:170 }}>
            <option value="">כל הסטטוסים</option>
            {statuses.map(s => <option key={s.id}>{s.name}</option>)}
          </select>
          <select className="form-input" value={fOrg} onChange={e => setFOrg(e.target.value)} style={{ width:160 }}>
            <option value="">כל הפעילויות</option>
            {orgs.map(o => <option key={o.id}>{o.name}</option>)}
          </select>
          <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
            {Object.entries(DATE_RANGES).map(([k,v]) => (
              <button key={k} onClick={() => setFDate(k)} style={{
                padding:'4px 12px', borderRadius:999, fontSize:11, fontWeight:600, cursor:'pointer',
                fontFamily:'Heebo,sans-serif', border:'none',
                background: fDate===k ? '#2563eb' : '#f1f3f8',
                color: fDate===k ? '#fff' : '#4b5568',
              }}>{v}</button>
            ))}
          </div>
          <span style={{ fontSize:12, color:'var(--text3)', marginRight:'auto' }}>{filtered.length} פניות</span>
        </div>
        <div className="card" style={{ padding:0 }}>
          <div className="table-wrap">
            <table>
              <thead><tr><th>#</th><th>שם לקוח</th><th>טלפון</th><th>ארגון</th><th>סיווג 1</th><th>סיווג 2</th><th>סטטוס</th><th>נוצר</th><th>עודכן</th></tr></thead>
              <tbody>
                {filtered.length ? filtered.map(c => (
                  <tr key={c.id} className={isOverdue(c)?'overdue-row':''} style={{ cursor:'pointer' }} onClick={() => openCase(c)}>
                    <td className="td-muted">#{c.id}</td>
                    <td style={{ fontWeight:600, color:'var(--accent)' }}>{c.customer_name}{isOverdue(c) && <span className="overdue-label" style={{ marginRight:6 }}>חריגה</span>}</td>
                    <td className="td-mono">{c.phone}</td>
                    <td><span className="badge b-gray" style={{ fontSize:10 }}>{(c.org_name||'').split(' ')[0]}</span></td>
                    <td>{c.cat1_name||'—'}</td><td>{c.cat2_name||'—'}</td>
                    <td><span className={`badge ${statusBadgeClass(c.status_name)}`}>{c.status_name}</span></td>
                    <td className="td-muted" style={{ whiteSpace:'nowrap' }}>{fmt(c.created_at)}</td>
                    <td className="td-muted" style={{ whiteSpace:'nowrap' }}>{fmt(c.updated_at)}</td>
                  </tr>
                )) : <tr><td colSpan={9} style={{ textAlign:'center', padding:'2rem', color:'var(--text3)' }}>אין פניות</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {selectedCase && (
        <div className="modal-overlay" onClick={e => { if(e.target===e.currentTarget) setSelectedCase(null) }}>
          <div className="modal">
            <div className="modal-header">
              <div className="modal-title">פניה #{selectedCase.id} — {selectedCase.customer_name}</div>
              <button className="close-btn" onClick={() => setSelectedCase(null)}>✕</button>
            </div>
            <div className="tabs" style={{ marginBottom:14 }}>
              <div className={`tab${caseTab==='details'?' active':''}`} onClick={() => setCaseTab('details')}>📋 פרטים</div>
              <div className={`tab${caseTab==='sms'?' active':''}`} onClick={() => setCaseTab('sms')}>💬 SMS</div>
            </div>
            {caseTab==='details' && <>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:14 }}>
              {[['שם לקוח',selectedCase.customer_name],['ארגון',selectedCase.org_name],['טלפון',selectedCase.phone],['ת״ז',selectedCase.id_number],['סיווג 1',selectedCase.cat1_name],['סיווג 2',selectedCase.cat2_name],['סיווג 3',selectedCase.cat3_name],['נציג',selectedCase.agent_name]].map(([l,v]) => v ? (
                <div key={l} style={{ background:'var(--bg3)', borderRadius:'var(--radius-sm)', padding:'10px 13px' }}>
                  <div style={{ fontSize:10, fontWeight:700, color:'var(--text3)', textTransform:'uppercase', marginBottom:3 }}>{l}</div>
                  <div style={{ fontSize:13 }}>{v}</div>
                </div>
              ):null)}
            </div>
            {selectedCase.content && <div style={{ marginBottom:14 }}>
              <div style={{ fontSize:10, fontWeight:700, color:'var(--text3)', textTransform:'uppercase', marginBottom:6 }}>תוכן הפניה</div>
              <div style={{ background:'var(--bg3)', borderRadius:'var(--radius-sm)', padding:'10px 12px', fontSize:13, color:'var(--text2)', lineHeight:1.6 }}>{selectedCase.content}</div>
            </div>}
            <div style={{ height:1, background:'var(--border)', margin:'14px 0' }} />
            <div style={{ fontSize:11, fontWeight:700, color:'var(--text2)', textTransform:'uppercase', marginBottom:10 }}>סטטוס</div>
            <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginBottom:16 }}>
              {statuses.map(s => {
                const st = CM[s.name]||{bg:'#f3f4f6',ab:'#6b7280',c:'#374151',b:'#d1d5db'}
                const sel = editStatus===s.name
                return <button key={s.id} onClick={() => setEditStatus(s.name)} style={{ padding:'7px 16px', borderRadius:8, fontSize:12, fontWeight:sel?700:500, cursor:'pointer', fontFamily:'Heebo,sans-serif', transition:'all 0.15s', background:sel?st.ab:st.bg, color:sel?'#fff':st.c, border:`1.5px solid ${sel?st.ab:st.b}`, boxShadow:sel?`0 3px 10px ${st.ab}50`:'0 1px 2px rgba(0,0,0,0.05)', outline:'none' }}>{s.name}</button>
              })}
            </div>
            <button onClick={saveStatus} style={{ width:'100%', padding:'11px 0', borderRadius:10, border:'none', background:'linear-gradient(135deg,#1d4ed8,#2563eb)', color:'#fff', fontSize:15, fontWeight:800, cursor:'pointer', fontFamily:'Heebo,sans-serif', marginBottom:16, boxShadow:'0 4px 14px rgba(37,99,235,0.4)' }}>✓ עדכן סטטוס</button>
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
            {caseTab==='sms' && <div>
              <div style={{ fontSize:12, color:'var(--text3)', marginBottom:14 }}>📱 שליחה ל: <strong style={{ color:'var(--text)', direction:'ltr', display:'inline-block' }}>{selectedCase.phone}</strong></div>
              {smsTemplates.length>0 && <div className="form-group"><label className="form-label">בחר תבנית</label>
                <select className="form-input" value={selectedTemplate} onChange={e => { setSelectedTemplate(e.target.value); const t=smsTemplates.find((x:any)=>x.id===e.target.value); if(t) setSmsText(t.content.replace('{שם}',selectedCase.customer_name)) }}>
                  <option value="">בחר תבנית...</option>
                  {smsTemplates.map((t:any) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>}
              <div className="form-group"><label className="form-label">תוכן ההודעה</label>
                <textarea className="form-input" rows={4} value={smsText} onChange={e => setSmsText(e.target.value)} placeholder="הקלד הודעה..." />
                <div style={{ fontSize:11, color:'var(--text3)', marginTop:4 }}>{smsText.length} תווים</div>
              </div>
              <button className="btn btn-primary" style={{ width:'100%', justifyContent:'center' }} onClick={() => { const p=selectedCase.phone.replace(/\D/g,'').replace(/^0/,'972'); window.open(`https://wa.me/${p}?text=${encodeURIComponent(smsText)}`,'_blank'); showToast('נפתח WhatsApp ✓') }}>📱 שלח ב-WhatsApp</button>
            </div>}
          </div>
        </div>
      )}
      {toast && <div className="toast">{toast}</div>}
    </>
  )
}

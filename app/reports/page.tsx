'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useUser } from '@/lib/useUser'
import Topbar from '@/components/Topbar'
import { fmt, statusBadgeClass } from '@/lib/utils'
import * as XLSX from 'xlsx'

type SortDir = 'asc' | 'desc'

export default function ReportsPage() {
  const { profile, loading } = useUser()
  const supabase = createClient()
  const [cases, setCases] = useState<any[]>([])
  const [statuses, setStatuses] = useState<any[]>([])
  const [orgs, setOrgs] = useState<any[]>([])
  const [cat1s, setCat1s] = useState<string[]>([])
  const [cat2s, setCat2s] = useState<string[]>([])
  const [cat3s, setCat3s] = useState<string[]>([])
  const [selectedCase, setSelectedCase] = useState<any>(null)
  const [logs, setLogs] = useState<any[]>([])
  const [newLog, setNewLog] = useState('')
  const [editStatus, setEditStatus] = useState('')
  const [toast, setToast] = useState('')
  const [sortCol, setSortCol] = useState('created_at')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const now = new Date()
  const [from, setFrom] = useState(new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0])
  const [to, setTo] = useState(new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0])
  const [fOrg, setFOrg] = useState('')
  const [fStatus, setFStatus] = useState('')
  const [fCat1, setFCat1] = useState('')
  const [fCat2, setFCat2] = useState('')
  const [fCat3, setFCat3] = useState('')

  const [fAgent, setFAgent] = useState('')
  const [agents, setAgents] = useState<any[]>([])

  const [caseTab, setCaseTab] = useState<'details'|'history'|'files'|'sms'|'reminder'>('details')
  const [history, setHistory] = useState<any[]>([])
  const [attachments, setAttachments] = useState<any[]>([])
  const [smsTemplates, setSmsTemplates] = useState<any[]>([])
  const [smsText, setSmsText] = useState('')
  const [selectedTemplate, setSelectedTemplate] = useState('')
  const [uploading, setUploading] = useState(false)
  const [showAddReminder, setShowAddReminder] = useState(false)
  const [newReminder, setNewReminder] = useState({ remind_at: '', note: '' })

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(''), 2500) }

  useEffect(() => {
    if (!profile) return
    supabase.from('statuses').select('*').order('sort_order').then(({ data }) => setStatuses(data || []))
    supabase.from('organizations').select('*').order('name').then(({ data }) => setOrgs(data || []))
    supabase.from('profiles').select('id, full_name').eq('active', true).order('full_name').then(({ data }) => setAgents(data || []))
    loadReport()
  }, [profile])

  async function loadReport() {
    // Get allowed orgs for agent
    const { data: myProfile } = await supabase.from('profiles').select('allowed_orgs, role').eq('id', profile.id).single()
    const allowedOrgs = myProfile?.role === 'agent' && myProfile?.allowed_orgs?.length > 0 ? myProfile.allowed_orgs : null

    let q = supabase.from('cases').select('*').gte('created_at', from).lte('created_at', to + 'T23:59:59')
    if (allowedOrgs) q = q.in('org_id', allowedOrgs)
    if (fOrg) q = q.eq('org_name', fOrg)
    if (fStatus) q = q.eq('status_name', fStatus)
    if (fCat1) q = q.eq('cat1_name', fCat1)
    if (fCat2) q = q.eq('cat2_name', fCat2)
    if (fCat3) q = q.eq('cat3_name', fCat3)
    if (fAgent) q = q.eq('agent_id', fAgent)
    const { data } = await q.order('created_at', { ascending: false })
    const d = data || []

    // Also filter org dropdown by allowed orgs
    if (allowedOrgs) {
      const { data: allowedOrgData } = await supabase.from('organizations').select('*').in('id', allowedOrgs).order('name')
      setOrgs(allowedOrgData || [])
    }

    setCases(d)
    setCat1s(Array.from(new Set(d.map((c: any) => c.cat1_name).filter(Boolean))))
    setCat2s(Array.from(new Set(d.map((c: any) => c.cat2_name).filter(Boolean))))
    setCat3s(Array.from(new Set(d.map((c: any) => c.cat3_name).filter(Boolean))))
  }

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
    if (c.phone) {
      const { data: hist } = await supabase.from('cases').select('id,created_at,status_name,cat1_name,cat2_name,agent_name,org_name').neq('id', c.id).eq('phone', c.phone).order('created_at', { ascending: false }).limit(20)
      setHistory(hist || [])
    } else setHistory([])
    const { data: att } = await supabase.from('case_attachments').select('*').eq('case_id', c.id).order('created_at')
    setAttachments(att || [])
    if (c.org_id) {
      const { data: tmpl } = await supabase.from('sms_templates').select('*').eq('org_id', c.org_id).order('name')
      setSmsTemplates(tmpl || [])
    } else setSmsTemplates([])
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

  function toggleSort(col: string) {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('asc') }
  }

  function SortIcon({ col }: { col: string }) {
    if (sortCol !== col) return <span style={{ color: '#9ca3af', fontSize: 10 }}>↕</span>
    return <span style={{ color: 'var(--accent)', fontSize: 10 }}>{sortDir === 'asc' ? '↑' : '↓'}</span>
  }

  const sortedCases = [...cases].sort((a, b) => {
    const av = a[sortCol] ?? ''
    const bv = b[sortCol] ?? ''
    const cmp = av < bv ? -1 : av > bv ? 1 : 0
    return sortDir === 'asc' ? cmp : -cmp
  })

  function exportExcel() {
    const rows = sortedCases.map(c => ({
      'מספר פניה': c.id, 'תאריך יצירה': fmt(c.created_at), 'תאריך עדכון': fmt(c.updated_at),
      'שם לקוח': c.customer_name, 'סטטוס': c.status_name, 'ת"ז': c.id_number, 'טלפון': c.phone,
      'סיווג 1': c.cat1_name, 'סיווג 2': c.cat2_name, 'סיווג 3': c.cat3_name,
      'ספק': c.supplier_name, 'הטבה': c.benefit_name, 'תוכן': c.content,
      'ארגון': c.org_name, 'נציג': c.agent_name,
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'דוח פניות')
    XLSX.writeFile(wb, `crm_report_${new Date().toISOString().split('T')[0]}.xlsx`)
  }

  async function saveReminder() {
    if (!newReminder.remind_at || !newReminder.note) { alert('חובה: תאריך+שעה והערה'); return }
    await supabase.from('reminders').insert({ case_id: selectedCase.id, agent_id: profile.id, agent_name: profile.full_name, customer_name: selectedCase.customer_name, org_name: selectedCase.org_name, remind_at: newReminder.remind_at, note: newReminder.note })
    setShowAddReminder(false); setNewReminder({ remind_at: '', note: '' }); showToast('תזכורת נוספה ✓')
  }

  async function uploadFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !selectedCase) return
    setUploading(true)
    const safeName = Date.now() + '_' + file.name.replace(/[^\x00-\x7F]/g, '').replace(/[^a-zA-Z0-9._-]/g, '_')
    const path = `${selectedCase.id}/${safeName}`
    const { error } = await supabase.storage.from('case-attachments').upload(path, file)
    if (!error) {
      await supabase.from('case_attachments').insert({ case_id: selectedCase.id, uploaded_by: profile.id, uploader_name: profile.full_name, file_name: file.name, file_size: file.size, file_type: file.type, storage_path: path })
      const { data } = await supabase.from('case_attachments').select('*').eq('case_id', selectedCase.id).order('created_at')
      setAttachments(data || []); showToast('קובץ הועלה ✓')
    }
    setUploading(false); e.target.value = ''
  }

  async function downloadFile(att: any) {
    const { data } = await supabase.storage.from('case-attachments').createSignedUrl(att.storage_path, 60)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
  }

  function formatBytes(b: number) { if (!b) return ''; if (b < 1024) return b + ' B'; if (b < 1048576) return (b/1024).toFixed(1)+' KB'; return (b/1048576).toFixed(1)+' MB' }
  if (profile?.role !== 'admin') return <div style={{ padding: 40 }}>אין הרשאה</div>

  const thStyle = (col: string): React.CSSProperties => ({
    cursor: 'pointer', userSelect: 'none',
    background: sortCol === col ? 'var(--accent-lt)' : undefined
  })

  return (
    <>
      <Topbar userName={profile?.full_name || ''} userRole={profile?.role || 'agent'} userEmail={profile?.email || ''} onOpenCase={openCase} />
      <div style={{ padding: '22px 26px' }}>
        <div className="page-header"><div className="page-title">דוחות</div></div>
        <div className="card card-pad" style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 14 }}>סינון דוח</div>
          <div className="form-row">
            <div className="form-group"><label className="form-label">תאריך מ</label><input className="form-input" type="date" value={from} onChange={e => setFrom(e.target.value)} /></div>
            <div className="form-group"><label className="form-label">תאריך עד</label><input className="form-input" type="date" value={to} onChange={e => setTo(e.target.value)} /></div>
          </div>
          <div className="form-row">
            <div className="form-group"><label className="form-label">ארגון / פעילות</label>
              <select className="form-input" value={fOrg} onChange={e => setFOrg(e.target.value)}>
                <option value="">כל הארגונים</option>{orgs.map(o => <option key={o.id}>{o.name}</option>)}
              </select>
            </div>
            <div className="form-group"><label className="form-label">סטטוס</label>
              <select className="form-input" value={fStatus} onChange={e => setFStatus(e.target.value)}>
                <option value="">כל הסטטוסים</option>{statuses.map(s => <option key={s.id}>{s.name}</option>)}
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group"><label className="form-label">נציג</label>
              <select className="form-input" value={fAgent} onChange={e => setFAgent(e.target.value)}>
                <option value="">כל הנציגים</option>{agents.map(a => <option key={a.id} value={a.id}>{a.full_name}</option>)}
              </select>
            </div>
            <div className="form-group" /></div>
          <div className="form-row-3" style={{ marginBottom: 14 }}>
            <div className="form-group"><label className="form-label">סיווג ראשון</label>
              <select className="form-input" value={fCat1} onChange={e => setFCat1(e.target.value)}>
                <option value="">הכל</option>{cat1s.map(v => <option key={v}>{v}</option>)}
              </select>
            </div>
            <div className="form-group"><label className="form-label">סיווג שני</label>
              <select className="form-input" value={fCat2} onChange={e => setFCat2(e.target.value)}>
                <option value="">הכל</option>{cat2s.map(v => <option key={v}>{v}</option>)}
              </select>
            </div>
            <div className="form-group"><label className="form-label">סיווג שלישי</label>
              <select className="form-input" value={fCat3} onChange={e => setFCat3(e.target.value)}>
                <option value="">הכל</option>{cat3s.map(v => <option key={v}>{v}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <button className="btn btn-primary" onClick={loadReport}>🔍 הצג תוצאות</button>
            <button className="btn btn-success" onClick={exportExcel}>📥 ייצוא Excel</button>
            <span style={{ fontSize: 12, color: 'var(--text3)' }}>{cases.length} רשומות</span>
          </div>
        </div>

        <div className="card" style={{ padding: 0 }}>
          <div className="table-wrap">
            <table>
              <thead><tr>
                <th onClick={() => toggleSort('id')} style={thStyle('id')}># <SortIcon col="id" /></th>
                <th onClick={() => toggleSort('created_at')} style={thStyle('created_at')}>תאריך יצירה <SortIcon col="created_at" /></th>
                <th onClick={() => toggleSort('updated_at')} style={thStyle('updated_at')}>תאריך עדכון <SortIcon col="updated_at" /></th>
                <th onClick={() => toggleSort('customer_name')} style={thStyle('customer_name')}>שם לקוח <SortIcon col="customer_name" /></th>
                <th onClick={() => toggleSort('status_name')} style={thStyle('status_name')}>סטטוס <SortIcon col="status_name" /></th>
                <th>ת״ז</th><th>טלפון</th>
                <th onClick={() => toggleSort('cat1_name')} style={thStyle('cat1_name')}>סיווג 1 <SortIcon col="cat1_name" /></th>
                <th onClick={() => toggleSort('cat2_name')} style={thStyle('cat2_name')}>סיווג 2 <SortIcon col="cat2_name" /></th>
                <th>סיווג 3</th><th>ספק</th><th>הטבה</th><th>תוכן</th>
                <th onClick={() => toggleSort('org_name')} style={thStyle('org_name')}>ארגון <SortIcon col="org_name" /></th>
                <th onClick={() => toggleSort('agent_name')} style={thStyle('agent_name')}>נציג <SortIcon col="agent_name" /></th>
              </tr></thead>
              <tbody>
                {sortedCases.length ? sortedCases.map(c => (
                  <tr key={c.id} style={{ cursor: 'pointer' }} onClick={() => openCase(c)}>
                    <td className="td-muted">#{c.id}</td>
                    <td style={{ whiteSpace: 'nowrap', fontSize: 11 }}>{fmt(c.created_at)}</td>
                    <td style={{ whiteSpace: 'nowrap', fontSize: 11 }}>{fmt(c.updated_at)}</td>
                    <td style={{ fontWeight: 500, color: 'var(--accent)' }}>{c.customer_name}</td>
                    <td><span className={`badge ${statusBadgeClass(c.status_name)}`}>{c.status_name}</span></td>
                    <td className="td-muted">{c.id_number}</td>
                    <td className="td-mono">{c.phone}</td>
                    <td>{c.cat1_name}</td><td>{c.cat2_name}</td><td>{c.cat3_name}</td>
                    <td>{c.supplier_name}</td><td>{c.benefit_name}</td>
                    <td style={{ maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text2)' }}>{c.content}</td>
                    <td><span className="badge b-gray" style={{ fontSize: 10 }}>{(c.org_name || '').split(' ')[0]}</span></td>
                    <td style={{ color: 'var(--text2)' }}>{c.agent_name}</td>
                  </tr>
                )) : (
                  <tr><td colSpan={15} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text3)' }}>אין תוצאות</td></tr>
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
              <div className="modal-title">פניה #{selectedCase.id} — {selectedCase.customer_name}</div>
              <button className="close-btn" onClick={() => setSelectedCase(null)}>✕</button>
            </div>
            <div className="tabs" style={{ marginBottom: 14 }}>
              <div className={`tab${caseTab==='details'?' active':''}`} onClick={() => setCaseTab('details')}>📋 פרטים</div>
              <div className={`tab${caseTab==='history'?' active':''}`} onClick={() => setCaseTab('history')}>
                🕐 היסטוריה {history.length>0 && <span className="badge b-blue" style={{ fontSize:10, marginRight:4 }}>{history.length}</span>}
              </div>
              <div className={`tab${caseTab==='files'?' active':''}`} onClick={() => setCaseTab('files')}>
                📎 קבצים {attachments.length>0 && <span className="badge b-gray" style={{ fontSize:10, marginRight:4 }}>{attachments.length}</span>}
              </div>
              <div className={`tab${caseTab==='sms'?' active':''}`} onClick={() => setCaseTab('sms')}>💬 SMS</div>
              <div className={`tab${caseTab==='reminder'?' active':''}`} onClick={() => setCaseTab('reminder')}>🔔 תזכורת</div>
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
              {selectedCase.content && <div style={{ marginBottom:14 }}><div style={{ fontSize:10, fontWeight:700, color:'var(--text3)', textTransform:'uppercase', marginBottom:6 }}>תוכן הפניה</div><div style={{ background:'var(--bg3)', borderRadius:'var(--radius-sm)', padding:'10px 12px', fontSize:13, color:'var(--text2)', lineHeight:1.6 }}>{selectedCase.content}</div></div>}
              <div style={{ height:1, background:'var(--border)', margin:'14px 0' }} />
              <div style={{ fontSize:11, fontWeight:700, color:'var(--text2)', textTransform:'uppercase', marginBottom:10 }}>סטטוס</div>
              <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginBottom:16 }}>
                {statuses.map((s:any) => {
                  const cm: Record<string,any> = { 'טופל':{bg:'#dcfce7',ab:'#16a34a',c:'#15803d',b:'#86efac'}, 'טופל לאחר שיחת מנהל':{bg:'#ccfbf1',ab:'#0f766e',c:'#0f766e',b:'#5eead4'}, 'בטיפול נציג':{bg:'#dbeafe',ab:'#2563eb',c:'#1d4ed8',b:'#93c5fd'}, 'הועבר לשיחת מנהל':{bg:'#ede9fe',ab:'#7c3aed',c:'#6d28d9',b:'#c4b5fd'}, 'בטיפול בשיחת מנהל':{bg:'#fae8ff',ab:'#c026d3',c:'#a21caf',b:'#e879f9'}, 'אין מענה':{bg:'#fef3c7',ab:'#d97706',c:'#b45309',b:'#fcd34d'} }
                  const st=cm[s.name]||{bg:'#f3f4f6',ab:'#6b7280',c:'#374151',b:'#d1d5db'}; const sel=editStatus===s.name
                  return <button key={s.id} onClick={() => setEditStatus(s.name)} style={{ padding:'7px 16px', borderRadius:8, fontSize:12, fontWeight:sel?700:500, cursor:'pointer', fontFamily:'Heebo,sans-serif', background:sel?st.ab:st.bg, color:sel?'#fff':st.c, border:`1.5px solid ${sel?st.ab:st.b}`, boxShadow:sel?`0 3px 10px ${st.ab}50`:'none', outline:'none' }}>{s.name}</button>
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

            {caseTab==='history' && (
              <div>
                {history.length===0 ? <div style={{ textAlign:'center', padding:'2rem', color:'var(--text3)' }}>אין פניות קודמות</div>
                : history.map(h => (
                  <div key={h.id} style={{ background:'var(--bg3)', borderRadius:8, padding:'10px 14px', marginBottom:8, cursor:'pointer', border:'1px solid var(--border)' }} onClick={() => openCase(h)}>
                    <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}><span style={{ fontWeight:600, fontSize:13 }}>פניה #{h.id}</span><span className={`badge ${statusBadgeClass(h.status_name)}`}>{h.status_name}</span></div>
                    <div style={{ fontSize:11, color:'var(--text2)' }}>{h.cat1_name}{h.cat2_name?' › '+h.cat2_name:''} | {h.agent_name}</div>
                    <div style={{ fontSize:11, color:'var(--text3)', marginTop:3 }}>{fmt(h.created_at)}</div>
                  </div>
                ))}
              </div>
            )}

            {caseTab==='files' && (
              <div>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
                  <div style={{ fontSize:13, fontWeight:600 }}>קבצים ({attachments.length})</div>
                  <label style={{ cursor:'pointer' }}>
                    <input type="file" style={{ display:'none' }} onChange={uploadFile} />
                    <span className="btn btn-primary btn-sm">{uploading ? '⏳' : '+ העלה'}</span>
                  </label>
                </div>
                {attachments.length===0 ? <div style={{ textAlign:'center', padding:'2rem', color:'var(--text3)' }}>📎 אין קבצים</div>
                : attachments.map(att => (
                  <div key={att.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 12px', background:'var(--bg3)', borderRadius:8, marginBottom:8, border:'1px solid var(--border)' }}>
                    <span style={{ fontSize:20 }}>{att.file_type?.startsWith('image/')?'🖼️':att.file_type==='application/pdf'?'📄':'📎'}</span>
                    <div style={{ flex:1, minWidth:0 }}><div style={{ fontSize:13, fontWeight:500, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{att.file_name}</div><div style={{ fontSize:11, color:'var(--text3)' }}>{formatBytes(att.file_size)} · {att.uploader_name}</div></div>
                    <button className="btn btn-xs btn-primary" onClick={() => downloadFile(att)}>הורד</button>
                  </div>
                ))}
              </div>
            )}

            {caseTab==='sms' && (
              <div>
                <div style={{ fontSize:12, color:'var(--text3)', marginBottom:14 }}>📱 שליחה ל: <strong style={{ direction:'ltr', display:'inline-block' }}>{selectedCase.phone}</strong></div>
                {smsTemplates.length>0 && <div className="form-group"><label className="form-label">בחר תבנית</label><select className="form-input" value={selectedTemplate} onChange={e => { setSelectedTemplate(e.target.value); const t=smsTemplates.find((x:any)=>x.id===e.target.value); if(t) setSmsText(t.content.replace('{שם}',selectedCase.customer_name)) }}><option value="">בחר...</option>{smsTemplates.map((t:any) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></div>}
                <div className="form-group"><label className="form-label">תוכן</label><textarea className="form-input" rows={4} value={smsText} onChange={e => setSmsText(e.target.value)} placeholder="הקלד הודעה..." /><div style={{ fontSize:11, color:'var(--text3)', marginTop:4 }}>{smsText.length} תווים</div></div>
                <button className="btn btn-primary" style={{ width:'100%', justifyContent:'center' }} onClick={async () => {
                  if (!smsText.trim()) return
                  try { const res=await fetch('/api/send-sms',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({to:selectedCase.phone,message:smsText})}); const d=await res.json(); if(d.success){const now=new Date().toLocaleString('he-IL',{timeZone:'Asia/Jerusalem',day:'2-digit',month:'2-digit',year:'2-digit',hour:'2-digit',minute:'2-digit'}); await supabase.from('case_logs').insert({case_id:selectedCase.id,author_id:profile.id,author_name:profile.full_name,content:`📱 SMS נשלח ב-${now}:\n${smsText}`}); showToast('SMS נשלח ✓'); return} } catch{}
                  window.open(`https://wa.me/${selectedCase.phone.replace(/\D/g,'').replace(/^0/,'972')}?text=${encodeURIComponent(smsText)}`,'_blank'); showToast('נפתח WhatsApp ✓')
                }}>📱 שלח SMS</button>
              </div>
            )}

            {caseTab==='reminder' && (
              <div>
                <div style={{ fontSize:12, color:'var(--text3)', marginBottom:16 }}>הוסף תזכורת לחזרה ללקוח זה</div>
                <div className="form-group"><label className="form-label">תאריך ושעה *</label><input className="form-input" type="datetime-local" value={newReminder.remind_at} onChange={e => setNewReminder(p=>({...p,remind_at:e.target.value}))} /></div>
                <div className="form-group"><label className="form-label">הערה *</label><textarea className="form-input" rows={3} value={newReminder.note} onChange={e => setNewReminder(p=>({...p,note:e.target.value}))} placeholder="לדוגמא: לחזור ולוודא קבלת חבילה..." /></div>
                <button className="btn btn-primary" style={{ width:'100%', justifyContent:'center' }} onClick={saveReminder}>🔔 שמור תזכורת</button>
              </div>
            )}
          </div>
        </div>
      )}
      {toast && <div className="toast">{toast}</div>}
    </>
  )
}

'use client'
import { useState, useEffect, useCallback, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { useUser } from '@/lib/useUser'
import Topbar from '@/components/Topbar'
import { fmt, statusBadgeClass, isOverdue, isMgrWaitOverdue, isMgrActiveOverdue, businessDaysBetween } from '@/lib/utils'
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import * as XLSX from 'xlsx'

const RANGE_LABELS: Record<string,string> = { all:'הכל', day:'יום', week:'שבוע', month:'חודש', '3m':'3 חודשים', '6m':'חצי שנה', year:'שנה' }
const DATE_LABELS: Record<string,string> = { all:'הכל', today:'היום', yesterday:'אתמול', week:'שבוע', month:'חודש', '3m':'3 חודשים', '6m':'חצי שנה', year:'שנה' }
const CM: Record<string,any> = {
  'טופל':                  { bg:'#dcfce7',ab:'#16a34a',c:'#15803d',b:'#86efac' },
  'טופל לאחר שיחת מנהל': { bg:'#ccfbf1',ab:'#0f766e',c:'#0f766e',b:'#5eead4' },
  'בטיפול נציג':           { bg:'#dbeafe',ab:'#2563eb',c:'#1d4ed8',b:'#93c5fd' },
  'הועבר לשיחת מנהל':     { bg:'#ede9fe',ab:'#7c3aed',c:'#6d28d9',b:'#c4b5fd' },
  'בטיפול בשיחת מנהל':    { bg:'#fae8ff',ab:'#c026d3',c:'#a21caf',b:'#e879f9' },
  'אין מענה':              { bg:'#fef3c7',ab:'#d97706',c:'#b45309',b:'#fcd34d' },
}

function rangeFilter(c: any, range: string) {
  const now = new Date()
  const ms: Record<string,number> = { day:864e5, week:7*864e5, month:30*864e5, '3m':90*864e5, '6m':180*864e5, year:365*864e5 }
  if (range === 'all') return true
  return now.getTime() - new Date(c.updated_at).getTime() <= ms[range]
}

function israelDay(dateStr: string) {
  return new Date(new Date(dateStr).toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' }))
}

function relativeTime(dateStr: string): string {
  const nowDay = israelDay(new Date().toISOString())
  const dDay = israelDay(dateStr)
  const diff = Math.round((nowDay.getTime() - dDay.getTime()) / 864e5)
  if (diff === 0) return 'היום'
  if (diff === 1) return 'אתמול'
  if (diff === 2) return 'שלשום'
  if (diff < 7) return `לפני ${diff} ימים`
  if (diff < 14) return 'שבוע שעבר'
  if (diff < 21) return 'לפני שבועיים'
  if (diff < 30) return 'לפני 3 שבועות'
  if (diff < 60) return 'חודש שעבר'
  if (diff < 90) return 'לפני חודשיים'
  return `לפני ${Math.floor(diff / 30)} חודשים`
}

function StatusBtn({ s, editStatus, setEditStatus, onSelect }: any) {
  const st = CM[s.name] || { bg:'#f3f4f6',ab:'#6b7280',c:'#374151',b:'#d1d5db' }
  const sel = editStatus === s.name
  return (
    <button onClick={() => { setEditStatus(s.name); onSelect?.(s.name) }} style={{
      padding:'7px 16px', borderRadius:8, fontSize:12, fontWeight:sel?700:500,
      cursor:'pointer', fontFamily:'Heebo,sans-serif', transition:'all 0.15s',
      background:sel?st.ab:st.bg, color:sel?'#fff':st.c,
      border:`1.5px solid ${sel?st.ab:st.b}`,
      boxShadow:sel?`0 3px 10px ${st.ab}50`:'0 1px 2px rgba(0,0,0,0.05)', outline:'none',
    }}>{s.name}</button>
  )
}

function CaseCard({ c, onClick }: { c: any; onClick: () => void }) {
  const od = isOverdue(c)
  const bd = businessDaysBetween(new Date(c.created_at), new Date(c.updated_at))
  return (
    <div onClick={onClick} style={{
      padding:'10px 14px', cursor:'pointer', borderRadius:8,
      background: od ? '#fff5f5' : 'var(--bg3)',
      border:`1px solid ${od ? '#fca5a5' : 'var(--border)'}`,
      marginBottom:8, display:'flex', alignItems:'center', justifyContent:'space-between'
    }}>
      <div>
        <div style={{ fontWeight:600, fontSize:13 }}>{c.customer_name} <span className="td-muted">#{c.id}</span></div>
        <div style={{ fontSize:11, color:'var(--text2)', marginTop:2 }}>
          {c.org_name?.split(' ')[0]} · {c.cat1_name} {c.cat2_name?'› '+c.cat2_name:''}
        </div>
      </div>
      <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:4 }}>
        <span className={`badge ${statusBadgeClass(c.status_name)}`}>{c.status_name}</span>
        {od && <span className="overdue-label">⚠ {bd} ימים</span>}
      </div>
    </div>
  )
}

function MiniList({ cases, empty, onClick }: { cases:any[]; empty:string; onClick:(c:any)=>void }) {
  if (!cases.length) return <div style={{ textAlign:'center', padding:'1.5rem', color:'var(--text3)', fontSize:13 }}>{empty}</div>
  return <>{cases.map(c => <CaseCard key={c.id} c={c} onClick={() => onClick(c)} />)}</>
}

function DashboardPage() {
  const { profile, loading } = useUser()
  const searchParams = useSearchParams()
  const supabase = createClient()

  const [cases, setCases] = useState<any[]>([])
  const [statuses, setStatuses] = useState<any[]>([])
  const [orgs, setOrgs] = useState<any[]>([])
  const [toast, setToast] = useState('')
  const [ipFilter, setIpFilter] = useState('all')
  const [chartOrgFilter, setChartOrgFilter] = useState('')
  const [chartDateRange, setChartDateRange] = useState('all')

  // Modal states
  const [selectedCase, setSelectedCase] = useState<any>(null)
  const [caseTab, setCaseTab] = useState<'details'|'history'|'files'|'sms'>('details')
  const [logs, setLogs] = useState<any[]>([])
  const [newLog, setNewLog] = useState('')
  const [editStatus, setEditStatus] = useState('')
  const [showAddReminder, setShowAddReminder] = useState(false)
  const [newReminder, setNewReminder] = useState({ remind_at:'', note:'' })
  const [history, setHistory] = useState<any[]>([])
  const [attachments, setAttachments] = useState<any[]>([])
  const [uploading, setUploading] = useState(false)
  const [smsTemplates, setSmsTemplates] = useState<any[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState('')
  const [smsText, setSmsText] = useState('')
  const [showListModal, setShowListModal] = useState(false)
  const [modalTitle, setModalTitle] = useState('')
  const [modalList, setModalList] = useState<any[]>([])
  const [recurringModal, setRecurringModal] = useState<{title:string, cases:any[]} | null>(null)

  const isSuperAdmin = profile?.email === 'adir2112@gmail.com'
  const isAdmin = profile?.role === 'admin'

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(''), 2500) }
  function showList(title: string, list: any[]) { setModalTitle(title); setModalList(list); setShowListModal(true) }

  const loadCases = useCallback(async () => {
    if (!profile) return
    const [casesRes, orgsRes] = await Promise.all([
      supabase.from('cases').select('*').order('created_at', { ascending: false }),
      supabase.from('organizations').select('*').order('name')
    ])
    setCases(casesRes.data || [])
    setOrgs(orgsRes.data || [])
    const { data: st } = await supabase.from('statuses').select('*').order('sort_order')
    setStatuses(st || [])
  }, [profile])

  useEffect(() => { loadCases() }, [loadCases])

  useEffect(() => {
    const caseId = searchParams?.get('openCase')
    if (caseId && cases.length > 0) {
      const c = cases.find(x => x.id === parseInt(caseId))
      if (c) openCase(c)
    }
  }, [searchParams, cases])

  async function openCase(c: any) {
    setSelectedCase(c)
    setEditStatus(c.status_name)
    setCaseTab('details')
    setSmsText('')
    setSelectedTemplate('')
    setShowAddReminder(false)
    setNewReminder({ remind_at:'', note:'' })
    const { data: logsData } = await supabase.from('case_logs').select('*').eq('case_id', c.id).order('created_at')
    setLogs(logsData || [])
    const { data: att } = await supabase.from('case_attachments').select('*').eq('case_id', c.id).order('created_at')
    setAttachments(att || [])
    if (c.phone) {
      const { data: hist } = await supabase.from('cases').select('id,created_at,status_name,cat1_name,cat2_name,agent_name,org_name').neq('id', c.id).eq('phone', c.phone).order('created_at', { ascending: false }).limit(20)
      setHistory(hist || [])
    } else setHistory([])
    if (c.org_id) {
      const { data: tmpl } = await supabase.from('sms_templates').select('*').eq('org_id', c.org_id).order('name')
      setSmsTemplates(tmpl || [])
    } else setSmsTemplates([])
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
    setNewReminder({ remind_at:'', note:'' })
    showToast('תזכורת נוספה ✓')
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

  async function uploadFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !selectedCase) return
    setUploading(true)
    const path = `${selectedCase.id}/${Date.now()}_${file.name}`
    const { error } = await supabase.storage.from('case-attachments').upload(path, file)
    if (!error) {
      await supabase.from('case_attachments').insert({
        case_id: selectedCase.id, uploaded_by: profile.id, uploader_name: profile.full_name,
        file_name: file.name, file_size: file.size, file_type: file.type, storage_path: path
      })
      const { data } = await supabase.from('case_attachments').select('*').eq('case_id', selectedCase.id).order('created_at')
      setAttachments(data || [])
      showToast('קובץ הועלה ✓')
    } else {
      showToast('שגיאה: ' + error.message)
    }
    setUploading(false)
    e.target.value = ''
  }

  async function downloadFile(att: any) {
    const { data } = await supabase.storage.from('case-attachments').createSignedUrl(att.storage_path, 60)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
  }

  async function deleteFile(att: any) {
    if (!confirm('למחוק קובץ?')) return
    await supabase.storage.from('case-attachments').remove([att.storage_path])
    await supabase.from('case_attachments').delete().eq('id', att.id)
    setAttachments(prev => prev.filter(a => a.id !== att.id))
    showToast('קובץ נמחק ✓')
  }

  function formatBytes(bytes: number): string {
    if (!bytes) return ''
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024*1024) return (bytes/1024).toFixed(1) + ' KB'
    return (bytes/(1024*1024)).toFixed(1) + ' MB'
  }

  function exportRecurringExcel(rcases: any[], title: string) {
    const rows = rcases.map(c => ({
      '#': c.id, 'שם לקוח': c.customer_name, 'טלפון': c.phone, 'ת"ז': c.id_number,
      'ארגון': c.org_name, 'סיווג 1': c.cat1_name, 'סיווג 2': c.cat2_name, 'סיווג 3': c.cat3_name,
      'סטטוס': c.status_name, 'נציג': c.agent_name,
      'תאריך יצירה': fmt(c.created_at), 'תאריך עדכון': fmt(c.updated_at),
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, title.slice(0, 30))
    XLSX.writeFile(wb, `${title}_${new Date().toISOString().split('T')[0]}.xlsx`)
  }

  if (loading) return null
  if (!profile) return null

  const myCases = cases.filter(c => c.agent_id === profile.id)
  const todayCases = myCases.filter(c => {
    const d = c.created_at > c.updated_at ? c.created_at : c.updated_at
    return d?.startsWith(new Date().toISOString().split('T')[0])
  })
  const allIP = myCases.filter(c => c.status_name === 'בטיפול נציג')
  const filteredIP = allIP.filter(c => rangeFilter(c, ipFilter))
  const overdueCases = myCases.filter(c => isOverdue(c))
  const mgrWait = cases.filter(c => isMgrWaitOverdue(c))
  const mgrActive = cases.filter(c => isMgrActiveOverdue(c))
  const doneMine = myCases.filter(c => c.status_name?.includes('טופל')).length
  const h = new Date().getHours()
  const greeting = (h < 12 ? 'בוקר טוב' : 'אחר הצהריים טובים') + ', ' + profile?.full_name + ' 👋'
  const days = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת']
  const dateStr = days[new Date().getDay()] + ', ' + new Date().toLocaleDateString('he-IL', { day:'numeric', month:'long', year:'numeric' })

  return (
    <>
      <Topbar userName={profile?.full_name||''} userRole={profile?.role||'agent'} userEmail={profile?.email||''} onOpenCase={openCase} />
      <div style={{ padding:'22px 26px', maxWidth:1600, margin:'0 auto' }}>

        <div className="page-header">
          <div>
            <div className="page-title">{greeting}</div>
            <div style={{ fontSize:13, color:'var(--text3)', marginTop:2 }}>{dateStr}</div>
          </div>
          <a href="/new-case" className="btn btn-primary">＋ פניה חדשה</a>
        </div>

        {/* Stats */}
        <div className="stats-grid" style={{ gridTemplateColumns: isAdmin ? 'repeat(7,1fr)' : 'repeat(5,1fr)' }}>
          <div className="stat-card clickable" onClick={() => showList('📅 פניות היום', todayCases)}>
            <div className="stat-icon" style={{ background:'var(--accent-lt)' }}>📅</div>
            <div className="stat-num" style={{ color:'var(--accent)' }}>{todayCases.length}</div>
            <div className="stat-lbl">פניות היום</div>
          </div>
          <div className="stat-card clickable" onClick={() => showList('⏳ בטיפול נציג', allIP)}>
            <div className="stat-icon" style={{ background:'var(--amber-lt)' }}>⏳</div>
            <div className="stat-num" style={{ color:'var(--amber)' }}>{allIP.length}</div>
            <div className="stat-lbl">בטיפול נציג</div>
          </div>
          <div className="stat-card clickable" onClick={() => showList('🔴 חריגת ימי עסקים', overdueCases)}>
            <div className="stat-icon" style={{ background:'var(--red-lt)' }}>🔴</div>
            <div className="stat-num" style={{ color:'var(--red)' }}>{overdueCases.length}</div>
            <div className="stat-lbl">חריגת ימי עסקים</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon" style={{ background:'var(--green-lt)' }}>✅</div>
            <div className="stat-num" style={{ color:'var(--green)' }}>{doneMine}</div>
            <div className="stat-lbl">טופל</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon" style={{ background:'var(--bg4)' }}>📋</div>
            <div className="stat-num">{myCases.length}</div>
            <div className="stat-lbl">סה"כ שלי</div>
          </div>
          {isAdmin && <>
            <div className="stat-card clickable" onClick={() => showList('ממתין לשיחת מנהל', mgrWait)}>
              <div className="stat-icon" style={{ background:'var(--purple-lt)' }}>🟣</div>
              <div className="stat-num" style={{ color:'var(--purple)' }}>{mgrWait.length}</div>
              <div className="stat-lbl">ממתין מנהל</div>
            </div>
            <div className="stat-card clickable" onClick={() => showList('בטיפול שיחת מנהל', mgrActive)}>
              <div className="stat-icon" style={{ background:'var(--purple-lt)' }}>📞</div>
              <div className="stat-num" style={{ color:'var(--purple)' }}>{mgrActive.length}</div>
              <div className="stat-lbl">בשיחת מנהל</div>
            </div>
          </>}
        </div>

        {/* In progress filter */}
        <div className="card card-pad" style={{ marginBottom:16 }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
            <div style={{ fontSize:13, fontWeight:700 }}>⏳ בטיפול נציג</div>
            <div style={{ display:'flex', gap:4 }}>
              {Object.entries(RANGE_LABELS).map(([k,v]) => (
                <button key={k} onClick={() => setIpFilter(k)} style={{ padding:'3px 10px', borderRadius:999, fontSize:11, fontWeight:600, cursor:'pointer', fontFamily:'Heebo,sans-serif', border:'none', background:ipFilter===k?'#2563eb':'#f1f3f8', color:ipFilter===k?'#fff':'#4b5568' }}>{v}</button>
              ))}
            </div>
          </div>
          {filteredIP.length ? filteredIP.map(c => <CaseCard key={c.id} c={c} onClick={() => openCase(c)} />) : <div style={{ textAlign:'center', padding:'1.5rem', color:'var(--text3)', fontSize:13 }}>אין פניות בטווח הנבחר</div>}
        </div>

        {/* Admin panels */}
        {isAdmin && (
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:16 }}>
            <div className="card">
              <div className="card-header">
                <div className="card-title" style={{ color:'var(--red)' }}>🔴 חריגת ימי עסקים</div>
                <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                  <span className="badge b-red">{overdueCases.length}</span>
                  <button className="btn btn-xs" onClick={() => showList('חריגת ימי עסקים', overdueCases)}>הצג הכל</button>
                </div>
              </div>
              <div style={{ padding:'8px 14px', fontSize:11, color:'var(--text3)', borderBottom:'1px solid var(--border)' }}>בטיפול נציג מעל 2 ימי עסקים</div>
              <div style={{ padding:'10px 14px', maxHeight:280, overflowY:'auto' }}>
                <MiniList cases={overdueCases} empty="אין חריגות" onClick={openCase} />
              </div>
            </div>
            <div className="card">
              <div className="card-header">
                <div className="card-title" style={{ color:'var(--purple)' }}>🟣 ממתין/בטיפול מנהל</div>
                <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                  <span className="badge b-purple">{mgrWait.length + mgrActive.length}</span>
                </div>
              </div>
              <div style={{ padding:'8px 14px', fontSize:11, color:'var(--text3)', borderBottom:'1px solid var(--border)' }}>הועבר/בטיפול שיחת מנהל מעל 2 ימי עסקים</div>
              <div style={{ padding:'10px 14px', maxHeight:280, overflowY:'auto' }}>
                <MiniList cases={[...mgrWait,...mgrActive]} empty="אין חריגות" onClick={openCase} />
              </div>
            </div>
          </div>
        )}

        {/* Charts — admin only */}
        {isAdmin && (() => {
          const now = new Date()
          const filteredForChart = cases.filter(c => {
            if (chartOrgFilter && c.org_name !== chartOrgFilter) return false
            if (chartDateRange === 'all') return true
            const nowDay = israelDay(now.toISOString())
            const dDay = israelDay(c.created_at)
            const diff = Math.round((nowDay.getTime() - dDay.getTime()) / 864e5)
            if (chartDateRange === 'today') return diff === 0
            if (chartDateRange === 'yesterday') return diff === 1
            if (chartDateRange === 'week') return diff <= 7
            if (chartDateRange === 'month') return diff <= 30
            if (chartDateRange === '3m') return diff <= 90
            if (chartDateRange === '6m') return diff <= 180
            if (chartDateRange === 'year') return diff <= 365
            return true
          })

          const counts: Record<string,number> = {}
          filteredForChart.forEach(c => {
            if (!c.cat1_name || !c.cat2_name) return
            const key = c.cat1_name + ' › ' + c.cat2_name
            counts[key] = (counts[key]||0) + 1
          })
          const chartData = Object.entries(counts).sort((a,b) => b[1]-a[1]).slice(0,8).map(([name,value]) => ({ name, value }))
          const COLORS = ['#2563eb','#7c3aed','#0d9488','#d97706','#dc2626','#16a34a','#9333ea','#0891b2']
          const tableCounts: Record<string,any> = {}
          filteredForChart.forEach(c => {
            if (!c.cat1_name || !c.cat2_name) return
            const key = (c.org_name||'') + '||' + c.cat1_name + '||' + c.cat2_name
            if (!tableCounts[key]) tableCounts[key] = { org:c.org_name, cat1:c.cat1_name, cat2:c.cat2_name, count:0 }
            tableCounts[key].count++
          })
          const tableRows = Object.values(tableCounts).sort((a:any,b:any) => b.count-a.count).slice(0,20)

          const filterBar = (
            <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap', marginBottom:12 }}>
              <select className="form-input" value={chartOrgFilter} onChange={e => setChartOrgFilter(e.target.value)} style={{ width:150, fontSize:12, padding:'4px 8px' }}>
                <option value="">כל הארגונים</option>
                {orgs.map((o:any) => <option key={o.id}>{o.name}</option>)}
              </select>
              <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
                {Object.entries(DATE_LABELS).map(([k,v]) => (
                  <button key={k} onClick={() => setChartDateRange(k)} style={{ padding:'3px 10px', borderRadius:999, fontSize:11, fontWeight:600, cursor:'pointer', fontFamily:'Heebo,sans-serif', border:'none', background:chartDateRange===k?'#2563eb':'#f1f3f8', color:chartDateRange===k?'#fff':'#4b5568' }}>{v}</button>
                ))}
              </div>
            </div>
          )

          return (
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginTop:16 }}>
              <div className="card card-pad">
                <div style={{ fontSize:13, fontWeight:700, marginBottom:10 }}>📊 פניות חוזרות — סיווג שני</div>
                {filterBar}
                {chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={240}>
                    <PieChart>
                      <Pie data={chartData} cx="50%" cy="50%" innerRadius={55} outerRadius={95} dataKey="value">
                        {chartData.map((_,i) => <Cell key={i} fill={COLORS[i%COLORS.length]} />)}
                      </Pie>
                      <Tooltip />
                      <Legend iconSize={10} wrapperStyle={{ fontSize:11 }} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : <div style={{ textAlign:'center', padding:'2rem', color:'var(--text3)' }}>אין נתונים</div>}
              </div>
              <div className="card card-pad">
                <div style={{ fontSize:13, fontWeight:700, marginBottom:10 }}>📈 פניות חוזרות — טבלה מפורטת</div>
                {filterBar}
                <div style={{ overflowY:'auto', maxHeight:260 }}>
                  <table style={{ fontSize:12 }}>
                    <thead><tr><th>ארגון</th><th>סיווג ראשון</th><th>סיווג שני</th><th style={{ textAlign:'center' }}>כמות</th></tr></thead>
                    <tbody>
                      {tableRows.length ? tableRows.map((r:any,i:number) => {
                        const rowCases = filteredForChart.filter((c:any) => c.org_name===r.org && c.cat1_name===r.cat1 && c.cat2_name===r.cat2)
                        return (
                          <tr key={i} style={{ cursor:'pointer' }} onClick={() => setRecurringModal({ title:`${r.cat2} — ${(r.org||'').split(' ')[0]}`, cases:rowCases })}>
                            <td><span className="badge b-gray" style={{ fontSize:10 }}>{(r.org||'').split(' ')[0]}</span></td>
                            <td style={{ color:'var(--text2)' }}>{r.cat1}</td>
                            <td style={{ fontWeight:500, color:'var(--accent)' }}>{r.cat2}</td>
                            <td style={{ textAlign:'center' }}><span className={`badge ${i<3?'b-red':'b-gray'}`} style={{ fontSize:11 }}>{r.count}</span></td>
                          </tr>
                        )
                      }) : <tr><td colSpan={4} style={{ textAlign:'center', padding:'1.5rem', color:'var(--text3)' }}>אין נתונים</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )
        })()}
      </div>

      {/* Case detail modal */}
      {selectedCase && (
        <div className="modal-overlay" onClick={e => { if(e.target===e.currentTarget) setSelectedCase(null) }}>
          <div className="modal">
            <div className="modal-header">
              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                <div className="modal-title">פניה #{selectedCase.id} — {selectedCase.customer_name}</div>
                {isSuperAdmin && <button className="btn btn-xs btn-danger" onClick={() => deleteCase(selectedCase.id)}>🗑 מחק</button>}
              </div>
              <button className="close-btn" onClick={() => setSelectedCase(null)}>✕</button>
            </div>
            <div className="tabs" style={{ marginBottom:14 }}>
              <div className={`tab${caseTab==='details'?' active':''}`} onClick={() => setCaseTab('details')}>📋 פרטים</div>
              <div className={`tab${caseTab==='history'?' active':''}`} onClick={() => setCaseTab('history')}>
                🕐 היסטוריה {history.length>0 && <span className="badge b-blue" style={{ fontSize:10, marginRight:4 }}>{history.length}</span>}
              </div>
              <div className={`tab${caseTab==='files'?' active':''}`} onClick={() => setCaseTab('files')}>
                📎 קבצים {attachments.length>0 && <span className="badge b-gray" style={{ fontSize:10, marginRight:4 }}>{attachments.length}</span>}
              </div>
              <div className={`tab${caseTab==='sms'?' active':''}`} onClick={() => setCaseTab('sms')}>💬 SMS</div>
            </div>

            {/* Details tab */}
            {caseTab==='details' && <>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:14 }}>
                {[['שם לקוח',selectedCase.customer_name],['ארגון',selectedCase.org_name],['טלפון',selectedCase.phone],['ת״ז',selectedCase.id_number],['סיווג 1',selectedCase.cat1_name],['סיווג 2',selectedCase.cat2_name],['סיווג 3',selectedCase.cat3_name],['נציג',selectedCase.agent_name]].map(([l,v]) => v ? (
                  <div key={l} style={{ background:'var(--bg3)', borderRadius:'var(--radius-sm)', padding:'10px 13px' }}>
                    <div style={{ fontSize:10, fontWeight:700, color:'var(--text3)', textTransform:'uppercase', marginBottom:3 }}>{l}</div>
                    <div style={{ fontSize:13 }}>{v}</div>
                  </div>
                ) : null)}
              </div>
              {selectedCase.content && (
                <div style={{ marginBottom:14 }}>
                  <div style={{ fontSize:10, fontWeight:700, color:'var(--text3)', textTransform:'uppercase', marginBottom:6 }}>תוכן הפניה</div>
                  <div style={{ background:'var(--bg3)', borderRadius:'var(--radius-sm)', padding:'10px 12px', fontSize:13, color:'var(--text2)', lineHeight:1.6 }}>{selectedCase.content}</div>
                </div>
              )}
              <div style={{ height:1, background:'var(--border)', margin:'14px 0' }} />
              <div style={{ fontSize:11, fontWeight:700, color:'var(--text2)', textTransform:'uppercase', marginBottom:10 }}>סטטוס</div>
              <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginBottom:16 }}>
                {statuses.map(s => <StatusBtn key={s.id} s={s} editStatus={editStatus} setEditStatus={setEditStatus} onSelect={(name: string) => { if(name==='בטיפול נציג') setShowAddReminder(true); else setShowAddReminder(false) }} />)}
              </div>
              <button onClick={saveStatus} style={{ width:'100%', padding:'11px 0', borderRadius:10, border:'none', background:'linear-gradient(135deg,#1d4ed8,#2563eb)', color:'#fff', fontSize:15, fontWeight:800, cursor:'pointer', fontFamily:'Heebo,sans-serif', marginBottom:16, boxShadow:'0 4px 14px rgba(37,99,235,0.4)' }}>✓ עדכן סטטוס</button>
              <div style={{ height:1, background:'var(--border)', margin:'0 0 14px 0' }} />
              <div style={{ fontSize:11, fontWeight:700, color:'var(--text2)', textTransform:'uppercase', marginBottom:10 }}>📝 תיעוד ידני</div>
              <div style={{ marginBottom:12, maxHeight:160, overflowY:'auto' }}>
                {logs.length ? logs.map(l => (
                  <div key={l.id} className="log-entry">
                    <div className="log-meta">{fmt(l.created_at)} — {l.author_name}</div>
                    <div className="log-text">{l.content}</div>
                  </div>
                )) : <div style={{ color:'var(--text3)', fontSize:12 }}>אין תיעודים</div>}
              </div>
              <div style={{ display:'flex', gap:8, marginBottom:14 }}>
                <textarea className="form-input" rows={2} value={newLog} onChange={e => setNewLog(e.target.value)} placeholder="הוסף הערה..." style={{ flex:1 }} />
                <button className="btn btn-success btn-sm" style={{ alignSelf:'flex-start' }} onClick={addLog}>+ הוסף</button>
              </div>
              <div style={{ height:1, background:'var(--border)', margin:'0 0 14px 0' }} />
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
                <div style={{ fontSize:11, fontWeight:700, color:'var(--text2)', textTransform:'uppercase' }}>🔔 תזכורת חזרה</div>
                <button className="btn btn-xs" style={{ background:'#eff4ff', color:'#2563eb', border:'1px solid #bfdbfe' }} onClick={() => setShowAddReminder(!showAddReminder)}>
                  {showAddReminder ? 'ביטול' : '+ הוסף'}
                </button>
              </div>
              {showAddReminder && (
                <div style={{ background:'#eff4ff', borderRadius:8, padding:'12px 14px', marginBottom:10 }}>
                  <div className="form-row" style={{ marginBottom:10 }}>
                    <div className="form-group" style={{ marginBottom:0 }}>
                      <label className="form-label">תאריך ושעה *</label>
                      <input className="form-input" type="datetime-local" value={newReminder.remind_at} onChange={e => setNewReminder(p => ({ ...p, remind_at:e.target.value }))} />
                    </div>
                    <div className="form-group" style={{ marginBottom:0 }}>
                      <label className="form-label">הערה *</label>
                      <input className="form-input" value={newReminder.note} onChange={e => setNewReminder(p => ({ ...p, note:e.target.value }))} placeholder="לדוגמא: לחזור ולוודא קבלת חבילה" />
                    </div>
                  </div>
                  <button className="btn btn-primary btn-sm" onClick={saveReminder}>שמור תזכורת</button>
                </div>
              )}
            </>}

            {/* History tab */}
            {caseTab==='history' && (
              <div>
                <div style={{ fontSize:12, color:'var(--text3)', marginBottom:12 }}>
                  כל הפניות הקודמות של {selectedCase.customer_name}
                </div>
                {history.length===0 ? (
                  <div style={{ textAlign:'center', padding:'2rem', color:'var(--text3)' }}>אין פניות קודמות</div>
                ) : history.map(h => (
                  <div key={h.id} style={{ background:'var(--bg3)', borderRadius:8, padding:'10px 14px', marginBottom:8, cursor:'pointer', border:'1px solid var(--border)' }} onClick={() => openCase(h)}>
                    <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                      <span style={{ fontWeight:600, fontSize:13 }}>פניה #{h.id}</span>
                      <span className={`badge ${statusBadgeClass(h.status_name)}`}>{h.status_name}</span>
                    </div>
                    <div style={{ fontSize:11, color:'var(--text2)' }}>{h.cat1_name}{h.cat2_name?' › '+h.cat2_name:''} | נציג: {h.agent_name}</div>
                    <div style={{ fontSize:11, color:'var(--text3)', marginTop:3 }}>{fmt(h.created_at)} · {relativeTime(h.created_at)}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Files tab */}
            {caseTab==='files' && (
              <div>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
                  <div style={{ fontSize:13, fontWeight:600 }}>קבצים מצורפים ({attachments.length})</div>
                  <label style={{ cursor:'pointer' }}>
                    <input type="file" style={{ display:'none' }} onChange={uploadFile} accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.mp3,.mp4,.wav" />
                    <span className="btn btn-primary btn-sm">{uploading ? '⏳ מעלה...' : '+ העלה קובץ'}</span>
                  </label>
                </div>
                {attachments.length===0 ? (
                  <div style={{ textAlign:'center', padding:'2rem', color:'var(--text3)' }}>
                    <div style={{ fontSize:32, marginBottom:8 }}>📎</div>
                    <div style={{ fontSize:13 }}>אין קבצים מצורפים</div>
                    <div style={{ fontSize:11, marginTop:4 }}>ניתן לצרף תמונות, PDF, מסמכים</div>
                  </div>
                ) : attachments.map(att => {
                  const icon = att.file_type?.startsWith('image/') ? '🖼️' : att.file_type?.startsWith('audio/') ? '🎵' : att.file_type==='application/pdf' ? '📄' : '📎'
                  return (
                    <div key={att.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 12px', background:'var(--bg3)', borderRadius:8, marginBottom:8, border:'1px solid var(--border)' }}>
                      <span style={{ fontSize:20 }}>{icon}</span>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:13, fontWeight:500, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{att.file_name}</div>
                        <div style={{ fontSize:11, color:'var(--text3)' }}>{formatBytes(att.file_size)} · {att.uploader_name}</div>
                      </div>
                      <button className="btn btn-xs btn-primary" onClick={() => downloadFile(att)}>הורד</button>
                      <button className="btn btn-xs btn-danger" onClick={() => deleteFile(att)}>מחק</button>
                    </div>
                  )
                })}
              </div>
            )}

            {/* SMS tab */}
            {caseTab==='sms' && (
              <div>
                <div style={{ fontSize:12, color:'var(--text3)', marginBottom:14 }}>
                  📱 שליחה ל: <strong style={{ color:'var(--text)', direction:'ltr', display:'inline-block' }}>{selectedCase.phone}</strong>
                </div>
                {smsTemplates.length>0 && (
                  <div className="form-group">
                    <label className="form-label">בחר תבנית</label>
                    <select className="form-input" value={selectedTemplate} onChange={e => {
                      setSelectedTemplate(e.target.value)
                      const t = smsTemplates.find(x => x.id===e.target.value)
                      if (t) setSmsText(t.content.replace('{שם}', selectedCase.customer_name))
                    }}>
                      <option value="">בחר תבנית...</option>
                      {smsTemplates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                  </div>
                )}
                <div className="form-group">
                  <label className="form-label">תוכן ההודעה</label>
                  <textarea className="form-input" rows={4} value={smsText} onChange={e => setSmsText(e.target.value)} placeholder="הקלד את ההודעה..." />
                  <div style={{ fontSize:11, color:'var(--text3)', marginTop:4 }}>{smsText.length} תווים</div>
                </div>
                <button className="btn btn-primary" style={{ width:'100%', justifyContent:'center', marginBottom:10 }} onClick={async () => {
                  if (!smsText.trim()) { showToast('הכנס תוכן הודעה'); return }
                  try {
                    const res = await fetch('/api/send-sms', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ to:selectedCase.phone, message:smsText }) })
                    const data = await res.json()
                    if (data.success) {
                      const now = new Date().toLocaleString('he-IL',{timeZone:'Asia/Jerusalem',day:'2-digit',month:'2-digit',year:'2-digit',hour:'2-digit',minute:'2-digit'})
                      await supabase.from('case_logs').insert({ case_id:selectedCase.id, author_id:profile.id, author_name:profile.full_name, content:`📱 SMS נשלח ב-${now}:\n${smsText}` })
                      const { data: ld } = await supabase.from('case_logs').select('*').eq('case_id',selectedCase.id).order('created_at')
                      setLogs(ld || [])
                      showToast('SMS נשלח ✓')
                      return
                    }
                  } catch {}
                  const p = selectedCase.phone.replace(/\D/g,'').replace(/^0/,'972')
                  window.open(`https://wa.me/${p}?text=${encodeURIComponent(smsText)}`,'_blank')
                  const now = new Date().toLocaleString('he-IL',{timeZone:'Asia/Jerusalem',day:'2-digit',month:'2-digit',year:'2-digit',hour:'2-digit',minute:'2-digit'})
                  await supabase.from('case_logs').insert({ case_id:selectedCase.id, author_id:profile.id, author_name:profile.full_name, content:`📱 WhatsApp נשלח ב-${now}:\n${smsText}` })
                  const { data: ld } = await supabase.from('case_logs').select('*').eq('case_id',selectedCase.id).order('created_at')
                  setLogs(ld || [])
                  showToast('נפתח WhatsApp ✓')
                }}>📱 שלח SMS</button>
                <div style={{ background:'#f0fdf4', border:'1px solid #bbf7d0', borderRadius:8, padding:'12px 14px' }}>
                  <div style={{ fontSize:12, fontWeight:600, color:'#15803d', marginBottom:8 }}>📨 הלקוח הגיב?</div>
                  <div style={{ display:'flex', gap:8 }}>
                    <input className="form-input" id="reply-input" placeholder="תוכן תגובת הלקוח..." style={{ flex:1, fontSize:12 }} />
                    <button className="btn btn-xs" style={{ background:'#16a34a', color:'#fff', border:'none', whiteSpace:'nowrap' }} onClick={async () => {
                      const el = document.getElementById('reply-input') as HTMLInputElement
                      if (!el?.value.trim()) return
                      const now = new Date().toLocaleString('he-IL',{timeZone:'Asia/Jerusalem',day:'2-digit',month:'2-digit',year:'2-digit',hour:'2-digit',minute:'2-digit'})
                      await supabase.from('case_logs').insert({ case_id:selectedCase.id, author_id:profile.id, author_name:profile.full_name, content:`📨 תגובת לקוח ב-${now}:\n${el.value}` })
                      const { data: ld } = await supabase.from('case_logs').select('*').eq('case_id',selectedCase.id).order('created_at')
                      setLogs(ld || [])
                      el.value = ''
                      showToast('תגובה נרשמה ✓')
                    }}>רשום תגובה</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* List modal */}
      {showListModal && (
        <div className="modal-overlay" onClick={e => { if(e.target===e.currentTarget) setShowListModal(false) }}>
          <div className="modal">
            <div className="modal-header">
              <div className="modal-title">{modalTitle}</div>
              <button className="close-btn" onClick={() => setShowListModal(false)}>✕</button>
            </div>
            {modalList.length ? modalList.map(c => <CaseCard key={c.id} c={c} onClick={() => { setShowListModal(false); openCase(c) }} />) : <div style={{ textAlign:'center', padding:'2rem', color:'var(--text3)' }}>אין פניות</div>}
          </div>
        </div>
      )}

      {/* Recurring modal */}
      {recurringModal && (
        <div className="modal-overlay" onClick={e => { if(e.target===e.currentTarget) setRecurringModal(null) }}>
          <div className="modal" style={{ maxWidth:900 }}>
            <div className="modal-header">
              <div className="modal-title">🔁 {recurringModal.title} ({recurringModal.cases.length})</div>
              <div style={{ display:'flex', gap:8 }}>
                <button className="btn btn-success btn-sm" onClick={() => exportRecurringExcel(recurringModal.cases, recurringModal.title)}>📥 Excel</button>
                <button className="close-btn" onClick={() => setRecurringModal(null)}>✕</button>
              </div>
            </div>
            <div style={{ maxHeight:460, overflowY:'auto' }}>
              <table>
                <thead><tr><th>#</th><th>שם לקוח</th><th>טלפון</th><th>ארגון</th><th>סיווג 2</th><th>סטטוס</th><th>נציג</th><th>תאריך</th></tr></thead>
                <tbody>
                  {recurringModal.cases.map(c => (
                    <tr key={c.id} style={{ cursor:'pointer' }} onClick={() => { setRecurringModal(null); openCase(c) }}>
                      <td className="td-muted">#{c.id}</td>
                      <td style={{ fontWeight:600, color:'var(--accent)' }}>{c.customer_name}</td>
                      <td className="td-mono">{c.phone}</td>
                      <td><span className="badge b-gray" style={{ fontSize:10 }}>{(c.org_name||'').split(' ')[0]}</span></td>
                      <td>{c.cat2_name}</td>
                      <td><span className={`badge ${statusBadgeClass(c.status_name)}`}>{c.status_name}</span></td>
                      <td style={{ color:'var(--text2)' }}>{c.agent_name}</td>
                      <td className="td-muted" style={{ whiteSpace:'nowrap', fontSize:11 }}>{fmt(c.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}
    </>
  )
}

export default function DashboardPageWrapper() {
  return (
    <Suspense fallback={<div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', color:'var(--text3)' }}>טוען...</div>}>
      <DashboardPage />
    </Suspense>
  )
}

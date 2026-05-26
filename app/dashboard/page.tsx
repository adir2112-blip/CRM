'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { useUser } from '@/lib/useUser'
import Topbar from '@/components/Topbar'
import { fmt, statusBadgeClass, isOverdue, isMgrWaitOverdue, isMgrActiveOverdue, businessDaysBetween } from '@/lib/utils'

const RANGE_LABELS: Record<string, string> = { all:'הכל', day:'יום', week:'שבוע', month:'חודש', '3m':'3 חודשים', '6m':'חצי שנה', year:'שנה' }

function rangeFilter(c: any, range: string) {
  if (range === 'all') return true
  const now = new Date()
  const ms: Record<string, number> = { day:864e5, week:7*864e5, month:30*864e5, '3m':90*864e5, '6m':180*864e5, year:365*864e5 }
  return new Date(c.created_at) >= new Date(now.getTime() - ms[range])
}

function CaseCard({ c, onClick }: { c: any; onClick: () => void }) {
  const od = isOverdue(c)
  const bd = businessDaysBetween(new Date(c.created_at), new Date(c.updated_at))
  return (
    <div className={`case-card${od ? ' overdue' : ''}`} onClick={onClick}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 5 }}>
        <div className="case-card-name">{c.customer_name}</div>
        {od
          ? <span className="overdue-label">⚠ {bd} ימי עסקים</span>
          : <span className={`badge ${statusBadgeClass(c.status_name)}`}>{c.status_name}</span>}
      </div>
      <div className="case-card-meta">
        <span className="badge b-gray" style={{ fontSize: 10 }}>{(c.org_name || '').split(' ')[0]}</span>
        {c.cat1_name && <span style={{ fontSize: 11, color: 'var(--text2)' }}>{c.cat1_name}{c.cat2_name ? ' › ' + c.cat2_name : ''}</span>}
        <span className="case-card-id">#{c.id}</span>
      </div>
    </div>
  )
}

function MiniList({ cases, empty, onClick }: { cases: any[]; empty: string; onClick: (c: any) => void }) {
  if (!cases.length) return <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text3)', fontSize: 13 }}>{empty}</div>
  return <>{cases.map(c => <CaseCard key={c.id} c={c} onClick={() => onClick(c)} />)}</>
}

export default function DashboardPage() {
  const { profile, loading } = useUser()
  const [cases, setCases] = useState<any[]>([])
  const [searchQ, setSearchQ] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [ipFilter, setIpFilter] = useState('all')
  const [selectedCase, setSelectedCase] = useState<any>(null)
  const [logs, setLogs] = useState<any[]>([])
  const [newLog, setNewLog] = useState('')
  const [editStatus, setEditStatus] = useState('')
  const [statuses, setStatuses] = useState<any[]>([])
  const [modalTitle, setModalTitle] = useState('')
  const [modalList, setModalList] = useState<any[]>([])
  const [showListModal, setShowListModal] = useState(false)

  const supabase = createClient()

  const loadCases = useCallback(async () => {
    if (!profile) return
    const { data } = await supabase.from('cases').select('*').order('updated_at', { ascending: false })
    setCases(data || [])
  }, [profile])

  useEffect(() => { loadCases() }, [loadCases])

  useEffect(() => {
    supabase.from('statuses').select('*').order('sort_order').then(({ data }) => setStatuses(data || []))
  }, [])

  async function openCase(c: any) {
    setSelectedCase(c)
    setEditStatus(c.status_name)
    const { data } = await supabase.from('case_logs').select('*').eq('case_id', c.id).order('created_at')
    setLogs(data || [])
  }

  async function saveStatus() {
    const st = statuses.find(s => s.name === editStatus)
    await supabase.from('cases').update({ status_name: editStatus, status_id: st?.id, last_editor_id: profile.id, last_editor_name: profile.full_name }).eq('id', selectedCase.id)
    setSelectedCase({ ...selectedCase, status_name: editStatus })
    loadCases()
    showToast('סטטוס עודכן ✓')
  }

  async function addLog() {
    if (!newLog.trim()) return
    await supabase.from('case_logs').insert({ case_id: selectedCase.id, author_id: profile.id, author_name: profile.full_name, content: newLog })
    await supabase.from('cases').update({ last_editor_id: profile.id, last_editor_name: profile.full_name }).eq('id', selectedCase.id)
    const { data } = await supabase.from('case_logs').select('*').eq('case_id', selectedCase.id).order('created_at')
    setLogs(data || [])
    setNewLog('')
    loadCases()
    showToast('תיעוד נוסף ✓')
  }

  async function doSearch(q: string) {
    setSearchQ(q)
    if (!q.trim()) { setSearchResults([]); return }
    const { data } = await supabase.from('cases').select('*')
      .or(`customer_name.ilike.%${q}%,phone.ilike.%${q}%,id_number.ilike.%${q}%`)
      .order('updated_at', { ascending: false }).limit(20)
    setSearchResults(data || [])
  }

  function showList(title: string, list: any[]) { setModalTitle(title); setModalList(list); setShowListModal(true) }

  const [toast, setToast] = useState('')
  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(''), 2500) }

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: 'var(--text3)' }}>טוען...</div>

  const myCases = cases.filter(c => c.agent_id === profile.id)
  const todayCases = myCases.filter(c => { const d = c.created_at > c.updated_at ? c.created_at : c.updated_at; return d?.startsWith(new Date().toISOString().split('T')[0]) })
  const allIP = myCases.filter(c => c.status_name === 'בטיפול נציג')
  const filteredIP = allIP.filter(c => rangeFilter(c, ipFilter))
  const overdueCases = myCases.filter(c => isOverdue(c))
  const mgrWait = cases.filter(c => isMgrWaitOverdue(c))
  const mgrActive = cases.filter(c => isMgrActiveOverdue(c))
  const doneMine = myCases.filter(c => c.status_name?.includes('טופל')).length
  const isAdmin = profile?.role === 'admin'
  const h = new Date().getHours()
  const greeting = (h < 12 ? 'בוקר טוב' : 'אחר הצהריים טובים') + ', ' + profile?.full_name + ' 👋'
  const days = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת']
  const dateStr = days[new Date().getDay()] + ', ' + new Date().toLocaleDateString('he-IL', { day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <>
      <Topbar userName={profile?.full_name || ''} userRole={profile?.role || 'agent'} />
      <div style={{ padding: '22px 26px', maxWidth: 1600, margin: '0 auto' }}>

        {/* Header */}
        <div className="page-header">
          <div>
            <div className="page-title">{greeting}</div>
            <div style={{ fontSize: 13, color: 'var(--text3)', marginTop: 2 }}>{dateStr}</div>
          </div>
          <a href="/new-case" className="btn btn-primary">＋ פניה חדשה</a>
        </div>

        {/* Stats */}
        <div className="stats-grid" style={{ gridTemplateColumns: isAdmin ? 'repeat(7,1fr)' : 'repeat(5,1fr)' }}>
          <div className="stat-card clickable" onClick={() => showList('📅 פניות היום', todayCases)}>
            <div className="stat-icon" style={{ background: 'var(--accent-lt)' }}>📅</div>
            <div className="stat-num" style={{ color: 'var(--accent)' }}>{todayCases.length}</div>
            <div className="stat-lbl">פניות היום</div>
          </div>
          <div className="stat-card clickable" onClick={() => showList('⏳ בטיפול נציג', allIP)}>
            <div className="stat-icon" style={{ background: 'var(--amber-lt)' }}>⏳</div>
            <div className="stat-num" style={{ color: 'var(--amber)' }}>{allIP.length}</div>
            <div className="stat-lbl">בטיפול נציג</div>
          </div>
          <div className="stat-card clickable" onClick={() => showList('🔴 חריגת ימי עסקים', overdueCases)}>
            <div className="stat-icon" style={{ background: 'var(--red-lt)' }}>🔴</div>
            <div className="stat-num" style={{ color: 'var(--red)' }}>{overdueCases.length}</div>
            <div className="stat-lbl">חריגת ימי עסקים</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon" style={{ background: 'var(--green-lt)' }}>✅</div>
            <div className="stat-num" style={{ color: 'var(--green)' }}>{doneMine}</div>
            <div className="stat-lbl">טופל — שלי</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon" style={{ background: 'var(--bg4)' }}>📋</div>
            <div className="stat-num" style={{ color: 'var(--text2)' }}>{myCases.length}</div>
            <div className="stat-lbl">סה"כ שלי</div>
          </div>
          {isAdmin && <>
            <div className="stat-card clickable" onClick={() => showList('🟣 ממתין לשיחת מנהל', mgrWait)} style={{ borderRight: '3px solid var(--purple)' }}>
              <div className="stat-icon" style={{ background: 'var(--purple-lt)' }}>🟣</div>
              <div className="stat-num" style={{ color: 'var(--purple)' }}>{mgrWait.length}</div>
              <div className="stat-lbl">ממתין מנהל</div>
            </div>
            <div className="stat-card clickable" onClick={() => showList('🟣 בטיפול שיחת מנהל', mgrActive)} style={{ borderRight: '3px solid var(--purple)' }}>
              <div className="stat-icon" style={{ background: 'var(--purple-lt)' }}>🟣</div>
              <div className="stat-num" style={{ color: 'var(--purple)' }}>{mgrActive.length}</div>
              <div className="stat-lbl">בטיפול מנהל</div>
            </div>
          </>}
        </div>

        {/* Search */}
        <div className="card card-pad" style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, color: 'var(--text2)' }}>🔍 חיפוש פניה</div>
          <div style={{ display: 'flex', gap: 10 }}>
            <input className="form-input" value={searchQ} onChange={e => doSearch(e.target.value)} placeholder="חיפוש לפי שם לקוח, טלפון, ת״ז..." style={{ flex: 1, fontSize: 14 }} />
            <button className="btn" onClick={() => { setSearchQ(''); setSearchResults([]) }}>נקה</button>
          </div>
          {searchResults.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 8 }}>{searchResults.length} תוצאות</div>
              {searchResults.map(c => <CaseCard key={c.id} c={c} onClick={() => openCase(c)} />)}
            </div>
          )}
        </div>

        {/* Bottom grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
          <div className="card">
            <div className="card-header">
              <div className="card-title">📅 פניות היום שלי</div>
              <span className="badge b-blue">{todayCases.length}</span>
            </div>
            <div style={{ padding: '10px 14px', maxHeight: 360, overflowY: 'auto' }}>
              <MiniList cases={todayCases} empty="אין פניות היום" onClick={openCase} />
            </div>
          </div>

          <div className="card">
            <div className="card-header" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                <div className="card-title">⏳ בטיפול נציג — שלי</div>
                <span className="badge b-amber">{filteredIP.length}</span>
              </div>
              <div className="filter-pills">
                {Object.entries(RANGE_LABELS).map(([k, v]) => (
                  <span key={k} className={`pill${ipFilter === k ? ' active' : ''}`} onClick={() => setIpFilter(k)}>{v}</span>
                ))}
              </div>
            </div>
            <div style={{ padding: '10px 14px', maxHeight: 320, overflowY: 'auto' }}>
              <MiniList cases={filteredIP} empty="אין פניות בטיפול" onClick={openCase} />
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <div className="card-title" style={{ color: 'var(--red)' }}>🔴 חריגת ימי עסקים</div>
              <span className="badge b-red">{overdueCases.length}</span>
            </div>
            <div style={{ padding: '8px 14px', fontSize: 11, color: 'var(--text3)', borderBottom: '1px solid var(--border)' }}>פניות שלא עודכנו תוך 2 ימי עסקים</div>
            <div style={{ padding: '10px 14px', maxHeight: 320, overflowY: 'auto' }}>
              <MiniList cases={overdueCases} empty="אין חריגות" onClick={openCase} />
            </div>
          </div>
        </div>

        {/* Admin: manager overdue */}
        {isAdmin && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 16 }}>
            <div className="card">
              <div className="card-header">
                <div className="card-title" style={{ color: 'var(--purple)' }}>🟣 ממתין לשיחת מנהל — חריגה</div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span className="badge b-purple">{mgrWait.length}</span>
                  <button className="btn btn-xs" onClick={() => showList('ממתין לשיחת מנהל', mgrWait)}>הצג הכל</button>
                </div>
              </div>
              <div style={{ padding: '8px 14px', fontSize: 11, color: 'var(--text3)', borderBottom: '1px solid var(--border)' }}>הועבר לשיחת מנהל מעל 2 ימי עסקים</div>
              <div style={{ padding: '10px 14px', maxHeight: 280, overflowY: 'auto' }}>
                <MiniList cases={mgrWait} empty="אין חריגות" onClick={openCase} />
              </div>
            </div>
            <div className="card">
              <div className="card-header">
                <div className="card-title" style={{ color: 'var(--purple)' }}>🟣 בטיפול שיחת מנהל — חריגה</div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span className="badge b-purple">{mgrActive.length}</span>
                  <button className="btn btn-xs" onClick={() => showList('בטיפול שיחת מנהל', mgrActive)}>הצג הכל</button>
                </div>
              </div>
              <div style={{ padding: '8px 14px', fontSize: 11, color: 'var(--text3)', borderBottom: '1px solid var(--border)' }}>בטיפול שיחת מנהל מעל 2 ימי עסקים</div>
              <div style={{ padding: '10px 14px', maxHeight: 280, overflowY: 'auto' }}>
                <MiniList cases={mgrActive} empty="אין חריגות" onClick={openCase} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Case detail modal */}
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
            <div className="divider" />
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 8 }}>סטטוס</div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
              <select className="form-input" value={editStatus} onChange={e => setEditStatus(e.target.value)} style={{ flex: 1 }}>
                {statuses.map(s => <option key={s.id}>{s.name}</option>)}
              </select>
              <button className="btn btn-primary btn-sm" onClick={saveStatus}>עדכן</button>
            </div>
            <div className="divider" />
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 10 }}>📝 תיעוד ידני</div>
            <div style={{ marginBottom: 12, maxHeight: 180, overflowY: 'auto' }}>
              {logs.length ? logs.map(l => (
                <div key={l.id} className="log-entry">
                  <div className="log-meta">{fmt(l.created_at)} — {l.author_name}</div>
                  <div className="log-text">{l.content}</div>
                </div>
              )) : <div style={{ color: 'var(--text3)', fontSize: 12, padding: '8px 0' }}>אין תיעודים עדיין</div>}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <textarea className="form-input" rows={2} value={newLog} onChange={e => setNewLog(e.target.value)} placeholder="הוסף הערה לתיעוד..." style={{ flex: 1 }} />
              <button className="btn btn-success btn-sm" style={{ alignSelf: 'flex-start' }} onClick={addLog}>+ הוסף</button>
            </div>
          </div>
        </div>
      )}

      {/* List modal */}
      {showListModal && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowListModal(false) }}>
          <div className="modal">
            <div className="modal-header">
              <div className="modal-title">{modalTitle}</div>
              <button className="close-btn" onClick={() => setShowListModal(false)}>✕</button>
            </div>
            {modalList.length ? modalList.map(c => (
              <CaseCard key={c.id} c={c} onClick={() => { setShowListModal(false); openCase(c) }} />
            )) : <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text3)' }}>אין פניות</div>}
          </div>
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}
    </>
  )
}

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

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(''), 2500) }

  useEffect(() => {
    if (!profile) return
    supabase.from('statuses').select('*').order('sort_order').then(({ data }) => setStatuses(data || []))
    supabase.from('organizations').select('*').order('name').then(({ data }) => setOrgs(data || []))
    supabase.from('profiles').select('id, full_name').eq('active', true).order('full_name').then(({ data }) => setAgents(data || []))
    loadReport()
  }, [profile])

  async function loadReport() {
    let q = supabase.from('cases').select('*').gte('created_at', from).lte('created_at', to + 'T23:59:59')
    if (fOrg) q = q.eq('org_name', fOrg)
    if (fStatus) q = q.eq('status_name', fStatus)
    if (fCat1) q = q.eq('cat1_name', fCat1)
    if (fCat2) q = q.eq('cat2_name', fCat2)
    if (fCat3) q = q.eq('cat3_name', fCat3)
    if (fAgent) q = q.eq('agent_id', fAgent)
    const { data } = await q.order('created_at', { ascending: false })
    const d = data || []
    setCases(d)
    setCat1s(Array.from(new Set(d.map((c: any) => c.cat1_name).filter(Boolean))))
    setCat2s(Array.from(new Set(d.map((c: any) => c.cat2_name).filter(Boolean))))
    setCat3s(Array.from(new Set(d.map((c: any) => c.cat3_name).filter(Boolean))))
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

  if (loading) return null
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

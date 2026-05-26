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
  const [statuses, setStatuses] = useState<any[]>([])
  const [orgs, setOrgs] = useState<any[]>([])

  useEffect(() => {
    if (!profile) return
    supabase.from('cases').select('*').order('updated_at', { ascending: false }).then(({ data }) => { setCases(data || []); setFiltered(data || []) })
    supabase.from('statuses').select('*').order('sort_order').then(({ data }) => setStatuses(data || []))
    supabase.from('organizations').select('*').order('name').then(({ data }) => setOrgs(data || []))
  }, [profile])

  useEffect(() => {
    const q = search.toLowerCase()
    setFiltered(cases.filter(c => {
      if (fStatus && c.status_name !== fStatus) return false
      if (fOrg && c.org_name !== fOrg) return false
      if (q && !c.customer_name?.toLowerCase().includes(q) && !c.phone?.includes(q) && !c.id_number?.includes(q)) return false
      return true
    }))
  }, [search, fStatus, fOrg, cases])

  if (loading) return null
  if (profile?.role !== 'admin') return <div style={{ padding: 40 }}>אין הרשאה</div>

  const total = cases.length
  const open = cases.filter(c => c.status_name === 'בטיפול נציג').length
  const none = cases.filter(c => c.status_name === 'אין מענה').length
  const done = cases.filter(c => c.status_name?.includes('טופל')).length

  return (
    <>
      <Topbar userName={profile?.full_name || ''} userRole={profile?.role || 'agent'} />
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

        <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          <input className="form-input" value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 שם, טלפון, ת״ז..." style={{ maxWidth: 260 }} />
          <select className="form-input" value={fStatus} onChange={e => setFStatus(e.target.value)} style={{ width: 190 }}>
            <option value="">כל הסטטוסים</option>
            {statuses.map(s => <option key={s.id}>{s.name}</option>)}
          </select>
          <select className="form-input" value={fOrg} onChange={e => setFOrg(e.target.value)} style={{ width: 170 }}>
            <option value="">כל הארגונים</option>
            {orgs.map(o => <option key={o.id}>{o.name}</option>)}
          </select>
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
                  <tr key={c.id} className={isOverdue(c) ? 'overdue-row' : ''}>
                    <td className="td-muted">#{c.id}</td>
                    <td style={{ fontWeight: 600 }}>{c.customer_name}{isOverdue(c) && <span className="overdue-label" style={{ marginRight: 6 }}>חריגה</span>}</td>
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
    </>
  )
}

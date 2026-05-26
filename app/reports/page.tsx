'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useUser } from '@/lib/useUser'
import Topbar from '@/components/Topbar'
import { fmt, statusBadgeClass } from '@/lib/utils'
import * as XLSX from 'xlsx'

export default function ReportsPage() {
  const { profile, loading } = useUser()
  const supabase = createClient()
  const [cases, setCases] = useState<any[]>([])
  const [statuses, setStatuses] = useState<any[]>([])
  const [orgs, setOrgs] = useState<any[]>([])
  const [cat1s, setCat1s] = useState<string[]>([])
  const [cat2s, setCat2s] = useState<string[]>([])
  const [cat3s, setCat3s] = useState<string[]>([])

  const now = new Date()
  const [from, setFrom] = useState(new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0])
  const [to, setTo] = useState(new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0])
  const [fOrg, setFOrg] = useState('')
  const [fStatus, setFStatus] = useState('')
  const [fCat1, setFCat1] = useState('')
  const [fCat2, setFCat2] = useState('')
  const [fCat3, setFCat3] = useState('')

  useEffect(() => {
    if (!profile) return
    supabase.from('statuses').select('*').order('sort_order').then(({ data }) => setStatuses(data || []))
    supabase.from('organizations').select('*').order('name').then(({ data }) => setOrgs(data || []))
    loadReport()
  }, [profile])

  async function loadReport() {
    let q = supabase.from('cases').select('*').gte('created_at', from).lte('created_at', to + 'T23:59:59')
    if (fOrg) q = q.eq('org_name', fOrg)
    if (fStatus) q = q.eq('status_name', fStatus)
    if (fCat1) q = q.eq('cat1_name', fCat1)
    if (fCat2) q = q.eq('cat2_name', fCat2)
    if (fCat3) q = q.eq('cat3_name', fCat3)
    const { data } = await q.order('created_at', { ascending: false })
    const d = data || []
    setCases(d)
    setCat1s([...new Set(d.map((c: any) => c.cat1_name).filter(Boolean))])
    setCat2s([...new Set(d.map((c: any) => c.cat2_name).filter(Boolean))])
    setCat3s([...new Set(d.map((c: any) => c.cat3_name).filter(Boolean))])
  }

  function exportExcel() {
    const rows = cases.map(c => ({
      'מספר פניה': c.id,
      'תאריך יצירה': fmt(c.created_at),
      'תאריך עדכון': fmt(c.updated_at),
      'שם לקוח': c.customer_name,
      'סטטוס': c.status_name,
      'ת"ז': c.id_number,
      'טלפון': c.phone,
      'סיווג 1': c.cat1_name,
      'סיווג 2': c.cat2_name,
      'סיווג 3': c.cat3_name,
      'ספק': c.supplier_name,
      'הטבה': c.benefit_name,
      'תוכן': c.content,
      'ארגון': c.org_name,
      'נציג': c.agent_name,
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'דוח פניות')
    XLSX.writeFile(wb, `crm_report_${new Date().toISOString().split('T')[0]}.xlsx`)
  }

  if (loading) return null
  if (profile?.role !== 'admin') return <div style={{ padding: 40 }}>אין הרשאה</div>

  return (
    <>
      <Topbar userName={profile?.full_name || ''} userRole={profile?.role || 'agent'} />
      <div style={{ padding: '22px 26px' }}>
        <div className="page-header"><div className="page-title">דוחות</div></div>
        <div className="card card-pad" style={{ maxWidth: 920, marginBottom: 18 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 14 }}>סינון דוח</div>
          <div className="form-row">
            <div className="form-group"><label className="form-label">תאריך מ</label><input className="form-input" type="date" value={from} onChange={e => setFrom(e.target.value)} /></div>
            <div className="form-group"><label className="form-label">תאריך עד</label><input className="form-input" type="date" value={to} onChange={e => setTo(e.target.value)} /></div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">ארגון / פעילות</label>
              <select className="form-input" value={fOrg} onChange={e => setFOrg(e.target.value)}>
                <option value="">כל הארגונים</option>
                {orgs.map(o => <option key={o.id}>{o.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">סטטוס</label>
              <select className="form-input" value={fStatus} onChange={e => setFStatus(e.target.value)}>
                <option value="">כל הסטטוסים</option>
                {statuses.map(s => <option key={s.id}>{s.name}</option>)}
              </select>
            </div>
          </div>
          <div className="form-row-3" style={{ marginBottom: 14 }}>
            <div className="form-group">
              <label className="form-label">סיווג ראשון</label>
              <select className="form-input" value={fCat1} onChange={e => setFCat1(e.target.value)}>
                <option value="">הכל</option>
                {cat1s.map(v => <option key={v}>{v}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">סיווג שני</label>
              <select className="form-input" value={fCat2} onChange={e => setFCat2(e.target.value)}>
                <option value="">הכל</option>
                {cat2s.map(v => <option key={v}>{v}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">סיווג שלישי</label>
              <select className="form-input" value={fCat3} onChange={e => setFCat3(e.target.value)}>
                <option value="">הכל</option>
                {cat3s.map(v => <option key={v}>{v}</option>)}
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
                <th>#</th><th>תאריך יצירה</th><th>תאריך עדכון</th><th>שם לקוח</th>
                <th>סטטוס</th><th>ת״ז</th><th>טלפון</th>
                <th>סיווג 1</th><th>סיווג 2</th><th>סיווג 3</th>
                <th>ספק</th><th>הטבה</th><th>תוכן</th><th>ארגון</th><th>נציג</th>
              </tr></thead>
              <tbody>
                {cases.length ? cases.map(c => (
                  <tr key={c.id}>
                    <td className="td-muted">#{c.id}</td>
                    <td style={{ whiteSpace: 'nowrap', fontSize: 11 }}>{fmt(c.created_at)}</td>
                    <td style={{ whiteSpace: 'nowrap', fontSize: 11 }}>{fmt(c.updated_at)}</td>
                    <td style={{ fontWeight: 500 }}>{c.customer_name}</td>
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
    </>
  )
}

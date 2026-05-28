'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useUser } from '@/lib/useUser'
import Topbar from '@/components/Topbar'
import { businessDaysBetween } from '@/lib/utils'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid, Cell } from 'recharts'

const COLORS = ['#2563eb','#16a34a','#d97706','#dc2626','#7c3aed','#0d9488','#c026d3','#ea580c']

function israelDay(d: string) {
  return new Date(new Date(d).toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' }))
}

type Period = { label: string; from: Date; to: Date }

function getPeriods(mode: string): [Period, Period] {
  const now = new Date()
  const today = israelDay(now.toISOString())
  if (mode === 'week') {
    const s = new Date(today); s.setDate(today.getDate() - today.getDay())
    const ps = new Date(s); ps.setDate(s.getDate() - 7)
    const pe = new Date(s); pe.setDate(s.getDate() - 1)
    return [{ label: 'שבוע זה', from: s, to: today }, { label: 'שבוע קודם', from: ps, to: pe }]
  }
  if (mode === 'month') {
    const s = new Date(today.getFullYear(), today.getMonth(), 1)
    const ps = new Date(today.getFullYear(), today.getMonth() - 1, 1)
    const pe = new Date(today.getFullYear(), today.getMonth(), 0)
    return [{ label: 'חודש זה', from: s, to: today }, { label: 'חודש קודם', from: ps, to: pe }]
  }
  if (mode === 'quarter') {
    const q = Math.floor(today.getMonth() / 3)
    const s = new Date(today.getFullYear(), q * 3, 1)
    const ps = new Date(today.getFullYear(), q * 3 - 3, 1)
    const pe = new Date(today.getFullYear(), q * 3, 0)
    return [{ label: 'רבעון זה', from: s, to: today }, { label: 'רבעון קודם', from: ps, to: pe }]
  }
  if (mode === 'year') {
    const s = new Date(today.getFullYear(), 0, 1)
    const ps = new Date(today.getFullYear() - 1, 0, 1)
    const pe = new Date(today.getFullYear() - 1, 11, 31)
    return [{ label: String(today.getFullYear()), from: s, to: today }, { label: String(today.getFullYear() - 1), from: ps, to: pe }]
  }
  // default: month
  const s = new Date(today.getFullYear(), today.getMonth(), 1)
  const ps = new Date(today.getFullYear(), today.getMonth() - 1, 1)
  const pe = new Date(today.getFullYear(), today.getMonth(), 0)
  return [{ label: 'חודש זה', from: s, to: today }, { label: 'חודש קודם', from: ps, to: pe }]
}

function inPeriod(dateStr: string, p: Period) {
  const d = israelDay(dateStr)
  return d >= p.from && d <= p.to
}

export default function AnalyticsPage() {
  const { profile, loading } = useUser()
  const supabase = createClient()
  const [cases, setCases] = useState<any[]>([])
  const [orgs, setOrgs] = useState<any[]>([])
  const [compareMode, setCompareMode] = useState('month')
  const [fOrg, setFOrg] = useState('')
  const [trendDays, setTrendDays] = useState(30)

  useEffect(() => {
    if (!profile) return
    supabase.from('cases').select('*').order('created_at').then(({ data }) => setCases(data || []))
    supabase.from('organizations').select('*').order('name').then(({ data }) => setOrgs(data || []))
  }, [profile])

  if (loading) return null
  if (profile?.role !== 'admin') return <div style={{ padding: 40 }}>אין הרשאה</div>

  const [cur, prev] = getPeriods(compareMode)
  const all = fOrg ? cases.filter(c => c.org_name === fOrg) : cases
  const curCases = all.filter(c => inPeriod(c.created_at, cur))
  const prevCases = all.filter(c => inPeriod(c.created_at, prev))

  function kpi(arr: any[], key: string) {
    if (key === 'total') return arr.length
    if (key === 'done') return arr.filter(c => c.status_name?.includes('טופל')).length
    if (key === 'open') return arr.filter(c => c.status_name === 'בטיפול נציג').length
    if (key === 'no_answer') return arr.filter(c => c.status_name === 'אין מענה').length
    if (key === 'mgr') return arr.filter(c => c.status_name?.includes('מנהל')).length
    if (key === 'rate') return arr.length ? Math.round(arr.filter(c => c.status_name?.includes('טופל')).length / arr.length * 100) : 0
    return 0
  }

  function delta(cur: number, prev: number) {
    if (!prev) return null
    const d = Math.round((cur - prev) / prev * 100)
    return d
  }

  const kpis = [
    { label: 'סה"כ פניות', key: 'total', color: '#2563eb', icon: '📋' },
    { label: 'טופל', key: 'done', color: '#16a34a', icon: '✅' },
    { label: 'בטיפול נציג', key: 'open', color: '#d97706', icon: '⏳' },
    { label: 'אין מענה', key: 'no_answer', color: '#dc2626', icon: '📵' },
    { label: 'טיפול מנהל', key: 'mgr', color: '#7c3aed', icon: '🟣' },
    { label: '% טיפול', key: 'rate', color: '#0d9488', icon: '📈', suffix: '%' },
  ]

  // Trend data
  const now = new Date()
  const trendMap: Record<string, number> = {}
  for (let i = trendDays - 1; i >= 0; i--) {
    const d = new Date(now); d.setDate(now.getDate() - i)
    trendMap[d.toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' })] = 0
  }
  all.forEach(c => {
    const d = new Date(c.created_at).toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' })
    if (trendMap[d] !== undefined) trendMap[d]++
  })
  const trendData = Object.entries(trendMap).map(([date, count]) => ({
    date: new Date(date).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit' }), count
  }))

  // Org+status breakdown
  const orgStatusMap: Record<string, any> = {}
  curCases.forEach(c => {
    const org = (c.org_name || 'לא ידוע').split(' ')[0]
    if (!orgStatusMap[org]) orgStatusMap[org] = { name: org, טופל: 0, 'בטיפול נציג': 0, 'אין מענה': 0, אחר: 0 }
    if (c.status_name?.includes('טופל')) orgStatusMap[org]['טופל']++
    else if (c.status_name === 'בטיפול נציג') orgStatusMap[org]['בטיפול נציג']++
    else if (c.status_name === 'אין מענה') orgStatusMap[org]['אין מענה']++
    else orgStatusMap[org]['אחר']++
  })
  const orgStatusData = Object.values(orgStatusMap).sort((a: any, b: any) => (b['טופל'] + b['בטיפול נציג'] + b['אין מענה'] + b['אחר']) - (a['טופל'] + a['בטיפול נציג'] + a['אין מענה'] + a['אחר']))

  // Recurring top 10
  const cat2Map: Record<string, number> = {}
  curCases.forEach(c => { if (c.cat2_name) cat2Map[c.cat2_name] = (cat2Map[c.cat2_name] || 0) + 1 })
  const recurringData = Object.entries(cat2Map).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([name, count]) => ({ name, count }))

  // Agent performance
  const agentMap: Record<string, any> = {}
  curCases.forEach(c => {
    if (!c.agent_name) return
    if (!agentMap[c.agent_name]) agentMap[c.agent_name] = { name: c.agent_name, total: 0, done: 0, overdue: 0 }
    agentMap[c.agent_name].total++
    if (c.status_name?.includes('טופל')) agentMap[c.agent_name].done++
    if (c.status_name !== 'טופל' && c.status_name !== 'טופל לאחר שיחת מנהל') {
      if (businessDaysBetween(new Date(c.created_at), new Date(c.updated_at)) > 2) agentMap[c.agent_name].overdue++
    }
  })
  const agentData = Object.values(agentMap).sort((a: any, b: any) => b.total - a.total)

  const COMPARE_MODES = [
    { k: 'week', v: 'שבוע' }, { k: 'month', v: 'חודש' },
    { k: 'quarter', v: 'רבעון' }, { k: 'year', v: 'שנה' }
  ]

  return (
    <>
      <Topbar userName={profile?.full_name || ''} userRole="admin" userEmail={profile?.email || ''} />
      <div style={{ padding: '22px 26px' }}>
        <div className="page-header">
          <div className="page-title">📊 דשבורד</div>
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
          <select className="form-input" value={fOrg} onChange={e => setFOrg(e.target.value)} style={{ width: 180 }}>
            <option value="">כל הפעילויות</option>
            {orgs.map(o => <option key={o.id}>{o.name}</option>)}
          </select>
          <div style={{ display: 'flex', gap: 4 }}>
            {COMPARE_MODES.map(m => (
              <button key={m.k} onClick={() => setCompareMode(m.k)} style={{
                padding: '5px 14px', borderRadius: 999, fontSize: 12, fontWeight: 600,
                cursor: 'pointer', fontFamily: 'Heebo,sans-serif', border: 'none',
                background: compareMode === m.k ? '#2563eb' : '#f1f3f8',
                color: compareMode === m.k ? '#fff' : '#4b5568'
              }}>{m.v}</button>
            ))}
          </div>
        </div>

        {/* KPI comparison */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 12, marginBottom: 20 }}>
          {kpis.map(k => {
            const curVal = kpi(curCases, k.key)
            const prevVal = kpi(prevCases, k.key)
            const d = delta(curVal, prevVal)
            return (
              <div key={k.key} className="stat-card">
                <div style={{ fontSize: 20, marginBottom: 4 }}>{k.icon}</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: k.color }}>{curVal}{k.suffix || ''}</div>
                <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>{k.label}</div>
                <div style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ color: 'var(--text3)' }}>{prev.label}: {prevVal}{k.suffix || ''}</span>
                  {d !== null && (
                    <span style={{ fontWeight: 700, color: d >= 0 ? '#16a34a' : '#dc2626' }}>
                      {d >= 0 ? '▲' : '▼'}{Math.abs(d)}%
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Trend */}
        <div className="card card-pad" style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 700 }}>📈 מגמת פניות</div>
            <div style={{ display: 'flex', gap: 4 }}>
              {[[7,'7 ימים'],[30,'חודש'],[90,'3 חודשים'],[365,'שנה']].map(([d,l]) => (
                <button key={d} onClick={() => setTrendDays(Number(d))} style={{
                  padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 600,
                  cursor: 'pointer', fontFamily: 'Heebo,sans-serif', border: 'none',
                  background: trendDays === d ? '#2563eb' : '#f1f3f8',
                  color: trendDays === d ? '#fff' : '#4b5568'
                }}>{l}</button>
              ))}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f3f8" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} interval={Math.floor(trendData.length / 8)} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Line type="monotone" dataKey="count" stroke="#2563eb" strokeWidth={2} dot={false} name="פניות" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
          {/* Org + status breakdown */}
          <div className="card card-pad">
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 14 }}>🏢 פניות לפי פעילות וסטטוס</div>
            {orgStatusData.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={orgStatusData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f3f8" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="טופל" stackId="a" fill="#16a34a" />
                  <Bar dataKey="בטיפול נציג" stackId="a" fill="#2563eb" />
                  <Bar dataKey="אין מענה" stackId="a" fill="#d97706" />
                  <Bar dataKey="אחר" stackId="a" fill="#9ca3af" />
                </BarChart>
              </ResponsiveContainer>
            ) : <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text3)' }}>אין נתונים</div>}
          </div>

          {/* Recurring top 10 */}
          <div className="card card-pad">
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 14 }}>🔁 פניות חוזרות — Top 10 סיווג שני</div>
            <div style={{ overflowY: 'auto', maxHeight: 260 }}>
              {recurringData.length > 0 ? recurringData.map((r, i) => (
                <div key={r.name} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: i < 3 ? '#dc2626' : '#9ca3af', minWidth: 20 }}>#{i + 1}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#111827' }}>{r.name}</div>
                    <div style={{ height: 6, background: '#f1f3f8', borderRadius: 3, marginTop: 3 }}>
                      <div style={{ width: `${Math.round(r.count / recurringData[0].count * 100)}%`, height: '100%', background: i < 3 ? '#dc2626' : '#2563eb', borderRadius: 3 }} />
                    </div>
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 700, color: i < 3 ? '#dc2626' : '#374151', minWidth: 24, textAlign: 'right' }}>{r.count}</span>
                </div>
              )) : <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text3)' }}>אין נתונים</div>}
            </div>
          </div>
        </div>

        {/* Agent performance */}
        <div className="card card-pad">
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 14 }}>🏆 ביצועי נציגים — {cur.label}</div>
          <table style={{ fontSize: 12 }}>
            <thead>
              <tr>
                <th>נציג</th>
                <th style={{ textAlign: 'center' }}>סה"כ</th>
                <th style={{ textAlign: 'center' }}>טופל</th>
                <th style={{ textAlign: 'center' }}>% טיפול</th>
                <th style={{ textAlign: 'center' }}>⚠ חריגות</th>
                <th>ביצועים</th>
              </tr>
            </thead>
            <tbody>
              {agentData.map((a: any) => {
                const rate = a.total ? Math.round(a.done / a.total * 100) : 0
                const rateColor = rate >= 80 ? '#16a34a' : rate >= 50 ? '#d97706' : '#dc2626'
                return (
                  <tr key={a.name}>
                    <td style={{ fontWeight: 500 }}>{a.name}</td>
                    <td style={{ textAlign: 'center' }}><span className="badge b-gray">{a.total}</span></td>
                    <td style={{ textAlign: 'center' }}><span className="badge b-green">{a.done}</span></td>
                    <td style={{ textAlign: 'center' }}><span style={{ fontWeight: 700, color: rateColor }}>{rate}%</span></td>
                    <td style={{ textAlign: 'center' }}>
                      {a.overdue > 0
                        ? <span className="badge b-red">⚠ {a.overdue}</span>
                        : <span className="badge b-green">✓ 0</span>}
                    </td>
                    <td style={{ minWidth: 120 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ flex: 1, height: 8, background: '#e5e7eb', borderRadius: 4 }}>
                          <div style={{ width: rate + '%', height: '100%', background: rateColor, borderRadius: 4, transition: 'width 0.3s' }} />
                        </div>
                      </div>
                    </td>
                  </tr>
                )
              })}
              {agentData.length === 0 && <tr><td colSpan={6} style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text3)' }}>אין נתונים לתקופה זו</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}

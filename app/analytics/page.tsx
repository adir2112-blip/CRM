'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useUser } from '@/lib/useUser'
import Topbar from '@/components/Topbar'
import { businessDaysBetween, fmt, statusBadgeClass } from '@/lib/utils'
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid, Cell, BarChart, Bar } from 'recharts'
import * as XLSX from 'xlsx'

const COLORS = ['#6366f1','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#ec4899','#84cc16']
const CM: Record<string,any> = {
  'טופל': '#10b981', 'טופל לאחר שיחת מנהל': '#0d9488',
  'בטיפול נציג': '#6366f1', 'הועבר לשיחת מנהל': '#8b5cf6',
  'בטיפול בשיחת מנהל': '#a855f7', 'אין מענה': '#f59e0b',
}

function israelDay(d: string) {
  return new Date(new Date(d).toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' }))
}

type Period = { label: string; from: Date; to: Date }

function getPeriods(mode: string, customFrom: string, customTo: string): [Period, Period] {
  const now = new Date()
  const today = israelDay(now.toISOString())
  if (mode === 'custom' && customFrom && customTo) {
    return [
      { label: 'טווח נבחר', from: new Date(customFrom), to: new Date(customTo) },
      { label: 'השוואה', from: new Date(customFrom), to: new Date(customTo) }
    ]
  }
  if (mode === 'week') {
    const s = new Date(today); s.setDate(today.getDate() - 7)
    const ps = new Date(today); ps.setDate(today.getDate() - 14)
    const pe = new Date(today); pe.setDate(today.getDate() - 8)
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
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [recurringModal, setRecurringModal] = useState<{title:string, cases:any[]} | null>(null)
  const [selectedCase, setSelectedCase] = useState<any>(null)

  useEffect(() => {
    if (!profile) return
    supabase.from('cases').select('*').order('created_at').then(({ data }) => setCases(data || []))
    supabase.from('organizations').select('*').order('name').then(({ data }) => setOrgs(data || []))
  }, [profile])

  if (loading) return null
  if (profile?.role !== 'admin') return <div style={{ padding: 40 }}>אין הרשאה</div>

  const [cur, prev] = getPeriods(compareMode, customFrom, customTo)
  const all = fOrg ? cases.filter(c => c.org_name === fOrg) : cases
  const curCases = all.filter(c => inPeriod(c.created_at, cur))
  const prevCases = compareMode !== 'custom' ? all.filter(c => inPeriod(c.created_at, prev)) : []

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
    return Math.round((cur - prev) / prev * 100)
  }

  const kpis = [
    { label: 'סה"כ פניות', key: 'total', color: '#6366f1', icon: '📋' },
    { label: 'טופל', key: 'done', color: '#10b981', icon: '✅' },
    { label: 'בטיפול נציג', key: 'open', color: '#f59e0b', icon: '⏳' },
    { label: 'אין מענה', key: 'no_answer', color: '#ef4444', icon: '📵' },
    { label: 'טיפול מנהל', key: 'mgr', color: '#8b5cf6', icon: '🟣' },
    { label: '% טיפול', key: 'rate', color: '#0d9488', icon: '📈', suffix: '%' },
  ]

  // Trend with comparison
  const now = new Date()
  const trendMap: Record<string, { cur: number, prev: number }> = {}
  for (let i = trendDays - 1; i >= 0; i--) {
    const d = new Date(now); d.setDate(now.getDate() - i)
    const key = d.toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' })
    trendMap[key] = { cur: 0, prev: 0 }
  }
  all.forEach(c => {
    const d = new Date(c.created_at).toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' })
    if (trendMap[d] !== undefined) trendMap[d].cur++
  })
  // Prev period trend
  if (compareMode !== 'custom') {
    all.forEach(c => {
      const cDay = israelDay(c.created_at)
      if (cDay >= prev.from && cDay <= prev.to) {
        const offset = Math.round((prev.to.getTime() - cDay.getTime()) / 864e5)
        const mappedDay = new Date(now); mappedDay.setDate(now.getDate() - offset)
        const key = mappedDay.toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' })
        if (trendMap[key] !== undefined) trendMap[key].prev++
      }
    })
  }
  const trendData = Object.entries(trendMap).slice(-Math.min(trendDays, 30)).map(([date, v]) => ({
    date: new Date(date).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit' }),
    [cur.label]: v.cur,
    ...(compareMode !== 'custom' ? { [prev.label]: v.prev } : {})
  }))

  // Org+status — modern horizontal stacked
  const orgMap: Record<string, any> = {}
  curCases.forEach(c => {
    const org = (c.org_name || 'לא ידוע').split(' ')[0]
    if (!orgMap[org]) orgMap[org] = { name: org, טופל: 0, 'בטיפול נציג': 0, 'אין מענה': 0, אחר: 0, total: 0 }
    if (c.status_name?.includes('טופל')) orgMap[org]['טופל']++
    else if (c.status_name === 'בטיפול נציג') orgMap[org]['בטיפול נציג']++
    else if (c.status_name === 'אין מענה') orgMap[org]['אין מענה']++
    else orgMap[org]['אחר']++
    orgMap[org].total++
  })
  const orgData = Object.values(orgMap).sort((a: any, b: any) => b.total - a.total).slice(0, 8)

  // Recurring top 10
  const cat2Map: Record<string, { count: number, cases: any[] }> = {}
  curCases.forEach(c => {
    if (!c.cat2_name) return
    if (!cat2Map[c.cat2_name]) cat2Map[c.cat2_name] = { count: 0, cases: [] }
    cat2Map[c.cat2_name].count++
    cat2Map[c.cat2_name].cases.push(c)
  })
  const recurringData = Object.entries(cat2Map).sort((a, b) => b[1].count - a[1].count).slice(0, 10).map(([name, v]) => ({ name, ...v }))
  const maxRecurring = recurringData[0]?.count || 1

  function exportRecurringExcel(cases: any[], title: string) {
    const rows = cases.map(c => ({ '#': c.id, 'שם לקוח': c.customer_name, 'טלפון': c.phone, 'ארגון': c.org_name, 'סיווג 2': c.cat2_name, 'סטטוס': c.status_name, 'נציג': c.agent_name, 'תאריך': new Date(c.created_at).toLocaleDateString('he-IL') }))
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, title.slice(0, 30))
    XLSX.writeFile(wb, `${title}_${new Date().toISOString().split('T')[0]}.xlsx`)
  }

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

  const COMPARE_MODES = [{ k:'week',v:'שבוע' },{ k:'month',v:'חודש' },{ k:'quarter',v:'רבעון' },{ k:'year',v:'שנה' },{ k:'custom',v:'מותאם' }]

  const cardStyle = { background:'#fff', borderRadius:16, border:'1px solid #e2e8f0', boxShadow:'0 2px 12px rgba(0,0,0,0.06)', padding:'20px 24px' }

  return (
    <>
      <Topbar userName={profile?.full_name||''} userRole="admin" userEmail={profile?.email||''} />
      <div style={{ padding:'22px 26px', background:'#f8fafc', minHeight:'100vh' }}>
        <div className="page-header">
          <div className="page-title">🎯 דשבורד</div>
        </div>

        {/* Filters */}
        <div style={{ display:'flex', gap:10, marginBottom:20, alignItems:'center', flexWrap:'wrap', ...cardStyle, padding:'14px 20px' }}>
          <select className="form-input" value={fOrg} onChange={e => setFOrg(e.target.value)} style={{ width:180 }}>
            <option value="">כל הפעילויות</option>
            {orgs.map(o => <option key={o.id}>{o.name}</option>)}
          </select>
          <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
            {COMPARE_MODES.map(m => (
              <button key={m.k} onClick={() => setCompareMode(m.k)} style={{ padding:'5px 14px', borderRadius:999, fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'Heebo,sans-serif', border:'none', background:compareMode===m.k?'#6366f1':'#f1f5f9', color:compareMode===m.k?'#fff':'#4b5568', transition:'all 0.15s' }}>{m.v}</button>
            ))}
          </div>
          {compareMode === 'custom' && <>
            <input className="form-input" type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} style={{ width:140 }} />
            <span style={{ fontSize:12, color:'var(--text3)' }}>—</span>
            <input className="form-input" type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} style={{ width:140 }} />
          </>}
          {compareMode !== 'custom' && <span style={{ fontSize:12, color:'#94a3b8' }}>משווה {cur.label} מול {prev.label}</span>}
        </div>

        {/* KPI Cards */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(6,1fr)', gap:12, marginBottom:20 }}>
          {kpis.map(k => {
            const curVal = kpi(curCases, k.key)
            const prevVal = kpi(prevCases, k.key)
            const d = compareMode !== 'custom' ? delta(curVal, prevVal) : null
            return (
              <div key={k.key} style={{ ...cardStyle, padding:'16px', textAlign:'center' }}>
                <div style={{ fontSize:24, marginBottom:6 }}>{k.icon}</div>
                <div style={{ fontSize:26, fontWeight:800, color:k.color, lineHeight:1 }}>{curVal}{k.suffix||''}</div>
                <div style={{ fontSize:11, color:'#64748b', margin:'4px 0' }}>{k.label}</div>
                {d !== null && (
                  <div style={{ fontSize:11, fontWeight:700, color:d>=0?'#10b981':'#ef4444', background:d>=0?'#f0fdf4':'#fef2f2', borderRadius:999, padding:'2px 8px', display:'inline-block' }}>
                    {d>=0?'▲':'▼'}{Math.abs(d)}% מ-{prev.label}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Trend */}
        <div style={{ ...cardStyle, marginBottom:16 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
            <div style={{ fontSize:14, fontWeight:700, color:'#1e293b' }}>📈 מגמת פניות {compareMode !== 'custom' ? `— ${cur.label} מול ${prev.label}` : ''}</div>
            <div style={{ display:'flex', gap:4 }}>
              {[[7,'7 ימים'],[14,'14 ימים'],[30,'חודש'],[90,'3 חודשים']].map(([d,l]) => (
                <button key={d} onClick={() => setTrendDays(Number(d))} style={{ padding:'3px 10px', borderRadius:999, fontSize:11, fontWeight:600, cursor:'pointer', fontFamily:'Heebo,sans-serif', border:'none', background:trendDays===d?'#6366f1':'#f1f5f9', color:trendDays===d?'#fff':'#4b5568' }}>{l}</button>
              ))}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="date" tick={{ fontSize:10, fill:'#94a3b8' }} interval={Math.floor(trendData.length/8)} />
              <YAxis tick={{ fontSize:10, fill:'#94a3b8' }} />
              <Tooltip contentStyle={{ borderRadius:10, border:'1px solid #e2e8f0', boxShadow:'0 4px 12px rgba(0,0,0,0.08)' }} />
              <Legend wrapperStyle={{ fontSize:12 }} />
              <Line type="monotone" dataKey={cur.label} stroke="#6366f1" strokeWidth={2.5} dot={false} />
              {compareMode !== 'custom' && <Line type="monotone" dataKey={prev.label} stroke="#94a3b8" strokeWidth={1.5} dot={false} strokeDasharray="4 2" />}
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:16 }}>
          {/* Org + status — modern */}
          <div style={cardStyle}>
            <div style={{ fontSize:14, fontWeight:700, color:'#1e293b', marginBottom:16 }}>🏢 פניות לפי פעילות וסטטוס</div>
            {orgData.length > 0 ? (
              <div style={{ overflowY:'auto', maxHeight:280 }}>
                {orgData.map((org: any) => {
                  const total = org.total || 1
                  return (
                    <div key={org.name} style={{ marginBottom:14 }}>
                      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                        <span style={{ fontSize:12, fontWeight:600, color:'#334155' }}>{org.name}</span>
                        <span style={{ fontSize:11, color:'#94a3b8' }}>{org.total}</span>
                      </div>
                      <div style={{ height:20, borderRadius:10, overflow:'hidden', display:'flex', background:'#f1f5f9' }}>
                        {['טופל','בטיפול נציג','אין מענה','אחר'].map(key => {
                          const val = org[key] || 0
                          const pct = Math.round(val / total * 100)
                          const colors: Record<string,string> = { 'טופל':'#10b981', 'בטיפול נציג':'#6366f1', 'אין מענה':'#f59e0b', 'אחר':'#cbd5e1' }
                          if (!pct) return null
                          return <div key={key} style={{ width:`${pct}%`, background:colors[key], transition:'width 0.3s', display:'flex', alignItems:'center', justifyContent:'center' }}>
                            {pct > 8 && <span style={{ fontSize:9, color:'#fff', fontWeight:700 }}>{pct}%</span>}
                          </div>
                        })}
                      </div>
                      <div style={{ display:'flex', gap:8, marginTop:4, flexWrap:'wrap' }}>
                        {['טופל','בטיפול נציג','אין מענה'].map(key => org[key] > 0 && (
                          <span key={key} style={{ fontSize:10, color:'#64748b' }}>
                            <span style={{ display:'inline-block', width:6, height:6, borderRadius:'50%', background:{'טופל':'#10b981','בטיפול נציג':'#6366f1','אין מענה':'#f59e0b'}[key], marginLeft:3 }} />
                            {key}: {org[key]}
                          </span>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : <div style={{ textAlign:'center', padding:'2rem', color:'#94a3b8' }}>אין נתונים</div>}
          </div>

          {/* Recurring top 10 */}
          <div style={cardStyle}>
            <div style={{ fontSize:14, fontWeight:700, color:'#1e293b', marginBottom:16 }}>🔁 פניות חוזרות — Top 10</div>
            <div style={{ overflowY:'auto', maxHeight:280 }}>
              {recurringData.length > 0 ? recurringData.map((r, i) => (
                <div key={r.name} onClick={() => setRecurringModal({ title: r.name, cases: r.cases })} style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10, cursor:'pointer', padding:'6px 8px', borderRadius:8, transition:'background 0.15s' }}
                  onMouseEnter={e => (e.currentTarget.style.background='#f8fafc')}
                  onMouseLeave={e => (e.currentTarget.style.background='transparent')}>
                  <span style={{ fontSize:11, fontWeight:800, color:i<3?'#ef4444':'#94a3b8', minWidth:20, textAlign:'center' }}>#{i+1}</span>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:12, fontWeight:600, color:'#1e293b', marginBottom:3 }}>{r.name}</div>
                    <div style={{ height:6, background:'#f1f5f9', borderRadius:3 }}>
                      <div style={{ width:`${Math.round(r.count/maxRecurring*100)}%`, height:'100%', background:i<3?'#ef4444':'#6366f1', borderRadius:3 }} />
                    </div>
                  </div>
                  <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:2 }}>
                    <span style={{ fontSize:13, fontWeight:800, color:i<3?'#ef4444':'#334155' }}>{r.count}</span>
                    <button onClick={e => { e.stopPropagation(); exportRecurringExcel(r.cases, r.name) }} style={{ fontSize:9, padding:'1px 5px', borderRadius:4, background:'#f0fdf4', color:'#15803d', border:'1px solid #bbf7d0', cursor:'pointer', fontFamily:'Heebo,sans-serif' }}>Excel</button>
                  </div>
                </div>
              )) : <div style={{ textAlign:'center', padding:'2rem', color:'#94a3b8' }}>אין נתונים</div>}
            </div>
          </div>
        </div>

        {/* Agent performance */}
        <div style={cardStyle}>
          <div style={{ fontSize:14, fontWeight:700, color:'#1e293b', marginBottom:16 }}>🏆 ביצועי נציגים — {cur.label}</div>
          <table style={{ fontSize:12, width:'100%' }}>
            <thead><tr>
              <th style={{ textAlign:'right', padding:'6px 10px', color:'#64748b', fontWeight:600, fontSize:11, textTransform:'uppercase', letterSpacing:'0.4px' }}>נציג</th>
              <th style={{ textAlign:'center', color:'#64748b', fontWeight:600, fontSize:11, textTransform:'uppercase' }}>סה"כ</th>
              <th style={{ textAlign:'center', color:'#64748b', fontWeight:600, fontSize:11, textTransform:'uppercase' }}>טופל</th>
              <th style={{ textAlign:'center', color:'#64748b', fontWeight:600, fontSize:11, textTransform:'uppercase' }}>% טיפול</th>
              <th style={{ textAlign:'center', color:'#64748b', fontWeight:600, fontSize:11, textTransform:'uppercase' }}>⚠ חריגות</th>
              <th style={{ color:'#64748b', fontWeight:600, fontSize:11, textTransform:'uppercase' }}>ביצועים</th>
            </tr></thead>
            <tbody>
              {agentData.map((a: any) => {
                const rate = a.total ? Math.round(a.done / a.total * 100) : 0
                const rateColor = rate >= 80 ? '#10b981' : rate >= 50 ? '#f59e0b' : '#ef4444'
                return (
                  <tr key={a.name} style={{ borderTop:'1px solid #f1f5f9' }}>
                    <td style={{ padding:'10px', fontWeight:600, color:'#1e293b' }}>{a.name}</td>
                    <td style={{ textAlign:'center' }}><span style={{ background:'#f1f5f9', borderRadius:999, padding:'2px 10px', fontSize:12, fontWeight:600 }}>{a.total}</span></td>
                    <td style={{ textAlign:'center' }}><span style={{ background:'#f0fdf4', color:'#15803d', borderRadius:999, padding:'2px 10px', fontSize:12, fontWeight:600 }}>{a.done}</span></td>
                    <td style={{ textAlign:'center' }}><span style={{ fontWeight:800, color:rateColor, fontSize:13 }}>{rate}%</span></td>
                    <td style={{ textAlign:'center' }}>
                      {a.overdue > 0
                        ? <span style={{ background:'#fef2f2', color:'#ef4444', borderRadius:999, padding:'2px 10px', fontSize:12, fontWeight:700 }}>⚠ {a.overdue}</span>
                        : <span style={{ background:'#f0fdf4', color:'#10b981', borderRadius:999, padding:'2px 10px', fontSize:12 }}>✓ 0</span>}
                    </td>
                    <td style={{ minWidth:140, padding:'10px' }}>
                      <div style={{ height:8, background:'#f1f5f9', borderRadius:4, overflow:'hidden' }}>
                        <div style={{ width:rate+'%', height:'100%', background:`linear-gradient(90deg, ${rateColor}, ${rateColor}99)`, borderRadius:4, transition:'width 0.3s' }} />
                      </div>
                    </td>
                  </tr>
                )
              })}
              {agentData.length===0 && <tr><td colSpan={6} style={{ textAlign:'center', padding:'2rem', color:'#94a3b8' }}>אין נתונים</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recurring modal */}
      {recurringModal && (
        <div className="modal-overlay" onClick={e => { if(e.target===e.currentTarget) setRecurringModal(null) }}>
          <div className="modal" style={{ maxWidth:800 }}>
            <div className="modal-header">
              <div className="modal-title">🔁 {recurringModal.title} ({recurringModal.cases.length})</div>
              <div style={{ display:'flex', gap:8 }}>
                <button className="btn btn-success btn-sm" onClick={() => exportRecurringExcel(recurringModal.cases, recurringModal.title)}>📥 Excel</button>
                <button className="close-btn" onClick={() => setRecurringModal(null)}>✕</button>
              </div>
            </div>
            <div style={{ maxHeight:460, overflowY:'auto' }}>
              <table>
                <thead><tr><th>#</th><th>שם לקוח</th><th>טלפון</th><th>ארגון</th><th>סטטוס</th><th>נציג</th><th>תאריך</th></tr></thead>
                <tbody>
                  {recurringModal.cases.map(c => (
                    <tr key={c.id} style={{ cursor:'pointer' }} onClick={() => { setSelectedCase(c); setRecurringModal(null) }}>
                      <td className="td-muted">#{c.id}</td>
                      <td style={{ fontWeight:600, color:'var(--accent)' }}>{c.customer_name}</td>
                      <td className="td-mono">{c.phone}</td>
                      <td><span className="badge b-gray" style={{ fontSize:10 }}>{(c.org_name||'').split(' ')[0]}</span></td>
                      <td><span className={`badge ${statusBadgeClass(c.status_name)}`}>{c.status_name}</span></td>
                      <td>{c.agent_name}</td>
                      <td className="td-muted" style={{ fontSize:11 }}>{fmt(c.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Case detail modal */}
      {selectedCase && (
        <div className="modal-overlay" onClick={e => { if(e.target===e.currentTarget) setSelectedCase(null) }}>
          <div className="modal">
            <div className="modal-header">
              <div className="modal-title">פניה #{selectedCase.id} — {selectedCase.customer_name}</div>
              <button className="close-btn" onClick={() => setSelectedCase(null)}>✕</button>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
              {[['שם לקוח',selectedCase.customer_name],['ארגון',selectedCase.org_name],['טלפון',selectedCase.phone],['ת״ז',selectedCase.id_number],['סיווג 1',selectedCase.cat1_name],['סיווג 2',selectedCase.cat2_name],['סטטוס',selectedCase.status_name],['נציג',selectedCase.agent_name]].map(([l,v]) => v ? (
                <div key={l} style={{ background:'var(--bg3)', borderRadius:'var(--radius-sm)', padding:'10px 13px' }}>
                  <div style={{ fontSize:10, fontWeight:700, color:'var(--text3)', textTransform:'uppercase', marginBottom:3 }}>{l}</div>
                  <div style={{ fontSize:13 }}>{v}</div>
                </div>
              ):null)}
            </div>
            {selectedCase.content && <div style={{ marginTop:12, background:'var(--bg3)', borderRadius:8, padding:'10px 12px', fontSize:13, color:'var(--text2)', lineHeight:1.6 }}>{selectedCase.content}</div>}
          </div>
        </div>
      )}
    </>
  )
}

'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useUser } from '@/lib/useUser'
import Topbar from '@/components/Topbar'
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, LineChart, Line, CartesianGrid } from 'recharts'

const COLORS = ['#2563eb','#16a34a','#d97706','#dc2626','#7c3aed','#0d9488','#c026d3','#ea580c','#0891b2','#65a30d']

const DATE_LABELS: Record<string,string> = { today:'היום', yesterday:'אתמול', week:'שבוע', month:'חודש', '3m':'3 חודשים', '6m':'חצי שנה', year:'שנה', all:'הכל' }

export default function AnalyticsPage() {
  const { profile, loading } = useUser()
  const supabase = createClient()
  const [cases, setCases] = useState<any[]>([])
  const [orgs, setOrgs] = useState<any[]>([])
  const [fOrg, setFOrg] = useState('')
  const [fDate, setFDate] = useState('month')
  const [loadingData, setLoadingData] = useState(true)

  useEffect(() => {
    if (!profile) return
    supabase.from('organizations').select('*').order('name').then(({ data }) => setOrgs(data || []))
    loadData()
  }, [profile])

  async function loadData() {
    setLoadingData(true)
    const { data } = await supabase.from('cases').select('*').order('created_at')
    setCases(data || [])
    setLoadingData(false)
  }

  if (loading) return null
  if (profile?.role !== 'admin') return <div style={{ padding: 40 }}>אין הרשאה</div>

  // Filter cases
  const now = new Date()
  const filtered = cases.filter(c => {
    if (fOrg && c.org_name !== fOrg) return false
    if (fDate === 'all') return true
    const nowDay = new Date(now.toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' }))
    const dDay = new Date(new Date(c.created_at).toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' }))
    const diff = Math.round((nowDay.getTime() - dDay.getTime()) / 864e5)
    if (fDate === 'today') return diff === 0
    if (fDate === 'yesterday') return diff === 1
    if (fDate === 'week') return diff <= 7
    if (fDate === 'month') return diff <= 30
    if (fDate === '3m') return diff <= 90
    if (fDate === '6m') return diff <= 180
    if (fDate === 'year') return diff <= 365
    return true
  })

  // KPIs
  const total = filtered.length
  const open = filtered.filter(c => c.status_name === 'בטיפול נציג').length
  const done = filtered.filter(c => c.status_name?.includes('טופל')).length
  const noAnswer = filtered.filter(c => c.status_name === 'אין מענה').length
  const mgrCases = filtered.filter(c => c.status_name?.includes('מנהל')).length
  const doneRate = total > 0 ? Math.round(done / total * 100) : 0

  // By status
  const statusCounts: Record<string,number> = {}
  filtered.forEach(c => { statusCounts[c.status_name] = (statusCounts[c.status_name]||0)+1 })
  const statusData = Object.entries(statusCounts).map(([name,value]) => ({ name, value })).sort((a,b) => b.value-a.value)

  // By org
  const orgCounts: Record<string,number> = {}
  filtered.forEach(c => { if(c.org_name) orgCounts[c.org_name] = (orgCounts[c.org_name]||0)+1 })
  const orgData = Object.entries(orgCounts).map(([name,value]) => ({ name: name.split(' ')[0], value })).sort((a,b) => b.value-a.value).slice(0,8)

  // By agent
  const agentCounts: Record<string,{total:number,done:number}> = {}
  filtered.forEach(c => {
    if (!c.agent_name) return
    if (!agentCounts[c.agent_name]) agentCounts[c.agent_name] = {total:0,done:0}
    agentCounts[c.agent_name].total++
    if (c.status_name?.includes('טופל')) agentCounts[c.agent_name].done++
  })
  const agentData = Object.entries(agentCounts).map(([name,v]) => ({ name: name.split(' ')[0], ...v, rate: Math.round(v.done/v.total*100) })).sort((a,b) => b.total-a.total).slice(0,10)

  // By day (last 30 days)
  const dayMap: Record<string,number> = {}
  const days = fDate === 'week' ? 7 : fDate === 'month' ? 30 : fDate === '3m' ? 90 : 30
  for (let i = days-1; i >= 0; i--) {
    const d = new Date(now); d.setDate(now.getDate()-i)
    dayMap[d.toLocaleDateString('en-CA',{timeZone:'Asia/Jerusalem'})] = 0
  }
  filtered.forEach(c => {
    const d = new Date(c.created_at).toLocaleDateString('en-CA',{timeZone:'Asia/Jerusalem'})
    if (dayMap[d] !== undefined) dayMap[d]++
  })
  const trendData = Object.entries(dayMap).slice(-30).map(([date,count]) => ({
    date: new Date(date).toLocaleDateString('he-IL',{day:'2-digit',month:'2-digit'}), count
  }))

  // Recurring by cat2
  const cat2Counts: Record<string,number> = {}
  filtered.forEach(c => { if(c.cat2_name) cat2Counts[c.cat2_name] = (cat2Counts[c.cat2_name]||0)+1 })
  const recurringData = Object.entries(cat2Counts).sort((a,b) => b[1]-a[1]).slice(0,10).map(([name,count]) => ({ name, count }))

  const kpiCards = [
    { icon:'📋', num:total, label:'סה"כ פניות', color:'var(--accent)', bg:'var(--accent-lt)' },
    { icon:'⏳', num:open, label:'בטיפול נציג', color:'#d97706', bg:'#fffbeb' },
    { icon:'✅', num:done, label:'טופל', color:'#16a34a', bg:'#f0fdf4' },
    { icon:'📵', num:noAnswer, label:'אין מענה', color:'#dc2626', bg:'#fef2f2' },
    { icon:'🟣', num:mgrCases, label:'טיפול מנהל', color:'#7c3aed', bg:'#f5f3ff' },
    { icon:'📈', num:doneRate+'%', label:'אחוז טיפול', color:'#0d9488', bg:'#f0fdfa' },
  ]

  return (
    <>
      <Topbar userName={profile?.full_name||''} userRole={profile?.role||'agent'} userEmail={profile?.email||''} />
      <div style={{ padding:'22px 26px' }}>
        <div className="page-header">
          <div className="page-title">📊 אנליטיקס ודוחות</div>
        </div>

        {/* Filters */}
        <div style={{ display:'flex', gap:10, marginBottom:20, alignItems:'center', flexWrap:'wrap' }}>
          <select className="form-input" value={fOrg} onChange={e => setFOrg(e.target.value)} style={{ width:180 }}>
            <option value="">כל הפעילויות</option>
            {orgs.map(o => <option key={o.id}>{o.name}</option>)}
          </select>
          <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
            {Object.entries(DATE_LABELS).map(([k,v]) => (
              <button key={k} onClick={() => setFDate(k)} style={{ padding:'5px 14px', borderRadius:999, fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'Heebo,sans-serif', border:'none', background:fDate===k?'#2563eb':'#f1f3f8', color:fDate===k?'#fff':'#4b5568', transition:'all 0.15s' }}>{v}</button>
            ))}
          </div>
          <span style={{ fontSize:13, color:'var(--text3)', marginRight:'auto' }}>{loadingData ? 'טוען...' : `${filtered.length} פניות`}</span>
        </div>

        {/* KPI Cards */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(6,1fr)', gap:12, marginBottom:20 }}>
          {kpiCards.map((k,i) => (
            <div key={i} className="stat-card">
              <div className="stat-icon" style={{ background:k.bg }}>{k.icon}</div>
              <div className="stat-num" style={{ color:k.color }}>{k.num}</div>
              <div className="stat-lbl">{k.label}</div>
            </div>
          ))}
        </div>

        {/* Trend chart */}
        <div className="card card-pad" style={{ marginBottom:16 }}>
          <div style={{ fontSize:14, fontWeight:700, marginBottom:14 }}>📈 מגמת פניות לאורך זמן</div>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f3f8" />
              <XAxis dataKey="date" tick={{ fontSize:10 }} interval={Math.floor(trendData.length/8)} />
              <YAxis tick={{ fontSize:10 }} />
              <Tooltip />
              <Line type="monotone" dataKey="count" stroke="#2563eb" strokeWidth={2} dot={false} name="פניות" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Charts row 1 */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:16 }}>
          {/* By status */}
          <div className="card card-pad">
            <div style={{ fontSize:13, fontWeight:700, marginBottom:14 }}>📊 פניות לפי סטטוס</div>
            {statusData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={statusData} cx="50%" cy="50%" innerRadius={50} outerRadius={90} dataKey="value">
                    {statusData.map((_,i) => <Cell key={i} fill={COLORS[i%COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                  <Legend iconSize={10} wrapperStyle={{ fontSize:11 }} />
                </PieChart>
              </ResponsiveContainer>
            ) : <div style={{ textAlign:'center', padding:'2rem', color:'var(--text3)' }}>אין נתונים</div>}
          </div>

          {/* By org */}
          <div className="card card-pad">
            <div style={{ fontSize:13, fontWeight:700, marginBottom:14 }}>🏢 פניות לפי פעילות</div>
            {orgData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={orgData} layout="vertical">
                  <XAxis type="number" tick={{ fontSize:10 }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize:10 }} width={80} />
                  <Tooltip />
                  <Bar dataKey="value" name="פניות" radius={[0,4,4,0]}>
                    {orgData.map((_,i) => <Cell key={i} fill={COLORS[i%COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : <div style={{ textAlign:'center', padding:'2rem', color:'var(--text3)' }}>אין נתונים</div>}
          </div>
        </div>

        {/* Charts row 2 */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:16 }}>
          {/* By agent */}
          <div className="card card-pad">
            <div style={{ fontSize:13, fontWeight:700, marginBottom:14 }}>👥 פניות לפי נציג</div>
            {agentData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={agentData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f3f8" />
                  <XAxis dataKey="name" tick={{ fontSize:10 }} />
                  <YAxis tick={{ fontSize:10 }} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize:11 }} />
                  <Bar dataKey="total" name="סה״כ" fill="#2563eb" radius={[4,4,0,0]} />
                  <Bar dataKey="done" name="טופל" fill="#16a34a" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <div style={{ textAlign:'center', padding:'2rem', color:'var(--text3)' }}>אין נתונים</div>}
          </div>

          {/* Recurring */}
          <div className="card card-pad">
            <div style={{ fontSize:13, fontWeight:700, marginBottom:14 }}>🔁 פניות חוזרות — Top 10 סיווג שני</div>
            {recurringData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={recurringData} layout="vertical">
                  <XAxis type="number" tick={{ fontSize:10 }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize:9 }} width={120} />
                  <Tooltip />
                  <Bar dataKey="count" name="פניות" radius={[0,4,4,0]}>
                    {recurringData.map((_,i) => <Cell key={i} fill={i<3?'#dc2626':COLORS[i%COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : <div style={{ textAlign:'center', padding:'2rem', color:'var(--text3)' }}>אין נתונים</div>}
          </div>
        </div>

        {/* Agent performance table */}
        <div className="card card-pad">
          <div style={{ fontSize:13, fontWeight:700, marginBottom:14 }}>🏆 ביצועי נציגים</div>
          <table style={{ fontSize:12 }}>
            <thead><tr><th>נציג</th><th style={{ textAlign:'center' }}>סה"כ</th><th style={{ textAlign:'center' }}>טופל</th><th style={{ textAlign:'center' }}>בטיפול</th><th style={{ textAlign:'center' }}>אין מענה</th><th style={{ textAlign:'center' }}>% טיפול</th></tr></thead>
            <tbody>
              {Object.entries(agentCounts).sort((a,b) => b[1].total-a[1].total).map(([name, v]) => {
                const inProgress = filtered.filter(c => c.agent_name === name && c.status_name === 'בטיפול נציג').length
                const noAns = filtered.filter(c => c.agent_name === name && c.status_name === 'אין מענה').length
                const rate = Math.round(v.done/v.total*100)
                return (
                  <tr key={name}>
                    <td style={{ fontWeight:500 }}>{name}</td>
                    <td style={{ textAlign:'center' }}><span className="badge b-gray">{v.total}</span></td>
                    <td style={{ textAlign:'center' }}><span className="badge b-green">{v.done}</span></td>
                    <td style={{ textAlign:'center' }}><span className="badge b-blue">{inProgress}</span></td>
                    <td style={{ textAlign:'center' }}><span className="badge b-amber">{noAns}</span></td>
                    <td style={{ textAlign:'center' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                        <div style={{ flex:1, height:6, background:'#e5e7eb', borderRadius:3 }}>
                          <div style={{ width:rate+'%', height:'100%', background:rate>=80?'#16a34a':rate>=50?'#d97706':'#dc2626', borderRadius:3 }} />
                        </div>
                        <span style={{ fontSize:11, fontWeight:600, color:rate>=80?'#16a34a':rate>=50?'#d97706':'#dc2626', minWidth:30 }}>{rate}%</span>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}

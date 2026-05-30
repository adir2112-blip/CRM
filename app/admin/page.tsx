'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useUser } from '@/lib/useUser'
import Topbar from '@/components/Topbar'
import * as XLSX from 'xlsx'

const SUPER_ADMIN = 'adir2112@gmail.com'

function OnlineUsersTab() {
  const supabase = createClient()
  const [sessions, setSessions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    // Consider active if last_ping within 10 minutes
    const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString()
    const today = new Date().toISOString().split('T')[0]
    const { data } = await supabase
      .from('user_sessions')
      .select('*')
      .gte('login_at', today)
      .order('login_at', { ascending: false })
    setSessions(data || [])
    setLoading(false)
  }

  useEffect(() => { load(); const t = setInterval(load, 30000); return () => clearInterval(t) }, [])

  function fmt(d: string) {
    return new Date(d).toLocaleString('he-IL', { timeZone:'Asia/Jerusalem', hour:'2-digit', minute:'2-digit', day:'2-digit', month:'2-digit' })
  }

  function duration(login: string, logout?: string) {
    const from = new Date(login)
    const to = logout ? new Date(logout) : new Date()
    const mins = Math.round((to.getTime() - from.getTime()) / 60000)
    if (mins < 60) return `${mins} דק'`
    return `${Math.floor(mins/60)}:${String(mins%60).padStart(2,'0')} ש'`
  }

  const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString()
  const active = sessions.filter(s => s.is_active && s.last_ping > tenMinAgo)
  const inactive = sessions.filter(s => !s.is_active || s.last_ping <= tenMinAgo)

  // Group by user for total hours
  const byUser: Record<string, number> = {}
  sessions.forEach(s => {
    const mins = Math.round((new Date(s.logout_at || new Date()).getTime() - new Date(s.login_at).getTime()) / 60000)
    byUser[s.user_name] = (byUser[s.user_name] || 0) + mins
  })

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
        <div style={{ fontSize:13, fontWeight:700 }}>🟢 משתמשים מחוברים היום</div>
        <button className="btn btn-xs" onClick={load}>🔄 רענן</button>
      </div>

      {/* Active now */}
      <div style={{ marginBottom:20 }}>
        <div style={{ fontSize:12, fontWeight:700, color:'#15803d', marginBottom:8 }}>פעילים כרגע ({active.length})</div>
        <div className="card" style={{ padding:0 }}>
          <table>
            <thead><tr><th>נציג</th><th>ארגון</th><th>התחבר</th><th>זמן מחובר</th><th>Ping אחרון</th></tr></thead>
            <tbody>
              {active.length === 0 ? <tr><td colSpan={5} style={{ textAlign:'center', padding:'1.5rem', color:'var(--text3)' }}>אין משתמשים פעילים</td></tr>
              : active.map(s => (
                <tr key={s.id}>
                  <td>
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <span style={{ width:8, height:8, borderRadius:'50%', background:'#10b981', display:'inline-block' }} />
                      <span style={{ fontWeight:600 }}>{s.user_name}</span>
                    </div>
                  </td>
                  <td style={{ fontSize:12, color:'var(--text3)' }}>{s.org_names || '—'}</td>
                  <td style={{ fontSize:12 }}>{fmt(s.login_at)}</td>
                  <td style={{ fontSize:12, fontWeight:600, color:'#059669' }}>{duration(s.login_at)}</td>
                  <td style={{ fontSize:11, color:'var(--text3)' }}>{fmt(s.last_ping)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Today's sessions */}
      <div style={{ marginBottom:20 }}>
        <div style={{ fontSize:12, fontWeight:700, color:'var(--text2)', marginBottom:8 }}>כל הסשנים היום ({sessions.length})</div>
        <div className="card" style={{ padding:0 }}>
          <table>
            <thead><tr><th>נציג</th><th>התחבר</th><th>התנתק</th><th>משך</th></tr></thead>
            <tbody>
              {sessions.map(s => (
                <tr key={s.id} style={{ opacity: s.is_active && s.last_ping > tenMinAgo ? 1 : 0.6 }}>
                  <td>
                    <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                      <span style={{ width:8, height:8, borderRadius:'50%', background: s.is_active && s.last_ping > tenMinAgo ? '#10b981' : '#94a3b8', display:'inline-block' }} />
                      {s.user_name}
                    </div>
                  </td>
                  <td style={{ fontSize:12 }}>{fmt(s.login_at)}</td>
                  <td style={{ fontSize:12, color:'var(--text3)' }}>{s.logout_at ? fmt(s.logout_at) : '—'}</td>
                  <td style={{ fontSize:12, fontWeight:600 }}>{duration(s.login_at, s.logout_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Summary by user */}
      <div>
        <div style={{ fontSize:12, fontWeight:700, color:'var(--text2)', marginBottom:8 }}>סיכום שעות היום</div>
        <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
          {Object.entries(byUser).map(([name, mins]) => (
            <div key={name} style={{ background:'var(--bg3)', borderRadius:10, padding:'10px 16px', border:'1px solid var(--border)', textAlign:'center' }}>
              <div style={{ fontWeight:700, fontSize:13 }}>{name}</div>
              <div style={{ fontSize:18, fontWeight:900, color:'#2563eb', marginTop:4 }}>{Math.floor(mins/60)}:{String(mins%60).padStart(2,'0')}</div>
              <div style={{ fontSize:10, color:'var(--text3)' }}>שעות</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function AgentStatsTab() {
  const supabase = createClient()
  const [stats, setStats] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filterType, setFilterType] = useState<'month'|'range'>('month')
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7))
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [orgFilter, setOrgFilter] = useState('')
  const [orgs, setOrgs] = useState<any[]>([])

  useEffect(() => {
    supabase.from('organizations').select('id,name').order('name').then(({ data }) => setOrgs(data || []))
  }, [])

  useEffect(() => {
    async function load() {
      setLoading(true)
      let from: string, to: string
      if (filterType === 'month') {
        from = month + '-01'
        to = month + '-31'
      } else {
        if (!fromDate || !toDate) { setLoading(false); return }
        from = fromDate
        to = toDate
      }

      let query = supabase.from('cases')
        .select('agent_id, agent_name, status_name, created_at, org_id, org_name')
        .gte('created_at', from).lte('created_at', to + 'T23:59:59')

      if (orgFilter) query = query.eq('org_id', orgFilter)

      const { data } = await query
      const byAgent: Record<string, any> = {}
      ;(data || []).forEach((c: any) => {
        if (!c.agent_name) return
        if (!byAgent[c.agent_name]) byAgent[c.agent_name] = { name: c.agent_name, total: 0, closed: 0 }
        byAgent[c.agent_name].total++
        if (c.status_name?.includes('טופל')) byAgent[c.agent_name].closed++
      })
      setStats(Object.values(byAgent).sort((a: any, b: any) => b.total - a.total))
      setLoading(false)
    }
    load()
  }, [month, fromDate, toDate, orgFilter, filterType])

  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:16, flexWrap:'wrap' }}>
        <div style={{ fontSize:13, fontWeight:700 }}>📊 סטטיסטיקות נציגים</div>
        <div style={{ display:'flex', gap:4 }}>
          <button className={`btn btn-sm${filterType==='month'?' btn-primary':''}`} onClick={() => setFilterType('month')}>לפי חודש</button>
          <button className={`btn btn-sm${filterType==='range'?' btn-primary':''}`} onClick={() => setFilterType('range')}>טווח תאריכים</button>
        </div>
        {filterType === 'month'
          ? <input type="month" className="form-input" value={month} onChange={e => setMonth(e.target.value)} style={{ width:160 }} />
          : <>
            <input type="date" className="form-input" value={fromDate} onChange={e => setFromDate(e.target.value)} style={{ width:150 }} />
            <span style={{ fontSize:12, color:'var(--text3)' }}>—</span>
            <input type="date" className="form-input" value={toDate} onChange={e => setToDate(e.target.value)} style={{ width:150 }} />
          </>
        }
        <select className="form-input" value={orgFilter} onChange={e => setOrgFilter(e.target.value)} style={{ width:180, fontSize:12 }}>
          <option value="">כל הארגונים</option>
          {orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
        </select>
      </div>
      {loading ? <div style={{ textAlign:'center', padding:'2rem', color:'var(--text3)' }}>טוען...</div> : (
        <div className="card" style={{ padding:0 }}>
          <table>
            <thead><tr><th>נציג</th><th style={{ textAlign:'center' }}>סה"כ פניות</th><th style={{ textAlign:'center' }}>טופלו</th><th style={{ textAlign:'center' }}>אחוז טיפול</th></tr></thead>
            <tbody>
              {stats.length === 0 ? <tr><td colSpan={4} style={{ textAlign:'center', padding:'2rem', color:'var(--text3)' }}>אין נתונים לתקופה זו</td></tr>
              : stats.map((s: any) => (
                <tr key={s.name}>
                  <td style={{ fontWeight:600 }}>{s.name}</td>
                  <td style={{ textAlign:'center' }}><span className="badge b-blue">{s.total}</span></td>
                  <td style={{ textAlign:'center' }}><span className="badge b-green">{s.closed}</span></td>
                  <td style={{ textAlign:'center' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <div style={{ flex:1, height:8, background:'#e5e7eb', borderRadius:4, overflow:'hidden' }}>
                        <div style={{ width:`${Math.round(s.closed/s.total*100)}%`, height:'100%', background:'#10b981', borderRadius:4 }} />
                      </div>
                      <span style={{ fontSize:12, fontWeight:700, color:'#059669', minWidth:36 }}>{Math.round(s.closed/s.total*100)}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function AgentStatsTab() {
  const supabase = createClient()
  const [stats, setStats] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filterType, setFilterType] = useState<'month'|'range'>('month')
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7))
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [orgFilter, setOrgFilter] = useState('')
  const [orgs, setOrgs] = useState<any[]>([])

  useEffect(() => {
    supabase.from('organizations').select('id,name').order('name').then(({ data }) => setOrgs(data || []))
  }, [])

  useEffect(() => {
    async function load() {
      setLoading(true)
      let from: string, to: string
      if (filterType === 'month') { from = month + '-01'; to = month + '-31' }
      else { if (!fromDate || !toDate) { setLoading(false); return }; from = fromDate; to = toDate }
      let query = supabase.from('cases').select('agent_name, status_name, created_at').gte('created_at', from).lte('created_at', to + 'T23:59:59')
      if (orgFilter) query = query.eq('org_id', orgFilter)
      const { data } = await query
      const byAgent: Record<string, any> = {}
      ;(data || []).forEach((c: any) => {
        if (!c.agent_name) return
        if (!byAgent[c.agent_name]) byAgent[c.agent_name] = { name: c.agent_name, total: 0, closed: 0 }
        byAgent[c.agent_name].total++
        if (c.status_name?.includes('טופל')) byAgent[c.agent_name].closed++
      })
      setStats(Object.values(byAgent).sort((a: any, b: any) => b.total - a.total))
      setLoading(false)
    }
    load()
  }, [month, fromDate, toDate, orgFilter, filterType])

  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:16, flexWrap:'wrap' }}>
        <div style={{ fontSize:13, fontWeight:700 }}>📊 סטטיסטיקות נציגים</div>
        <div style={{ display:'flex', gap:4 }}>
          <button className={`btn btn-sm${filterType==='month'?' btn-primary':''}`} onClick={() => setFilterType('month')}>לפי חודש</button>
          <button className={`btn btn-sm${filterType==='range'?' btn-primary':''}`} onClick={() => setFilterType('range')}>טווח תאריכים</button>
        </div>
        {filterType === 'month' ? <input type="month" className="form-input" value={month} onChange={e => setMonth(e.target.value)} style={{ width:160 }} />
        : <><input type="date" className="form-input" value={fromDate} onChange={e => setFromDate(e.target.value)} style={{ width:150 }} /><span style={{ fontSize:12, color:'var(--text3)' }}>—</span><input type="date" className="form-input" value={toDate} onChange={e => setToDate(e.target.value)} style={{ width:150 }} /></>}
        <select className="form-input" value={orgFilter} onChange={e => setOrgFilter(e.target.value)} style={{ width:180, fontSize:12 }}>
          <option value="">כל הארגונים</option>
          {orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
        </select>
      </div>
      {loading ? <div style={{ textAlign:'center', padding:'2rem', color:'var(--text3)' }}>טוען...</div> : (
        <div className="card" style={{ padding:0 }}>
          <table>
            <thead><tr><th>נציג</th><th style={{ textAlign:'center' }}>סה"כ פניות</th><th style={{ textAlign:'center' }}>טופלו</th><th style={{ textAlign:'center' }}>אחוז טיפול</th></tr></thead>
            <tbody>
              {stats.length === 0 ? <tr><td colSpan={4} style={{ textAlign:'center', padding:'2rem', color:'var(--text3)' }}>אין נתונים לתקופה זו</td></tr>
              : stats.map((s: any) => (
                <tr key={s.name}>
                  <td style={{ fontWeight:600 }}>{s.name}</td>
                  <td style={{ textAlign:'center' }}><span className="badge b-blue">{s.total}</span></td>
                  <td style={{ textAlign:'center' }}><span className="badge b-green">{s.closed}</span></td>
                  <td style={{ textAlign:'center' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <div style={{ flex:1, height:8, background:'#e5e7eb', borderRadius:4, overflow:'hidden' }}>
                        <div style={{ width:`${Math.round(s.closed/s.total*100)}%`, height:'100%', background:'#10b981', borderRadius:4 }} />
                      </div>
                      <span style={{ fontSize:12, fontWeight:700, color:'#059669', minWidth:36 }}>{Math.round(s.closed/s.total*100)}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function ActivityLogTab() {
  const supabase = createClient()
  const [logs, setLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.from('admin_activity_log')
      .select('*').order('created_at', { ascending: false }).limit(100)
      .then(({ data }) => { setLogs(data || []); setLoading(false) })
  }, [])

  function fmt(d: string) {
    return new Date(d).toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem', day:'2-digit', month:'2-digit', year:'2-digit', hour:'2-digit', minute:'2-digit' })
  }

  return (
    <div>
      <div style={{ fontSize:13, fontWeight:700, marginBottom:16 }}>📋 יומן שינויים</div>
      {loading ? <div style={{ textAlign:'center', padding:'2rem', color:'var(--text3)' }}>טוען...</div> : (
        <div className="card" style={{ padding:0 }}>
          <table>
            <thead><tr><th>תאריך</th><th>בוצע על ידי</th><th>פעולה</th><th>משתמש יעד</th></tr></thead>
            <tbody>
              {logs.length === 0 ? <tr><td colSpan={4} style={{ textAlign:'center', padding:'2rem', color:'var(--text3)' }}>אין פעולות</td></tr>
              : logs.map((l: any) => (
                <tr key={l.id}>
                  <td className="td-muted" style={{ whiteSpace:'nowrap', fontSize:11 }}>{fmt(l.created_at)}</td>
                  <td style={{ fontWeight:600, fontSize:13 }}>{l.performed_by_name}</td>
                  <td style={{ fontSize:12 }}>{l.action}</td>
                  <td style={{ fontSize:12, color:'var(--text3)' }}>{l.target_user}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default function AdminPage() {
  const { profile, loading } = useUser()
  const supabase = createClient()
  const [tab, setTab] = useState('users')
  const [users, setUsers] = useState<any[]>([])
  const [newUser, setNewUser] = useState({ email: '', password: '', full_name: '', role: 'agent' })
  const [newUserOrgs, setNewUserOrgs] = useState<string[]>([])
  const [addingUser, setAddingUser] = useState(false)
  const [userFilter, setUserFilter] = useState('active')
  const [userOrgFilter, setUserOrgFilter] = useState('')
  const [statuses, setStatuses] = useState<any[]>([])
  const [newStatus, setNewStatus] = useState('')
  const [orgs, setOrgs] = useState<any[]>([])
  const [newOrg, setNewOrg] = useState('')
  const [selOrg, setSelOrg] = useState('')
  const [cat1List, setCat1List] = useState<any[]>([])
  const [selCat1, setSelCat1] = useState('')
  const [cat2List, setCat2List] = useState<any[]>([])
  const [cat3Map, setCat3Map] = useState<Record<string, any[]>>({})
  const [newCat1Name, setNewCat1Name] = useState('')
  const [newCat2Name, setNewCat2Name] = useState('')
  const [newCat3Names, setNewCat3Names] = useState<Record<string, string>>({})
  const [newCat3Dyn, setNewCat3Dyn] = useState<Record<string, boolean>>({})
  const [suppliers, setSuppliers] = useState<any[]>([])
  const [benefits, setBenefits] = useState<any[]>([])
  const [newSupplier, setNewSupplier] = useState('')
  const [newBenefit, setNewBenefit] = useState('')
  const [smsTemplates, setSmsTemplates] = useState<any[]>([])
  const [newSms, setNewSms] = useState({ name: '', content: '', org_id: '', org_name: '' })
  const [editingSms, setEditingSms] = useState<any>(null)

  const [editingUserOrgs, setEditingUserOrgs] = useState<any>(null)
  const [editUserOrgsList, setEditUserOrgsList] = useState<string[]>([])
  const [resetPassUser, setResetPassUser] = useState<any>(null)
  const [newPass, setNewPass] = useState('')
  const [toast, setToast] = useState('')

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(''), 2500) }

  useEffect(() => {
    if (!profile) return
    loadUsers(); loadStatuses(); loadOrgs(); loadSuppliers(); loadBenefits(); loadSmsTemplates()
  }, [profile])

  async function loadUsers() {
    const { data } = await supabase.from('profiles').select('*').order('full_name')
    setUsers(data || [])
    // Also fetch last sign in from auth - use the API
    try {
      const res = await fetch('/api/get-users')
      if (res.ok) {
        const authUsers = await res.json()
        setUsers(prev => prev.map(u => {
          const au = authUsers.find((a: any) => a.id === u.id)
          return au ? { ...u, last_sign_in: au.last_sign_in_at } : u
        }))
      }
    } catch {}
  }
  async function loadStatuses() {
    const { data } = await supabase.from('statuses').select('*').order('sort_order')
    setStatuses(data || [])
  }
  async function loadOrgs() {
    const { data } = await supabase.from('organizations').select('*').order('name')
    setOrgs(data || [])
  }
  async function loadSuppliers() {
    const { data } = await supabase.from('suppliers').select('*').order('name')
    setSuppliers(data || [])
  }
  async function loadSmsTemplates() {
    const { data } = await supabase.from('sms_templates').select('*').order('org_name').order('name')
    setSmsTemplates(data || [])
  }
  async function addSmsTemplate() {
    if (!newSms.name || !newSms.content || !newSms.org_id) { alert('שם, תוכן וארגון חובה'); return }
    await supabase.from('sms_templates').insert({ ...newSms })
    setNewSms({ name: '', content: '', org_id: '', org_name: '' })
    loadSmsTemplates(); showToast('תבנית נוספה ✓')
  }
  async function updateSmsTemplate() {
    if (!editingSms) return
    await supabase.from('sms_templates').update({ name: editingSms.name, content: editingSms.content }).eq('id', editingSms.id)
    setEditingSms(null); loadSmsTemplates(); showToast('תבנית עודכנה ✓')
  }
  async function deleteSmsTemplate(id: string) {
    if (!confirm('למחוק תבנית?')) return
    await supabase.from('sms_templates').delete().eq('id', id)
    loadSmsTemplates()
  }

  async function loadBenefits() {
    const { data } = await supabase.from('benefits').select('*').order('name')
    setBenefits(data || [])
  }
  async function loadCat1(orgId: string) {
    setSelOrg(orgId); setSelCat1(''); setCat2List([]); setCat3Map({})
    const { data } = await supabase.from('cat1').select('*').eq('org_id', orgId).order('sort_order')
    setCat1List(data || [])
  }
  async function loadCat2(cat1Id: string) {
    setSelCat1(cat1Id); setCat2List([]); setCat3Map({})
    const { data } = await supabase.from('cat2').select('*').eq('cat1_id', cat1Id).order('sort_order')
    const c2 = data || []
    setCat2List(c2)
    const map: Record<string, any[]> = {}
    for (const c2item of c2) {
      const { data: c3 } = await supabase.from('cat3').select('*').eq('cat2_id', c2item.id).order('sort_order')
      map[c2item.id] = c3 || []
    }
    setCat3Map(map)
  }

  async function createUser() {
    if (!newUser.email || !newUser.password || !newUser.full_name) { alert('כל השדות חובה'); return }
    setAddingUser(true)
    const res = await fetch('/api/create-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...newUser,
        allowed_orgs: newUser.role === 'agent' && newUserOrgs.length > 0 ? newUserOrgs : null
      })
    })
    const data = await res.json()
    if (data.error) { alert('שגיאה: ' + data.error); setAddingUser(false); return }
    setAddingUser(false)
    setNewUser({ email: '', password: '', full_name: '', role: 'agent' })
    setNewUserOrgs([])
    await logActivity(`הוסיף משתמש חדש: ${newUser.full_name} (${newUser.role})`, newUser.email)
    showToast('משתמש נוסף ✓')
    loadUsers()
  }

  async function saveUserOrgs() {
    if (!editingUserOrgs) return
    await supabase.from('profiles').update({ allowed_orgs: editUserOrgsList.length > 0 ? editUserOrgsList : null }).eq('id', editingUserOrgs.id)
    await logActivity(`עדכן מחלקות מורשות`, editingUserOrgs.full_name)
    setEditingUserOrgs(null)
    loadUsers()
    showToast('מחלקות עודכנו ✓')
  }

  function exportAgentsExcel() {
    const rows = users.map(u => ({
      'שם מלא': u.full_name,
      'מייל': u.email || '',
      'תפקיד': u.role === 'admin' ? 'מנהל' : 'נציג',
      'סטטוס': u.active ? 'פעיל' : 'לא פעיל',
      'כניסה אחרונה': u.last_sign_in ? new Date(u.last_sign_in).toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' }) : '—',
      'מחלקות': u.allowed_orgs?.length > 0 ? u.allowed_orgs.map((id: string) => { const o = orgs.find(x => x.id === id); return o?.name || id }).join(', ') : 'כל המחלקות'
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'נציגים')
    XLSX.writeFile(wb, `נציגים_${new Date().toISOString().split('T')[0]}.xlsx`)
  }

  async function logActivity(action: string, targetUser?: string) {
    try {
      await supabase.from('admin_activity_log').insert({
        performed_by: profile.id,
        performed_by_name: profile.full_name,
        action,
        target_user: targetUser || '',
        created_at: new Date().toISOString()
      })
    } catch {}
  }

  async function resetPassword() {
    if (!newPass || newPass.length < 6) { alert('סיסמא חייבת להיות לפחות 6 תווים'); return }
    const res = await fetch('/api/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: resetPassUser.id, password: newPass })
    })
    const data = await res.json()
    if (data.error) { alert('שגיאה: ' + data.error); return }
    await logActivity('איפס סיסמא', resetPassUser.full_name)
    setResetPassUser(null)
    setNewPass('')
    showToast('סיסמא עודכנה ✓')
  }

  async function deleteUser(id: string) {
    if (!confirm('להשבית משתמש?')) return
    const u = users.find(x => x.id === id)
    await supabase.from('profiles').update({ active: false }).eq('id', id)
    await logActivity('השבית משתמש', u?.full_name || id)
    loadUsers()
  }
  async function hardDeleteUser(id: string) {
    if (!confirm('למחוק משתמש לחלוטין? הפניות שלו יישארו')) return
    const u = users.find(x => x.id === id)
    await supabase.from('profiles').delete().eq('id', id)
    await logActivity('מחק משתמש לחלוטין', u?.full_name || id)
    loadUsers()
    showToast('משתמש נמחק ✓')
  }
  async function addStatus() {
    if (!newStatus.trim()) return
    await supabase.from('statuses').insert({ name: newStatus, sort_order: statuses.length + 1 })
    setNewStatus(''); loadStatuses(); showToast('סטטוס נוסף ✓')
  }
  async function deleteStatus(id: string) {
    if (!confirm('למחוק?')) return
    await supabase.from('statuses').delete().eq('id', id)
    loadStatuses()
  }
  async function addOrg() {
    if (!newOrg.trim()) return
    await supabase.from('organizations').insert({ name: newOrg })
    setNewOrg(''); loadOrgs(); showToast('ארגון נוסף ✓')
  }
  async function deleteOrg(id: string) {
    if (!confirm('למחוק ארגון?')) return
    await supabase.from('organizations').delete().eq('id', id)
    loadOrgs()
  }
  async function deleteCat1(id: string) {
    if (!confirm('למחוק סיווג ראשון? כל הסיווגים השניים והשלישיים שלו יימחקו גם')) return
    await supabase.from('cat1').delete().eq('id', id)
    loadCat1(selOrg)
    setSelCat1('')
    setCat2List([])
    setCat3Map({})
  }
  async function addCat1() {
    if (!selOrg || !newCat1Name.trim()) return
    await supabase.from('cat1').insert({ org_id: selOrg, name: newCat1Name, sort_order: cat1List.length + 1 })
    setNewCat1Name(''); loadCat1(selOrg); showToast('סיווג נוסף ✓')
  }
  async function addCat2() {
    if (!selCat1 || !newCat2Name.trim()) return
    await supabase.from('cat2').insert({ cat1_id: selCat1, name: newCat2Name, sort_order: cat2List.length + 1 })
    setNewCat2Name(''); loadCat2(selCat1); showToast('סיווג נוסף ✓')
  }
  async function addCat3(cat2Id: string) {
    const name = newCat3Names[cat2Id]?.trim()
    if (!name) return
    await supabase.from('cat3').insert({ cat2_id: cat2Id, name, opens_dynamic: !!newCat3Dyn[cat2Id], sort_order: (cat3Map[cat2Id]?.length || 0) + 1 })
    setNewCat3Names(p => ({ ...p, [cat2Id]: '' }))
    setNewCat3Dyn(p => ({ ...p, [cat2Id]: false }))
    loadCat2(selCat1); showToast('סיווג נוסף ✓')
  }
  async function toggleDynamic(cat3Id: string, current: boolean) {
    await supabase.from('cat3').update({ opens_dynamic: !current }).eq('id', cat3Id)
    loadCat2(selCat1)
  }
  async function deleteCat3(id: string) {
    if (!confirm('למחוק?')) return
    await supabase.from('cat3').delete().eq('id', id)
    loadCat2(selCat1)
  }
  async function deleteCat2(id: string) {
    if (!confirm('למחוק?')) return
    await supabase.from('cat2').delete().eq('id', id)
    loadCat2(selCat1)
  }
  async function addSupplier() {
    if (!newSupplier.trim()) return
    await supabase.from('suppliers').insert({ name: newSupplier })
    setNewSupplier(''); loadSuppliers(); showToast('ספק נוסף ✓')
  }
  async function deleteSupplier(id: string) {
    if (!confirm('למחוק?')) return
    await supabase.from('suppliers').delete().eq('id', id)
    loadSuppliers()
  }
  async function addBenefit() {
    if (!newBenefit.trim()) return
    await supabase.from('benefits').insert({ name: newBenefit })
    setNewBenefit(''); loadBenefits(); showToast('הטבה נוספה ✓')
  }
  async function deleteBenefit(id: string) {
    if (!confirm('למחוק?')) return
    await supabase.from('benefits').delete().eq('id', id)
    loadBenefits()
  }

  if (loading) return null
  if (profile?.role !== 'admin') return <div style={{ padding: 40 }}>אין הרשאה</div>

  const filteredUsers = users.filter(u => {
    if (userFilter === 'active' && !u.active) return false
    if (userFilter === 'inactive' && u.active) return false
    if (userOrgFilter && u.role === 'agent') {
      if (!u.allowed_orgs || !u.allowed_orgs.includes(userOrgFilter)) return false
    }
    return true
  })

  return (
    <>
      <Topbar userName={profile?.full_name || ''} userRole={profile?.role || 'agent'} userEmail={profile?.email || ''} />
      <div style={{ padding: '22px 26px' }}>
        <div className="page-header"><div className="page-title">ניהול מערכת</div></div>
        <div className="tabs">
          {[['users','משתמשים'],['online','🟢 מחוברים'],['agent-stats','סטטיסטיקות נציגים'],['statuses','סטטוסים'],['orgs','ארגונים'],['cats','סיווגים'],['suppliers','ספקים והטבות'],['sms','SMS תבניות'],['activity','יומן שינויים']].map(([k,v]) => (
            <div key={k} className={`tab${tab===k?' active':''}`} onClick={() => setTab(k)}>{v}</div>
          ))}
        </div>

        {tab === 'users' && (
          <div>
            <div className="card card-pad" style={{ marginBottom: 16, maxWidth: 600 }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>הוסף משתמש חדש</div>
              <div className="form-row">
                <div className="form-group"><label className="form-label">שם מלא</label><input className="form-input" value={newUser.full_name} onChange={e => setNewUser(p => ({ ...p, full_name: e.target.value }))} placeholder="שם מלא" /></div>
                <div className="form-group"><label className="form-label">מייל</label><input className="form-input" type="email" value={newUser.email} onChange={e => setNewUser(p => ({ ...p, email: e.target.value }))} placeholder="email@company.com" /></div>
              </div>
              <div className="form-row">
                <div className="form-group"><label className="form-label">סיסמא</label><input className="form-input" type="password" value={newUser.password} onChange={e => setNewUser(p => ({ ...p, password: e.target.value }))} placeholder="לפחות 6 תווים" /></div>
                <div className="form-group"><label className="form-label">תפקיד</label><select className="form-input" value={newUser.role} onChange={e => setNewUser(p => ({ ...p, role: e.target.value }))}><option value="agent">נציג</option><option value="admin">מנהל</option></select></div>
              </div>
              {newUser.role === 'agent' && (
                <div className="form-group">
                  <label className="form-label">מחלקות מורשות <span style={{ color:'var(--text3)', fontWeight:400 }}>(ריק = גישה לכל המחלקות)</span></label>
                  <div style={{ display:'flex', flexWrap:'wrap', gap:8, padding:'10px 12px', background:'var(--bg3)', borderRadius:8, border:'1px solid var(--border)' }}>
                    {orgs.map(o => (
                      <label key={o.id} style={{ display:'flex', alignItems:'center', gap:6, fontSize:12, cursor:'pointer', padding:'4px 10px', borderRadius:999, background: newUserOrgs.includes(o.id) ? '#dbeafe' : '#fff', border:`1px solid ${newUserOrgs.includes(o.id) ? '#93c5fd' : '#e5e7eb'}`, color: newUserOrgs.includes(o.id) ? '#1d4ed8' : '#374151' }}>
                        <input type="checkbox" checked={newUserOrgs.includes(o.id)} onChange={e => {
                          if (e.target.checked) setNewUserOrgs(prev => [...prev, o.id])
                          else setNewUserOrgs(prev => prev.filter(id => id !== o.id))
                        }} style={{ display:'none' }} />
                        {newUserOrgs.includes(o.id) ? '✓ ' : ''}{o.name}
                      </label>
                    ))}
                  </div>
                </div>
              )}
              <button className="btn btn-primary" onClick={createUser} disabled={addingUser}>{addingUser ? 'מוסיף...' : '+ הוסף משתמש'}</button>
            </div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
              {[
                ['active', `פעילים (${users.filter(u => u.active).length})`],
                ['inactive', `לא פעילים (${users.filter(u => !u.active).length})`],
                ['all', `כולם (${users.length})`]
              ].map(([k,v]) => (
                <button key={k} className={`btn btn-sm${userFilter===k?' btn-primary':''}`} onClick={() => setUserFilter(k)}>{v}</button>
              ))}
              <select className="form-input" value={userOrgFilter} onChange={e => setUserOrgFilter(e.target.value)} style={{ width: 180, fontSize: 12 }}>
                <option value="">סנן לפי מחלקה</option>
                {orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
              <button className="btn btn-success btn-sm" style={{ marginRight:'auto' }} onClick={exportAgentsExcel}>📥 ייצוא Excel</button>
            </div>
            <div className="card" style={{ padding: 0 }}>
              <table>
                <thead><tr><th>שם</th><th>תפקיד</th><th>סטטוס</th><th>מחלקות</th><th>כניסה אחרונה</th><th>פעולות</th></tr></thead>
                <tbody>{filteredUsers.map(u => (
                  <tr key={u.id}>
                    <td style={{ fontWeight: 500 }}>{u.full_name}</td>
                    <td><span className={`badge ${u.role === 'admin' ? 'b-purple' : 'b-blue'}`}>{u.role === 'admin' ? 'מנהל' : 'נציג'}</span></td>
                    <td><span className={`badge ${u.active ? 'b-green' : 'b-gray'}`}>{u.active ? 'פעיל' : 'לא פעיל'}</span></td>
                    <td style={{ maxWidth: 200 }}>
                      {u.role === 'agent' ? (
                        u.allowed_orgs?.length > 0
                          ? <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                              {u.allowed_orgs.map((id: string) => {
                                const org = orgs.find(o => o.id === id)
                                return org ? <span key={id} className="badge b-blue" style={{ fontSize: 10 }}>{org.name.split(' ')[0]}</span> : null
                              })}
                            </div>
                          : <span style={{ fontSize: 11, color: 'var(--text3)' }}>כל המחלקות</span>
                      ) : <span style={{ fontSize: 11, color: 'var(--text3)' }}>—</span>}
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--text2)', whiteSpace: 'nowrap' }}>
                      {u.last_sign_in ? new Date(u.last_sign_in).toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem', day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'}
                    </td>
                    <td style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <button className="btn btn-xs" style={{ background: 'var(--accent-lt)', color: 'var(--accent)', border: '1px solid rgba(37,99,235,0.2)' }} onClick={() => { setResetPassUser(u); setNewPass('') }}>איפוס סיסמא</button>
                      {u.role === 'agent' && <button className="btn btn-xs" style={{ background: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0' }} onClick={() => { setEditingUserOrgs(u); setEditUserOrgsList(u.allowed_orgs || []) }}>מחלקות</button>}
                      {u.id !== profile.id && u.active && <button className="btn btn-xs btn-danger" onClick={() => deleteUser(u.id)}>השבת</button>}
                      {u.id !== profile.id && <button className="btn btn-xs" style={{ background: '#fee2e2', color: '#b91c1c', border: '1px solid #fca5a5' }} onClick={() => hardDeleteUser(u.id)}>מחק</button>}
                    </td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </div>
        )}

        {tab === 'statuses' && (
          <div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16, maxWidth: 400 }}>
              <input className="form-input" value={newStatus} onChange={e => setNewStatus(e.target.value)} placeholder="שם סטטוס חדש" onKeyDown={e => e.key === 'Enter' && addStatus()} />
              <button className="btn btn-primary" onClick={addStatus}>+ הוסף</button>
            </div>
            <div className="card" style={{ padding: 0, maxWidth: 500 }}>
              <table><thead><tr><th>שם סטטוס</th><th></th></tr></thead>
                <tbody>{statuses.map(s => (
                  <tr key={s.id}><td>{s.name}</td><td><button className="btn btn-xs btn-danger" onClick={() => deleteStatus(s.id)}>מחק</button></td></tr>
                ))}</tbody>
              </table>
            </div>
          </div>
        )}

        {tab === 'orgs' && (
          <div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16, maxWidth: 400 }}>
              <input className="form-input" value={newOrg} onChange={e => setNewOrg(e.target.value)} placeholder="שם ארגון / פעילות חדשה" onKeyDown={e => e.key === 'Enter' && addOrg()} />
              <button className="btn btn-primary" onClick={addOrg}>+ הוסף</button>
            </div>
            <div className="card" style={{ padding: 0, maxWidth: 500 }}>
              <table><thead><tr><th>שם ארגון</th><th></th></tr></thead>
                <tbody>{orgs.map(o => (
                  <tr key={o.id}><td style={{ fontWeight: 500 }}>{o.name}</td><td><button className="btn btn-xs btn-danger" onClick={() => deleteOrg(o.id)}>מחק</button></td></tr>
                ))}</tbody>
              </table>
            </div>
          </div>
        )}

        {tab === 'cats' && (
          <div>
            <div className="form-row" style={{ maxWidth: 520, marginBottom: 16 }}>
              <div className="form-group"><label className="form-label">ארגון</label>
                <select className="form-input" value={selOrg} onChange={e => loadCat1(e.target.value)}>
                  <option value="">בחר ארגון</option>
                  {orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
              </div>
              <div className="form-group"><label className="form-label">סיווג ראשון</label>
                <select className="form-input" value={selCat1} onChange={e => loadCat2(e.target.value)} disabled={!selOrg}>
                  <option value="">בחר סיווג ראשון</option>
                  {cat1List.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            </div>
            {selOrg && (
              <>
                <div style={{ display: 'flex', gap: 8, marginBottom: 16, maxWidth: 400 }}>
                  <input className="form-input" value={newCat1Name} onChange={e => setNewCat1Name(e.target.value)} placeholder="+ סיווג ראשון חדש" />
                  <button className="btn btn-primary btn-sm" onClick={addCat1}>הוסף</button>
                </div>
                {cat1List.length > 0 && (
                  <div className="card" style={{ padding: 0, maxWidth: 400, marginBottom: 16 }}>
                    <table>
                      <thead><tr><th>סיווג ראשון</th><th></th></tr></thead>
                      <tbody>{cat1List.map(c => (
                        <tr key={c.id}>
                          <td style={{ fontWeight: 500 }}>{c.name}</td>
                          <td><button className="btn btn-xs btn-danger" onClick={() => deleteCat1(c.id)}>מחק</button></td>
                        </tr>
                      ))}</tbody>
                    </table>
                  </div>
                )}
              </>
            )}
            {selCat1 && (
              <>
                {cat2List.map(c2 => (
                  <div key={c2.id} className="cat-block" style={{ marginBottom: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                      <strong style={{ fontSize: 13 }}>{c2.name}</strong>
                      <button className="btn btn-xs btn-danger" onClick={() => deleteCat2(c2.id)}>מחק</button>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
                      {(cat3Map[c2.id] || []).map(c3 => (
                        <span key={c3.id} className="chip" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          {c3.name}
                          {c3.opens_dynamic && <span style={{ fontSize: 10, color: 'var(--green)' }}>📦</span>}
                          <span onClick={() => toggleDynamic(c3.id, c3.opens_dynamic)} title="הפעל/בטל ספק+הטבה" style={{ cursor: 'pointer', color: c3.opens_dynamic ? 'var(--green)' : 'var(--text3)', fontSize: 12 }}>⚙</span>
                          <span onClick={() => deleteCat3(c3.id)} style={{ cursor: 'pointer', color: 'var(--text3)' }}>×</span>
                        </span>
                      ))}
                    </div>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <input className="form-input" value={newCat3Names[c2.id] || ''} onChange={e => setNewCat3Names(p => ({ ...p, [c2.id]: e.target.value }))} placeholder="+ סיווג שלישי" style={{ flex: 1 }} />
                      <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap', cursor: 'pointer' }}>
                        <input type="checkbox" checked={!!newCat3Dyn[c2.id]} onChange={e => setNewCat3Dyn(p => ({ ...p, [c2.id]: e.target.checked }))} style={{ width: 'auto' }} /> 📦 ספק+הטבה
                      </label>
                      <button className="btn btn-xs btn-primary" onClick={() => addCat3(c2.id)}>הוסף</button>
                    </div>
                  </div>
                ))}
                <div style={{ display: 'flex', gap: 8, maxWidth: 340, marginTop: 6 }}>
                  <input className="form-input" value={newCat2Name} onChange={e => setNewCat2Name(e.target.value)} placeholder="+ סיווג שני חדש" />
                  <button className="btn btn-primary btn-sm" onClick={addCat2}>הוסף</button>
                </div>
              </>
            )}
          </div>
        )}

        {tab === 'suppliers' && (
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 220 }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>ספקים</div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                <input className="form-input" value={newSupplier} onChange={e => setNewSupplier(e.target.value)} placeholder="שם ספק" onKeyDown={e => e.key === 'Enter' && addSupplier()} />
                <button className="btn btn-primary btn-sm" onClick={addSupplier}>+</button>
              </div>
              <div className="card" style={{ padding: 0 }}><table><thead><tr><th>שם ספק</th><th></th></tr></thead>
                <tbody>{suppliers.map(s => (<tr key={s.id}><td>{s.name}</td><td><button className="btn btn-xs btn-danger" onClick={() => deleteSupplier(s.id)}>מחק</button></td></tr>))}</tbody>
              </table></div>
            </div>
            <div style={{ flex: 1, minWidth: 220 }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>הטבות</div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                <input className="form-input" value={newBenefit} onChange={e => setNewBenefit(e.target.value)} placeholder="שם הטבה" onKeyDown={e => e.key === 'Enter' && addBenefit()} />
                <button className="btn btn-primary btn-sm" onClick={addBenefit}>+</button>
              </div>
              <div className="card" style={{ padding: 0 }}><table><thead><tr><th>שם הטבה</th><th></th></tr></thead>
                <tbody>{benefits.map(b => (<tr key={b.id}><td>{b.name}</td><td><button className="btn btn-xs btn-danger" onClick={() => deleteBenefit(b.id)}>מחק</button></td></tr>))}</tbody>
              </table></div>
            </div>
          </div>
        )}

        {tab === 'sms' && (
          <div>
            <div className="card card-pad" style={{ marginBottom: 16, maxWidth: 600 }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>הוסף תבנית SMS חדשה</div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">שם התבנית</label>
                  <input className="form-input" value={newSms.name} onChange={e => setNewSms(p => ({ ...p, name: e.target.value }))} placeholder="לדוגמא: אישור קבלת פניה" />
                </div>
                <div className="form-group">
                  <label className="form-label">ארגון</label>
                  <select className="form-input" value={newSms.org_id} onChange={e => { const o = orgs.find(x => x.id === e.target.value); setNewSms(p => ({ ...p, org_id: e.target.value, org_name: o?.name || '' })) }}>
                    <option value="">בחר ארגון</option>
                    {orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">תוכן ההודעה <span style={{ color: 'var(--text3)', fontWeight: 400 }}>(השתמש ב-{'{שם}'} לשם הלקוח)</span></label>
                <textarea className="form-input" rows={3} value={newSms.content} onChange={e => setNewSms(p => ({ ...p, content: e.target.value }))} placeholder="שלום {'{'}שם{'}'}, פנייתך התקבלה ותטופל בהקדם." />
              </div>
              <button className="btn btn-primary" onClick={addSmsTemplate}>+ הוסף תבנית</button>
            </div>
            <div className="card" style={{ padding: 0 }}>
              <table>
                <thead><tr><th>שם תבנית</th><th>ארגון</th><th>תוכן</th><th>פעולות</th></tr></thead>
                <tbody>
                  {smsTemplates.length ? smsTemplates.map(t => (
                    <tr key={t.id}>
                      <td>{editingSms?.id === t.id ? <input className="form-input" value={editingSms.name} onChange={e => setEditingSms((p: any) => ({ ...p, name: e.target.value }))} style={{ fontSize: 12 }} /> : <span style={{ fontWeight: 500 }}>{t.name}</span>}</td>
                      <td><span className="badge b-gray" style={{ fontSize: 10 }}>{(t.org_name || '').split(' ')[0]}</span></td>
                      <td>{editingSms?.id === t.id ? <textarea className="form-input" rows={2} value={editingSms.content} onChange={e => setEditingSms((p: any) => ({ ...p, content: e.target.value }))} style={{ fontSize: 12 }} /> : <span style={{ fontSize: 12, color: 'var(--text2)' }}>{t.content.slice(0, 60)}{t.content.length > 60 ? '...' : ''}</span>}</td>
                      <td style={{ display: 'flex', gap: 6 }}>
                        {editingSms?.id === t.id ? <>
                          <button className="btn btn-xs btn-success" onClick={updateSmsTemplate}>שמור</button>
                          <button className="btn btn-xs" onClick={() => setEditingSms(null)}>ביטול</button>
                        </> : <>
                          <button className="btn btn-xs" onClick={() => setEditingSms({ ...t })}>ערוך</button>
                          <button className="btn btn-xs btn-danger" onClick={() => deleteSmsTemplate(t.id)}>מחק</button>
                        </>}
                      </td>
                    </tr>
                  )) : <tr><td colSpan={4} style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text3)' }}>אין תבניות עדיין</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === 'online' && <OnlineUsersTab />}

        {tab === 'agent-stats' && (
          <AgentStatsTab />
        )}

        {tab === 'activity' && (
          <ActivityLogTab />
        )}
      </div>

      {/* Reset password modal */}
      {resetPassUser && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setResetPassUser(null) }}>
          <div className="modal modal-sm">
            <div className="modal-header">
              <div className="modal-title">איפוס סיסמא — {resetPassUser.full_name}</div>
              <button className="close-btn" onClick={() => setResetPassUser(null)}>✕</button>
            </div>
            <div className="form-group">
              <label className="form-label">סיסמא חדשה</label>
              <input className="form-input" type="password" value={newPass} onChange={e => setNewPass(e.target.value)} placeholder="לפחות 6 תווים" />
            </div>
            <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={resetPassword}>עדכן סיסמא</button>
          </div>
        </div>
      )}

      {/* Edit user orgs modal */}
      {editingUserOrgs && (
        <div className="modal-overlay" onClick={e => { if(e.target===e.currentTarget) setEditingUserOrgs(null) }}>
          <div className="modal modal-sm">
            <div className="modal-header">
              <div className="modal-title">מחלקות מורשות — {editingUserOrgs.full_name}</div>
              <button className="close-btn" onClick={() => setEditingUserOrgs(null)}>✕</button>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 14 }}>ריק = גישה לכל המחלקות</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 18 }}>
              {orgs.map(o => {
                const checked = editUserOrgsList.includes(o.id)
                return (
                  <label key={o.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer', padding: '6px 12px', borderRadius: 999, background: checked ? '#dbeafe' : '#f9fafb', border: `1.5px solid ${checked ? '#2563eb' : '#e5e7eb'}`, color: checked ? '#1d4ed8' : '#374151', fontFamily: 'Heebo, sans-serif' }}>
                    <input type="checkbox" checked={checked} onChange={e => {
                      if (e.target.checked) setEditUserOrgsList(prev => [...prev, o.id])
                      else setEditUserOrgsList(prev => prev.filter(id => id !== o.id))
                    }} style={{ display: 'none' }} />
                    {checked ? '✓ ' : ''}{o.name}
                  </label>
                )
              })}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }} onClick={saveUserOrgs}>שמור</button>
              <button className="btn" onClick={() => { setEditUserOrgsList([]); saveUserOrgs() }}>נקה הכל (גישה לכולם)</button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}
    </>
  )


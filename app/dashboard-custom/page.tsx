'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { PieChart, Pie, Cell, BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'

const WIDGET_TYPES = [
  { type: 'kpi', label: '🔢 כרטיסיית מספר', desc: 'מונה עם כותרת וצבע' },
  { type: 'pie', label: '🥧 גרף עוגה', desc: 'חלוקה לפי קטגוריה' },
  { type: 'bar', label: '📊 גרף עמודות', desc: 'השוואה בין קטגוריות' },
  { type: 'line', label: '📈 גרף קו', desc: 'מגמה לאורך זמן' },
  { type: 'table', label: '📋 טבלה', desc: 'נתונים עם סינון חופשי' },
]

const DATA_SOURCES = [
  { key: 'cases_open', label: 'פניות פתוחות' },
  { key: 'cases_today', label: 'פניות היום' },
  { key: 'cases_week', label: 'פניות השבוע' },
  { key: 'cases_by_org', label: 'פניות לפי ארגון' },
  { key: 'cases_by_status', label: 'פניות לפי סטטוס' },
  { key: 'cases_by_agent', label: 'פניות לפי נציג' },
  { key: 'cases_by_category', label: 'פניות לפי סיווג' },
  { key: 'cases_daily_trend', label: 'מגמה יומית (30 יום)' },
  { key: 'agents_online', label: 'נציגים מחוברים' },
  { key: 'emails_open', label: 'מיילים פתוחים' },
]

const COLORS = ['#6366f1','#f59e0b','#10b981','#ef4444','#8b5cf6','#ec4899','#14b8a6','#f97316']
const KPI_COLORS = [
  { value: '#6366f1', label: 'סגול' },
  { value: '#10b981', label: 'ירוק' },
  { value: '#f59e0b', label: 'צהוב' },
  { value: '#ef4444', label: 'אדום' },
  { value: '#3b82f6', label: 'כחול' },
  { value: '#ec4899', label: 'ורוד' },
]

export default function DashboardCustomPage() {
  const supabase = createClient()
  const [profile, setProfile] = useState<any>(null)
  const [widgets, setWidgets] = useState<any[]>([])
  const [showAddModal, setShowAddModal] = useState(false)
  const [loading, setLoading] = useState(true)
  const [widgetData, setWidgetData] = useState<Record<string, any>>({})
  const [newType, setNewType] = useState('')
  const [newTitle, setNewTitle] = useState('')
  const [newSource, setNewSource] = useState('')
  const [newColor, setNewColor] = useState('#6366f1')
  const [newWidth, setNewWidth] = useState('half')

  useEffect(() => { loadProfile() }, [])
  useEffect(() => { if (profile) loadWidgets() }, [profile])

  async function loadProfile() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { window.location.href = '/login'; return }
    const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    if (data?.role !== 'admin') { window.location.href = '/dashboard'; return }
    setProfile(data)
  }

  async function loadWidgets() {
    const { data } = await supabase.from('dashboard_widgets').select('*').eq('user_id', profile.id).order('position')
    setWidgets(data || [])
    setLoading(false)
    for (const w of (data || [])) await loadWidgetData(w)
  }

  async function loadWidgetData(widget: any) {
    const src = widget.config?.data_source || ''
    const now = new Date()
    const today = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' })
    let result: any = null
    try {
      if (src === 'cases_open') {
        const { count } = await supabase.from('cases').select('*', { count: 'exact', head: true }).in('status', ['חדש','בטיפול נציג','הועבר לשיחת מנהל','ממתין לשיחת מנהל','בטיפול בשיחת מנהל','בטיפול לאחר שיחת מנהל'])
        result = { value: count || 0 }
      } else if (src === 'cases_today') {
        const { count } = await supabase.from('cases').select('*', { count: 'exact', head: true }).gte('created_at', today)
        result = { value: count || 0 }
      } else if (src === 'cases_week') {
        const weekAgo = new Date(now.getTime() - 7*864e5).toISOString().split('T')[0]
        const { count } = await supabase.from('cases').select('*', { count: 'exact', head: true }).gte('created_at', weekAgo)
        result = { value: count || 0 }
      } else if (src === 'cases_by_org') {
        const { data: cases } = await supabase.from('cases').select('organization').in('status', ['חדש','בטיפול נציג','הועבר לשיחת מנהל'])
        const g: Record<string,number> = {}
        ;(cases||[]).forEach((c:any) => { g[c.organization||'לא ידוע'] = (g[c.organization||'לא ידוע']||0)+1 })
        result = { items: Object.entries(g).map(([name,value]) => ({name,value})).sort((a:any,b:any) => b.value-a.value) }
      } else if (src === 'cases_by_status') {
        const { data: cases } = await supabase.from('cases').select('status')
        const g: Record<string,number> = {}
        ;(cases||[]).forEach((c:any) => { g[c.status||'לא ידוע'] = (g[c.status||'לא ידוע']||0)+1 })
        result = { items: Object.entries(g).map(([name,value]) => ({name,value})).sort((a:any,b:any) => b.value-a.value) }
      } else if (src === 'cases_by_agent') {
        const { data: cases } = await supabase.from('cases').select('assigned_to').in('status', ['חדש','בטיפול נציג','הועבר לשיחת מנהל'])
        const g: Record<string,number> = {}
        ;(cases||[]).forEach((c:any) => { g[c.assigned_to||'לא משויך'] = (g[c.assigned_to||'לא משויך']||0)+1 })
        result = { items: Object.entries(g).map(([name,value]) => ({name,value})).sort((a:any,b:any) => b.value-a.value) }
      } else if (src === 'cases_by_category') {
        const { data: cases } = await supabase.from('cases').select('category')
        const g: Record<string,number> = {}
        ;(cases||[]).forEach((c:any) => { g[c.category||'לא ידוע'] = (g[c.category||'לא ידוע']||0)+1 })
        result = { items: Object.entries(g).map(([name,value]) => ({name,value})).sort((a:any,b:any) => b.value-a.value).slice(0,10) }
      } else if (src === 'cases_daily_trend') {
        const thirtyAgo = new Date(now.getTime() - 30*864e5).toISOString().split('T')[0]
        const { data: cases } = await supabase.from('cases').select('created_at').gte('created_at', thirtyAgo)
        const g: Record<string,number> = {}
        ;(cases||[]).forEach((c:any) => { const d = new Date(c.created_at).toLocaleDateString('he-IL',{timeZone:'Asia/Jerusalem',day:'2-digit',month:'2-digit'}); g[d]=(g[d]||0)+1 })
        result = { items: Object.entries(g).map(([name,value]) => ({name,value})) }
      } else if (src === 'agents_online') {
        const tenMinAgo = new Date(Date.now()-600000).toISOString()
        const { count } = await supabase.from('user_sessions').select('*',{count:'exact',head:true}).eq('is_active',true).gte('last_ping',tenMinAgo)
        result = { value: count||0 }
      } else if (src === 'emails_open') {
        const { data: st } = await supabase.from('glassix_ticket_status').select('ticket_id').eq('status','Open')
        result = { value: (st||[]).length }
      }
    } catch { result = { value: 0 } }
    setWidgetData(prev => ({...prev, [widget.id]: result}))
  }

  async function addWidget() {
    if (!newType || !newTitle) return
    const maxPos = widgets.length > 0 ? Math.max(...widgets.map(w => w.position))+1 : 0
    const { data } = await supabase.from('dashboard_widgets').insert({
      user_id: profile.id, widget_type: newType, title: newTitle,
      config: { data_source: newSource, color: newColor },
      position: maxPos, width: newWidth
    }).select().single()
    if (data) { setWidgets([...widgets, data]); await loadWidgetData(data) }
    setShowAddModal(false); resetForm()
  }

  async function deleteWidget(id: string) {
    if (!confirm('למחוק את הווידג\'ט?')) return
    await supabase.from('dashboard_widgets').delete().eq('id', id)
    setWidgets(widgets.filter(w => w.id !== id))
  }

  async function moveWidget(id: string, dir: number) {
    const idx = widgets.findIndex(w => w.id === id)
    const newIdx = idx + dir
    if (newIdx < 0 || newIdx >= widgets.length) return
    const u = [...widgets]; const t = u[idx]; u[idx] = u[newIdx]; u[newIdx] = t
    for (let i=0;i<u.length;i++) { u[i]={...u[i],position:i}; await supabase.from('dashboard_widgets').update({position:i}).eq('id',u[i].id) }
    setWidgets(u)
  }

  function resetForm() { setNewType(''); setNewTitle(''); setNewSource(''); setNewColor('#6366f1'); setNewWidth('half') }

  function renderWidget(w: any) {
    const d = widgetData[w.id]; const color = w.config?.color || '#6366f1'
    if (!d) return <div style={{textAlign:'center',padding:40,color:'#94a3b8'}}>טוען...</div>
    if (w.widget_type === 'kpi') return <div style={{textAlign:'center',padding:'30px 20px'}}><div style={{fontSize:48,fontWeight:800,color,lineHeight:1}}>{d.value?.toLocaleString()||0}</div></div>
    if (w.widget_type === 'pie') { const items=d.items||[]; return items.length===0?<div style={{textAlign:'center',padding:40,color:'#94a3b8'}}>אין נתונים</div>:<ResponsiveContainer width="100%" height={220}><PieChart><Pie data={items} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({name,value}:any)=>`${name} (${value})`} labelLine={false}>{items.map((_:any,i:number)=><Cell key={i} fill={COLORS[i%COLORS.length]}/>)}</Pie><Tooltip/></PieChart></ResponsiveContainer> }
    if (w.widget_type === 'bar') { const items=d.items||[]; return items.length===0?<div style={{textAlign:'center',padding:40,color:'#94a3b8'}}>אין נתונים</div>:<ResponsiveContainer width="100%" height={220}><BarChart data={items} layout="vertical" margin={{left:80,right:20}}><CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0"/><XAxis type="number"/><YAxis type="category" dataKey="name" tick={{fontSize:11}} width={75}/><Tooltip/><Bar dataKey="value" fill={color} radius={[0,6,6,0]}/></BarChart></ResponsiveContainer> }
    if (w.widget_type === 'line') { const items=d.items||[]; return items.length===0?<div style={{textAlign:'center',padding:40,color:'#94a3b8'}}>אין נתונים</div>:<ResponsiveContainer width="100%" height={220}><LineChart data={items} margin={{left:10,right:20}}><CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0"/><XAxis dataKey="name" tick={{fontSize:10}}/><YAxis tick={{fontSize:11}}/><Tooltip/><Line type="monotone" dataKey="value" stroke={color} strokeWidth={2} dot={{r:3,fill:color}}/></LineChart></ResponsiveContainer> }
    if (w.widget_type === 'table') { const items=d.items||[]; return items.length===0?<div style={{textAlign:'center',padding:40,color:'#94a3b8'}}>אין נתונים</div>:<div style={{maxHeight:250,overflowY:'auto'}}><table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}><thead><tr style={{borderBottom:'2px solid #e2e8f0'}}><th style={{padding:'8px 12px',textAlign:'right',fontWeight:600}}>שם</th><th style={{padding:'8px 12px',textAlign:'center',fontWeight:600}}>כמות</th></tr></thead><tbody>{items.map((item:any,i:number)=><tr key={i} style={{borderBottom:'1px solid #f1f5f9'}}><td style={{padding:'6px 12px',textAlign:'right'}}>{item.name}</td><td style={{padding:'6px 12px',textAlign:'center',fontWeight:700,color}}>{item.value}</td></tr>)}</tbody></table></div> }
    return null
  }

  if (loading) return <div style={{textAlign:'center',padding:80,color:'#94a3b8'}}>טוען...</div>
  return (
    <div dir="rtl" style={{fontFamily:"'Rubik',sans-serif",padding:'20px 24px',maxWidth:1400,margin:'0 auto'}}>
      <link href="https://fonts.googleapis.com/css2?family=Rubik:wght@400;500;600;700;800&display=swap" rel="stylesheet"/>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:24}}>
        <div><h1 style={{fontSize:22,fontWeight:700,margin:0,color:'#1e293b'}}>📊 דשבורד מותאם אישית</h1><p style={{fontSize:13,color:'#94a3b8',margin:'4px 0 0'}}>{widgets.length} ווידג'טים</p></div>
        <div style={{display:'flex',gap:10}}>
          <button onClick={()=>{for(const w of widgets)loadWidgetData(w)}} style={{padding:'8px 16px',borderRadius:8,border:'1px solid #e2e8f0',background:'#fff',cursor:'pointer',fontSize:13,fontWeight:500}}>🔄 רענן</button>
          <button onClick={()=>setShowAddModal(true)} style={{padding:'8px 20px',borderRadius:8,border:'none',background:'#6366f1',color:'#fff',cursor:'pointer',fontSize:13,fontWeight:600,boxShadow:'0 2px 8px rgba(99,102,241,.3)'}}>✨ הוסף ווידג'ט</button>
        </div>
      </div>
      {widgets.length===0?(
        <div style={{textAlign:'center',padding:'80px 20px',background:'#f8fafc',borderRadius:16,border:'2px dashed #cbd5e1'}}>
          <div style={{fontSize:48,marginBottom:16}}>📊</div><h2 style={{fontSize:18,fontWeight:600,color:'#64748b',margin:0}}>הדשבורד ריק</h2>
          <p style={{fontSize:14,color:'#94a3b8',margin:'8px 0 20px'}}>הוסף ווידג'טים כדי לראות נתונים</p>
          <button onClick={()=>setShowAddModal(true)} style={{padding:'10px 24px',borderRadius:8,border:'none',background:'#6366f1',color:'#fff',cursor:'pointer',fontSize:14,fontWeight:600}}>✨ הוסף ווידג'ט ראשון</button>
        </div>
      ):(
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill, minmax(340px, 1fr))',gap:16}}>
          {widgets.map((w,idx)=>(
            <div key={w.id} style={{gridColumn:w.width==='full'?'1 / -1':undefined,background:'#fff',borderRadius:14,border:'1px solid #e2e8f0',boxShadow:'0 1px 4px rgba(0,0,0,.05)',overflow:'hidden'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'12px 16px',borderBottom:'1px solid #f1f5f9'}}>
                <span style={{fontSize:14,fontWeight:600,color:'#334155'}}>{w.title}</span>
                <div style={{display:'flex',gap:4}}>
                  {idx>0&&<button onClick={()=>moveWidget(w.id,-1)} style={{padding:'2px 6px',border:'none',background:'none',cursor:'pointer',fontSize:14,color:'#94a3b8'}}>◀</button>}
                  {idx<widgets.length-1&&<button onClick={()=>moveWidget(w.id,1)} style={{padding:'2px 6px',border:'none',background:'none',cursor:'pointer',fontSize:14,color:'#94a3b8'}}>▶</button>}
                  <button onClick={()=>deleteWidget(w.id)} style={{padding:'2px 6px',border:'none',background:'none',cursor:'pointer',fontSize:14,color:'#ef4444'}} title="מחק">✕</button>
                </div>
              </div>
              <div style={{padding:w.widget_type==='kpi'?'0':'12px 8px'}}>{renderWidget(w)}</div>
            </div>
          ))}
        </div>
      )}
      {showAddModal&&(
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.5)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000}} onClick={()=>{setShowAddModal(false);resetForm()}}>
          <div onClick={e=>e.stopPropagation()} style={{background:'#fff',borderRadius:16,padding:28,width:'95%',maxWidth:480,maxHeight:'85vh',overflowY:'auto',boxShadow:'0 20px 60px rgba(0,0,0,.2)'}}>
            <h2 style={{fontSize:18,fontWeight:700,margin:'0 0 20px',color:'#1e293b'}}>✨ הוסף ווידג'ט חדש</h2>
            <label style={{fontSize:13,fontWeight:600,color:'#475569',display:'block',marginBottom:8}}>סוג ווידג'ט</label>
            <div style={{display:'grid',gap:8,marginBottom:20}}>
              {WIDGET_TYPES.map(wt=>(
                <button key={wt.type} onClick={()=>setNewType(wt.type)} style={{padding:'12px 16px',borderRadius:10,textAlign:'right',cursor:'pointer',fontSize:13,border:newType===wt.type?'2px solid #6366f1':'1px solid #e2e8f0',background:newType===wt.type?'#eef2ff':'#fff',fontWeight:newType===wt.type?600:400}}>
                  <div style={{fontWeight:600}}>{wt.label}</div><div style={{fontSize:11,color:'#94a3b8',marginTop:2}}>{wt.desc}</div>
                </button>
              ))}
            </div>
            {newType&&<>
              <label style={{fontSize:13,fontWeight:600,color:'#475569',display:'block',marginBottom:6}}>כותרת</label>
              <input value={newTitle} onChange={e=>setNewTitle(e.target.value)} placeholder="למשל: פניות פתוחות" style={{width:'100%',padding:'10px 14px',borderRadius:8,border:'1px solid #cbd5e1',fontSize:14,marginBottom:16,boxSizing:'border-box'}}/>
              <label style={{fontSize:13,fontWeight:600,color:'#475569',display:'block',marginBottom:6}}>מקור נתונים</label>
              <select value={newSource} onChange={e=>setNewSource(e.target.value)} style={{width:'100%',padding:'10px 14px',borderRadius:8,border:'1px solid #cbd5e1',fontSize:14,marginBottom:16,boxSizing:'border-box',color:'#1e293b'}}>
                <option value="">בחר מקור...</option>
                {DATA_SOURCES.map(ds=><option key={ds.key} value={ds.key}>{ds.label}</option>)}
              </select>
              <label style={{fontSize:13,fontWeight:600,color:'#475569',display:'block',marginBottom:6}}>צבע</label>
              <div style={{display:'flex',gap:8,marginBottom:16,flexWrap:'wrap'}}>
                {KPI_COLORS.map(c=><button key={c.value} onClick={()=>setNewColor(c.value)} style={{width:36,height:36,borderRadius:10,background:c.value,border:newColor===c.value?'3px solid #1e293b':'2px solid #e2e8f0',cursor:'pointer',transition:'transform .15s',transform:newColor===c.value?'scale(1.15)':undefined}} title={c.label}/>)}
              </div>
              <label style={{fontSize:13,fontWeight:600,color:'#475569',display:'block',marginBottom:6}}>רוחב</label>
              <div style={{display:'flex',gap:8,marginBottom:24}}>
                <button onClick={()=>setNewWidth('half')} style={{flex:1,padding:'10px',borderRadius:8,cursor:'pointer',fontSize:13,fontWeight:500,border:newWidth==='half'?'2px solid #6366f1':'1px solid #e2e8f0',background:newWidth==='half'?'#eef2ff':'#fff'}}>חצי רוחב</button>
                <button onClick={()=>setNewWidth('full')} style={{flex:1,padding:'10px',borderRadius:8,cursor:'pointer',fontSize:13,fontWeight:500,border:newWidth==='full'?'2px solid #6366f1':'1px solid #e2e8f0',background:newWidth==='full'?'#eef2ff':'#fff'}}>רוחב מלא</button>
              </div>
              <div style={{display:'flex',gap:10}}>
                <button onClick={addWidget} disabled={!newTitle||!newSource} style={{flex:1,padding:'12px',borderRadius:10,border:'none',fontSize:14,fontWeight:600,cursor:'pointer',background:(!newTitle||!newSource)?'#cbd5e1':'#6366f1',color:'#fff'}}>✅ הוסף</button>
                <button onClick={()=>{setShowAddModal(false);resetForm()}} style={{padding:'12px 20px',borderRadius:10,border:'1px solid #e2e8f0',background:'#fff',fontSize:14,cursor:'pointer',color:'#64748b'}}>ביטול</button>
              </div>
            </>}
          </div>
        </div>
      )}
    </div>
  )
}

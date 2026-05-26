'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useUser } from '@/lib/useUser'
import Topbar from '@/components/Topbar'

export default function AdminPage() {
  const { profile, loading } = useUser()
  const supabase = createClient()
  const [tab, setTab] = useState('users')

  // Users
  const [users, setUsers] = useState<any[]>([])
  const [newUser, setNewUser] = useState({ email: '', password: '', full_name: '', role: 'agent' })
  const [addingUser, setAddingUser] = useState(false)

  // Statuses
  const [statuses, setStatuses] = useState<any[]>([])
  const [newStatus, setNewStatus] = useState('')

  // Orgs
  const [orgs, setOrgs] = useState<any[]>([])
  const [newOrg, setNewOrg] = useState('')

  // Cats
  const [selOrg, setSelOrg] = useState('')
  const [cat1List, setCat1List] = useState<any[]>([])
  const [selCat1, setSelCat1] = useState('')
  const [cat2List, setCat2List] = useState<any[]>([])
  const [cat3Map, setCat3Map] = useState<Record<string, any[]>>({})
  const [newCat1Name, setNewCat1Name] = useState('')
  const [newCat2Name, setNewCat2Name] = useState('')
  const [newCat3Names, setNewCat3Names] = useState<Record<string, string>>({})
  const [newCat3Dyn, setNewCat3Dyn] = useState<Record<string, boolean>>({})

  // Suppliers / Benefits
  const [suppliers, setSuppliers] = useState<any[]>([])
  const [benefits, setBenefits] = useState<any[]>([])
  const [newSupplier, setNewSupplier] = useState('')
  const [newBenefit, setNewBenefit] = useState('')

  const [toast, setToast] = useState('')
  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(''), 2500) }

  useEffect(() => {
    if (!profile) return
    loadUsers(); loadStatuses(); loadOrgs(); loadSuppliers(); loadBenefits()
  }, [profile])

  async function loadUsers() {
    const { data } = await supabase.from('profiles').select('*').order('full_name')
    setUsers(data || [])
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
      body: JSON.stringify(newUser)
    })
    const data = await res.json()
    if (data.error) { alert('שגיאה: ' + data.error); setAddingUser(false); return }
    setAddingUser(false)
    setNewUser({ email: '', password: '', full_name: '', role: 'agent' })
    showToast('משתמש נוסף ✓')
    loadUsers()
  }

  async function deleteUser(id: string) {
    if (!confirm('למחוק משתמש?')) return
    await supabase.from('profiles').update({ active: false }).eq('id', id)
    loadUsers()
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
    if (!confirm('למחוק ארגון? פעולה זו תמחק את כל הסיווגים שלו')) return
    await supabase.from('organizations').delete().eq('id', id)
    loadOrgs()
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

  return (
    <>
      <Topbar userName={profile?.full_name || ''} userRole={profile?.role || 'agent'} />
      <div style={{ padding: '22px 26px' }}>
        <div className="page-header"><div className="page-title">ניהול מערכת</div></div>
        <div className="tabs">
          {[['users','משתמשים'],['statuses','סטטוסים'],['orgs','ארגונים'],['cats','סיווגים'],['suppliers','ספקים והטבות']].map(([k,v]) => (
            <div key={k} className={`tab${tab===k?' active':''}`} onClick={() => setTab(k)}>{v}</div>
          ))}
        </div>

        {/* USERS */}
        {tab === 'users' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>משתמשי המערכת ({users.length})</div>
            </div>
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
              <button className="btn btn-primary" onClick={createUser} disabled={addingUser}>{addingUser ? 'מוסיף...' : '+ הוסף משתמש'}</button>
            </div>
            <div className="card" style={{ padding: 0 }}>
              <table><thead><tr><th>שם</th><th>מייל</th><th>תפקיד</th><th>סטטוס</th><th></th></tr></thead>
                <tbody>{users.map(u => (
                  <tr key={u.id}>
                    <td style={{ fontWeight: 500 }}>{u.full_name}</td>
                    <td style={{ color: 'var(--text2)' }}>{u.id}</td>
                    <td><span className={`badge ${u.role === 'admin' ? 'b-purple' : 'b-blue'}`}>{u.role === 'admin' ? 'מנהל' : 'נציג'}</span></td>
                    <td><span className={`badge ${u.active ? 'b-green' : 'b-gray'}`}>{u.active ? 'פעיל' : 'לא פעיל'}</span></td>
                    <td>{u.id !== profile.id && <button className="btn btn-xs btn-danger" onClick={() => deleteUser(u.id)}>השבת</button>}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </div>
        )}

        {/* STATUSES */}
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

        {/* ORGS */}
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

        {/* CATS */}
        {tab === 'cats' && (
          <div>
            <div className="form-row" style={{ maxWidth: 520, marginBottom: 16 }}>
              <div className="form-group">
                <label className="form-label">ארגון</label>
                <select className="form-input" value={selOrg} onChange={e => loadCat1(e.target.value)}>
                  <option value="">בחר ארגון</option>
                  {orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">סיווג ראשון</label>
                <select className="form-input" value={selCat1} onChange={e => loadCat2(e.target.value)} disabled={!selOrg}>
                  <option value="">בחר סיווג ראשון</option>
                  {cat1List.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            </div>
            {selOrg && (
              <div style={{ display: 'flex', gap: 8, marginBottom: 16, maxWidth: 400 }}>
                <input className="form-input" value={newCat1Name} onChange={e => setNewCat1Name(e.target.value)} placeholder="+ סיווג ראשון חדש" />
                <button className="btn btn-primary btn-sm" onClick={addCat1}>הוסף</button>
              </div>
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

        {/* SUPPLIERS & BENEFITS */}
        {tab === 'suppliers' && (
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 220 }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>ספקים</div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                <input className="form-input" value={newSupplier} onChange={e => setNewSupplier(e.target.value)} placeholder="שם ספק" onKeyDown={e => e.key === 'Enter' && addSupplier()} />
                <button className="btn btn-primary btn-sm" onClick={addSupplier}>+</button>
              </div>
              <div className="card" style={{ padding: 0 }}>
                <table><thead><tr><th>שם ספק</th><th></th></tr></thead>
                  <tbody>{suppliers.map(s => (
                    <tr key={s.id}><td>{s.name}</td><td><button className="btn btn-xs btn-danger" onClick={() => deleteSupplier(s.id)}>מחק</button></td></tr>
                  ))}</tbody>
                </table>
              </div>
            </div>
            <div style={{ flex: 1, minWidth: 220 }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>הטבות</div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                <input className="form-input" value={newBenefit} onChange={e => setNewBenefit(e.target.value)} placeholder="שם הטבה" onKeyDown={e => e.key === 'Enter' && addBenefit()} />
                <button className="btn btn-primary btn-sm" onClick={addBenefit}>+</button>
              </div>
              <div className="card" style={{ padding: 0 }}>
                <table><thead><tr><th>שם הטבה</th><th></th></tr></thead>
                  <tbody>{benefits.map(b => (
                    <tr key={b.id}><td>{b.name}</td><td><button className="btn btn-xs btn-danger" onClick={() => deleteBenefit(b.id)}>מחק</button></td></tr>
                  ))}</tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
      {toast && <div className="toast">{toast}</div>}
    </>
  )
}

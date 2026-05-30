'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { useUser } from '@/lib/useUser'
import Topbar from '@/components/Topbar'

export default function NewCasePage() {
  const router = useRouter()
  const { profile, loading } = useUser()
  const supabase = createClient()

  const [orgs, setOrgs] = useState<any[]>([])
  const [statuses, setStatuses] = useState<any[]>([])
  const [cat1List, setCat1List] = useState<any[]>([])
  const [cat2List, setCat2List] = useState<any[]>([])
  const [cat3List, setCat3List] = useState<any[]>([])
  const [suppliers, setSuppliers] = useState<any[]>([])
  const [benefits, setBenefits] = useState<any[]>([])

  const [form, setForm] = useState({
    customer_name: '', phone: '', id_number: '',
    org_id: '', org_name: '',
    status_id: '', status_name: '',
    subject: '', content: '',
    cat1_id: '', cat1_name: '',
    cat2_id: '', cat2_name: '',
    cat3_id: '', cat3_name: '',
    supplier_id: '', supplier_name: '',
    benefit_id: '', benefit_name: '',
  })
  const [showDynamic, setShowDynamic] = useState(false)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')

  useEffect(() => {
    if (!profile) return
    async function loadOrgs() {
      const { data: allOrgs } = await supabase.from('organizations').select('*').eq('active', true).order('name')
      const { data: myProfile } = await supabase.from('profiles').select('allowed_orgs').eq('id', profile.id).single()
      const allowedOrgs = myProfile?.allowed_orgs
      setOrgs(allowedOrgs?.length > 0 ? (allOrgs || []).filter((o: any) => allowedOrgs.includes(o.id)) : (allOrgs || []))
    }
    loadOrgs()
    supabase.from('statuses').select('*').eq('active', true).order('sort_order').then(({ data }) => {
      if (!data) return
      // Custom order: טופל first, then בטיפול נציג, then הועבר לשיחת מנהל, then rest
      const ORDER = ['טופל', 'בטיפול נציג', 'הועבר לשיחת מנהל', 'בטיפול בשיחת מנהל', 'טופל לאחר שיחת מנהל', 'אין מענה']
      const sorted = [...data].sort((a, b) => {
        const ai = ORDER.indexOf(a.name); const bi = ORDER.indexOf(b.name)
        if (ai === -1 && bi === -1) return 0
        if (ai === -1) return 1
        if (bi === -1) return -1
        return ai - bi
      })
      setStatuses(sorted)
    })
    supabase.from('suppliers').select('*').eq('active', true).order('name').then(({ data }) => setSuppliers(data || []))
    supabase.from('benefits').select('*').eq('active', true).order('name').then(({ data }) => setBenefits(data || []))
  }, [profile])

  async function handleOrgChange(orgId: string) {
    const org = orgs.find(o => o.id === orgId)
    setForm(f => ({ ...f, org_id: orgId, org_name: org?.name || '', cat1_id: '', cat1_name: '', cat2_id: '', cat2_name: '', cat3_id: '', cat3_name: '' }))
    setCat1List([]); setCat2List([]); setCat3List([]); setShowDynamic(false)
    if (!orgId) return
    const { data } = await supabase.from('cat1').select('*').eq('org_id', orgId).eq('active', true).order('sort_order')
    setCat1List(data || [])
  }

  async function handleCat1Change(cat1Id: string) {
    const c = cat1List.find(x => x.id === cat1Id)
    setForm(f => ({ ...f, cat1_id: cat1Id, cat1_name: c?.name || '', cat2_id: '', cat2_name: '', cat3_id: '', cat3_name: '' }))
    setCat2List([]); setCat3List([]); setShowDynamic(false)
    if (!cat1Id) return
    const { data } = await supabase.from('cat2').select('*').eq('cat1_id', cat1Id).eq('active', true).order('sort_order')
    setCat2List(data || [])
  }

  async function handleCat2Change(cat2Id: string) {
    const c = cat2List.find(x => x.id === cat2Id)
    setForm(f => ({ ...f, cat2_id: cat2Id, cat2_name: c?.name || '', cat3_id: '', cat3_name: '' }))
    setCat3List([]); setShowDynamic(false)
    if (!cat2Id) return
    const { data } = await supabase.from('cat3').select('*').eq('cat2_id', cat2Id).eq('active', true).order('sort_order')
    setCat3List(data || [])
  }

  function handleCat3Change(cat3Id: string) {
    const c = cat3List.find(x => x.id === cat3Id)
    setForm(f => ({ ...f, cat3_id: cat3Id, cat3_name: c?.name || '' }))
    setShowDynamic(!!(c?.opens_dynamic))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const missing: string[] = []
    if (!form.customer_name) missing.push('שם לקוח')
    if (!form.phone) missing.push('טלפון')
    if (!form.id_number) missing.push('תעודת זהות')
    if (!form.org_id) missing.push('ארגון')
    if (!form.status_id) missing.push('סטטוס')
    if (!form.subject) missing.push('נושא')
    if (!form.cat1_id) missing.push('סיווג ראשון')
    if (!form.cat2_id) missing.push('סיווג שני')
    if (!form.cat3_id) missing.push('סיווג שלישי')
    if (!form.content) missing.push('תוכן הפניה')
    if (missing.length) { alert('שדות חובה חסרים:\n' + missing.join(', ')); return }

    setSaving(true)
    const insertData: any = {
      customer_name: form.customer_name,
      phone: form.phone,
      id_number: form.id_number,
      subject: form.subject,
      content: form.content,
      org_id: form.org_id || null,
      org_name: form.org_name || null,
      status_id: form.status_id || null,
      status_name: form.status_name || null,
      cat1_id: form.cat1_id || null,
      cat1_name: form.cat1_name || null,
      cat2_id: form.cat2_id || null,
      cat2_name: form.cat2_name || null,
      cat3_id: form.cat3_id || null,
      cat3_name: form.cat3_name || null,
      supplier_id: form.supplier_id || null,
      supplier_name: form.supplier_name || null,
      benefit_id: form.benefit_id || null,
      benefit_name: form.benefit_name || null,
      agent_id: profile.id,
      agent_name: profile.full_name,
    }
    const { data: newCase, error } = await supabase.from('cases').insert(insertData).select().single()
    setSaving(false)
    if (error) { alert('שגיאה בשמירה: ' + error.message); return }
    setToast('פניה נשמרה ✓')
    setTimeout(() => router.push('/dashboard?openCase=' + newCase.id), 800)
  }

  if (loading) return null

  const step = !form.customer_name || !form.phone || !form.id_number || !form.org_id ? 1
    : !form.status_id || !form.subject || !form.content ? 2 : 3

  return (
    <>
      <Topbar userName={profile?.full_name || ''} userRole={profile?.role || 'agent'} userEmail={profile?.email || ''} />
      <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #eff6ff 0%, #f5f3ff 50%, #f0fdfa 100%)', padding: '28px 24px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>

          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 28 }}>
            <a href="/dashboard" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 10, background: '#fff', color: '#475569', fontSize: 13, fontWeight: 600, textDecoration: 'none', fontFamily: 'Heebo, sans-serif', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', border: '1px solid #e2e8f0' }}>← חזרה</a>
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', margin: 0 }}>פניה חדשה</h1>
              <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>מלא את כל השדות המסומנים ב-*</div>
            </div>
          </div>

          {/* Progress steps */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 28, background: '#fff', borderRadius: 14, padding: '16px 24px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: '1px solid #e2e8f0' }}>
            {[
              { n: 1, label: 'פרטי לקוח', icon: '👤' },
              { n: 2, label: 'פרטי הפניה', icon: '📋' },
              { n: 3, label: 'סיווגים', icon: '🏷️' },
            ].map((s, i) => (
              <div key={s.n} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: step > s.n ? '#16a34a' : step === s.n ? '#2563eb' : '#f1f5f9',
                    color: step >= s.n ? '#fff' : '#94a3b8', fontSize: step > s.n ? 16 : 13, fontWeight: 700, flexShrink: 0,
                    boxShadow: step === s.n ? '0 0 0 4px #dbeafe' : 'none', transition: 'all 0.3s'
                  }}>{step > s.n ? '✓' : s.icon}</div>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: step >= s.n ? '#1e293b' : '#94a3b8' }}>{s.label}</div>
                    <div style={{ fontSize: 10, color: step > s.n ? '#16a34a' : step === s.n ? '#2563eb' : '#cbd5e1' }}>{step > s.n ? 'הושלם' : step === s.n ? 'בתהליך' : 'ממתין'}</div>
                  </div>
                </div>
                {i < 2 && <div style={{ height: 2, flex: 1, background: step > s.n ? '#16a34a' : '#e2e8f0', borderRadius: 2, margin: '0 12px', transition: 'background 0.3s' }} />}
              </div>
            ))}
          </div>

          {/* Main card */}
          <form onSubmit={handleSubmit}>
            <div style={{ background: '#fff', borderRadius: 16, boxShadow: '0 4px 24px rgba(0,0,0,0.07)', border: '1px solid #e2e8f0', overflow: 'hidden' }}>

              {/* Section 1: Customer */}
              <div style={{ padding: '28px 32px', borderBottom: '1px solid #f1f5f9' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 22 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17 }}>👤</div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#1e293b' }}>פרטי לקוח</div>
                    <div style={{ fontSize: 11, color: '#94a3b8' }}>מידע אישי בסיסי</div>
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' as const, letterSpacing: '0.5px', marginBottom: 6, display: 'block' }}>שם לקוח מלא *</label>
                    <div style={{ position: 'relative' }}>
                      <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 14, pointerEvents: 'none' }}>👤</span>
                      <input style={{ width: '100%', padding: '10px 36px 10px 14px', borderRadius: 8, border: '1.5px solid #e2e8f0', fontSize: 13, fontFamily: 'Heebo,sans-serif', background: '#f8fafc', color: '#1e293b', outline: 'none', boxSizing: 'border-box' as const }} value={form.customer_name} onChange={e => setForm(f => ({ ...f, customer_name: e.target.value }))} placeholder="שם מלא" onFocus={e => { e.target.style.borderColor='#2563eb'; e.target.style.background='#fff' }} onBlur={e => { e.target.style.borderColor='#e2e8f0'; e.target.style.background='#f8fafc' }} />
                    </div>
                  </div>
                  <div className="form-group">
                    <label style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' as const, letterSpacing: '0.5px', marginBottom: 6, display: 'block' }}>מספר טלפון *</label>
                    <div style={{ position: 'relative' }}>
                      <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 14, pointerEvents: 'none' }}>📱</span>
                      <input style={{ width: '100%', padding: '10px 36px 10px 14px', borderRadius: 8, border: '1.5px solid #e2e8f0', fontSize: 13, fontFamily: 'Heebo,sans-serif', background: '#f8fafc', color: '#1e293b', outline: 'none', boxSizing: 'border-box' as const }} value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="05X-XXXXXXX" dir="ltr" onFocus={e => { e.target.style.borderColor='#2563eb'; e.target.style.background='#fff' }} onBlur={e => { e.target.style.borderColor='#e2e8f0'; e.target.style.background='#f8fafc' }} />
                    </div>
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' as const, letterSpacing: '0.5px', marginBottom: 6, display: 'block' }}>תעודת זהות *</label>
                    <div style={{ position: 'relative' }}>
                      <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 14, pointerEvents: 'none' }}>🪪</span>
                      <input style={{ width: '100%', padding: '10px 36px 10px 14px', borderRadius: 8, border: '1.5px solid #e2e8f0', fontSize: 13, fontFamily: 'Heebo,sans-serif', background: '#f8fafc', color: '#1e293b', outline: 'none', boxSizing: 'border-box' as const }} value={form.id_number} onChange={e => setForm(f => ({ ...f, id_number: e.target.value }))} placeholder="9 ספרות" maxLength={9} onFocus={e => { e.target.style.borderColor='#2563eb'; e.target.style.background='#fff' }} onBlur={e => { e.target.style.borderColor='#e2e8f0'; e.target.style.background='#f8fafc' }} />
                    </div>
                  </div>
                  <div className="form-group">
                    <label style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' as const, letterSpacing: '0.5px', marginBottom: 6, display: 'block' }}>ארגון / פעילות *</label>
                    <div style={{ position: 'relative' }}>
                      <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 14, pointerEvents: 'none' }}>🏢</span>
                      <select style={{ width: '100%', padding: '10px 36px 10px 14px', borderRadius: 8, border: '1.5px solid #e2e8f0', fontSize: 13, fontFamily: 'Heebo,sans-serif', background: '#f8fafc', color: form.org_id ? '#1e293b' : '#94a3b8', outline: 'none', appearance: 'none' as const, boxSizing: 'border-box' as const }} value={form.org_id} onChange={e => handleOrgChange(e.target.value)}>
                        <option value="">בחר ארגון</option>
                        {orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              {/* Section 2: Case */}
              <div style={{ padding: '28px 32px', borderBottom: '1px solid #f1f5f9', background: '#fafbff' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 22 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: '#f5f3ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17 }}>📋</div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#1e293b' }}>פרטי הפניה</div>
                    <div style={{ fontSize: 11, color: '#94a3b8' }}>מה הלקוח צריך?</div>
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' as const, letterSpacing: '0.5px', marginBottom: 6, display: 'block' }}>סטטוס *</label>
                    <select style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1.5px solid #e2e8f0', fontSize: 13, fontFamily: 'Heebo,sans-serif', background: '#f8fafc', color: form.status_id ? '#1e293b' : '#94a3b8', outline: 'none', appearance: 'none' as const }} value={form.status_id} onChange={e => { const s = statuses.find(x => x.id === e.target.value); setForm(f => ({ ...f, status_id: e.target.value, status_name: s?.name || '' })) }}>
                      <option value="">בחר סטטוס</option>
                      {statuses.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' as const, letterSpacing: '0.5px', marginBottom: 6, display: 'block' }}>נושא הפניה *</label>
                    <div style={{ position: 'relative' }}>
                      <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 14, pointerEvents: 'none' }}>✏️</span>
                      <input style={{ width: '100%', padding: '10px 36px 10px 14px', borderRadius: 8, border: '1.5px solid #e2e8f0', fontSize: 13, fontFamily: 'Heebo,sans-serif', background: '#f8fafc', color: '#1e293b', outline: 'none', boxSizing: 'border-box' as const }} value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} placeholder="נושא קצר ותמציתי" onFocus={e => { e.target.style.borderColor='#7c3aed'; e.target.style.background='#fff' }} onBlur={e => { e.target.style.borderColor='#e2e8f0'; e.target.style.background='#f8fafc' }} />
                    </div>
                  </div>
                </div>
                <div className="form-group">
                  <label style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' as const, letterSpacing: '0.5px', marginBottom: 6, display: 'block' }}>תוכן הפניה *</label>
                  <textarea style={{ width: '100%', padding: '12px 14px', borderRadius: 8, border: '1.5px solid #e2e8f0', fontSize: 13, fontFamily: 'Heebo,sans-serif', background: '#f8fafc', color: '#1e293b', outline: 'none', resize: 'vertical' as const, lineHeight: 1.6 }} rows={4} value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))} placeholder="תאר את הפניה בפירוט — מה קרה, מה הלקוח צריך..." onFocus={e => { (e.target as any).style.borderColor='#7c3aed'; (e.target as any).style.background='#fff' }} onBlur={e => { (e.target as any).style.borderColor='#e2e8f0'; (e.target as any).style.background='#f8fafc' }} />
                </div>
              </div>

              {/* Section 3: Classifications */}
              <div style={{ padding: '28px 32px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 22 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: '#f0fdfa', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17 }}>🏷️</div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#1e293b' }}>סיווגים</div>
                    <div style={{ fontSize: 11, color: '#94a3b8' }}>סווג את הפניה בדיוק</div>
                  </div>
                </div>
                <div className="form-row-3">
                  {[
                    { label: 'סיווג ראשון *', value: form.cat1_id, disabled: !form.org_id, list: cat1List, onChange: handleCat1Change, placeholder: form.org_id ? 'בחר' : 'בחר ארגון קודם' },
                    { label: 'סיווג שני *', value: form.cat2_id, disabled: !form.cat1_id, list: cat2List, onChange: handleCat2Change, placeholder: form.cat1_id ? 'בחר' : 'בחר סיווג ראשון' },
                    { label: 'סיווג שלישי *', value: form.cat3_id, disabled: !form.cat2_id, list: cat3List, onChange: handleCat3Change, placeholder: form.cat2_id ? 'בחר' : 'בחר סיווג שני', dynamic: true },
                  ].map(f2 => (
                    <div key={f2.label} className="form-group">
                      <label style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' as const, letterSpacing: '0.5px', marginBottom: 6, display: 'block' }}>{f2.label}</label>
                      <select style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1.5px solid #e2e8f0', fontSize: 13, fontFamily: 'Heebo,sans-serif', background: f2.disabled ? '#f1f5f9' : '#f8fafc', color: f2.value ? '#1e293b' : '#94a3b8', outline: 'none', appearance: 'none' as const, opacity: f2.disabled ? 0.6 : 1 }} value={f2.value} onChange={e => f2.onChange(e.target.value)} disabled={f2.disabled}>
                        <option value="">{f2.placeholder}</option>
                        {f2.list.map((c: any) => <option key={c.id} value={c.id}>{c.name}{f2.dynamic && c.opens_dynamic ? ' 📦' : ''}</option>)}
                      </select>
                    </div>
                  ))}
                </div>

                {showDynamic && (
                  <div style={{ marginTop: 18, padding: '18px 20px', background: 'linear-gradient(135deg, #eff6ff, #f5f3ff)', border: '1.5px solid #bfdbfe', borderRadius: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                      <span style={{ fontSize: 18 }}>📦</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#1d4ed8' }}>שדות נוספים — ספק והטבה</span>
                    </div>
                    <div className="form-row">
                      <div className="form-group">
                        <label style={{ fontSize: 11, fontWeight: 700, color: '#1d4ed8', textTransform: 'uppercase' as const, letterSpacing: '0.5px', marginBottom: 6, display: 'block' }}>שם ספק</label>
                        <select style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1.5px solid #bfdbfe', fontSize: 13, fontFamily: 'Heebo,sans-serif', background: '#fff', outline: 'none', appearance: 'none' as const }} value={form.supplier_id} onChange={e => { const s = suppliers.find(x => x.id === e.target.value); setForm(f => ({ ...f, supplier_id: e.target.value, supplier_name: s?.name || '' })) }}>
                          <option value="">בחר ספק</option>
                          {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                      </div>
                      <div className="form-group">
                        <label style={{ fontSize: 11, fontWeight: 700, color: '#1d4ed8', textTransform: 'uppercase' as const, letterSpacing: '0.5px', marginBottom: 6, display: 'block' }}>שם הטבה</label>
                        <select style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1.5px solid #bfdbfe', fontSize: 13, fontFamily: 'Heebo,sans-serif', background: '#fff', outline: 'none', appearance: 'none' as const }} value={form.benefit_id} onChange={e => { const b = benefits.find(x => x.id === e.target.value); setForm(f => ({ ...f, benefit_id: e.target.value, benefit_name: b?.name || '' })) }}>
                          <option value="">בחר הטבה</option>
                          {benefits.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                        </select>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Footer buttons */}
              <div style={{ padding: '20px 32px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: 12, color: '#94a3b8' }}>
                  {step === 1 ? '📝 מלא פרטי לקוח להמשיך' : step === 2 ? '📋 מלא פרטי פניה' : '✅ מוכן לשמירה!'}
                </div>
                <div style={{ display: 'flex', gap: 12 }}>
                  <a href="/dashboard" style={{ display: 'inline-flex', alignItems: 'center', padding: '11px 24px', borderRadius: 10, background: '#fff', color: '#475569', fontSize: 14, fontWeight: 600, textDecoration: 'none', fontFamily: 'Heebo, sans-serif', border: '1.5px solid #e2e8f0' }}>ביטול</a>
                  <button type="submit" disabled={saving} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '11px 36px', borderRadius: 10, border: 'none', background: saving ? '#94a3b8' : 'linear-gradient(135deg, #059669, #10b981)', color: '#fff', fontSize: 15, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'Heebo, sans-serif', boxShadow: saving ? 'none' : '0 4px 18px rgba(5,150,105,0.35)', letterSpacing: '0.3px' }}>
                    {saving ? '⏳ שומר...' : '💾 שמור פניה'}
                  </button>
                </div>
              </div>

            </div>
          </form>
        </div>
      </div>
      {toast && <div className="toast">{toast}</div>}
    </>
  )
}
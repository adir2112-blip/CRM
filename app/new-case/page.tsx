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
    supabase.from('organizations').select('*').eq('active', true).order('name').then(({ data }) => setOrgs(data || []))
    supabase.from('statuses').select('*').eq('active', true).order('sort_order').then(({ data }) => setStatuses(data || []))
    supabase.from('suppliers').select('*').eq('active', true).order('name').then(({ data }) => setSuppliers(data || []))
    supabase.from('benefits').select('*').eq('active', true).order('name').then(({ data }) => setBenefits(data || []))
  }, [])

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
    const { error } = await supabase.from('cases').insert(insertData)
    setSaving(false)
    if (error) { alert('שגיאה בשמירה: ' + error.message); return }
    setToast('פניה נשמרה ✓')
    setTimeout(() => router.push('/dashboard'), 1000)
  }

  if (loading) return null

  const sectionStyle = {
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: 12,
    padding: '20px 24px',
    marginBottom: 16,
    boxShadow: '0 1px 4px rgba(0,0,0,0.05)'
  }

  const sectionTitle = (icon: string, title: string) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid #f3f4f6' }}>
      <span style={{ fontSize: 16 }}>{icon}</span>
      <span style={{ fontSize: 13, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{title}</span>
    </div>
  )

  return (
    <>
      <Topbar userName={profile?.full_name || ''} userRole={profile?.role || 'agent'} userEmail={profile?.email || ''} />
      <div style={{ padding: '22px 26px', maxWidth: 900, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
          <a href="/dashboard" className="btn btn-sm">← חזרה</a>
          <div>
            <div className="page-title">פניה חדשה</div>
            <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>מלא את כל השדות המסומנים ב-*</div>
          </div>
        </div>
        <form onSubmit={handleSubmit}>

          {/* Section 1: Customer Info */}
          <div style={sectionStyle}>
            {sectionTitle('👤', 'פרטי לקוח')}
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">שם לקוח מלא *</label>
                <input className="form-input" value={form.customer_name} onChange={e => setForm(f => ({ ...f, customer_name: e.target.value }))} placeholder="שם מלא" />
              </div>
              <div className="form-group">
                <label className="form-label">מספר טלפון *</label>
                <input className="form-input" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="05X-XXXXXXX" dir="ltr" />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">תעודת זהות *</label>
                <input className="form-input" value={form.id_number} onChange={e => setForm(f => ({ ...f, id_number: e.target.value }))} placeholder="9 ספרות" maxLength={9} />
              </div>
              <div className="form-group">
                <label className="form-label">ארגון / פעילות *</label>
                <select className="form-input" value={form.org_id} onChange={e => handleOrgChange(e.target.value)}>
                  <option value="">בחר ארגון</option>
                  {orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Section 2: Case Info */}
          <div style={sectionStyle}>
            {sectionTitle('📋', 'פרטי פניה')}
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">סטטוס *</label>
                <select className="form-input" value={form.status_id} onChange={e => { const s = statuses.find(x => x.id === e.target.value); setForm(f => ({ ...f, status_id: e.target.value, status_name: s?.name || '' })) }}>
                  <option value="">בחר סטטוס</option>
                  {statuses.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">נושא הפניה *</label>
                <input className="form-input" value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} placeholder="נושא קצר ותמציתי" />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">תוכן הפניה *</label>
              <textarea className="form-input" rows={4} value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))} placeholder="תאר את הפניה בפירוט..." style={{ resize: 'vertical' }} />
            </div>
          </div>

          {/* Section 3: Classifications */}
          <div style={sectionStyle}>
            {sectionTitle('🏷️', 'סיווגים')}
            <div className="form-row-3">
              <div className="form-group">
                <label className="form-label">סיווג ראשון *</label>
                <select className="form-input" value={form.cat1_id} onChange={e => handleCat1Change(e.target.value)} disabled={!form.org_id}
                  style={{ opacity: !form.org_id ? 0.5 : 1 }}>
                  <option value="">{form.org_id ? 'בחר סיווג' : 'בחר ארגון קודם'}</option>
                  {cat1List.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">סיווג שני *</label>
                <select className="form-input" value={form.cat2_id} onChange={e => handleCat2Change(e.target.value)} disabled={!form.cat1_id}
                  style={{ opacity: !form.cat1_id ? 0.5 : 1 }}>
                  <option value="">{form.cat1_id ? 'בחר סיווג' : 'בחר סיווג ראשון'}</option>
                  {cat2List.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">סיווג שלישי *</label>
                <select className="form-input" value={form.cat3_id} onChange={e => handleCat3Change(e.target.value)} disabled={!form.cat2_id}
                  style={{ opacity: !form.cat2_id ? 0.5 : 1 }}>
                  <option value="">{form.cat2_id ? 'בחר סיווג' : 'בחר סיווג שני'}</option>
                  {cat3List.map(c => <option key={c.id} value={c.id}>{c.name}{c.opens_dynamic ? ' 📦' : ''}</option>)}
                </select>
              </div>
            </div>
            {showDynamic && (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, padding: '8px 12px', background: '#eff4ff', borderRadius: 8, border: '1px solid #bfdbfe' }}>
                  <span>📦</span>
                  <span style={{ fontSize: 12, color: '#2563eb', fontWeight: 600 }}>שדות נוספים — ספק והטבה</span>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">שם ספק</label>
                    <select className="form-input" value={form.supplier_id} onChange={e => { const s = suppliers.find(x => x.id === e.target.value); setForm(f => ({ ...f, supplier_id: e.target.value, supplier_name: s?.name || '' })) }}>
                      <option value="">בחר ספק</option>
                      {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">שם הטבה</label>
                    <select className="form-input" value={form.benefit_id} onChange={e => { const b = benefits.find(x => x.id === e.target.value); setForm(f => ({ ...f, benefit_id: e.target.value, benefit_name: b?.name || '' })) }}>
                      <option value="">בחר הטבה</option>
                      {benefits.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
            <a href="/dashboard" className="btn" style={{ padding: '10px 24px' }}>ביטול</a>
            <button className="btn btn-primary" type="submit" disabled={saving} style={{ padding: '10px 28px', fontSize: 14 }}>
              {saving ? '⏳ שומר...' : '💾 שמור פניה'}
            </button>
          </div>
        </form>
      </div>
      {toast && <div className="toast">{toast}</div>}
    </>
  )
}

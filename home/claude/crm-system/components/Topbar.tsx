'use client'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { useState, useRef, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { fmt } from '@/lib/utils'

const SUPER_ADMIN = 'adir2112@gmail.com'

interface TopbarProps {
  userName: string
  userRole: string
  userEmail?: string
  onOpenCase?: (c: any) => void
}

export default function Topbar({ userName, userRole, userEmail, onOpenCase }: TopbarProps) {
  const router = useRouter()
  const pathname = usePathname()
  const isAdmin = userRole === 'admin'
  const isSuperAdmin = userEmail === SUPER_ADMIN
  const [searchQ, setSearchQ] = useState('')
  const [results, setResults] = useState<any[]>([])
  const [showResults, setShowResults] = useState(false)
  const [overdueReminders, setOverdueReminders] = useState<any[]>([])
  const [showReminderPopup, setShowReminderPopup] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()
  const initials = userName.split(' ').map(p => p[0]).join('').slice(0, 2)

  // Check overdue reminders on mount
  useEffect(() => {
    async function checkReminders() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const lastLogin = localStorage.getItem('lastLogin_' + user.id) || new Date(0).toISOString()
      const now = new Date().toISOString()
      const { data } = await supabase
        .from('reminders')
        .select('*')
        .eq('agent_id', user.id)
        .eq('is_done', false)
        .lte('remind_at', now)
        .gte('remind_at', lastLogin)
        .order('remind_at')
      if (data && data.length > 0) {
        setOverdueReminders(data)
        setShowReminderPopup(true)
      }
      localStorage.setItem('lastLogin_' + user.id, now)
    }
    if (userName) checkReminders()
  }, [userName])

  function relativeTime(dateStr: string): string {
    const now = new Date()
    const d = new Date(dateStr)
    const nowDay = new Date(now.toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' }))
    const dDay = new Date(d.toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' }))
    const diffDays = Math.round((nowDay.getTime() - dDay.getTime()) / 864e5)
    if (diffDays === 0) return 'היום'
    if (diffDays === 1) return 'אתמול'
    if (diffDays === 2) return 'שלשום'
    if (diffDays < 7) return `לפני ${diffDays} ימים`
    if (diffDays < 14) return 'שבוע שעבר'
    if (diffDays < 21) return 'לפני שבועיים'
    if (diffDays < 30) return 'לפני 3 שבועות'
    if (diffDays < 60) return 'חודש שעבר'
    if (diffDays < 90) return 'לפני חודשיים'
    return `לפני ${Math.floor(diffDays / 30)} חודשים`
  }

  async function doSearch(q: string) {
    setSearchQ(q)
    if (!q.trim()) { setResults([]); setShowResults(false); return }
    const { data: { user } } = await supabase.auth.getUser()
    const { data: myProfile } = await supabase.from('profiles').select('allowed_orgs, role').eq('id', user?.id || '').single()
    
    const qClean = q.trim()
    const qPhone = qClean.replace(/\D/g, '')
    
    let query = supabase
      .from('cases')
      .select('id, customer_name, phone, id_number, org_name, org_id, status_name, updated_at, agent_name')
      .order('updated_at', { ascending: false })
      .limit(50)
    
    if (myProfile?.role === 'agent' && myProfile?.allowed_orgs?.length > 0) {
      query = query.in('org_id', myProfile.allowed_orgs)
    }
    
    const { data } = await query
    const all = data || []
    
    // Filter and deduplicate by phone
    const matched = all.filter(c => {
      const nameMatch = c.customer_name?.toLowerCase().includes(qClean.toLowerCase())
      const cPhone = c.phone?.replace(/\D/g,'') || ''
      const phoneMatch = qPhone.length >= 4 && cPhone.startsWith(qPhone)
      const idMatch = qClean.length >= 5 && c.id_number?.startsWith(qClean)
      return nameMatch || phoneMatch || idMatch
    })
    
    // Deduplicate — show latest case per unique phone
    const seen = new Set<string>()
    const unique = matched.filter(c => {
      const key = c.phone || c.id_number || c.id
      if (seen.has(key)) return false
      seen.add(key)
      return true
    }).slice(0, 8)
    
    setResults(unique)
    setShowResults(true)
  }

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowResults(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  function handleSelectCase(c: any) {
    setShowResults(false)
    setSearchQ('')
    if (onOpenCase) onOpenCase(c)
    else router.push('/dashboard?openCase=' + c.id)
  }

  async function markReminderDone(id: string) {
    await supabase.from('reminders').update({ is_done: true }).eq('id', id)
    setOverdueReminders(prev => prev.filter(r => r.id !== id))
  }

  return (
    <>
      <div className="topbar">
        <div className="topbar-brand"><span className="brand-dot" />CRM</div>
        <Link href="/dashboard" className={`nav-btn${pathname === '/dashboard' ? ' active' : ''}`}>🏠 ראשי</Link>
        <Link href="/new-case" style={{
          padding: '7px 16px', borderRadius: 8, border: 'none',
          background: pathname === '/new-case' ? 'linear-gradient(135deg,#047857,#059669)' : 'linear-gradient(135deg,#059669,#10b981)',
          color: '#fff', cursor: 'pointer', fontFamily: 'Heebo, sans-serif',
          fontSize: 13, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 5,
          boxShadow: '0 2px 10px rgba(5,150,105,0.45)', textDecoration: 'none',
          transition: 'all 0.15s', letterSpacing: '0.2px'
        }}>＋ פניה חדשה</Link>
        {/* Agent-only links */}
        {!isAdmin && <Link href="/my-cases" className={`nav-btn${pathname === '/my-cases' ? ' active' : ''}`}>⏳ פניות בטיפול</Link>}
        {!isAdmin && <Link href="/all-cases" className={`nav-btn${pathname === '/all-cases' ? ' active' : ''}`}>📋 כל הפניות</Link>}
        {/* Admin-only links */}
        {isAdmin && <Link href="/cases" className={`nav-btn${pathname === '/cases' ? ' active' : ''}`}>📋 כל הפניות</Link>}
        {isAdmin && <Link href="/agents-status" className={`nav-btn${pathname === '/agents-status' ? ' active' : ''}`}>👥 בטיפול נציגים</Link>}
        {isAdmin && <Link href="/reports" className={`nav-btn${pathname === '/reports' ? ' active' : ''}`}>📊 דוחות</Link>}
        {isAdmin && <Link href="/analytics" className={`nav-btn${pathname === '/analytics' ? ' active' : ''}`}>🎯 דשבורד</Link>}
        <Link href="/calendar" className={`nav-btn${pathname === '/calendar' ? ' active' : ''}`}>📅 יומן</Link>
        {isSuperAdmin && <Link href="/admin" className={`nav-btn${pathname.startsWith('/admin') ? ' active' : ''}`}>⚙ ניהול</Link>}

        <div className="topbar-right">
          {/* Search */}
          <div ref={searchRef} style={{ position: 'relative' }}>
            <input
              value={searchQ}
              onChange={e => doSearch(e.target.value)}
              onFocus={() => results.length > 0 && setShowResults(true)}
              placeholder="🔍 חיפוש לקוח..."
              style={{
                width: 210, padding: '5px 12px', borderRadius: 20,
                border: '1px solid rgba(255,255,255,0.3)',
                background: 'rgba(255,255,255,0.15)', color: '#fff',
                fontSize: 12, fontFamily: 'Heebo, sans-serif', outline: 'none',
              }}
              onMouseEnter={e => { (e.target as any).style.background = 'rgba(255,255,255,0.22)' }}
              onMouseLeave={e => { if (document.activeElement !== e.target) (e.target as any).style.background = 'rgba(255,255,255,0.15)' }}
            />
            <style>{`input::placeholder { color: rgba(255,255,255,0.7) !important; }`}</style>
            {showResults && results.length > 0 && (
              <div style={{
                position: 'absolute', top: '110%', left: 0,
                background: '#fff', border: '1px solid #dde1eb',
                borderRadius: 10, boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
                zIndex: 999, overflow: 'hidden', minWidth: 360
              }}>
                {results.map(c => (
                  <div key={c.id} onClick={() => handleSelectCase(c)} style={{
                    padding: '10px 14px', cursor: 'pointer',
                    borderBottom: '1px solid #f1f3f8',
                  }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#eff4ff')}
                    onMouseLeave={e => (e.currentTarget.style.background = '#fff')}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <span style={{ fontWeight: 700, fontSize: 14, color: '#111827' }}>{c.customer_name}</span>
                      <div style={{ textAlign: 'left' }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: '#2563eb' }}>{relativeTime(c.updated_at)}</div>
                        <div style={{ fontSize: 10, color: '#9ca3af' }}>{fmt(c.updated_at)}</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span style={{ fontSize: 12, color: '#6b7280', direction: 'ltr', fontWeight: 500 }}>{c.phone}</span>
                      <span style={{ fontSize: 11, color: '#9ca3af' }}>|</span>
                      <span style={{ fontSize: 11, color: '#6b7280' }}>{(c.org_name || '').split(' ')[0]}</span>
                      <span style={{ fontSize: 11, color: '#9ca3af' }}>נציג: {c.agent_name}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Reminder bell */}
          {overdueReminders.length > 0 && (
            <button onClick={() => setShowReminderPopup(true)} style={{
              background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 999,
              padding: '4px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
              fontSize: 12, fontWeight: 700, color: '#b91c1c', fontFamily: 'Heebo, sans-serif'
            }}>
              🔔 {overdueReminders.length}
            </button>
          )}

          <div className="user-pill">
            <div className="avatar">{initials}</div>
            <div>
              <div className="user-name">{userName}</div>
              <div className="user-role">{isAdmin ? 'מנהל' : 'נציג'}</div>
            </div>
          </div>
          <button className="btn btn-white btn-sm" onClick={handleLogout}>יציאה</button>
        </div>
      </div>

      {/* Reminder popup */}
      {showReminderPopup && overdueReminders.length > 0 && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)',
          zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div style={{
            background: '#fff', borderRadius: 16, padding: 28, width: 460, maxWidth: '95vw',
            boxShadow: '0 24px 64px rgba(0,0,0,0.2)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
              <span style={{ fontSize: 24 }}>🔔</span>
              <div style={{ fontSize: 16, fontWeight: 700 }}>תזכורות שממתינות לך</div>
              <span style={{ marginRight: 'auto', fontSize: 12, color: '#9ca3af' }}>{overdueReminders.length} תזכורות</span>
            </div>
            <div style={{ maxHeight: 320, overflowY: 'auto' }}>
              {overdueReminders.map(r => (
                <div key={r.id} style={{
                  background: '#fff5f5', border: '1px solid #fca5a5', borderRadius: 8,
                  padding: '12px 14px', marginBottom: 10
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontWeight: 600, fontSize: 13 }}>{r.customer_name || 'תזכורת כללית'}</span>
                    <span style={{ fontSize: 11, color: '#b91c1c', fontWeight: 600 }}>{fmt(r.remind_at)}</span>
                  </div>
                  <div style={{ fontSize: 13, color: '#4b5568', marginBottom: 8 }}>{r.note}</div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {r.case_id && (
                      <button style={{ padding: '4px 12px', borderRadius: 999, fontSize: 12, fontWeight: 600, cursor: 'pointer', background: '#eff4ff', color: '#2563eb', border: '1px solid #bfdbfe', fontFamily: 'Heebo, sans-serif' }}
                        onClick={() => { setShowReminderPopup(false); router.push('/dashboard?openCase=' + r.case_id) }}>
                        פתח כרטיס לקוח
                      </button>
                    )}
                    <button className="btn btn-xs" style={{ background: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0' }}
                      onClick={() => markReminderDone(r.id)}>✓ טופל</button>
                  </div>
                </div>
              ))}
            </div>
            <button className="btn" style={{ width: '100%', justifyContent: 'center', marginTop: 14 }}
              onClick={() => setShowReminderPopup(false)}>סגור</button>
          </div>
        </div>
      )}
    </>
  )
}

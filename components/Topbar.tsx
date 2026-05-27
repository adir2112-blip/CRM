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
  const searchRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()

  const initials = userName.split(' ').map(p => p[0]).join('').slice(0, 2)

  async function doSearch(q: string) {
    setSearchQ(q)
    if (!q.trim()) { setResults([]); setShowResults(false); return }
    const { data } = await supabase
      .from('cases')
      .select('id, customer_name, phone, id_number, org_name, status_name, updated_at, agent_name')
      .or(`customer_name.ilike.%${q}%,phone.ilike.%${q}%,id_number.ilike.%${q}%`)
      .order('updated_at', { ascending: false })
      .limit(8)
    setResults(data || [])
    setShowResults(true)
  }

  // Close dropdown when clicking outside
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
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  function handleSelectCase(c: any) {
    setShowResults(false)
    setSearchQ('')
    if (onOpenCase) {
      onOpenCase(c)
    } else {
      // navigate to dashboard with case id
      router.push('/dashboard?case=' + c.id)
    }
  }

  return (
    <div className="topbar">
      <div className="topbar-brand"><span className="brand-dot" />CRM</div>
      <Link href="/dashboard" className={`nav-btn${pathname === '/dashboard' ? ' active' : ''}`}>🏠 ראשי</Link>
      <Link href="/new-case" className={`nav-btn${pathname === '/new-case' ? ' active' : ''}`}>＋ פניה חדשה</Link>
      {isAdmin && <Link href="/cases" className={`nav-btn${pathname === '/cases' ? ' active' : ''}`}>📋 כל הפניות</Link>}
      {isAdmin && <Link href="/agents-status" className={`nav-btn${pathname === '/agents-status' ? ' active' : ''}`}>👥 בטיפול נציגים</Link>}
      {isAdmin && <Link href="/reports" className={`nav-btn${pathname === '/reports' ? ' active' : ''}`}>📊 דוחות</Link>}
      {isSuperAdmin && <Link href="/admin" className={`nav-btn${pathname.startsWith('/admin') ? ' active' : ''}`}>⚙ ניהול</Link>}

      <div className="topbar-right">
        {/* Global search */}
        <div ref={searchRef} style={{ position: 'relative' }}>
          <input
            value={searchQ}
            onChange={e => doSearch(e.target.value)}
            onFocus={() => results.length > 0 && setShowResults(true)}
            placeholder="🔍 חיפוש לקוח..."
            style={{
              width: 200, padding: '5px 10px', borderRadius: 20,
              border: '1px solid rgba(255,255,255,0.25)',
              background: 'rgba(255,255,255,0.15)', color: '#fff',
              fontSize: 12, fontFamily: 'Heebo, sans-serif', outline: 'none'
            }}
          />
          {showResults && results.length > 0 && (
            <div style={{
              position: 'absolute', top: '110%', left: 0, right: 0,
              background: '#fff', border: '1px solid #dde1eb',
              borderRadius: 10, boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
              zIndex: 999, overflow: 'hidden', minWidth: 340
            }}>
              {results.map(c => (
                <div key={c.id} onClick={() => handleSelectCase(c)} style={{
                  padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid #f1f3f8',
                  display: 'flex', flexDirection: 'column', gap: 3
                }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#eff4ff')}
                  onMouseLeave={e => (e.currentTarget.style.background = '#fff')}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 600, fontSize: 13, color: '#111827' }}>{c.customer_name}</span>
                    <span style={{ fontSize: 10, color: '#9ca3af' }}>עדכון: {fmt(c.updated_at)}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span style={{ fontSize: 11, color: '#6b7280', direction: 'ltr' }}>{c.phone}</span>
                    <span style={{ fontSize: 10, color: '#9ca3af' }}>{(c.org_name || '').split(' ')[0]}</span>
                    <span style={{ fontSize: 10, color: '#9ca3af' }}>נציג: {c.agent_name}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

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
  )
}

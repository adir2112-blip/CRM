'use client'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase'

interface TopbarProps {
  userName: string
  userRole: string
}

export default function Topbar({ userName, userRole }: TopbarProps) {
  const router = useRouter()
  const pathname = usePathname()
  const isAdmin = userRole === 'admin'

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  const initials = userName.split(' ').map(p => p[0]).join('').slice(0, 2)

  return (
    <div className="topbar">
      <div className="topbar-brand">
        <span className="brand-dot" />
        CRM
      </div>
      <Link href="/dashboard" className={`nav-btn${pathname === '/dashboard' ? ' active' : ''}`}>🏠 ראשי</Link>
      <Link href="/new-case" className={`nav-btn${pathname === '/new-case' ? ' active' : ''}`}>＋ פניה חדשה</Link>
      {isAdmin && <Link href="/cases" className={`nav-btn${pathname === '/cases' ? ' active' : ''}`}>📋 כל הפניות</Link>}
      {isAdmin && <Link href="/reports" className={`nav-btn${pathname === '/reports' ? ' active' : ''}`}>📊 דוחות</Link>}
      {isAdmin && <Link href="/admin" className={`nav-btn${pathname.startsWith('/admin') ? ' active' : ''}`}>⚙ ניהול</Link>}
      <div className="topbar-right">
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

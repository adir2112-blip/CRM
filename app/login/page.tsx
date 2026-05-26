'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError('מייל או סיסמא שגויים')
      setLoading(false)
    } else {
      router.push('/dashboard')
    }
  }

  return (
    <div className="login-wrap">
      <div className="login-card">
        <div style={{textAlign:'center',marginBottom:28}}>
          <div style={{width:56,height:56,background:'linear-gradient(135deg,#2563eb,#4f46e5)',borderRadius:16,display:'flex',alignItems:'center',justifyContent:'center',fontSize:26,margin:'0 auto 12px',boxShadow:'0 8px 24px rgba(37,99,235,0.35)'}}>📋</div>
          <div style={{fontSize:22,fontWeight:800,color:'var(--text)',letterSpacing:-0.3}}>CRM</div>
          <div style={{fontSize:13,color:'var(--text3)',marginTop:4}}>מערכת ניהול פניות לקוחות</div>
        </div>
        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label className="form-label">כתובת מייל</label>
            <input className="form-input" type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="name@company.com" required />
          </div>
          <div className="form-group">
            <label className="form-label">סיסמא</label>
            <input className="form-input" type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••" required />
          </div>
          {error && <div style={{color:'var(--red)',fontSize:13,marginBottom:12,padding:'8px 12px',background:'var(--red-lt)',borderRadius:'var(--radius-sm)'}}>{error}</div>}
          <button className="btn btn-primary" type="submit" disabled={loading} style={{width:'100%',justifyContent:'center',padding:9,fontSize:14,marginTop:4}}>
            {loading ? 'מתחבר...' : 'כניסה למערכת'}
          </button>
        </form>
      </div>
    </div>
  )
}

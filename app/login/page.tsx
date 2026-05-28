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
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      fontFamily: 'Heebo, sans-serif',
      direction: 'rtl',
      background: '#0f172a',
      overflow: 'hidden',
      position: 'relative',
    }}>

      {/* Animated background */}
      <style>{`
        @keyframes float { 0%,100% { transform: translateY(0px) rotate(0deg); } 50% { transform: translateY(-20px) rotate(3deg); } }
        @keyframes pulse { 0%,100% { opacity: 0.3; } 50% { opacity: 0.6; } }
        @keyframes slideIn { from { opacity: 0; transform: translateY(30px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes dash { to { stroke-dashoffset: 0; } }
        .login-field { transition: all 0.2s; }
        .login-field:focus { border-color: #6366f1 !important; background: #fff !important; box-shadow: 0 0 0 4px rgba(99,102,241,0.15) !important; outline: none; }
        .login-btn { transition: all 0.2s; }
        .login-btn:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 8px 30px rgba(99,102,241,0.5) !important; }
        .login-btn:active:not(:disabled) { transform: translateY(0); }
        .login-card-anim { animation: slideIn 0.6s ease forwards; }
        .stat-chip { animation: float 4s ease-in-out infinite; }
      `}</style>

      {/* Left panel — branding */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '60px 48px',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* SVG network background */}
        <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} viewBox="0 0 800 600" preserveAspectRatio="xMidYMid slice">
          <defs>
            <radialGradient id="bg" cx="50%" cy="50%" r="60%">
              <stop offset="0%" stopColor="#1e1b4b" />
              <stop offset="100%" stopColor="#0f172a" />
            </radialGradient>
          </defs>
          <rect width="800" height="600" fill="url(#bg)" />
          {/* Network nodes */}
          {[
            [120,80],[320,60],[580,90],[720,140],[680,280],[560,380],[400,480],[200,420],[60,300],[160,200],
            [440,160],[520,250],[300,310],[180,360],[620,200],[380,350]
          ].map(([x,y],i) => (
            <circle key={i} cx={x} cy={y} r={3} fill="#6366f1" opacity={0.6}>
              <animate attributeName="opacity" values="0.3;0.7;0.3" dur={`${2+i*0.3}s`} repeatCount="indefinite" />
            </circle>
          ))}
          {/* Connection lines */}
          {[
            [120,80,320,60],[320,60,580,90],[580,90,720,140],[720,140,680,280],
            [680,280,560,380],[560,380,400,480],[400,480,200,420],[200,420,60,300],
            [60,300,160,200],[160,200,120,80],[320,60,440,160],[440,160,520,250],
            [520,250,620,200],[300,310,400,480],[180,360,200,420],[380,350,560,380],
            [440,160,680,280],[160,200,300,310],[320,60,180,360],[520,250,400,480]
          ].map(([x1,y1,x2,y2],i) => (
            <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#6366f1" strokeWidth={0.8} opacity={0.25} />
          ))}
          {/* Glow circles */}
          <circle cx="400" cy="300" r="180" fill="none" stroke="#6366f1" strokeWidth="1" opacity="0.08">
            <animate attributeName="r" values="160;200;160" dur="6s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.05;0.12;0.05" dur="6s" repeatCount="indefinite" />
          </circle>
          <circle cx="400" cy="300" r="280" fill="none" stroke="#818cf8" strokeWidth="0.5" opacity="0.05">
            <animate attributeName="r" values="260;300;260" dur="8s" repeatCount="indefinite" />
          </circle>
        </svg>

        {/* Floating stat chips */}
        <div className="stat-chip" style={{ position:'absolute', top:'15%', right:'12%', background:'rgba(99,102,241,0.15)', border:'1px solid rgba(99,102,241,0.3)', borderRadius:12, padding:'10px 16px', backdropFilter:'blur(8px)', animationDelay:'0s' }}>
          <div style={{ fontSize:18, fontWeight:800, color:'#a5b4fc' }}>+2,400</div>
          <div style={{ fontSize:11, color:'#818cf8' }}>פניות טופלו החודש</div>
        </div>
        <div className="stat-chip" style={{ position:'absolute', bottom:'22%', right:'8%', background:'rgba(16,185,129,0.12)', border:'1px solid rgba(16,185,129,0.25)', borderRadius:12, padding:'10px 16px', backdropFilter:'blur(8px)', animationDelay:'1.5s' }}>
          <div style={{ fontSize:18, fontWeight:800, color:'#6ee7b7' }}>94%</div>
          <div style={{ fontSize:11, color:'#34d399' }}>שביעות רצון</div>
        </div>
        <div className="stat-chip" style={{ position:'absolute', top:'40%', left:'8%', background:'rgba(245,158,11,0.12)', border:'1px solid rgba(245,158,11,0.25)', borderRadius:12, padding:'10px 16px', backdropFilter:'blur(8px)', animationDelay:'0.8s' }}>
          <div style={{ fontSize:18, fontWeight:800, color:'#fcd34d' }}>32</div>
          <div style={{ fontSize:11, color:'#fbbf24' }}>נציגים פעילים</div>
        </div>

        {/* Main brand text */}
        <div style={{ position:'relative', textAlign:'center', zIndex:1 }}>
          <div style={{ width:72, height:72, background:'linear-gradient(135deg,#6366f1,#8b5cf6)', borderRadius:20, display:'flex', alignItems:'center', justifyContent:'center', fontSize:34, margin:'0 auto 20px', boxShadow:'0 12px 40px rgba(99,102,241,0.5)' }}>📋</div>
          <div style={{ fontSize:42, fontWeight:900, color:'#fff', letterSpacing:'-1px', marginBottom:12 }}>CRM</div>
          <div style={{ fontSize:16, color:'#94a3b8', lineHeight:1.6, maxWidth:300 }}>מערכת ניהול פניות לקוחות<br />חכמה ומתקדמת</div>
          <div style={{ display:'flex', gap:16, justifyContent:'center', marginTop:28, flexWrap:'wrap' }}>
            {['ניהול פניות', 'מעקב נציגים', 'דוחות חכמים', 'SMS אוטומטי'].map(f => (
              <div key={f} style={{ display:'flex', alignItems:'center', gap:6, fontSize:12, color:'#818cf8' }}>
                <span style={{ color:'#6ee7b7' }}>✓</span>{f}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel — login form */}
      <div style={{
        width: 440,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '48px 40px',
        background: '#fff',
        borderRadius: '24px 0 0 24px',
        position: 'relative',
        zIndex: 2,
        boxShadow: '-20px 0 60px rgba(0,0,0,0.3)',
      }}>
        <div className="login-card-anim" style={{ width: '100%', maxWidth: 360 }}>
          <div style={{ marginBottom: 36 }}>
            <div style={{ fontSize: 26, fontWeight: 800, color: '#0f172a', marginBottom: 6 }}>ברוך הבא 👋</div>
            <div style={{ fontSize: 14, color: '#64748b' }}>הכנס לחשבונך כדי להמשיך</div>
          </div>

          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: 18 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8, display: 'block' }}>כתובת מייל</label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 16 }}>📧</span>
                <input
                  className="login-field"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  required
                  style={{ width: '100%', padding: '13px 42px 13px 16px', borderRadius: 12, border: '1.5px solid #e2e8f0', fontSize: 14, fontFamily: 'Heebo, sans-serif', background: '#f8fafc', color: '#0f172a', boxSizing: 'border-box' as const, direction: 'ltr', textAlign: 'right' }}
                />
              </div>
            </div>

            <div style={{ marginBottom: 28 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8, display: 'block' }}>סיסמא</label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 16 }}>🔒</span>
                <input
                  className="login-field"
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  style={{ width: '100%', padding: '13px 42px 13px 16px', borderRadius: 12, border: '1.5px solid #e2e8f0', fontSize: 14, fontFamily: 'Heebo, sans-serif', background: '#f8fafc', color: '#0f172a', boxSizing: 'border-box' as const }}
                />
              </div>
            </div>

            {error && (
              <div style={{ color: '#dc2626', fontSize: 13, marginBottom: 16, padding: '10px 14px', background: '#fef2f2', borderRadius: 10, border: '1px solid #fca5a5', display: 'flex', alignItems: 'center', gap: 8 }}>
                ⚠️ {error}
              </div>
            )}

            <button
              className="login-btn"
              type="submit"
              disabled={loading}
              style={{
                width: '100%', padding: '14px', borderRadius: 12, border: 'none',
                background: loading ? '#94a3b8' : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                color: '#fff', fontSize: 15, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer',
                fontFamily: 'Heebo, sans-serif', boxShadow: '0 4px 20px rgba(99,102,241,0.4)',
                letterSpacing: '0.3px',
              }}>
              {loading ? '⏳ מתחבר...' : '🚀 כניסה למערכת'}
            </button>
          </form>

          <div style={{ marginTop: 32, paddingTop: 24, borderTop: '1px solid #f1f5f9', textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: '#94a3b8' }}>© {new Date().getFullYear()} CRM System · כל הזכויות שמורות</div>
          </div>
        </div>
      </div>
    </div>
  )
}

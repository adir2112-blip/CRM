import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: Request) {
  try {
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
    const { email, success, userAgent } = await request.json()

    if (success) {
      await supabase.from('login_attempts').delete().eq('email', email)
      await supabase.from('login_log').insert({ email, user_agent: userAgent, created_at: new Date().toISOString(), success: true })
      return NextResponse.json({ ok: true })
    }

    const { data: existing } = await supabase.from('login_attempts').select('*').eq('email', email).single()
    const attempts = (existing?.attempts || 0) + 1
    const blocked = attempts >= 5
    const blockedUntil = blocked ? new Date(Date.now() + 15 * 60 * 1000).toISOString() : null

    await supabase.from('login_attempts').upsert({ email, attempts, blocked, blocked_until: blockedUntil, last_attempt: new Date().toISOString() }, { onConflict: 'email' })
    await supabase.from('login_log').insert({ email, user_agent: userAgent, created_at: new Date().toISOString(), success: false, note: blocked ? '🔒 נחסם לאחר 5 ניסיונות' : `ניסיון ${attempts}/5` })

    return NextResponse.json({ ok: true, blocked, attempts })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function GET(request: Request) {
  try {
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
    const email = new URL(request.url).searchParams.get('email')
    if (!email) return NextResponse.json({ blocked: false })
    const { data } = await supabase.from('login_attempts').select('*').eq('email', email).single()
    if (!data?.blocked) return NextResponse.json({ blocked: false })
    if (data.blocked_until && new Date(data.blocked_until) < new Date()) {
      await supabase.from('login_attempts').delete().eq('email', email)
      return NextResponse.json({ blocked: false })
    }
    return NextResponse.json({ blocked: true, until: data.blocked_until, attempts: data.attempts })
  } catch {
    return NextResponse.json({ blocked: false })
  }
}

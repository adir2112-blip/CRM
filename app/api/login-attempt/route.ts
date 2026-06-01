import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: Request) {
  try {
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
    const { email, success, userAgent } = await request.json()

    // Get or create attempt record
    const { data: existing } = await supabase
      .from('login_attempts')
      .select('*')
      .eq('email', email)
      .single()

    if (success) {
      // Log successful login
      await supabase.from('login_log').insert({
        email,
        success: true,
        user_agent: userAgent,
        ip: request.headers.get('x-forwarded-for') || '',
        created_at: new Date().toISOString()
      })
      // Reset failed attempts
      if (existing) {
        await supabase.from('login_attempts').update({ count: 0, blocked_until: null }).eq('email', email)
      }
      return NextResponse.json({ ok: true })
    }

    // Failed attempt
    const count = (existing?.count || 0) + 1
    const blockedUntil = count >= 5 ? new Date(Date.now() + 15 * 60 * 1000).toISOString() : null

    if (existing) {
      await supabase.from('login_attempts').update({ count, blocked_until: blockedUntil, last_attempt: new Date().toISOString() }).eq('email', email)
    } else {
      await supabase.from('login_attempts').insert({ email, count, blocked_until: blockedUntil, last_attempt: new Date().toISOString() })
    }

    await supabase.from('login_log').insert({
      email, success: false, user_agent: userAgent,
      ip: request.headers.get('x-forwarded-for') || '',
      created_at: new Date().toISOString()
    })

    return NextResponse.json({ ok: true, blocked: count >= 5, count })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function GET(request: Request) {
  try {
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
    const { searchParams } = new URL(request.url)
    const email = searchParams.get('email')
    if (!email) return NextResponse.json({ blocked: false })

    const { data } = await supabase.from('login_attempts').select('*').eq('email', email).single()
    if (!data) return NextResponse.json({ blocked: false })

    const isBlocked = data.blocked_until && new Date(data.blocked_until) > new Date()
    return NextResponse.json({ blocked: isBlocked, count: data.count, blockedUntil: data.blocked_until })
  } catch {
    return NextResponse.json({ blocked: false })
  }
}

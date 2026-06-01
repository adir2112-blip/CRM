import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: Request) {
  try {
    const { email } = await request.json()
    if (!email) return NextResponse.json({ error: 'נדרש מייל' }, { status: 400 })

    // Get user by email directly
    const { data: { users }, error: usersError } = await supabase.auth.admin.listUsers({ perPage: 1000 })
    const authUser = (users || []).find((u: any) => u.email?.toLowerCase() === email.toLowerCase())
    if (!authUser) return NextResponse.json({ error: 'משתמש לא נמצא' }, { status: 404 })

    const { data: profile } = await supabase.from('profiles').select('phone, full_name').eq('id', authUser.id).single()
    if (!profile?.phone) return NextResponse.json({ error: 'no_phone' }, { status: 400 })

    const code = Math.floor(100000 + Math.random() * 900000).toString()
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString()

    await supabase.from('otp_codes').upsert({
      user_id: authUser.id, code, expires_at: expiresAt, used: false
    }, { onConflict: 'user_id' })

    const accountSid = process.env.TWILIO_ACCOUNT_SID!
    const authToken = process.env.TWILIO_AUTH_TOKEN!
    const from = process.env.TWILIO_PHONE_NUMBER!
    const phone = profile.phone.replace(/\D/g,'').replace(/^972/,'').replace(/^0/,'')
    const phoneE164 = '+972' + phone
    console.log('Sending OTP to:', phoneE164)

    await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
      method: 'POST',
      headers: { 'Authorization': 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64'), 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ To: phoneE164, From: from, Body: `Controller CRM - קוד הכניסה שלך: ${code}\nתקף ל-5 דקות` })
    })

    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

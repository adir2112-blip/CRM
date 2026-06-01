import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: Request) {
  try {
    const { email, code } = await request.json()
    if (!email || !code) return NextResponse.json({ error: 'חסרים פרמטרים' }, { status: 400 })

    const { data: { users }, error: usersError } = await supabase.auth.admin.listUsers({ perPage: 1000 })
    const authUser = (users || []).find((u: any) => u.email?.toLowerCase() === email.toLowerCase())
    if (!authUser) return NextResponse.json({ error: 'משתמש לא נמצא' }, { status: 404 })

    const { data: otp } = await supabase.from('otp_codes')
      .select('*').eq('user_id', authUser.id).eq('used', false).single()

    if (!otp) return NextResponse.json({ error: 'קוד לא נמצא' }, { status: 400 })
    if (new Date(otp.expires_at) < new Date()) return NextResponse.json({ error: 'הקוד פג תוקף' }, { status: 400 })
    if (otp.code !== code) return NextResponse.json({ error: 'קוד שגוי' }, { status: 400 })

    await supabase.from('otp_codes').update({ used: true }).eq('user_id', authUser.id)
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

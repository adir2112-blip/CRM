import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const supabaseAdmin = createClient(
      'https://khucibpmwfpcobfvlibw.supabase.co',
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )
    const { data, error } = await supabaseAdmin.auth.admin.listUsers()
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json(data.users.map(u => ({
      id: u.id,
      email: u.email,
      last_sign_in_at: u.last_sign_in_at,
    })))
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

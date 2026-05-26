import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const { email, password, full_name, role } = await request.json()
    
    const supabaseAdmin = createClient(
      'https://khucibpmwfpcobfvlibw.supabase.co',
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name, role }
    })

    if (error) {
      console.error('Create user error:', error)
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .upsert({ id: data.user.id, full_name, role, active: true })

    if (profileError) {
      console.error('Profile error:', profileError)
    }

    return NextResponse.json({ success: true, userId: data.user.id })
  } catch (e: any) {
    console.error('Unexpected error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
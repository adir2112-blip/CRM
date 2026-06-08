import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function cleanPhone(phone: string): string {
  if (!phone) return ''
  let p = phone.replace(/[^0-9]/g, '')
  if (p.startsWith('972') && p.length > 9) p = '0' + p.slice(3)
  if (!p.startsWith('0') && p.length === 9) p = '0' + p
  return p
}

export async function POST(req: Request) {
  try {
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
    const body = await req.json()

    const event = body.event
    const callId = body.id || ''
    const callerPhone = cleanPhone(body.callerid || '')
    const extension = body.user || ''

    // Save completed calls (incoming/outgoing with Ok or Missed)
    if (event === 'incoming' || event === 'outgoing') {
      const files = body.FILES || []
      const recordingUrl = files.length > 0 ? files[0] : null

      await supabase.from('call_recordings').upsert({
        call_id: callId,
        caller_phone: callerPhone,
        extension,
        direction: event === 'incoming' ? 'נכנסת' : 'יוצאת',
        finish_type: body.finishtype || '',
        title: body.title || '',
        recording_url: recordingUrl,
        created_at: new Date().toISOString()
      }, { onConflict: 'call_id' })
    }

    // Save AI transcription and summary
    if (event === 'ai') {
      await supabase.from('call_recordings').upsert({
        call_id: callId,
        transcription: body.transcription || '',
        summary: body.summary || '',
        sentiment_score: body.sentiment_score || ''
      }, { onConflict: 'call_id' })
    }

    return NextResponse.json({ success: true })
  } catch (e: any) {
    console.error('3CX webhook error:', e.message)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// GET for health check
export async function GET() {
  return NextResponse.json({ status: 'ok', service: '3cx-webhook' })
}

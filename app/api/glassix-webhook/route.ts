import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: Request) {
  let rawBody = ''
  try {
    rawBody = await request.text()
    const body = JSON.parse(rawBody)

    // Save raw webhook to debug table
    await supabase.from('webhook_log').upsert({
      id: Date.now().toString(),
      received_at: new Date().toISOString(),
      body: rawBody.slice(0, 5000)
    }, { onConflict: 'id' })

    const changes = body.changes || body.events || (Array.isArray(body) ? body : [body])

    for (const change of changes) {
      const event = change._event || change.event || change.type || ''

      if (event === 'NEW_MESSAGE') {
        const tx = change.transaction || change.message || change.newMessage
        const ticket = change.ticket || change.ticketData
        if (!tx || !ticket) continue

        await supabase.from('glassix_messages').upsert({
          message_id: String(tx.id || Date.now()),
          ticket_id: String(ticket.id),
          text: tx.text || tx.body || '',
          sender_name: tx.senderName || tx.userName || '',
          sender_type: tx.senderType || 'Unknown',
          created_at: tx.time || tx.createTime || new Date().toISOString(),
          ticket_data: JSON.stringify(ticket)
        }, { onConflict: 'message_id' })
      }

      if (event === 'NEW_TICKET') {
        const ticket = change.ticket || change.ticketData
        if (!ticket) continue
        await supabase.from('glassix_cache')
          .delete()
          .eq('cache_key', `glassix_tickets_${process.env.GLASSIX_WORKSPACE || 'm4l-il'}`)
      }
    }

    return NextResponse.json({ success: true })
  } catch (e: any) {
    // Save error to debug table too
    await supabase.from('webhook_log').upsert({
      id: Date.now().toString(),
      received_at: new Date().toISOString(),
      body: `ERROR: ${e.message} | RAW: ${rawBody.slice(0, 1000)}`
    }, { onConflict: 'id' }).catch(() => {})
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({ status: 'ok' })
}

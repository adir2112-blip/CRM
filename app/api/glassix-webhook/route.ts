import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: Request) {
  try {
    const body = await request.json()
    
    // Log full body to see exact format
    console.log('WEBHOOK BODY:', JSON.stringify(body).slice(0, 2000))

    // Glassix sends either body.changes[] or direct event fields
    const changes = body.changes || body.events || (Array.isArray(body) ? body : [body])

    for (const change of changes) {
      const event = change._event || change.event || change.type || ''
      console.log('EVENT:', event, 'keys:', Object.keys(change))

      if (event === 'NEW_MESSAGE') {
        // transaction can be under different keys
        const tx = change.transaction || change.message || change.newMessage
        const ticket = change.ticket || change.ticketData
        if (!tx || !ticket) {
          console.log('Missing tx or ticket, change keys:', Object.keys(change))
          continue
        }
        await supabase.from('glassix_messages').upsert({
          message_id: String(tx.id || Date.now()),
          ticket_id: String(ticket.id),
          text: tx.text || tx.body || '',
          sender_name: tx.senderName || tx.userName || '',
          sender_type: tx.senderType || 'Unknown',
          created_at: tx.time || tx.createTime || new Date().toISOString(),
          ticket_data: JSON.stringify(ticket)
        }, { onConflict: 'message_id' })
        console.log('Saved message for ticket:', ticket.id)
      }

      if (event === 'NEW_TICKET') {
        const ticket = change.ticket || change.ticketData
        if (!ticket) continue
        await supabase.from('glassix_cache')
          .delete()
          .eq('cache_key', `glassix_tickets_${process.env.GLASSIX_WORKSPACE || 'm4l-il'}`)
        console.log('Cache cleared for new ticket:', ticket.id)
      }
    }

    return NextResponse.json({ success: true })
  } catch (e: any) {
    console.error('Webhook error:', e.message)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({ status: 'ok' })
}

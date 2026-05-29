import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const changes = body.changes || []

    for (const change of changes) {
      const event = change._event

      if (event === 'NEW_MESSAGE') {
        const tx = change.transaction
        const ticket = change.ticket
        if (!tx || !ticket) continue

        // Save message to Supabase
        await supabase.from('glassix_messages').upsert({
          message_id: String(tx.id),
          ticket_id: String(ticket.id),
          text: tx.text || '',
          sender_name: tx.senderName || tx.userName || '',
          sender_type: tx.senderType || 'Unknown',
          created_at: tx.time || tx.createTime || new Date().toISOString(),
          ticket_data: JSON.stringify(ticket)
        }, { onConflict: 'message_id' })
      }

      if (event === 'NEW_TICKET') {
        const ticket = change.ticket
        if (!ticket) continue

        // Invalidate cache so next request fetches fresh
        await supabase.from('glassix_cache')
          .delete()
          .eq('cache_key', `glassix_tickets_${process.env.GLASSIX_WORKSPACE || 'm4l-il'}`)
      }
    }

    return NextResponse.json({ success: true })
  } catch (e: any) {
    console.error('Webhook error:', e.message)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// Glassix sends GET to verify webhook
export async function GET() {
  return NextResponse.json({ status: 'ok' })
}

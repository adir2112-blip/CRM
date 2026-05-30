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
      const event = change._event || ''

      if (event === 'NEW_MESSAGE') {
        const tx = change.transaction
        const ticketId = change.ticketId
        if (!tx || !ticketId) continue

        const participant = tx.fromParticipant || {}
        const isClient = participant.type === 'Client'

        await supabase.from('glassix_messages').upsert({
          message_id: String(tx.id),
          ticket_id: String(ticketId),
          text: tx.text || '',
          sender_name: participant.name || '',
          sender_type: isClient ? 'Client' : 'Agent',
          created_at: tx.dateTime || new Date().toISOString(),
          ticket_data: JSON.stringify({ ticketId, participant })
        }, { onConflict: 'message_id' })
      }

      if (event === 'NEW_TICKET') {
        // Invalidate cache
        await supabase.from('glassix_cache')
          .delete()
          .eq('cache_key', `glassix_tickets_${process.env.GLASSIX_WORKSPACE || 'm4l-il'}`)
      }
    }

    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({ status: 'ok' })
}

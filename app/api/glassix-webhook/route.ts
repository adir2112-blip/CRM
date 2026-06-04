import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'


const BASE_URL = `https://${process.env.GLASSIX_WORKSPACE || 'm4l-il'}.glassix.com`

async function getGlassixToken(): Promise<string | null> {
  try {
    const res = await fetch(`${BASE_URL}/api/v1.2/token/get`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        apiKey: process.env.GLASSIX_API_KEY,
        apiSecret: process.env.GLASSIX_API_SECRET,
        userName: process.env.GLASSIX_USERNAME,
        workspace: process.env.GLASSIX_WORKSPACE || 'm4l-il'
      })
    })
    const data = await res.json()
    return data.token || null
  } catch { return null }
}

async function getTicketParticipants(ticketId: string, token: string): Promise<string | null> {
  try {
    const res = await fetch(`${BASE_URL}/api/v1.2/tickets/${ticketId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    if (!res.ok) return null
    const data = await res.json()
    const participants = data.participants || []
    const client = participants.find((p: any) => p.type === 'Client')
    if (client?.identifier) {
      return client.identifier.replace(/\D/g, '').replace(/^972/, '0')
    }
    return null
  } catch { return null }
}

export async function POST(request: Request) {
  try {
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
    const body = await request.json()
    const changes = body.changes || []
    let token: string | null = null

    for (const change of changes) {
      const event = change._event || ''

      if (event === 'NEW_MESSAGE') {
        const tx = change.transaction
        const ticketId = change.ticketId
        if (!tx || !ticketId) continue

        const participant = tx.fromParticipant || {}
        const isClient = participant.type === 'Client'
        const department = participant.departmentIdentifier || ''
        const channel = tx.fromProtocolType || 'WhatsApp'

        let clientPhone: string | null = null
        if (!isClient) {
          if (!token) token = await getGlassixToken()
          if (token) clientPhone = await getTicketParticipants(String(ticketId), token)
        } else {
          clientPhone = (participant.identifier || '').replace(/\D/g, '').replace(/^972/, '0')
        }

        await supabase.from('glassix_messages').upsert({
          message_id: String(tx.id),
          ticket_id: String(ticketId),
          text: tx.text || '',
          sender_name: participant.name || '',
          sender_type: isClient ? 'Client' : 'Agent',
          client_phone: clientPhone,
          department,
          channel,
          created_at: tx.dateTime || new Date().toISOString(),
          ticket_data: JSON.stringify({ ticketId, participant, clientPhone })
        }, { onConflict: 'message_id' })
      }

      if (event === 'TICKET_STATE_CHANGE') {
        const ticketId = change.ticketId
        const newState = change.state || change.newState || ''
        if (ticketId && newState) {
          // Update status in dedicated table (source of truth)
          await supabase.from('glassix_ticket_status').upsert({
            ticket_id: String(ticketId),
            status: newState,
            updated_at: new Date().toISOString()
          }, { onConflict: 'ticket_id' })
          // Also update messages for backwards compatibility
          await supabase.from('glassix_messages')
            .update({ ticket_status: newState })
            .eq('ticket_id', String(ticketId))
        }
      }

      if (event === 'NEW_TICKET') {
        const ticketId = change.ticketId
        if (ticketId) {
          // Mark new ticket as Open
          await supabase.from('glassix_ticket_status').upsert({
            ticket_id: String(ticketId),
            status: 'Open',
            updated_at: new Date().toISOString()
          }, { onConflict: 'ticket_id' })
        }
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

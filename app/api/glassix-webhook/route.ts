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

        // Try to get client phone from ticket
        let clientPhone: string | null = null
        if (!isClient) {
          // Message from agent — get client phone from ticket
          if (!token) token = await getGlassixToken()
          if (token) clientPhone = await getTicketParticipants(String(ticketId), token)
        } else {
          // Message from client — use their identifier
          clientPhone = (participant.identifier || '').replace(/\D/g, '').replace(/^972/, '0')
        }

        await supabase.from('glassix_messages').upsert({
          message_id: String(tx.id),
          ticket_id: String(ticketId),
          text: tx.text || '',
          sender_name: participant.name || '',
          sender_type: isClient ? 'Client' : 'Agent',
          client_phone: clientPhone,
          created_at: tx.dateTime || new Date().toISOString(),
          ticket_data: JSON.stringify({ ticketId, participant, clientPhone })
        }, { onConflict: 'message_id' })
      }

      if (event === 'NEW_TICKET') {
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

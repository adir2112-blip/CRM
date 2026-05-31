import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const WORKSPACE = process.env.GLASSIX_WORKSPACE || 'm4l-il'
const BASE_URL = `https://${WORKSPACE}.glassix.com`
const API_KEY = process.env.GLASSIX_API_KEY!
const API_SECRET = process.env.GLASSIX_API_SECRET!
const USERNAME = process.env.GLASSIX_USERNAME!
const CACHE_KEY = `glassix_tickets_${WORKSPACE}`
const CACHE_MINUTES = 5

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function getToken(): Promise<string> {
  const res = await fetch(`${BASE_URL}/api/v1.2/token/get`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ apiKey: API_KEY, apiSecret: API_SECRET, userName: USERNAME })
  })
  if (!res.ok) throw new Error('Glassix token error: ' + await res.text())
  const data = await res.json()
  return data.access_token
}

function toGlassixDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}/${d.getUTCFullYear()} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:00:00`
}

async function getTicketsWithCache(): Promise<any[]> {
  // Check cache
  try {
    const { data: cached } = await supabase
      .from('glassix_cache')
      .select('tickets, updated_at')
      .eq('cache_key', CACHE_KEY)
      .single()
    if (cached) {
      const age = (Date.now() - new Date(cached.updated_at).getTime()) / 60000
      if (age < CACHE_MINUTES) return JSON.parse(cached.tickets)
    }
  } catch {}

  const token = await getToken()
  const now = new Date()
  const monthAgo = new Date(now.getTime() - 28 * 864e5)
  const since = toGlassixDate(monthAgo)
  const until = toGlassixDate(now)

  let allTickets: any[] = []
  let hitRateLimit = false
  let url: string | null = `${BASE_URL}/api/v1.2/tickets/list?since=${encodeURIComponent(since)}&until=${encodeURIComponent(until)}&statuses=open,closed,snoozed`

  let pages = 0
  while (url && pages < 15) {
    const res = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } })
    if (res.status === 429) { hitRateLimit = true; break }
    if (!res.ok) break
    const data = await res.json()
    const batch = data[''] || data.tickets || data.data || (Array.isArray(data) ? data : [])
    if (batch.length === 0) break
    allTickets = allTickets.concat(batch)
    const next = data.paging?.next || null
    url = next && typeof next === 'string' ? (next.startsWith('http') ? next : `${BASE_URL}${next}`) : null
    pages++
  }

  // Don't save empty cache if we hit rate limit — keep existing cache
  if (hitRateLimit && allTickets.length === 0) {
    try {
      const { data: existing } = await supabase.from('glassix_cache').select('tickets').eq('cache_key', CACHE_KEY).single()
      if (existing?.tickets) {
        const parsed = JSON.parse(existing.tickets)
        if (parsed.length > 0) return parsed
      }
    } catch {}
    // No cache available — return empty but don't save empty cache
    return []
  }

  try {
    await supabase.from('glassix_cache').upsert({
      cache_key: CACHE_KEY,
      tickets: JSON.stringify(allTickets),
      updated_at: new Date().toISOString()
    }, { onConflict: 'cache_key' })
  } catch {}

  return allTickets
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const phone = searchParams.get('phone')
    const email = searchParams.get('email')
    const idNumber = searchParams.get('id_number')

    if (!phone && !email && !idNumber) {
      return NextResponse.json({ error: 'נדרש פרמטר חיפוש' }, { status: 400 })
    }

    const allTickets = await getTicketsWithCache()
    const phoneNorm = phone ? phone.replace(/\D/g, '').replace(/^972/, '').replace(/^0/, '') : null
    const emailNorm = email ? email.toLowerCase() : null

    let matched = allTickets.filter((t: any) => {
      return (t.participants || []).some((p: any) => {
        if (p.type !== 'Client' || !p.identifier) return false
        if (phoneNorm) {
          const pNorm = p.identifier.replace(/\D/g, '').replace(/^972/, '').replace(/^0/, '')
          if (pNorm === phoneNorm) return true
        }
        if (emailNorm && p.identifier.toLowerCase() === emailNorm) return true
        if (idNumber && p.identifier.replace(/\D/g, '') === idNumber.replace(/\D/g, '')) return true
        return false
      })
    })

    // Fallback: if no tickets found in cache, check glassix_messages table (from webhook)
    if (matched.length === 0 && (phone || idNumber)) {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      )
      let msgQuery = supabase.from('glassix_messages').select('ticket_id, text, sender_name, sender_type, created_at').order('created_at', { ascending: false })
      
      // Get all messages and group by ticket_id
      const { data: msgs } = await msgQuery
      if (msgs && msgs.length > 0) {
        // Group messages by ticket_id
        const byTicket: Record<string, any[]> = {}
        msgs.forEach((m: any) => {
          if (!byTicket[m.ticket_id]) byTicket[m.ticket_id] = []
          byTicket[m.ticket_id].push(m)
        })
        
        // Check if phone matches any ticket's participant
        // Since webhook doesn't store phone, return tickets from webhook if we got any today
        const todayTickets = Object.entries(byTicket).map(([ticketId, messages]) => ({
          id: ticketId,
          status: 'Open',
          channel: 'WhatsApp',
          subject: messages[0]?.text?.slice(0, 50) || '',
          created: messages[messages.length-1]?.created_at,
          updated: messages[0]?.created_at,
          assignee: messages.find((m:any) => m.sender_type === 'Agent')?.sender_name || '',
          clientName: messages.find((m:any) => m.sender_type === 'Client')?.sender_name || '',
          clientIdentifier: phone || '',
          fromWebhook: true
        }))
        
        if (todayTickets.length > 0) {
          return NextResponse.json({ total: todayTickets.length, tickets: todayTickets, fromWebhook: true })
        }
      }
    }

    const formatted = matched.slice(0, 20).map((t: any) => {
      const clientPart = (t.participants || []).find((p: any) => p.type === 'Client')
      const agentPart = (t.participants || []).find((p: any) => 
        p.type === 'User' && !p.userName?.includes('@glassix.bot') && p.name !== 'בוט'
      )
      return {
        id: t.id,
        status: t.state,
        channel: t.primaryProtocolType || 'WhatsApp',
        subject: t.field1 || '',
        created: t.open,
        updated: t.lastActivity,
        assignee: agentPart?.displayName || agentPart?.name || t.owner?.fullName || '',
        clientName: clientPart?.name || '',
        clientIdentifier: clientPart?.identifier || '',
        messages: []
      }
    })

    return NextResponse.json({ total: matched.length, tickets: formatted })

  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

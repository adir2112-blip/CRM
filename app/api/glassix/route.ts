import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const BASE_URL = `https://${process.env.GLASSIX_WORKSPACE || 'm4l-il'}.glassix.com`
const CACHE_KEY = `glassix_tickets_${process.env.GLASSIX_WORKSPACE || 'm4l-il'}`
const CACHE_TTL = 5 * 60 * 1000

function toGlassixDate(d: Date): string {
  return d.toISOString().replace('T', ' ').replace('Z', '').split('.')[0]
}

async function getToken(): Promise<string | null> {
  try {
    const res = await fetch(`${BASE_URL}/api/v1.2/token/get`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey: process.env.GLASSIX_API_KEY, apiSecret: process.env.GLASSIX_API_SECRET, userName: process.env.GLASSIX_USERNAME, workspace: process.env.GLASSIX_WORKSPACE || 'm4l-il' })
    })
    const data = await res.json()
    return data.token || null
  } catch { return null }
}

async function getTicketsWithCache(): Promise<any[]> {
  // Check cache
  try {
    const { data: cached } = await supabase.from('glassix_cache').select('tickets, updated_at').eq('cache_key', CACHE_KEY).single()
    if (cached?.tickets && cached?.updated_at) {
      const age = Date.now() - new Date(cached.updated_at).getTime()
      if (age < CACHE_TTL) {
        const parsed = JSON.parse(cached.tickets)
        if (parsed.length > 0) return parsed
      }
    }
  } catch {}

  const token = await getToken()
  if (!token) return []

  const now = new Date()
  const monthAgo = new Date(now.getTime() - 28 * 864e5)
  let allTickets: any[] = []
  let hitRateLimit = false
  let url: string | null = `${BASE_URL}/api/v1.2/tickets/list?since=${encodeURIComponent(toGlassixDate(monthAgo))}&until=${encodeURIComponent(toGlassixDate(now))}&statuses=open,closed,snoozed`

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

  if (hitRateLimit && allTickets.length === 0) {
    try {
      const { data: existing } = await supabase.from('glassix_cache').select('tickets').eq('cache_key', CACHE_KEY).single()
      if (existing?.tickets) { const p = JSON.parse(existing.tickets); if (p.length > 0) return p }
    } catch {}
    return []
  }

  if (allTickets.length > 0) {
    try {
      await supabase.from('glassix_cache').upsert({ cache_key: CACHE_KEY, tickets: JSON.stringify(allTickets), updated_at: new Date().toISOString() }, { onConflict: 'cache_key' })
    } catch {}
  }

  return allTickets
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const phone = searchParams.get('phone')
    const email = searchParams.get('email')
    const idNumber = searchParams.get('id_number')

    if (!phone && !email && !idNumber) return NextResponse.json({ error: 'נדרש פרמטר חיפוש' }, { status: 400 })

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

    // Fallback: search glassix_messages DB by phone
    if (matched.length === 0 && phone) {
      const phoneClean = phone.replace(/\D/g,'').replace(/^972/,'').replace(/^0/,'')
      
      // Direct search in ticket_data using SQL LIKE
      const { data: allMsgs } = await supabase
        .from('glassix_messages')
        .select('ticket_id, sender_name, sender_type, text, created_at, client_phone, ticket_data')
        .or(`client_phone.eq.${phone},ticket_data.like.%${phoneClean}%`)
        .order('created_at', { ascending: false })
        .limit(500)

      const matchedMsgs = (allMsgs || []).filter((m: any) => {
        // Check client_phone field
        if (m.client_phone) {
          const cp = m.client_phone.replace(/\D/g,'').replace(/^972/,'').replace(/^0/,'')
          if (cp === phoneClean) return true
        }
        // Check participant.identifier in ticket_data (WhatsApp phone = 972XXXXXXXXX)
        try {
          const td = JSON.parse(m.ticket_data || '{}')
          const identifier = td.participant?.identifier || ''
          const idNorm = identifier.replace(/\D/g,'').replace(/^972/,'').replace(/^0/,'')
          if (idNorm && idNorm === phoneClean) return true
        } catch {}
        return false
      })

      if (matchedMsgs.length > 0) {
        const ticketIds = Array.from(new Set(matchedMsgs.map((m: any) => m.ticket_id)))
        const tickets = ticketIds.map(tid => {
          const tMsgs = matchedMsgs.filter((m: any) => m.ticket_id === tid)
            .sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
          const agentMsg = tMsgs.find((m: any) => m.sender_type === 'Agent')
          const clientMsg = tMsgs.find((m: any) => m.sender_type === 'Client')
          return {
            id: tid, status: 'Open', channel: 'WhatsApp',
            subject: tMsgs[tMsgs.length-1]?.text?.slice(0,60) || '',
            created: tMsgs[0]?.created_at,
            updated: tMsgs[tMsgs.length-1]?.created_at,
            assignee: agentMsg?.sender_name || '',
            clientName: clientMsg?.sender_name || '',
            clientIdentifier: phone, fromDB: true
          }
        })
        return NextResponse.json({ total: tickets.length, tickets })
      }
    }

    if (matched.length === 0) return NextResponse.json({ total: 0, tickets: [] })

    const formatted = matched.slice(0, 20).map((t: any) => {
      const clientPart = (t.participants || []).find((p: any) => p.type === 'Client')
      const agentPart = (t.participants || []).find((p: any) => p.type === 'User' && !p.userName?.includes('@glassix.bot') && p.name !== 'בוט')
      return {
        id: t.id, status: t.state, channel: t.primaryProtocolType || 'WhatsApp',
        subject: t.field1 || '', created: t.open, updated: t.lastActivity,
        assignee: agentPart?.displayName || agentPart?.name || t.owner?.fullName || '',
        clientName: clientPart?.name || '', clientIdentifier: clientPart?.identifier || '', messages: []
      }
    })

    return NextResponse.json({ total: matched.length, tickets: formatted })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

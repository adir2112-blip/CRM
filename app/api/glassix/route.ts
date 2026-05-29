import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const WORKSPACE = process.env.GLASSIX_WORKSPACE || 'm4l-il'
const BASE_URL = `https://${WORKSPACE}.glassix.com`
const API_KEY = process.env.GLASSIX_API_KEY!
const API_SECRET = process.env.GLASSIX_API_SECRET!
const USERNAME = process.env.GLASSIX_USERNAME!

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const CACHE_KEY = `glassix_tickets_${WORKSPACE}`
const CACHE_MINUTES = 5

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
  // Check Supabase cache
  const { data: cached } = await supabase
    .from('glassix_cache')
    .select('tickets, updated_at')
    .eq('cache_key', CACHE_KEY)
    .single()

  if (cached) {
    const age = (Date.now() - new Date(cached.updated_at).getTime()) / 1000 / 60
    if (age < CACHE_MINUTES) {
      return JSON.parse(cached.tickets)
    }
  }

  // Fetch fresh from Glassix
  const token = await getToken()
  const now = new Date()
  // Use Israel timezone — subtract 3 hours to get Israel midnight
  const israelNow = new Date(now.getTime() + 3 * 60 * 60 * 1000)
  // Start of current month in Israel time
  const israelStartOfMonth = new Date(Date.UTC(israelNow.getUTCFullYear(), israelNow.getUTCMonth(), 1, 0, 0, 0))
  // Convert back to UTC for API
  const startUTC = new Date(israelStartOfMonth.getTime() - 3 * 60 * 60 * 1000)
  const since = toGlassixDate(startUTC)
  const until = toGlassixDate(now)

  let allTickets: any[] = []
  let currentUrl: string | null = `${BASE_URL}/api/v1.2/tickets/list?since=${encodeURIComponent(since)}&until=${encodeURIComponent(until)}&statuses=open,closed,snoozed`

  while (currentUrl) {
    const res = await fetch(currentUrl, { headers: { 'Authorization': `Bearer ${token}` } })
    if (res.status === 429) break
    if (!res.ok) throw new Error(`Glassix list ${res.status}: ${await res.text()}`)
    const data = await res.json()
    const tickets = data[''] || data.tickets || data.data || (Array.isArray(data) ? data : [])
    allTickets = allTickets.concat(tickets)
    
    // Debug pagination
    console.log(`Glassix page: ${tickets.length} tickets, total so far: ${allTickets.length}, paging:`, JSON.stringify(data.paging))
    
    const next = data.paging?.next || data.paging?.nextPageToken || null
    if (next && typeof next === 'string') {
      currentUrl = next.startsWith('http') ? next : `${BASE_URL}${next.startsWith('/') ? '' : '/api/v1.2/'}${next}`
    } else {
      currentUrl = null
    }
    if (allTickets.length >= 1000) break
  }

  // Save to Supabase cache
  await supabase.from('glassix_cache').upsert({
    cache_key: CACHE_KEY,
    tickets: JSON.stringify(allTickets),
    updated_at: new Date().toISOString()
  }, { onConflict: 'cache_key' })

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

    const matched = allTickets.filter((t: any) => {
      return (t.participants || []).some((p: any) => {
        if (p.type !== 'Client' || !p.identifier) return false
        if (phoneNorm) {
          const pNorm = p.identifier.replace(/\D/g, '').replace(/^972/, '').replace(/^0/, '')
          if (pNorm === phoneNorm) return true
        }
        if (emailNorm && p.identifier.toLowerCase() === emailNorm) return true
        if (idNumber) {
          const idNorm = idNumber.replace(/\D/g, '')
          if (p.identifier.replace(/\D/g, '') === idNorm) return true
        }
        return false
      })
    })

    const formatted = matched.slice(0, 20).map((t: any) => {
      const clientPart = (t.participants || []).find((p: any) => p.type === 'Client')
      return {
        id: t.id,
        status: t.state,
        channel: t.primaryProtocolType || 'WhatsApp',
        subject: t.field1 || '',
        created: t.open,
        updated: t.lastActivity,
        assignee: t.owner?.fullName || t.owner?.UserName || '',
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

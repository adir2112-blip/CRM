import { NextResponse } from 'next/server'

const WORKSPACE = process.env.GLASSIX_WORKSPACE || 'm4l-il'
const BASE_URL = `https://${WORKSPACE}.glassix.com`
const API_KEY = process.env.GLASSIX_API_KEY!
const API_SECRET = process.env.GLASSIX_API_SECRET!
const USERNAME = process.env.GLASSIX_USERNAME!

let tokenCache: { token: string; expires: number } | null = null

async function getToken(): Promise<string> {
  if (tokenCache && Date.now() < tokenCache.expires - 300000) return tokenCache.token
  const res = await fetch(`${BASE_URL}/api/v1.2/token/get`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ apiKey: API_KEY, apiSecret: API_SECRET, userName: USERNAME })
  })
  if (!res.ok) throw new Error('Glassix token error: ' + await res.text())
  const data = await res.json()
  tokenCache = { token: data.access_token, expires: Date.now() + (data.expires_in || 10800) * 1000 }
  return tokenCache.token
}

function toGlassixDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}/${d.getUTCFullYear()} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:00:00`
}

function normalizePhone(phone: string): string {
  // Strip everything, remove leading 972 or 0 -> get local digits e.g. 504411096
  return phone.replace(/\D/g, '').replace(/^972/, '').replace(/^0/, '')
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

    const token = await getToken()

    const phoneNorm = phone ? normalizePhone(phone) : null
    const emailNorm = email ? email.toLowerCase() : null

    // Date range — current month in UTC
    const now = new Date()
    const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0))
    const since = toGlassixDate(startOfMonth)
    const until = toGlassixDate(now)

    // Fetch all tickets for the month (participants ARE included per Glassix docs)
    let allTickets: any[] = []
    let nextUrl: string | null = `${BASE_URL}/api/v1.2/tickets/list?since=${encodeURIComponent(since)}&until=${encodeURIComponent(until)}`

    while (nextUrl) {
      const res = await fetch(nextUrl, { headers: { 'Authorization': `Bearer ${token}` } })
      if (!res.ok) throw new Error(`Glassix list ${res.status}: ${await res.text()}`)
      const data = await res.json()
      // Glassix returns tickets under empty string key ""
      const tickets = data[''] || data.tickets || data.data || (Array.isArray(data) ? data : [])
      allTickets = allTickets.concat(tickets)
      nextUrl = data.paging?.next || null
      if (allTickets.length > 1000) break
    }

    // Filter by participant identifier using normalized phone
    const matched = allTickets.filter((t: any) => {
      const parts: any[] = t.participants || []
      return parts.some((p: any) => {
        if (p.type !== 'Client') return false
        if (!p.identifier) return false
        // Compare normalized phones
        if (phoneNorm) {
          const pNorm = normalizePhone(p.identifier)
          if (pNorm === phoneNorm) return true
        }
        if (emailNorm && p.identifier.toLowerCase() === emailNorm) return true
        if (idNumber && p.identifier === idNumber) return true
        return false
      })
    })

    // Format results — no extra API calls needed (no messages from list, that's ok)
    const formatted = matched.slice(0, 20).map((t: any) => {
      const clientPart = (t.participants || []).find((p: any) => p.type === 'Client')
      return {
        id: t.id,
        status: t.state,
        channel: t.primaryProtocolType || 'WhatsApp',
        subject: t.field1 || t.subject || '',
        created: t.open,
        updated: t.lastActivity,
        assignee: t.owner?.fullName || t.owner?.UserName || '',
        clientName: clientPart?.name || '',
        clientIdentifier: clientPart?.identifier || '',
        messages: [] // messages require separate call — skipped to avoid rate limit
      }
    })

    return NextResponse.json({ total: matched.length, tickets: formatted })

  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

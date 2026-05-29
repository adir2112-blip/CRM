import { NextResponse } from 'next/server'

const WORKSPACE = process.env.GLASSIX_WORKSPACE || 'm4l-il'
const BASE_URL = `https://${WORKSPACE}.glassix.com`
const API_KEY = process.env.GLASSIX_API_KEY!
const API_SECRET = process.env.GLASSIX_API_SECRET!
const USERNAME = process.env.GLASSIX_USERNAME!

// Token cache
let tokenCache: { token: string; expires: number } | null = null

// Ticket list cache — 5 minutes
let listCache: { tickets: any[]; expires: number } | null = null

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
  return phone.replace(/\D/g, '').replace(/^972/, '').replace(/^0/, '')
}

async function getTicketList(token: string): Promise<any[]> {
  // Return cached if valid
  if (listCache && Date.now() < listCache.expires) return listCache.tickets

  const now = new Date()
  const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
  const since = toGlassixDate(startOfMonth)
  const until = toGlassixDate(now)

  const url = `${BASE_URL}/api/v1.2/tickets/list?since=${encodeURIComponent(since)}&until=${encodeURIComponent(until)}`
  const res = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } })

  if (res.status === 429) {
    // Return cached even if expired — better than error
    if (listCache) return listCache.tickets
    throw new Error('Rate limit — נסה שוב בעוד דקה')
  }

  if (!res.ok) throw new Error(`Glassix list ${res.status}: ${await res.text()}`)

  const data = await res.json()
  // Glassix returns tickets under empty string key ""
  const tickets = data[''] || data.tickets || data.data || (Array.isArray(data) ? data : [])

  // Cache for 5 minutes
  listCache = { tickets, expires: Date.now() + 5 * 60 * 1000 }
  return tickets
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
    const allTickets = await getTicketList(token)

    const phoneNorm = phone ? normalizePhone(phone) : null
    const emailNorm = email ? email.toLowerCase() : null

    const matched = allTickets.filter((t: any) => {
      const parts: any[] = t.participants || []
      return parts.some((p: any) => {
        if (p.type !== 'Client' || !p.identifier) return false
        if (phoneNorm) {
          const pNorm = normalizePhone(p.identifier)
          if (pNorm === phoneNorm) return true
        }
        if (emailNorm && p.identifier.toLowerCase() === emailNorm) return true
        if (idNumber && normalizePhone(p.identifier) === normalizePhone(idNumber)) return true
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

    return NextResponse.json({ 
      total: matched.length, 
      tickets: formatted,
      debug: {
        totalInMonth: allTickets.length,
        searchPhone: phoneNorm,
        searchEmail: emailNorm,
        searchId: idNumber,
        sampleParticipants: allTickets.slice(0, 5).map((t: any) => ({
          ticketId: t.id,
          participants: (t.participants || []).map((p: any) => ({
            type: p.type,
            identifier: p.identifier,
            normalized: normalizePhone(p.identifier || '')
          }))
        }))
      }
    })

  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

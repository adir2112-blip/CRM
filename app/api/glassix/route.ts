import { NextResponse } from 'next/server'

const WORKSPACE = process.env.GLASSIX_WORKSPACE || 'm4l-il'
const BASE_URL = `https://${WORKSPACE}.glassix.com`
const API_KEY = process.env.GLASSIX_API_KEY!
const API_SECRET = process.env.GLASSIX_API_SECRET!
const USERNAME = process.env.GLASSIX_USERNAME!

let tokenCache: { token: string; expires: number } | null = null

async function getToken(): Promise<string> {
  if (tokenCache && Date.now() < tokenCache.expires - 300000) {
    return tokenCache.token
  }
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

function toGlassixDate(d: Date, endOfDay = false): string {
  const day = String(d.getDate()).padStart(2, '0')
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const year = d.getFullYear()
  const h = endOfDay ? '00' : String(d.getHours()).padStart(2, '0')
  const m = endOfDay ? '00' : String(d.getMinutes()).padStart(2, '0')
  return `${day}/${month}/${year} ${h}:${m}:00:00`
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const phone = searchParams.get('phone')
    const email = searchParams.get('email')
    const idNumber = searchParams.get('id_number')

    if (!phone && !email && !idNumber) {
      return NextResponse.json({ error: 'נדרש טלפון, מייל או ת״ז' }, { status: 400 })
    }

    const token = await getToken()

    // Build identifiers to search for
    const identifiers: string[] = []
    if (phone) {
      const digits = phone.replace(/\D/g, '')
      const intl = digits.startsWith('0') ? '972' + digits.slice(1) : digits.startsWith('972') ? digits : '972' + digits
      identifiers.push(intl)           // 972504411096
      identifiers.push('+' + intl)     // +972504411096
      identifiers.push('+972 ' + digits.slice(1, 3) + ' ' + digits.slice(3, 6) + ' ' + digits.slice(6)) // +972 50 441 1096
      identifiers.push(digits)
    }
    if (email) identifiers.push(email.toLowerCase())
    if (idNumber) identifiers.push(idNumber)

    // Date range — max 1 calendar month
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const since = toGlassixDate(startOfMonth, true)
    const until = toGlassixDate(now) // current time — never in the future

    // Fetch tickets list
    let allTickets: any[] = []
    let nextUrl: string | null = `${BASE_URL}/api/v1.2/tickets/list?since=${encodeURIComponent(since)}&until=${encodeURIComponent(until)}`

    while (nextUrl) {
      const res = await fetch(nextUrl, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (!res.ok) {
        const err = await res.text()
        throw new Error(`Glassix list ${res.status}: ${err}`)
      }
      const data = await res.json()
      const tickets = Array.isArray(data) ? data : (data.tickets || data.data || [])
      allTickets = allTickets.concat(tickets)
      // Handle pagination
      nextUrl = data.paging?.next || null
      if (allTickets.length > 500) break // safety
    }

    // Filter by participant identifier
    const matched = allTickets.filter((t: any) => {
      const parts = t.participants || []
      return parts.some((p: any) => {
        if (!p.identifier) return false
        // Normalize both to digits only, remove leading + and 972
        const pDigits = p.identifier.replace(/\D/g, '').replace(/^972/, '')
        return identifiers.some(id => {
          const iDigits = id.replace(/\D/g, '').replace(/^972/, '')
          return pDigits === iDigits || 
            p.identifier === id ||
            p.identifier.toLowerCase() === id.toLowerCase()
        })
      })
    })

    // Format for display (no messages in list — fetch separately for top 5)
    const formatted = await Promise.all(matched.slice(0, 10).map(async (t: any) => {
      // Get ticket details with transactions
      let messages: any[] = []
      try {
        const detailRes = await fetch(`${BASE_URL}/api/v1.2/tickets/${t.id}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
        if (detailRes.ok) {
          const detail = await detailRes.json()
          messages = (detail.transactions || [])
            .filter((tx: any) => tx.type === 'Message' || tx.type === 'Note')
            .slice(-5)
            .map((tx: any) => ({
              id: tx.id,
              text: tx.text || tx.content || '',
              sender: tx.senderName || tx.userName || '',
              time: tx.time || tx.createTime,
              type: tx.senderType === 'Client' ? 'Client' : 'Agent'
            }))
        }
      } catch {}

      return {
        id: t.id,
        status: t.status,
        channel: t.protocolType || t.channelType || 'WhatsApp',
        subject: t.subject || '',
        created: t.open || t.createTime,
        updated: t.lastActivity || t.updateTime,
        assignee: t.ownerName || t.assignee?.name || '',
        participants: (t.participants || [])
          .filter((p: any) => p.type === 'Client')
          .map((p: any) => ({ name: p.name, identifier: p.identifier })),
        messages
      }
    }))

    return NextResponse.json({ total: matched.length, tickets: formatted })

  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

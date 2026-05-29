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

  if (!res.ok) {
    const err = await res.text()
    throw new Error('Glassix token error: ' + err)
  }

  const data = await res.json()
  tokenCache = { token: data.access_token, expires: Date.now() + (data.expires_in || 10800) * 1000 }
  return tokenCache.token
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

    // Search by identifier — try all provided
    const identifiers: string[] = []
    if (phone) {
      const digits = phone.replace(/\D/g, '')
      // Convert Israeli format: 05X -> 9725X
      const international = digits.startsWith('0') ? '972' + digits.slice(1) : digits.startsWith('972') ? digits : '972' + digits
      identifiers.push(international)
      identifiers.push(digits) // also try original
    }
    if (email) identifiers.push(email)
    if (idNumber) identifiers.push(idNumber)

    // Fetch recent tickets list first
    const now = new Date()
    const sixMonthsAgo = new Date(now.getTime() - 180 * 864e5)
    
    function toGlassixDate(d: Date): string {
      const day = String(d.getDate()).padStart(2, '0')
      const month = String(d.getMonth() + 1).padStart(2, '0')
      const year = d.getFullYear()
      return `${month}/${day}/${year} 00:00:00:00`
    }

    const since = toGlassixDate(sixMonthsAgo)
    const until = toGlassixDate(now).replace('00:00:00:00', '23:59:59:00')

    const listRes = await fetch(`${BASE_URL}/api/v1.2/tickets/list`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ since, until })
    })

    if (!listRes.ok) {
      const err = await listRes.text()
      const status = listRes.status
      throw new Error(`Glassix list error ${status}: ${err}`)
    }

    const allTickets = await listRes.json()
    const tickets = Array.isArray(allTickets) ? allTickets : (allTickets.tickets || [])

    // Filter tickets by participant identifier
    const matched = tickets.filter((t: any) => {
      const participants = t.participants || []
      return participants.some((p: any) => {
        if (!p.identifier) return false
        const id = p.identifier.replace(/\D/g, '').replace(/^972/, '0')
        return identifiers.some(search => {
          const s = search.replace(/\D/g, '').replace(/^972/, '0')
          return p.identifier === search || id === s || p.identifier.toLowerCase() === search.toLowerCase()
        })
      })
    })

    // Format tickets for display
    const formatted = matched.slice(0, 20).map((t: any) => ({
      id: t.id,
      status: t.status,
      channel: t.protocolType || t.channelType || 'unknown',
      subject: t.subject || t.description || '',
      created: t.createTime || t.created,
      updated: t.updateTime || t.updated,
      assignee: t.assignee?.name || t.ownerName || '',
      participants: (t.participants || []).filter((p: any) => p.type === 'Client').map((p: any) => ({
        name: p.name,
        identifier: p.identifier,
        protocol: p.protocolType
      })),
      messages: (t.messages || []).slice(-5).map((m: any) => ({
        id: m.id,
        text: m.text || m.content || '',
        sender: m.senderName || m.sender || '',
        time: m.createTime || m.time,
        type: m.senderType || 'agent'
      }))
    }))

    return NextResponse.json({
      total: matched.length,
      tickets: formatted
    })

  } catch (e: any) {
    console.error('Glassix API error:', e.message)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

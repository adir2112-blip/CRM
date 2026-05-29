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
  if (!res.ok) throw new Error('Token error: ' + await res.text())
  const data = await res.json()
  tokenCache = { token: data.access_token, expires: Date.now() + (data.expires_in || 10800) * 1000 }
  return tokenCache.token
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const ticketId = searchParams.get('id')
    if (!ticketId) return NextResponse.json({ error: 'חסר מזהה' }, { status: 400 })

    const token = await getToken()

    // Try the correct endpoint
    const res = await fetch(`${BASE_URL}/api/v1.2/tickets/${ticketId}/messages`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })

    if (!res.ok) {
      // Fallback — try alternate endpoint
      const res2 = await fetch(`${BASE_URL}/api/v1.2/tickets/${ticketId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (!res2.ok) {
        return NextResponse.json({ 
          messages: [], 
          debug: { 
            messagesEndpoint: res.status,
            ticketEndpoint: res2.status,
            error: await res2.text()
          } 
        })
      }
      const detail = await res2.json()
      // Return raw for debugging
      return NextResponse.json({ 
        messages: [], 
        debug: { 
          keys: Object.keys(detail),
          transactionCount: (detail.transactions || []).length,
          transactionSample: (detail.transactions || []).slice(0, 2),
          messagesSample: (detail.messages || []).slice(0, 2)
        } 
      })
    }

    const data = await res.json()
    // Try to parse messages
    const rawMessages = Array.isArray(data) ? data : (data.messages || data.transactions || data[''] || [])
    
    // Return raw + formatted
    const messages = rawMessages.map((m: any) => {
      const isClient = m.senderType === 'Client' || m.direction === 'Incoming' || m.type === 'Incoming'
      return {
        id: m.id,
        text: m.text || m.body || m.content || '',
        sender: m.senderName || m.userName || m.sender || '',
        time: m.time || m.createTime || m.timestamp,
        type: isClient ? 'Client' : 'Agent',
        rawSenderType: m.senderType,
        rawDirection: m.direction,
        rawType: m.type
      }
    }).filter((m: any) => m.text)

    return NextResponse.json({ messages, subject: '', status: '' })

  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

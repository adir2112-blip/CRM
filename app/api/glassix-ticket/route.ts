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

    // Use Get endpoint with transactions
    const res = await fetch(`${BASE_URL}/api/v1.2/tickets/get/${ticketId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })

    if (!res.ok) {
      return NextResponse.json({ messages: [], debug: { status: res.status, error: await res.text() } })
    }

    const ticket = await res.json()

    // transactions is null in get — use get with transactions param
    if (!ticket.transactions || ticket.transactions === null) {
      // Try with includeTransactions
      const res2 = await fetch(`${BASE_URL}/api/v1.2/tickets/get/${ticketId}?includeTransactions=true`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (res2.ok) {
        const t2 = await res2.json()
        if (t2.transactions?.length > 0) {
          return formatTransactions(t2)
        }
      }

      // Fallback: use HTML endpoint and parse it
      const htmlRes = await fetch(`${BASE_URL}/api/v1.2/tickets/${ticketId}/html`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (htmlRes.ok) {
        const html = await htmlRes.text()
        const messages = parseGlassixHtml(html)
        return NextResponse.json({ messages, subject: ticket.field1 || '', status: ticket.state || '' })
      }

      return NextResponse.json({ messages: [], debug: { note: 'transactions null, html failed' } })
    }

    return formatTransactions(ticket)

  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

function formatTransactions(ticket: any) {
  const transactions = ticket.transactions || []
  const messages = transactions
    .filter((tx: any) => (tx.text || tx.body || tx.content || '').trim().length > 0)
    .map((tx: any) => {
      const senderType = tx.senderType || tx.type || ''
      const isClient = senderType === 'Client' || senderType === 'client' || tx.direction === 'Incoming'
      return {
        id: tx.id,
        text: tx.text || tx.body || tx.content || '',
        sender: tx.senderName || tx.userName || '',
        time: tx.time || tx.createTime,
        type: isClient ? 'Client' : 'Agent',
      }
    })
  return NextResponse.json({ messages, subject: ticket.field1 || '', status: ticket.state || '' })
}

function parseGlassixHtml(html: string): any[] {
  const messages: any[] = []
  
  // Extract message blocks from HTML
  // Look for patterns like sender name + message text
  const lines = html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&gt;/g, '>')
    .replace(/&lt;/g, '<')
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0)

  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    if (line.length > 0 && line.length < 200) {
      messages.push({
        id: i,
        text: line,
        sender: '',
        time: null,
        type: 'Client', // default, will be improved
      })
    }
    i++
  }
  
  return messages.slice(0, 50)
}

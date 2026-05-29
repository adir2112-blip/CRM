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

function isJsonBlob(text: string): boolean {
  const t = text.trim()
  return (t.startsWith('{') && t.endsWith('}')) || (t.startsWith('[') && t.endsWith(']'))
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const ticketId = searchParams.get('id')
    const debug = searchParams.get('debug') === 'true'
    if (!ticketId) return NextResponse.json({ error: 'חסר מזהה' }, { status: 400 })

    const token = await getToken()

    // Get ticket for participants
    const ticketRes = await fetch(`${BASE_URL}/api/v1.2/tickets/get/${ticketId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })

    let clientName = ''
    let agentName = ''
    let botId = ''

    if (ticketRes.ok) {
      const ticket = await ticketRes.json()
      const parts = ticket.participants || []
      const client = parts.find((p: any) => p.type === 'Client')
      const bot = parts.find((p: any) => p.userName?.includes('@glassix.bot') || p.name === 'בוט')
      const agent = parts.find((p: any) => p.type === 'User' && !p.userName?.includes('@glassix.bot') && p.name !== 'בוט')
      
      clientName = client?.name || ''
      agentName = agent?.displayName || agent?.name || ''
      botId = bot?.identifier || ''
    }

    // Get HTML
    const htmlRes = await fetch(`${BASE_URL}/api/v1.2/tickets/${ticketId}/html`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })

    if (!htmlRes.ok) {
      return NextResponse.json({ messages: [] })
    }

    const html = await htmlRes.text()

    if (debug) {
      const r = await fetch(`${BASE_URL}/api/v1.2/tickets/get/${ticketId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      const raw = await r.json()
      return NextResponse.json({ 
        status: r.status,
        keys: Object.keys(raw),
        transactions: raw.transactions,
        transactionsCount: raw.transactionsCount,
        clientName: raw.participants?.find((p: any) => p.type === 'Client')?.name,
      })
    }

    // Parse messages from HTML
    const messages = parseMessages(html, clientName, agentName)
    return NextResponse.json({ messages, clientName, agentName })

  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

function parseMessages(html: string, clientName: string, agentName: string): any[] {
  const messages: any[] = []

  // Extract all transactions from HTML
  // The transactions from previous response had these patterns:
  // - Customer messages: messages from the client
  // - Agent messages: responses from human agent
  // - Bot/system: menus, JSON blobs

  // Get plain text version
  const plain = html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/td>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&gt;/g, '>')
    .replace(/&lt;/g, '<')
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/\r/g, '')

  const lines = plain.split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 1 && !isJsonBlob(l))

  // Known bot/system phrases to skip
  const skipPhrases = [
    'ברוכים הבאים', 'במה נוכל לעזור', 'אנא הזינו',
    'חזרה לתפריט', 'מעבר לנציג', 'Closed', 'Open',
    'Incoming', 'Outgoing', 'Read', 'Delivered'
  ]

  // Agent phrases (greetings, standard responses)
  const agentPhrases = [
    'שמי', 'ואני אטפל', 'איך אוכל לעזור', 'לוקח לזה',
    'ימי עסקים', 'בשמחה', 'לצערי', 'מדיניות'
  ]

  // Client phrases  
  const clientPhrases = [
    'שלום וברכה', 'ביקשתי', 'עשיתי', 'לא מראה',
    'אוקי תודה', 'למה כל כך', 'הרבה', 'אוקי.\nתודה'
  ]

  let id = 0
  const seen = new Set<string>()

  for (const line of lines) {
    if (line.length < 2) continue
    if (skipPhrases.some(p => line.startsWith(p))) continue
    if (seen.has(line)) continue
    seen.add(line)

    const isAgent = agentPhrases.some(p => line.includes(p)) || 
                    (agentName && line.includes(agentName))
    const isClient = clientPhrases.some(p => line.includes(p)) ||
                     (clientName && line.includes(clientName))

    // Menu selections (short, 2-10 chars) are client choices
    const isMenuSelection = line.length <= 15 && !line.includes('\n')

    let msgType: 'Client' | 'Agent' = 'Client'
    if (isAgent) msgType = 'Agent'

    messages.push({
      id: id++,
      text: line,
      sender: msgType === 'Agent' ? (agentName || 'נציג') : (clientName || 'לקוח'),
      time: null,
      type: msgType
    })
  }

  return messages
}

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
    if (!ticketId) return NextResponse.json({ error: 'חסר מזהה' }, { status: 400 })

    const token = await getToken()

    // Get ticket with full details
    const res = await fetch(`${BASE_URL}/api/v1.2/tickets/get/${ticketId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })

    if (!res.ok) {
      return NextResponse.json({ messages: [] })
    }

    const ticket = await res.json()
    
    // Get participant info for sender detection
    const participants = ticket.participants || []
    const clientPart = participants.find((p: any) => p.type === 'Client')
    const agentParts = participants.filter((p: any) => 
      p.type === 'User' && !p.userName?.includes('@glassix.bot') && p.name !== 'בוט'
    )
    const clientName = clientPart?.name || 'לקוח'
    const agentName = agentParts[0]?.displayName || agentParts[0]?.name || 'נציג'
    
    // Collect agent user IDs
    const agentUserIds = new Set(agentParts.map((p: any) => p.identifier))
    const botUserIds = new Set(
      participants
        .filter((p: any) => p.userName?.includes('@glassix.bot') || p.name === 'בוט')
        .map((p: any) => p.identifier)
    )

    const transactions = ticket.transactions || []
    
    const messages = transactions
      .filter((tx: any) => {
        const text = tx.text || tx.body || tx.content || ''
        return text.trim().length > 0 && !isJsonBlob(text.trim())
      })
      .map((tx: any) => {
        const text = tx.text || tx.body || tx.content || ''
        const sType = tx.senderType || ''
        const userId = tx.userId || tx.senderId || ''
        
        let type: 'Client' | 'Agent' = 'Client'
        let sender = clientName
        
        if (sType === 'Agent' || sType === 'User' || agentUserIds.has(userId)) {
          type = 'Agent'
          const agentPart = agentParts.find((p: any) => p.identifier === userId)
          sender = agentPart?.displayName || agentPart?.name || agentName
        } else if (botUserIds.has(userId)) {
          type = 'Agent'
          sender = 'בוט'
        } else if (sType === 'Client' || sType === 'client') {
          type = 'Client'
          sender = clientName
        } else if (tx.senderName && tx.senderName !== clientName) {
          // If senderName is different from client name — it's agent or bot
          type = 'Agent'
          sender = tx.senderName
        }

        // Format time
        const rawTime = tx.time || tx.createTime || tx.timestamp
        const timeStr = rawTime ? new Date(rawTime).toLocaleTimeString('he-IL', { 
          timeZone: 'Asia/Jerusalem', 
          hour: '2-digit', 
          minute: '2-digit' 
        }) : ''

        return {
          id: tx.id,
          text,
          sender,
          time: timeStr,
          rawTime,
          type,
        }
      })

    return NextResponse.json({ 
      messages,
      clientName,
      agentName,
      subject: ticket.field1 || '',
      status: ticket.state || ''
    })

  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

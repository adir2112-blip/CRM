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
    if (!ticketId) return NextResponse.json({ error: 'חסר מזהה טיקט' }, { status: 400 })

    const token = await getToken()
    const res = await fetch(`${BASE_URL}/api/v1.2/tickets/get/${ticketId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    if (!res.ok) throw new Error(`Ticket error ${res.status}: ${await res.text()}`)

    const detail = await res.json()
    
    // Return raw transactions for debugging + formatted messages
    const messages = (detail.transactions || [])
      .filter((tx: any) => tx.type === 'Message' || tx.type === 'Note' || tx.type === 'Email' || tx.type === 'IncomingMessage' || tx.type === 'OutgoingMessage')
      .map((tx: any) => {
        // Detect if client sent this message using multiple possible fields
        const isClient = 
          tx.senderType === 'Client' || tx.senderType === 'client' ||
          tx.direction === 'Incoming' || tx.direction === 'incoming' ||
          tx.type === 'IncomingMessage' ||
          tx.isClient === true ||
          tx.from?.type === 'Client' ||
          (tx.senderType !== 'User' && tx.senderType !== 'Agent' && tx.senderType !== 'Bot' && tx.type !== 'OutgoingMessage' && tx.direction !== 'Outgoing')
        
        return {
          id: tx.id,
          text: tx.text || tx.body || tx.htmlBody?.replace(/<[^>]+>/g, '') || tx.content || '',
          sender: tx.senderName || tx.userName || tx.fromName || tx.from?.name || '',
          time: tx.time || tx.createTime,
          type: isClient ? 'Client' : 'Agent',
          rawType: tx.senderType, // for debug
        }
      })

    // If no messages, return raw data for debugging
    if (messages.length === 0) {
      return NextResponse.json({ 
        messages: [], 
        debug: {
          transactionCount: (detail.transactions || []).length,
          transactionTypes: Array.from(new Set((detail.transactions || []).map((tx: any) => tx.type as string))),
          sampleTx: (detail.transactions || []).slice(0, 2)
        }
      })
    }

    return NextResponse.json({ messages, subject: detail.subject || detail.field1 || '', status: detail.state })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

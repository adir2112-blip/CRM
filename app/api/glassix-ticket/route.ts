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

const agentPhrases = ['היי 👋', 'שמי ', 'ואני אטפל', 'איך אוכל לעזור',
  'לוקח לזה', 'ימי עסקים', 'בשמחה', 'לצערי', 'מדיניות',
  'אשמח לדעת', 'אשמח לעזור', 'נשמח לעזור', 'אפשר לעזור']
const botPhrases = ['ברוכים הבאים', 'במה נוכל לעזור', 'אנא הזינו',
  'מעבר לנציג', 'חזרה לתפריט', 'בחר אחת מהאפשרויות']

function detectType(text: string, senderType: string, agentName: string, clientName: string): { type: 'Client' | 'Agent', sender: string } {
  if (senderType === 'User' || senderType === 'Agent') return { type: 'Agent', sender: agentName }
  if (senderType === 'Client' || senderType === 'client') return { type: 'Client', sender: clientName }
  
  const isBotText = botPhrases.some(p => text.includes(p))
  const isAgentText = agentPhrases.some(p => text.includes(p)) || (agentName && text.includes(agentName))
  
  if (isBotText) return { type: 'Agent', sender: 'בוט' }
  if (isAgentText) return { type: 'Agent', sender: agentName }
  return { type: 'Client', sender: clientName }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const ticketId = searchParams.get('id')
    if (!ticketId) return NextResponse.json({ error: 'חסר מזהה' }, { status: 400 })

    // Try Supabase first (from webhook)
    const { data: dbMessages } = await supabase
      .from('glassix_messages')
      .select('*')
      .eq('ticket_id', ticketId)
      .order('created_at')

    if (dbMessages && dbMessages.length > 0) {
      const messages = dbMessages
        .filter(m => m.text && !isJsonBlob(m.text))
        .map(m => {
          const timeStr = m.created_at ? new Date(m.created_at).toLocaleTimeString('he-IL', {
            timeZone: 'Asia/Jerusalem', hour: '2-digit', minute: '2-digit'
          }) : ''
          const isAgent = m.sender_type === 'User' || m.sender_type === 'Agent'
          return {
            id: m.message_id,
            text: m.text,
            sender: m.sender_name || (isAgent ? 'נציג' : 'לקוח'),
            time: timeStr,
            type: isAgent ? 'Agent' : 'Client'
          }
        })
      return NextResponse.json({ messages, source: 'db' })
    }

    // Fallback: fetch from Glassix API
    const token = await getToken()
    const res = await fetch(`${BASE_URL}/api/v1.2/tickets/get/${ticketId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    if (!res.ok) return NextResponse.json({ messages: [] })

    const ticket = await res.json()
    const parts = ticket.participants || []
    const clientPart = parts.find((p: any) => p.type === 'Client')
    const agentPart = parts.find((p: any) => p.type === 'User' && !p.userName?.includes('@glassix.bot') && p.name !== 'בוט')
    const clientName = clientPart?.name || 'לקוח'
    const agentName = agentPart?.displayName || agentPart?.name || 'נציג'

    const transactions = ticket.transactions || []
    const messages = transactions
      .filter((tx: any) => {
        const text = tx.text || ''
        return text.trim().length > 0 && !isJsonBlob(text.trim())
      })
      .map((tx: any) => {
        const text = tx.text || ''
        const { type, sender } = detectType(text, tx.senderType || '', agentName, clientName)
        const rawTime = tx.time || tx.createTime
        const timeStr = rawTime ? new Date(rawTime).toLocaleTimeString('he-IL', {
          timeZone: 'Asia/Jerusalem', hour: '2-digit', minute: '2-digit'
        }) : ''
        return { id: tx.id, text, sender, time: timeStr, type }
      })

    return NextResponse.json({ messages, source: 'api', clientName, agentName })

  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

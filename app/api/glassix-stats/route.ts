import { NextResponse } from 'next/server'

const BASE_URL = `https://${process.env.GLASSIX_WORKSPACE || 'm4l-il'}.glassix.com`

const DEPT_MAP: Record<string, string> = {
  '972523481937': 'כללית אקטיב+',
  'active@movement4life.co.il': 'כללית אקטיב+',
  'Active@movement4life.co.il': 'כללית אקטיב+',
  '972559983925': 'כללית אקטיב+',
  '972799120535': 'עובדים בריא 360',
  '97279912053': 'עובדים בריא 360',
  'ovdim.bari@movement4life.co.il': 'עובדים בריא 360',
  '97236939342': 'מעוף לעמית',
  'maoflamit@m4l.co.il': 'מעוף לעמית',
  'Maoflamit@m4l.co.il': 'מעוף לעמית',
  '972747008676': 'לאומית FIT',
  'leumitfit@movement4life.co.il': 'לאומית FIT',
  'LeumitFIT@movement4life.co.il': 'לאומית FIT',
  '972747008669': 'מאוחדת',
  'meuhedetwow@movement-group.com': 'מאוחדת',
  'Meuhedetwow@movement-group.com': 'מאוחדת',
}

function resolveDept(dept: string): string {
  if (!dept) return 'לא ידוע'
  if (DEPT_MAP[dept]) return DEPT_MAP[dept]
  const lower = dept.toLowerCase()
  for (const [key, val] of Object.entries(DEPT_MAP)) {
    if (key.toLowerCase() === lower) return val
  }
  return dept
}

function businessDaysSince(dateStr: string): number {
  const start = new Date(dateStr)
  const end = new Date()
  start.setHours(0, 0, 0, 0)
  end.setHours(0, 0, 0, 0)
  if (start >= end) return 0
  let count = 0
  const cur = new Date(start)
  cur.setDate(cur.getDate() + 1)
  while (cur <= end) {
    const dow = cur.getDay()
    if (dow !== 5 && dow !== 6) count++
    cur.setDate(cur.getDate() + 1)
  }
  return count
}

async function getToken(): Promise<{ token: string | null, debug?: any }> {
  try {
    const res = await fetch(`${BASE_URL}/api/v1.2/token/get`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        apiKey: process.env.GLASSIX_API_KEY,
        apiSecret: process.env.GLASSIX_API_SECRET,
        userName: process.env.GLASSIX_USERNAME,
        workspace: process.env.GLASSIX_WORKSPACE || 'm4l-il'
      })
    })
    const text = await res.text()
    let data: any = {}
    try { data = JSON.parse(text) } catch {}
    if (!data.token && !data.access_token) return { token: null, debug: { status: res.status, response: text.slice(0, 500) } }
    return { token: data.token || data.access_token }
  } catch (e: any) {
    return { token: null, debug: { exception: e.message } }
  }
}

export async function GET() {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control': 'no-store, no-cache, must-revalidate',
  }

  try {
    const tokenResult = await getToken()
    if (!tokenResult.token) {
      const r = NextResponse.json({ 
        error: 'Failed to get Glassix token',
        debug: {
          workspace: process.env.GLASSIX_WORKSPACE || 'm4l-il',
          hasApiKey: !!process.env.GLASSIX_API_KEY,
          hasApiSecret: !!process.env.GLASSIX_API_SECRET,
          hasUsername: !!process.env.GLASSIX_USERNAME,
          glassixResponse: tokenResult.debug
        }
      }, { status: 500 })
      Object.entries(corsHeaders).forEach(([k, v]) => r.headers.set(k, v))
      return r
    }
    const token = tokenResult.token

    function toGlassixDate(d: Date): string {
      const dd = String(d.getUTCDate()).padStart(2, '0')
      const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
      const yyyy = d.getUTCFullYear()
      const hh = String(d.getUTCHours()).padStart(2, '0')
      const min = String(d.getUTCMinutes()).padStart(2, '0')
      const ss = String(d.getUTCSeconds()).padStart(2, '0')
      return `${dd}/${mm}/${yyyy} ${hh}:${min}:${ss}:00`
    }

    const since = toGlassixDate(new Date(Date.now() - 28 * 864e5))
    const until = toGlassixDate(new Date())

    let allTickets: any[] = []
    let listDebug: any = {}
    let url: string | null = `${BASE_URL}/api/v1.2/tickets/list?since=${encodeURIComponent(since)}&until=${encodeURIComponent(until)}&statuses=Open`

    let pages = 0
    while (url && pages < 20) {
      const res = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } })
      if (pages === 0) {
        const text = await res.text()
        listDebug = { status: res.status, url, responsePreview: text.slice(0, 500) }
        try {
          const data = JSON.parse(text)
          const batch = data[''] || data.tickets || data.data || (Array.isArray(data) ? data : [])
          if (batch.length === 0) break
          allTickets = allTickets.concat(batch)
          const next = data.paging?.next || null
          url = next && typeof next === 'string' ? (next.startsWith('http') ? next : `${BASE_URL}${next}`) : null
        } catch { break }
      } else {
        if (res.status === 429) break
        if (!res.ok) break
        const data = await res.json()
        const batch = data[''] || data.tickets || data.data || (Array.isArray(data) ? data : [])
        if (batch.length === 0) break
        allTickets = allTickets.concat(batch)
        const next = data.paging?.next || null
        url = next && typeof next === 'string' ? (next.startsWith('http') ? next : `${BASE_URL}${next}`) : null
      }
      pages++
    }

    // Filter mail only and group by department
    const deptMap: Record<string, any> = {}
    const debugProtocols: Record<string, number> = {}
    const debugStates: Record<string, number> = {}

    allTickets.forEach((t: any) => {
      const protocol = t.primaryProtocolType || t.protocolType || ''
      debugProtocols[protocol] = (debugProtocols[protocol] || 0) + 1
      debugStates[t.state || t.status || 'unknown'] = (debugStates[t.state || t.status || 'unknown'] || 0) + 1

      if (!protocol.toLowerCase().includes('mail')) return

      // Only count open tickets
      const state = (t.state || t.status || '').toLowerCase()
      if (state === 'closed' || state === 'solved') return

      const participants = t.participants || []
      const deptParticipant = participants.find((p: any) => p.departmentIdentifier)
      const deptId = deptParticipant?.departmentIdentifier || ''
      const deptName = resolveDept(deptId)
      if (deptName === 'לא ידוע') return

      if (!deptMap[deptName]) deptMap[deptName] = { name: deptName, open_tickets: 0, oldest_open: null }
      deptMap[deptName].open_tickets++

      const opened = t.open || t.created
      if (opened && (!deptMap[deptName].oldest_open || opened < deptMap[deptName].oldest_open)) {
        deptMap[deptName].oldest_open = opened
      }
    })

    const departments = Object.values(deptMap).map((d: any) => {
      const bd = d.oldest_open ? businessDaysSince(d.oldest_open) : 0
      return {
        name: d.name,
        open_tickets: d.open_tickets,
        oldest_open: d.oldest_open,
        oldest_business_days: bd,
        sla_status: bd === 0 ? 'green' : bd === 1 ? 'yellow' : bd === 2 ? 'orange' : 'red'
      }
    }).sort((a: any, b: any) => b.open_tickets - a.open_tickets)

    const response = NextResponse.json({
      departments,
      summary: {
        total_departments: departments.length,
        total_open: departments.reduce((s: number, d: any) => s + d.open_tickets, 0),
        critical: departments.filter((d: any) => d.sla_status === 'red').length
      },
      source: 'glassix-live',
      debug: { totalFromGlassix: allTickets.length, protocols: debugProtocols, states: debugStates, listDebug, sampleTicket: allTickets[0] ? { keys: Object.keys(allTickets[0]), protocolType: allTickets[0].primaryProtocolType || allTickets[0].protocolType, state: allTickets[0].state || allTickets[0].status } : null },
      updated: new Date().toISOString()
    })
    Object.entries(corsHeaders).forEach(([k, v]) => response.headers.set(k, v))
    return response
  } catch (e: any) {
    const r = NextResponse.json({ error: e.message }, { status: 500 })
    Object.entries(corsHeaders).forEach(([k, v]) => r.headers.set(k, v))
    return r
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' } })
}

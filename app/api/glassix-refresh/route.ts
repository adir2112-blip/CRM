import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const WORKSPACE = process.env.GLASSIX_WORKSPACE || 'm4l-il'

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

export async function POST() {
  try {
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
    await supabase.from('glassix_cache').delete().eq('cache_key', `glassix_tickets_${WORKSPACE}`)
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
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
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

    const { data } = await supabase
      .from('glassix_messages')
      .select('ticket_id, department, channel, created_at, sender_name, sender_type')
      .ilike('channel', '%mail%')
      .order('created_at', { ascending: false })
      .limit(10000)

    // Get only Open ticket statuses
    const { data: statusData } = await supabase
      .from('glassix_ticket_status')
      .select('ticket_id, status')
      .eq('status', 'Open')

    if (!data) {
      const r = NextResponse.json({ departments: [], updated: new Date().toISOString() })
      Object.entries(corsHeaders).forEach(([k, v]) => r.headers.set(k, v))
      return r
    }

    const statusMap: Record<string, string> = {}
    ;(statusData || []).forEach((s: any) => { statusMap[s.ticket_id] = 'Open' })

    const ticketMap: Record<string, any> = {}
    data.forEach((m: any) => {
      if (!ticketMap[m.ticket_id]) {
        const status = statusMap[m.ticket_id] === 'Open' ? 'Open' : 'Closed'
        ticketMap[m.ticket_id] = { ticket_id: m.ticket_id, department: m.department || '', first_msg: m.created_at, last_msg: m.created_at, status }
      }
      if (m.created_at < ticketMap[m.ticket_id].first_msg) ticketMap[m.ticket_id].first_msg = m.created_at
      if (m.created_at > ticketMap[m.ticket_id].last_msg) ticketMap[m.ticket_id].last_msg = m.created_at
    })

    const deptMap: Record<string, any> = {}
    Object.values(ticketMap).forEach((t: any) => {
      const name = resolveDept(t.department)
      if (!deptMap[name]) deptMap[name] = { name, total: 0, open: 0, oldest_open: null, tickets: [] }
      deptMap[name].total++
      if (t.status !== 'Closed' && t.status !== 'closed') {
        deptMap[name].open++
        if (!deptMap[name].oldest_open || t.first_msg < deptMap[name].oldest_open) deptMap[name].oldest_open = t.first_msg
        const bd = businessDaysSince(t.first_msg)
        deptMap[name].tickets.push({
          ticket_id: t.ticket_id, opened: t.first_msg, last_update: t.last_msg,
          business_days_open: bd,
          sla_status: bd === 0 ? 'green' : bd === 1 ? 'yellow' : bd === 2 ? 'orange' : 'red'
        })
      }
    })

    const departments = Object.values(deptMap).map((d: any) => {
      const bd = d.oldest_open ? businessDaysSince(d.oldest_open) : 0
      return {
        name: d.name, total_tickets: d.total, open_tickets: d.open, oldest_open: d.oldest_open,
        oldest_business_days: bd,
        sla_status: !d.oldest_open ? 'green' : bd === 0 ? 'green' : bd === 1 ? 'yellow' : bd === 2 ? 'orange' : 'red',
        tickets: d.tickets
      }
    }).sort((a: any, b: any) => b.open_tickets - a.open_tickets)
      .filter((d: any) => d.name !== 'לא ידוע')

    const response = NextResponse.json({
      departments,
      summary: { total_departments: departments.length, total_open: departments.reduce((s: number, d: any) => s + d.open_tickets, 0), critical: departments.filter((d: any) => d.sla_status === 'red').length },
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

import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const { to, message } = await request.json()
    if (!to || !message) return NextResponse.json({ error: 'חסרים פרטים' }, { status: 400 })

    const accountSid = process.env.TWILIO_ACCOUNT_SID
    const authToken = process.env.TWILIO_AUTH_TOKEN
    const from = process.env.TWILIO_PHONE_NUMBER

    if (!accountSid || !authToken || !from) {
      return NextResponse.json({ error: 'Twilio לא מוגדר' }, { status: 500 })
    }

    // Format Israel number
    let phone = to.replace(/\D/g, '')
    if (phone.startsWith('0')) phone = '972' + phone.slice(1)
    if (!phone.startsWith('+')) phone = '+' + phone

    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ To: phone, From: from, Body: message }).toString()
    })

    const data = await res.json()
    if (!res.ok) return NextResponse.json({ error: data.message || 'שגיאה בשליחה' }, { status: 400 })

    return NextResponse.json({ success: true, sid: data.sid })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

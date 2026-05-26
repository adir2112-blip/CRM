'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

export default function Home() {
  const router = useRouter()
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) router.push('/dashboard')
      else router.push('/login')
    })
  }, [router])
  return <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',color:'#9ca3af'}}>טוען...</div>
}

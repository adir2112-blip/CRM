'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

export function useUser() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user }, error } = await supabase.auth.getUser()
      if (error || !user) { router.push('/login'); return }
      setUser(user)
      const { data: prof, error: profError } = await supabase
        .from('profiles')
        .select('id, full_name, role, active')
        .eq('id', user.id)
        .single()
      console.log('Profile loaded:', prof, profError)
      if (prof) {
        setProfile(prof)
      } else {
        const { data: newProf } = await supabase
          .from('profiles')
          .insert({ id: user.id, full_name: user.email, role: 'agent' })
          .select()
          .single()
        setProfile(newProf)
      }
      setLoading(false)
    }
    load()
  }, [router])

  return { user, profile, loading }
}
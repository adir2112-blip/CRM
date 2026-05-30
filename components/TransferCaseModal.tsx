'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'

interface Props {
  caseId: number
  currentAgentName: string
  onClose: () => void
  onTransferred: () => void
}

export default function TransferCaseModal({ caseId, currentAgentName, onClose, onTransferred }: Props) {
  const supabase = createClient()
  const [agents, setAgents] = useState<any[]>([])
  const [selectedAgent, setSelectedAgent] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    supabase.from('profiles').select('id,full_name').eq('active', true).order('full_name')
      .then(({ data }) => setAgents((data || []).filter(a => a.full_name !== currentAgentName)))
  }, [])

  async function transfer() {
    if (!selectedAgent) return
    setSaving(true)
    const agent = agents.find(a => a.id === selectedAgent)
    if (!agent) return
    const { data: { user } } = await supabase.auth.getUser()
    const { data: myProfile } = await supabase.from('profiles').select('full_name').eq('id', user?.id || '').single()
    await supabase.from('cases').update({ agent_id: agent.id, agent_name: agent.full_name }).eq('id', caseId)
    await supabase.from('case_logs').insert({ case_id: caseId, author_id: user?.id, author_name: myProfile?.full_name, content: `🔄 פניה הועברה מ-${currentAgentName} ל-${agent.full_name}` })
    setSaving(false)
    onTransferred()
    onClose()
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(15,23,42,0.5)', zIndex:500, display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ background:'#fff', borderRadius:16, padding:24, width:380, maxWidth:'95vw', boxShadow:'0 24px 64px rgba(0,0,0,0.2)' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
          <div style={{ fontSize:15, fontWeight:700 }}>🔄 העבר פניה לנציג אחר</div>
          <button style={{ background:'none', border:'none', fontSize:18, cursor:'pointer', color:'#6b7280' }} onClick={onClose}>✕</button>
        </div>
        <div style={{ fontSize:12, color:'#6b7280', marginBottom:14 }}>נציג נוכחי: <strong>{currentAgentName}</strong></div>
        <select className="form-input" value={selectedAgent} onChange={e => setSelectedAgent(e.target.value)} style={{ marginBottom:16 }}>
          <option value="">בחר נציג...</option>
          {agents.map(a => <option key={a.id} value={a.id}>{a.full_name}</option>)}
        </select>
        <button onClick={transfer} disabled={!selectedAgent || saving}
          style={{ width:'100%', padding:'11px 0', borderRadius:10, border:'none', background: selectedAgent ? 'linear-gradient(135deg,#059669,#10b981)' : '#e5e7eb', color: selectedAgent ? '#fff' : '#9ca3af', fontSize:14, fontWeight:700, cursor: selectedAgent ? 'pointer' : 'not-allowed', fontFamily:'Heebo,sans-serif' }}>
          {saving ? '⏳ מעביר...' : '✓ אשר העברה'}
        </button>
      </div>
    </div>
  )
}

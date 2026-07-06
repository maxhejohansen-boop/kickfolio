import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

function getNextMatchday15() {
  const now = new Date()
  for (let ahead = 0; ahead <= 1; ahead++) {
    const probe = new Date(now.getTime() + ahead * 86_400_000)
    const lisbonDate = probe.toLocaleDateString('sv', { timeZone: 'Europe/Lisbon' })
    const noon = new Date(lisbonDate + 'T12:00:00Z')
    const offsetMin = (new Date(noon.toLocaleString('en-US', { timeZone: 'Europe/Lisbon' })) - new Date(noon.toLocaleString('en-US', { timeZone: 'UTC' }))) / 60_000
    const target = new Date(lisbonDate + 'T00:00:00Z')
    target.setUTCMinutes(15 * 60 - offsetMin)
    if (target > now) return target
  }
  return new Date(now.getTime() + 86_400_000)
}

function fmt(ms) {
  const s = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`
  if (m > 0) return `${m}m ${String(sec).padStart(2, '0')}s`
  return `${sec}s`
}

function fmtLive(ms) {
  const s = Math.max(0, Math.floor(ms / 1000))
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${m}:${String(sec).padStart(2, '0')}`
}

export default function MatchdayPill({ channelId = 'matchday-pill' }) {
  const [status, setStatus] = useState('scheduled')
  const [endsAt, setEndsAt] = useState(null)
  const [, setTick] = useState(0)

  useEffect(() => {
    supabase
      .from('matchday_status')
      .select('status, ends_at')
      .eq('id', 1)
      .single()
      .then(({ data }) => {
        if (data) { setStatus(data.status); setEndsAt(data.ends_at) }
      })

    const channel = supabase
      .channel(channelId)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'matchday_status', filter: 'id=eq.1'
      }, ({ new: row }) => {
        setStatus(row.status)
        setEndsAt(row.ends_at)
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 1000)
    return () => clearInterval(id)
  }, [])

  const remaining   = status === 'live' && endsAt ? Math.max(0, new Date(endsAt) - Date.now()) : 0
  const isLive      = status === 'live' && remaining > 0
  const isCompleted = status === 'completed' || (status === 'live' && endsAt != null && remaining === 0)
  const nextMs      = getNextMatchday15() - Date.now()

  return (
    <Link
      to="/live"
      className={`flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-semibold transition-all select-none ${
        isLive
          ? 'bg-red-500/15 border border-red-500/40 text-red-400 live-pill-pulse'
          : isCompleted
            ? 'bg-orange-500/10 border border-orange-500/30 text-orange-400 hover:border-orange-500/50'
            : 'bg-[#1a1f28] border border-[#1e2330] text-gray-400 hover:text-white hover:border-gray-500'
      }`}
    >
      {isLive ? (
        <>
          <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse flex-shrink-0" />
          <span className="text-red-300 font-bold">LIVE</span>
          <span className="text-red-400/80">{fmtLive(remaining)}</span>
        </>
      ) : isCompleted ? (
        <>
          <span className="text-orange-400/80">🏁</span>
          <span className="text-orange-300 font-bold">Match over</span>
          <span className="text-orange-400/60">·</span>
          <span className="text-orange-400/80 tabular-nums">{fmt(nextMs)}</span>
        </>
      ) : (
        <>
          <span className="text-gray-600">⚽</span>
          <span className="text-gray-500">Next matchday</span>
          <span className="text-white font-bold tabular-nums">{fmt(nextMs)}</span>
        </>
      )}
    </Link>
  )
}

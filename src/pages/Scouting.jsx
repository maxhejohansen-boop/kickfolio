import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { calcGrade, GRADE_META } from '../lib/gradeCalc'

const POSITIONS = ['Forward', 'Midfielder', 'Defender', 'Goalkeeper']
const CLUBS = ['Arsenal', 'Chelsea', 'Liverpool', 'Manchester City', 'Manchester United', 'Tottenham']

const SEND_SCOUT_COST = 150
const INSTANT_SCOUT_COST = 500

function focusCost({ position, club, max_price, min_price }) {
  let cost = 300
  if (position) cost -= 60
  if (club)     cost -= 60
  if (max_price) cost -= 30
  if (min_price) cost -= 30
  return Math.max(100, cost)
}

function GradePill({ grade }) {
  if (!grade) return null
  const meta = GRADE_META[grade]
  return (
    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-sm ${meta.pillClass}`}>{grade}</span>
  )
}

export default function Scouting() {
  const { user, userRecord, refreshUserRecord } = useAuth()
  const [tab, setTab]             = useState('focuses')
  const [players, setPlayers]     = useState([])
  const [scoutsMap, setScoutsMap] = useState({})
  const [focuses, setFocuses]     = useState([])
  const [matchday, setMatchday]   = useState(0)
  const [last5Map, setLast5Map]   = useState({})
  const [historyMap, setHistoryMap] = useState({})
  const [loading, setLoading]     = useState(true)
  const [actionMsg, setActionMsg] = useState(null)

  // new focus form
  const [form, setForm] = useState({ name: '', position: '', club: '', max_price: '', min_price: '' })
  const [saving, setSaving] = useState(false)

  // players tab filter
  const [playerFilter, setPlayerFilter] = useState('unscouted')
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (user) load()
  }, [user])

  async function load() {
    setLoading(true)
    const [playersRes, trackerRes, focusesRes] = await Promise.all([
      supabase.from('players').select('*').order('current_price', { ascending: false }),
      supabase.from('matchday_tracker').select('current_matchday').eq('id', 1).maybeSingle(),
      supabase.from('scouting_focuses').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
    ])
    const md = trackerRes.data?.current_matchday ?? 0
    setMatchday(md)
    setPlayers(playersRes.data ?? [])
    setFocuses(focusesRes.data ?? [])

    const [scoutsRes, last5Res, historyRes] = await Promise.all([
      supabase.from('player_scouts').select('*').eq('user_id', user.id),
      md > 0
        ? supabase.from('matchday_stats')
            .select('player_id, matchday, goals, assists, rating, minutes, saves, clean_sheet')
            .gte('matchday', Math.max(1, md - 4))
        : Promise.resolve({ data: [] }),
      supabase.from('price_history').select('player_id, price, matchday').order('matchday', { ascending: true }),
    ])

    const sm = {}
    for (const s of (scoutsRes.data ?? [])) sm[s.player_id] = s
    setScoutsMap(sm)

    const l5 = {}
    for (const r of (last5Res.data ?? [])) {
      if (!l5[r.player_id]) l5[r.player_id] = []
      l5[r.player_id].push(r)
    }
    setLast5Map(l5)

    const hm = {}
    for (const r of (historyRes.data ?? [])) {
      if (!hm[r.player_id]) hm[r.player_id] = []
      hm[r.player_id].push({ price: r.price, matchday: r.matchday })
    }
    setHistoryMap(hm)

    setLoading(false)
  }

  function isRevealed(playerId) {
    const s = scoutsMap[playerId]
    if (!s) return false
    if (s.scout_type === 'instant') return true
    return s.scout_type === 'sent' && s.reveals_at_matchday != null && s.reveals_at_matchday <= matchday
  }

  function isPending(playerId) {
    const s = scoutsMap[playerId]
    return s?.scout_type === 'sent' && !isRevealed(playerId)
  }

  function gradeFor(player) {
    if (!isRevealed(player.id)) return null
    return calcGrade(player, last5Map[player.id], historyMap[player.id], userRecord?.balance ?? 0)
  }

  async function scoutNow(player) {
    if (scoutsFull) {
      setActionMsg({ type: 'error', text: `All ${maxScouts} scouts are busy. Wait for them to return after the next matchday.` })
      return
    }
    if ((userRecord?.balance ?? 0) < INSTANT_SCOUT_COST) {
      setActionMsg({ type: 'error', text: `Insufficient balance. Instant scout costs £${INSTANT_SCOUT_COST}.` })
      return
    }
    await supabase.from('users').update({ balance: userRecord.balance - INSTANT_SCOUT_COST }).eq('id', user.id)
    await supabase.from('player_scouts').upsert(
      { user_id: user.id, player_id: player.id, scout_type: 'instant', reveals_at_matchday: null },
      { onConflict: 'user_id,player_id' }
    )
    await refreshUserRecord()
    setScoutsMap(m => ({ ...m, [player.id]: { scout_type: 'instant' } }))
    setActionMsg({ type: 'ok', text: `${player.name} scouted instantly. £${INSTANT_SCOUT_COST} deducted.` })
  }

  async function sendScouts(player) {
    if (scoutsFull) {
      setActionMsg({ type: 'error', text: `All ${maxScouts} scouts are busy. Wait for them to return after the next matchday.` })
      return
    }
    if ((userRecord?.balance ?? 0) < SEND_SCOUT_COST) {
      setActionMsg({ type: 'error', text: `Insufficient balance. Sending scouts costs £${SEND_SCOUT_COST}.` })
      return
    }
    await supabase.from('users').update({ balance: userRecord.balance - SEND_SCOUT_COST }).eq('id', user.id)
    await supabase.from('player_scouts').upsert(
      { user_id: user.id, player_id: player.id, scout_type: 'sent', reveals_at_matchday: matchday + 1 },
      { onConflict: 'user_id,player_id' }
    )
    await refreshUserRecord()
    setScoutsMap(m => ({ ...m, [player.id]: { scout_type: 'sent', reveals_at_matchday: matchday + 1 } }))
    setActionMsg({ type: 'ok', text: `Scouts sent to ${player.name}. £${SEND_SCOUT_COST} deducted. Reveals MD${matchday + 1}.` })
  }

  async function createFocus() {
    if (!form.name.trim()) { setActionMsg({ type: 'error', text: 'Give your focus a name.' }); return }
    setSaving(true)
    const cost = focusCost(form)
    const { data } = await supabase.from('scouting_focuses').insert({
      user_id: user.id,
      name: form.name.trim(),
      position:  form.position  || null,
      club:      form.club      || null,
      max_price: form.max_price ? parseFloat(form.max_price) : null,
      min_price: form.min_price ? parseFloat(form.min_price) : null,
      cost_per_matchday: cost,
      active: true,
    }).select().single()
    if (data) {
      setFocuses(f => [data, ...f])
      setForm({ name: '', position: '', club: '', max_price: '', min_price: '' })
      setActionMsg({ type: 'ok', text: `Focus created. Will cost £${cost}/MD.` })
    }
    setSaving(false)
  }

  async function toggleFocus(id, active) {
    await supabase.from('scouting_focuses').update({ active: !active }).eq('id', id)
    setFocuses(f => f.map(x => x.id === id ? { ...x, active: !active } : x))
  }

  async function deleteFocus(id) {
    await supabase.from('scouting_focuses').delete().eq('id', id)
    setFocuses(f => f.filter(x => x.id !== id))
  }

  const balance       = userRecord?.balance ?? 0
  const maxScouts     = userRecord?.max_scouts ?? 3
  const scoutedCount  = players.filter(p => isRevealed(p.id)).length
  const pendingCount  = players.filter(p => isPending(p.id)).length
  const occupiedScouts = pendingCount
  const availableScouts = Math.max(0, maxScouts - occupiedScouts)
  const scoutsFull    = availableScouts === 0
  const activeFocuses = focuses.filter(f => f.active)
  const focusCostMD   = activeFocuses.reduce((s, f) => s + Number(f.cost_per_matchday), 0)

  const filteredPlayers = players
    .filter(p => {
      const name = p.name.toLowerCase()
      const club = p.club.toLowerCase()
      if (search && !name.includes(search.toLowerCase()) && !club.includes(search.toLowerCase())) return false
      if (playerFilter === 'scouted')   return isRevealed(p.id)
      if (playerFilter === 'pending')   return isPending(p.id)
      if (playerFilter === 'unscouted') return !isRevealed(p.id) && !isPending(p.id)
      return true
    })

  if (!user) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 text-center">
        <p className="text-gray-500">
          <Link to="/login" className="text-green-400 hover:underline">Sign in</Link> to access scouting
        </p>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Scouting</h1>
          <p className="text-sm text-gray-500 mt-0.5">Scout players to reveal their grades</p>
        </div>
      </div>

      {/* Scout capacity + stats row */}
      <div className="bg-[#111318] border border-[#1e2330] rounded-xl p-4 mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="text-xs text-gray-500 mb-2">Scout slots</div>
          <div className="flex items-center gap-2">
            {Array.from({ length: maxScouts }).map((_, i) => {
              const busy = i < occupiedScouts
              return (
                <div key={i} className={`w-9 h-9 rounded-lg flex flex-col items-center justify-center border text-[9px] font-bold gap-0.5 ${
                  busy
                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                    : 'bg-[#1a1f28] border-[#2a3040] text-gray-600'
                }`}>
                  <span className="text-base leading-none">{busy ? '🕵️' : '○'}</span>
                  <span>{busy ? 'busy' : 'free'}</span>
                </div>
              )
            })}
            <span className={`text-xs font-medium ml-1 ${scoutsFull ? 'text-red-400' : 'text-gray-400'}`}>
              {scoutsFull ? 'All busy — wait for next matchday' : `${availableScouts} of ${maxScouts} available`}
            </span>
          </div>
        </div>
        <div className="flex gap-4 text-right sm:text-left">
          <div>
            <div className="text-xs text-gray-500">Scouted</div>
            <div className="text-lg font-bold text-white">{scoutedCount}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500">Active focuses</div>
            <div className="text-lg font-bold text-white">{activeFocuses.length}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500">Focus spend/MD</div>
            <div className={`text-lg font-bold ${focusCostMD > 0 ? 'text-amber-400' : 'text-gray-400'}`}>£{focusCostMD}</div>
          </div>
        </div>
      </div>

      {/* Action message */}
      {actionMsg && (
        <div className={`mb-4 px-4 py-2.5 rounded-lg text-sm ${actionMsg.type === 'ok' ? 'bg-green-500/10 border border-green-500/20 text-green-400' : 'bg-red-500/10 border border-red-500/20 text-red-400'}`}>
          {actionMsg.text}
          <button className="ml-3 opacity-50 hover:opacity-100" onClick={() => setActionMsg(null)}>✕</button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex bg-[#111318] border border-[#1e2330] rounded-lg p-1 gap-0.5 mb-6 w-fit">
        {[['focuses', 'Focuses'], ['players', 'Players']].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`text-sm font-medium px-4 py-1.5 rounded transition-colors ${tab === key ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-gray-300'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── FOCUSES TAB ─────────────────────────────────────────────────────── */}
      {tab === 'focuses' && (
        <div className="grid lg:grid-cols-2 gap-6">

          {/* Left: create focus */}
          <div className="bg-[#111318] border border-[#1e2330] rounded-xl p-5">
            <h2 className="text-white font-semibold mb-1">Create a focus</h2>
            <p className="text-xs text-gray-500 mb-4">Scouts automatically reveal matching unscouted players after each matchday. Cost deducted from your balance per matchday.</p>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-500 block mb-1">Focus name</label>
                <input
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Top forwards under £20"
                  className="w-full bg-[#0d1117] border border-[#1e2330] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-gray-500 placeholder-gray-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Position</label>
                  <select
                    value={form.position}
                    onChange={e => setForm(f => ({ ...f, position: e.target.value }))}
                    className="w-full bg-[#0d1117] border border-[#1e2330] rounded-lg px-3 py-2 text-sm text-gray-300 focus:outline-none focus:border-gray-500"
                  >
                    <option value="">Any</option>
                    {POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Club</label>
                  <select
                    value={form.club}
                    onChange={e => setForm(f => ({ ...f, club: e.target.value }))}
                    className="w-full bg-[#0d1117] border border-[#1e2330] rounded-lg px-3 py-2 text-sm text-gray-300 focus:outline-none focus:border-gray-500"
                  >
                    <option value="">Any</option>
                    {CLUBS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Min price (£)</label>
                  <input
                    type="number" min="0" step="0.5"
                    value={form.min_price}
                    onChange={e => setForm(f => ({ ...f, min_price: e.target.value }))}
                    placeholder="e.g. 5"
                    className="w-full bg-[#0d1117] border border-[#1e2330] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-gray-500 placeholder-gray-600"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Max price (£)</label>
                  <input
                    type="number" min="0" step="0.5"
                    value={form.max_price}
                    onChange={e => setForm(f => ({ ...f, max_price: e.target.value }))}
                    placeholder="e.g. 20"
                    className="w-full bg-[#0d1117] border border-[#1e2330] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-gray-500 placeholder-gray-600"
                  />
                </div>
              </div>

              {/* Cost preview */}
              <div className="bg-[#0d1117] border border-[#1e2330] rounded-lg px-3 py-2.5 flex items-center justify-between">
                <div>
                  <div className="text-xs text-gray-500">Estimated cost</div>
                  <div className="text-sm font-bold text-amber-400">£{focusCost(form)}/matchday</div>
                </div>
                <div className="text-xs text-gray-600 text-right">
                  {[
                    form.position && `${form.position}s`,
                    form.club,
                    form.min_price && `min £${form.min_price}`,
                    form.max_price && `max £${form.max_price}`,
                  ].filter(Boolean).join(' · ') || 'All players'}
                </div>
              </div>

              <button
                onClick={createFocus}
                disabled={saving}
                className="w-full bg-green-500 hover:bg-green-400 disabled:opacity-50 text-black font-bold rounded-lg py-2 text-sm transition-colors"
              >
                {saving ? 'Creating…' : 'Create focus'}
              </button>
            </div>
          </div>

          {/* Right: active focuses */}
          <div>
            <h2 className="text-white font-semibold mb-3">Active focuses</h2>
            {focuses.length === 0 ? (
              <div className="bg-[#111318] border border-[#1e2330] rounded-xl p-8 text-center text-gray-600 text-sm">
                No focuses yet. Create one to start auto-scouting.
              </div>
            ) : (
              <div className="space-y-3">
                {focuses.map(f => (
                  <div key={f.id} className={`bg-[#111318] border rounded-xl p-4 transition-colors ${f.active ? 'border-[#1e2330]' : 'border-[#1a1a1a] opacity-60'}`}>
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div>
                        <div className="text-white font-medium text-sm">{f.name}</div>
                        <div className="text-xs text-gray-500 mt-0.5 flex flex-wrap gap-1.5">
                          {f.position && <span className="bg-[#1e2330] px-1.5 py-0.5 rounded">{f.position}</span>}
                          {f.club     && <span className="bg-[#1e2330] px-1.5 py-0.5 rounded">{f.club}</span>}
                          {f.min_price && <span className="bg-[#1e2330] px-1.5 py-0.5 rounded">≥ £{Number(f.min_price).toFixed(0)}</span>}
                          {f.max_price && <span className="bg-[#1e2330] px-1.5 py-0.5 rounded">≤ £{Number(f.max_price).toFixed(0)}</span>}
                          {!f.position && !f.club && !f.min_price && !f.max_price && (
                            <span className="bg-[#1e2330] px-1.5 py-0.5 rounded">All players</span>
                          )}
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className={`text-xs font-bold ${f.active ? 'text-amber-400' : 'text-gray-600'}`}>
                          £{Number(f.cost_per_matchday).toFixed(0)}/MD
                        </div>
                        <div className={`text-[10px] mt-0.5 ${f.active ? 'text-green-400' : 'text-gray-600'}`}>
                          {f.active ? 'Active' : 'Paused'}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 pt-2 border-t border-[#1e2330]">
                      <button
                        onClick={() => toggleFocus(f.id, f.active)}
                        className="text-xs text-gray-400 hover:text-white px-2 py-1 rounded border border-[#1e2330] hover:border-gray-600 transition-colors"
                      >
                        {f.active ? 'Pause' : 'Resume'}
                      </button>
                      <button
                        onClick={() => deleteFocus(f.id)}
                        className="text-xs text-red-500/70 hover:text-red-400 px-2 py-1 rounded border border-red-500/10 hover:border-red-500/30 transition-colors ml-auto"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── PLAYERS TAB ─────────────────────────────────────────────────────── */}
      {tab === 'players' && (
        <div>
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            {/* Status filter */}
            <div className="flex bg-[#111318] border border-[#1e2330] rounded-lg p-1 gap-0.5">
              {[
                ['all',       'All'],
                ['unscouted', 'Unscouted'],
                ['pending',   'Pending'],
                ['scouted',   'Scouted'],
              ].map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setPlayerFilter(key)}
                  className={`text-xs font-medium px-3 py-1.5 rounded whitespace-nowrap transition-colors ${playerFilter === key ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-gray-300'}`}
                >
                  {label}
                </button>
              ))}
            </div>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search players or clubs…"
              className="bg-[#111318] border border-[#1e2330] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-gray-500 placeholder-gray-600 flex-1"
            />
          </div>

          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-14 bg-[#111318] border border-[#1e2330] rounded-lg animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="bg-[#111318] border border-[#1e2330] rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#1e2330] text-xs text-gray-500">
                    <th className="text-left px-4 py-2.5">Player</th>
                    <th className="text-left px-4 py-2.5 hidden sm:table-cell">Position</th>
                    <th className="text-right px-4 py-2.5">Price</th>
                    <th className="text-center px-4 py-2.5">Scout status</th>
                    <th className="text-right px-4 py-2.5"></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPlayers.map(p => {
                    const revealed = isRevealed(p.id)
                    const pending  = isPending(p.id)
                    const grade    = gradeFor(p)
                    const scout    = scoutsMap[p.id]

                    return (
                      <tr key={p.id} className="border-b border-[#1e2330] last:border-0 hover:bg-[#161a21] transition-colors">
                        <td className="px-4 py-3">
                          <div className="font-medium text-white text-sm">{p.name}</div>
                          <div className="text-xs text-gray-600">{p.club}</div>
                        </td>
                        <td className="px-4 py-3 hidden sm:table-cell text-gray-400 text-xs">{p.position}</td>
                        <td className="px-4 py-3 text-right text-white font-medium tabular-nums">
                          £{Number(p.current_price).toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {revealed ? (
                            <div className="flex items-center justify-center gap-1.5">
                              <GradePill grade={grade?.grade} />
                              <span className="text-[10px] text-gray-500">{grade ? GRADE_META[grade.grade]?.label : '—'}</span>
                            </div>
                          ) : pending ? (
                            <span className="text-[10px] text-amber-500/80">
                              Scouts en route · MD{scout.reveals_at_matchday}
                            </span>
                          ) : (
                            <span className="text-[10px] text-gray-600">Not scouted</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {!revealed && !pending && (
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => sendScouts(p)}
                                disabled={scoutsFull || balance < SEND_SCOUT_COST}
                                className="text-[11px] px-2 py-1 rounded border border-[#1e2330] text-gray-400 hover:text-white hover:border-gray-600 transition-colors whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed"
                              >
                                Send £{SEND_SCOUT_COST}
                              </button>
                              <button
                                onClick={() => scoutNow(p)}
                                disabled={scoutsFull || balance < INSTANT_SCOUT_COST}
                                className="text-[11px] px-2 py-1 rounded border border-amber-500/30 text-amber-400 hover:bg-amber-500/10 transition-colors whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed"
                              >
                                Instant £{INSTANT_SCOUT_COST}
                              </button>
                            </div>
                          )}
                          {pending && (
                            <span className="text-[10px] text-gray-600">Pending</span>
                          )}
                          {revealed && (
                            <span className="text-[10px] text-green-500/60">Revealed</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                  {filteredPlayers.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-10 text-center text-gray-600 text-sm">No players found</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

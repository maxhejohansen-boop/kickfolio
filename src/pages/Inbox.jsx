import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'

function InterviewPanel({ message, onRespond }) {
  const meta    = message.metadata ?? {}
  const options = meta.options ?? []
  const responded    = meta.responded ?? false
  const chosenId     = meta.chosen_option ?? null
  const resolvedEffect = meta.resolved_effect ?? null
  const [submitting, setSubmitting] = useState(null)

  const chosenOption = options.find(o => o.id === chosenId)

  async function respond(optionId) {
    setSubmitting(optionId)
    const { data, error } = await supabase.rpc('respond_to_interview', {
      p_message_id: message.id,
      p_option_id:  optionId,
    })
    if (!error && data?.success) {
      const newMeta = {
        ...meta,
        responded:       true,
        chosen_option:   optionId,
        resolved_effect: data.effect,
      }
      onRespond(message.id, newMeta)
    }
    setSubmitting(null)
  }

  function effectLabel(effect) {
    if (!effect) return null
    if (effect.type === 'balance') return `+£${Number(effect.amount).toFixed(2)} added to your wallet`
    if (effect.type === 'balance_gamble') {
      const success = effect.resolved_success ?? false
      const amount  = Number(effect.resolved_amount ?? 0)
      return success
        ? `Negotiation successful — +£${amount.toFixed(2)} added to your wallet`
        : `They didn't budge. No payment received.`
    }
    return null
  }

  const label = effectLabel(responded ? resolvedEffect : null)

  return (
    <div className="mt-6 pt-6 border-t border-[#1e2330]">
      {meta.question && (
        <div className="mb-5 p-4 bg-[#1a1f28] border border-[#1e2330] rounded-lg">
          <div className="text-[10px] text-gray-600 font-semibold uppercase tracking-wider mb-1.5">The question</div>
          <p className="text-white text-sm font-medium leading-snug">{meta.question}</p>
        </div>
      )}

      <div className="text-[10px] text-gray-600 font-semibold uppercase tracking-wider mb-3">
        {responded ? 'Your response' : 'Choose your response'}
      </div>

      {responded ? (
        <div className="space-y-3">
          <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
            <div className="flex items-start gap-2">
              <svg className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
              </svg>
              <div>
                <div className="text-xs text-green-400 font-semibold mb-1">{chosenOption?.label}</div>
                <p className="text-gray-300 text-sm italic">"{chosenOption?.text}"</p>
              </div>
            </div>
          </div>
          {label && (
            <div className="px-4 py-2.5 bg-[#1a1f28] border border-[#1e2330] rounded-lg text-sm text-gray-400">
              {label}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {options.map(opt => (
            <button
              key={opt.id}
              onClick={() => respond(opt.id)}
              disabled={submitting !== null}
              className="w-full text-left p-4 bg-[#111318] border border-[#1e2330] hover:border-gray-500 hover:bg-[#1a1f28] rounded-lg transition-colors group disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="flex items-center justify-between gap-3 mb-1">
                <span className="text-sm text-white font-medium group-hover:text-green-400 transition-colors">
                  {submitting === opt.id ? 'Submitting…' : opt.label}
                </span>
                {opt.effect?.type === 'balance' && (
                  <span className="text-xs text-green-400 font-semibold flex-shrink-0">+£{opt.effect.amount}</span>
                )}
                {opt.effect?.type === 'balance_gamble' && (
                  <span className="text-xs text-amber-400 font-semibold flex-shrink-0">+£{opt.effect.amount}?</span>
                )}
              </div>
              <p className="text-gray-500 text-xs italic">"{opt.text}"</p>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

const TYPE_META = {
  bill:         { label: 'Bill',    short: 'BILL',   color: 'text-red-400',    bar: 'bg-red-500',    chip: 'bg-red-500/10 text-red-400 border-red-500/20' },
  scout_report: { label: 'Report',  short: 'REPORT', color: 'text-green-400',  bar: 'bg-green-500',  chip: 'bg-green-500/10 text-green-400 border-green-500/20' },
  tip:          { label: 'Tip',     short: 'TIP',    color: 'text-amber-400',  bar: 'bg-amber-400',  chip: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
  news:         { label: 'News',    short: 'NEWS',   color: 'text-blue-400',   bar: 'bg-blue-500',   chip: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
  interview:    { label: 'Media',   short: 'MEDIA',  color: 'text-purple-400', bar: 'bg-purple-500', chip: 'bg-purple-500/10 text-purple-400 border-purple-500/20' },
}

const TABS = [
  { key: 'all',          label: 'All' },
  { key: 'unread',       label: 'Unread' },
  { key: 'interview',    label: 'Media' },
  { key: 'scout_report', label: 'Reports' },
  { key: 'tip',          label: 'Tips' },
  { key: 'news',         label: 'News' },
  { key: 'bill',         label: 'Bills' },
]

function msgTime(ts) {
  return new Date(ts).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

function groupByDate(msgs) {
  const today     = new Date().toDateString()
  const yesterday = new Date(Date.now() - 86400000).toDateString()
  const map = new Map()
  for (const m of msgs) {
    const d  = new Date(m.created_at)
    const ds = d.toDateString()
    const label = ds === today ? 'Today' : ds === yesterday ? 'Yesterday'
      : d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
    if (!map.has(label)) map.set(label, [])
    map.get(label).push(m)
  }
  return [...map.entries()].map(([date, items]) => ({ date, items }))
}

export default function Inbox() {
  const { user, refreshUserRecord } = useAuth()
  const [messages,  setMessages]  = useState([])
  const [selected,  setSelected]  = useState(null)
  const [tab,       setTab]       = useState('all')
  const [loading,   setLoading]   = useState(true)

  useEffect(() => {
    if (!user) return
    load()
    const ch = supabase.channel('inbox-rt')
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'inbox_messages',
        filter: `user_id=eq.${user.id}`,
      }, ({ new: row }) => setMessages(prev => [row, ...prev]))
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [user])

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('inbox_messages')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(200)
    setMessages(data ?? [])
    setLoading(false)
  }

  async function open(msg) {
    setSelected(msg)
    if (!msg.read) {
      await supabase.from('inbox_messages').update({ read: true }).eq('id', msg.id)
      setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, read: true } : m))
    }
  }

  async function markAllRead() {
    await supabase.from('inbox_messages').update({ read: true }).eq('user_id', user.id).eq('read', false)
    setMessages(prev => prev.map(m => ({ ...m, read: true })))
  }

  function handleInterviewResponse(msgId, newMeta) {
    const update = m => m.id === msgId ? { ...m, metadata: newMeta } : m
    setMessages(prev => prev.map(update))
    setSelected(prev => prev?.id === msgId ? { ...prev, metadata: newMeta } : prev)
    refreshUserRecord()
  }

  async function deleteMsg(id) {
    await supabase.from('inbox_messages').delete().eq('id', id)
    setMessages(prev => prev.filter(m => m.id !== id))
    if (selected?.id === id) setSelected(null)
  }

  const unreadCount = messages.filter(m => !m.read).length

  const filtered = messages.filter(m => {
    if (tab === 'all')    return true
    if (tab === 'unread') return !m.read
    return m.type === tab
  })

  const tabBadge = key => {
    if (key === 'all') return null
    const cnt = key === 'unread'
      ? unreadCount
      : messages.filter(m => m.type === key && !m.read).length
    return cnt > 0 ? cnt : null
  }

  const groups = groupByDate(filtered)
  const selMeta = selected ? TYPE_META[selected.type] ?? TYPE_META.news : null

  return (
    <div className="flex overflow-hidden" style={{ height: 'calc(100vh - 3.5rem)' }}>

      {/* ── List panel ──────────────────────────────────────────────── */}
      <div className={`flex flex-col border-r border-[#1e2330] flex-shrink-0 bg-[#111318] ${selected ? 'hidden lg:flex lg:w-[360px]' : 'flex-1 lg:flex lg:w-[360px]'}`}>

        {/* Filter chips */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-[#1e2330] overflow-x-auto flex-shrink-0">
          {TABS.map(({ key, label }) => {
            const badge  = tabBadge(key)
            const active = tab === key
            return (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                  active
                    ? 'bg-green-500 text-black'
                    : 'bg-[#111318] border border-[#1e2330] text-gray-400 hover:text-white'
                }`}
              >
                {label}
                {badge && (
                  <span className={`text-[10px] font-bold rounded-full px-1.5 py-0.5 leading-none ${active ? 'bg-black/20 text-black' : 'bg-[#1e2330] text-gray-300'}`}>
                    {badge > 99 ? '99+' : badge}
                  </span>
                )}
              </button>
            )
          })}
          <button
            onClick={markAllRead}
            disabled={unreadCount === 0}
            className="ml-auto text-gray-600 hover:text-gray-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex-shrink-0"
            title="Mark all as read"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
            </svg>
          </button>
        </div>

        {/* Message list */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-3 space-y-1">
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className="h-14 bg-[#1a1f28] rounded animate-pulse" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-6">
              <p className="text-gray-500 text-sm">No messages</p>
              <p className="text-gray-700 text-xs mt-1">Run a matchday to start receiving messages</p>
            </div>
          ) : (
            groups.map(({ date, items }) => (
              <div key={date}>
                {/* Date group header */}
                <div className="px-4 pt-4 pb-1.5 sticky top-0 z-10 bg-[#111318]">
                  <span className="text-[10px] text-gray-600 font-semibold uppercase tracking-widest">{date}</span>
                </div>

                {items.map(msg => {
                  const isSelected = selected?.id === msg.id
                  const typeMeta   = TYPE_META[msg.type] ?? TYPE_META.news
                  return (
                    <div
                      key={msg.id}
                      onClick={() => open(msg)}
                      className={`relative flex items-stretch cursor-pointer transition-colors border-b border-[#1e2330]/40 ${
                        isSelected
                          ? 'bg-[#1a2518]'
                          : 'hover:bg-[#1a1f28]'
                      }`}
                    >
                      {/* Type colour bar */}
                      <div className={`w-0.5 flex-shrink-0 ${isSelected ? typeMeta.bar : 'bg-transparent'}`} />

                      {/* Unread dot column */}
                      <div className="flex items-center justify-center w-5 flex-shrink-0">
                        {!msg.read && <span className={`w-1.5 h-1.5 rounded-full ${typeMeta.bar}`} />}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0 py-3 pr-4">
                        <div className="flex items-center justify-between gap-2 mb-0.5">
                          <span className={`text-sm truncate ${msg.read ? 'text-gray-500 font-normal' : 'text-white font-semibold'}`}>
                            {msg.sender}
                          </span>
                          <span className="text-[11px] text-gray-600 flex-shrink-0 tabular-nums">{msgTime(msg.created_at)}</span>
                        </div>
                        <div className={`text-sm truncate ${msg.read ? 'text-gray-600' : 'text-gray-300'}`}>
                          {msg.subject}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            ))
          )}
        </div>
      </div>

      {/* ── Detail pane ─────────────────────────────────────────────── */}
      {selected ? (
        <div className="flex-1 flex flex-col bg-[#0d0e13] overflow-hidden">

          {/* Header */}
          <div className="flex-shrink-0 border-b border-[#1e2330] px-6 py-5">
            <div className="flex items-start gap-3 mb-3">
              <button
                onClick={() => setSelected(null)}
                className="lg:hidden text-gray-500 hover:text-white mt-0.5 flex-shrink-0 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
                </svg>
              </button>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase tracking-wider ${selMeta.chip}`}>
                    {selMeta.label}
                  </span>
                  <span className="text-gray-600 text-xs">{selected.sender}</span>
                </div>
                <h2 className="text-white font-semibold text-lg leading-snug">{selected.subject}</h2>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                <span className="text-gray-600 text-xs tabular-nums">{msgTime(selected.created_at)}</span>
                <button
                  onClick={() => deleteMsg(selected.id)}
                  className="text-gray-600 hover:text-red-400 transition-colors"
                  title="Delete"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-6 py-6">
            <div className="max-w-xl">
              <p className="text-gray-300 text-sm leading-7 whitespace-pre-line">
                {selected.body}
              </p>
              {selected.type === 'interview' && (
                <InterviewPanel
                  message={selected}
                  onRespond={handleInterviewResponse}
                />
              )}
            </div>
          </div>

          {/* Action bar — hidden for interviews (options are inline) */}
          {selected.type !== 'interview' && (
          <div className="flex-shrink-0 border-t border-[#1e2330] bg-[#111318] px-6 py-3 flex items-center gap-3">
            <span className="text-gray-600 text-xs font-medium uppercase tracking-wider">Action</span>
            <div className="w-px h-4 bg-[#1e2330]" />
            {selected.type === 'scout_report' && (
              <Link
                to="/scouting"
                className="text-xs bg-green-500 hover:bg-green-400 text-black font-bold px-4 py-1.5 rounded transition-colors"
              >
                View in Scouting →
              </Link>
            )}
            {(selected.type === 'tip' || selected.type === 'news') && (
              <Link
                to="/market"
                className="text-xs bg-green-500 hover:bg-green-400 text-black font-bold px-4 py-1.5 rounded transition-colors"
              >
                Open Market →
              </Link>
            )}
            {selected.type === 'bill' && (
              <Link
                to="/portfolio"
                className="text-xs bg-[#1e2330] hover:bg-[#252d3d] text-gray-300 font-medium px-4 py-1.5 rounded border border-[#2a3344] transition-colors"
              >
                View Portfolio →
              </Link>
            )}
          </div>
          )}
        </div>
      ) : (
        <div className="hidden lg:flex flex-1 items-center justify-center bg-[#0d0e13]">
          <p className="text-gray-700 text-sm select-none">Select a message to read it</p>
        </div>
      )}
    </div>
  )
}

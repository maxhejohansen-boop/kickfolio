import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'

const TYPE_META = {
  bill:         { icon: '💸', dot: 'bg-red-400' },
  scout_report: { icon: '🔍', dot: 'bg-violet-400' },
  tip:          { icon: '💡', dot: 'bg-amber-400' },
  news:         { icon: '📰', dot: 'bg-blue-400' },
  interview:    { icon: '🎤', dot: 'bg-pink-400' },
}

const TABS = [
  { key: 'all',          label: 'All' },
  { key: 'unread',       label: 'Unread' },
  { key: 'scout_report', label: 'Reports' },
  { key: 'tip',          label: 'Tips' },
  { key: 'news',         label: 'News' },
  { key: 'bill',         label: 'Bills' },
]

function msgTime(ts) {
  return new Date(ts).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

function groupByDate(msgs) {
  const today = new Date().toDateString()
  const yesterday = new Date(Date.now() - 86400000).toDateString()
  const map = new Map()
  for (const m of msgs) {
    const d = new Date(m.created_at)
    const ds = d.toDateString()
    const label = ds === today ? 'Today' : ds === yesterday ? 'Yesterday'
      : d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
    if (!map.has(label)) map.set(label, [])
    map.get(label).push(m)
  }
  return [...map.entries()].map(([date, items]) => ({ date, items }))
}

function Avatar({ type, size = 'sm' }) {
  const meta = TYPE_META[type] ?? TYPE_META.news
  return (
    <div className={`rounded-full bg-[#252740] border border-[#2e3050] flex items-center justify-center flex-shrink-0 ${size === 'lg' ? 'w-12 h-12 text-xl' : 'w-9 h-9 text-sm'}`}>
      {meta.icon}
    </div>
  )
}

export default function Inbox() {
  const { user } = useAuth()
  const [messages, setMessages] = useState([])
  const [selected, setSelected] = useState(null)
  const [tab, setTab] = useState('all')
  const [loading, setLoading] = useState(true)

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

  return (
    <div className="flex overflow-hidden" style={{ height: 'calc(100vh - 3.5rem)' }}>

      {/* ── List panel ──────────────────────────────────────────────── */}
      <div className={`flex flex-col bg-[#15162a] border-r border-[#1e2040] flex-shrink-0 ${selected ? 'hidden lg:flex lg:w-[380px]' : 'flex-1 lg:flex lg:w-[380px]'}`}>

        {/* Tab bar */}
        <div className="flex items-center border-b border-[#1e2040] px-2 flex-shrink-0 overflow-x-auto">
          {TABS.map(({ key, label }) => {
            const badge = tabBadge(key)
            const active = tab === key
            return (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`relative flex items-center gap-1.5 px-3 py-3 text-[13px] font-medium transition-colors whitespace-nowrap ${
                  active ? 'text-white border-b-2 border-violet-500' : 'text-[#6b7080] hover:text-[#9ca3af]'
                }`}
              >
                {label}
                {badge && (
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none ${active ? 'bg-violet-600 text-white' : 'bg-[#252740] text-[#9ca3af]'}`}>
                    {badge > 99 ? '99+' : badge}
                  </span>
                )}
              </button>
            )
          })}
          <button
            onClick={markAllRead}
            disabled={unreadCount === 0}
            className="ml-auto p-2 text-[#6b7080] hover:text-white disabled:opacity-25 disabled:cursor-not-allowed transition-colors flex-shrink-0"
            title="Mark all as read"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
            </svg>
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-3 space-y-1">
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className="h-[62px] bg-[#1e2040] rounded animate-pulse" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full py-20 text-center px-6">
              <div className="text-3xl mb-3 opacity-20">📭</div>
              <p className="text-[#6b7080] text-sm">No messages</p>
              <p className="text-[#4b5060] text-xs mt-1">Run a matchday to start receiving messages</p>
            </div>
          ) : (
            groups.map(({ date, items }) => (
              <div key={date}>
                <div className="px-4 pt-3.5 pb-1.5 sticky top-0 z-10 bg-[#15162a]">
                  <span className="text-[10px] text-[#4b5060] font-semibold uppercase tracking-widest">{date}</span>
                </div>

                {items.map(msg => {
                  const isSelected = selected?.id === msg.id
                  const typeMeta = TYPE_META[msg.type] ?? TYPE_META.news
                  return (
                    <div
                      key={msg.id}
                      onClick={() => open(msg)}
                      className={`relative flex items-center gap-3 pl-6 pr-4 py-3 cursor-pointer transition-colors border-l-2 ${
                        isSelected
                          ? 'bg-violet-900/40 border-violet-500'
                          : 'border-transparent hover:bg-[#1e2040]/70'
                      }`}
                    >
                      {!msg.read && (
                        <span className={`absolute left-2 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full ${typeMeta.dot}`} />
                      )}

                      <Avatar type={msg.type} />

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-0.5">
                          <span className={`text-[13px] truncate leading-none ${msg.read ? 'text-[#9ca3af] font-normal' : 'text-white font-semibold'}`}>
                            {msg.sender}
                          </span>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            {msg.read && (
                              <svg className="w-3 h-3 text-violet-500/70" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                              </svg>
                            )}
                            <span className="text-[11px] text-[#4b5060]">{msgTime(msg.created_at)}</span>
                          </div>
                        </div>
                        <div className={`text-[13px] truncate leading-snug ${msg.read ? 'text-[#4b5060]' : 'text-[#b0b4cc]'}`}>
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
        <div className="flex-1 flex flex-col bg-[#1a1b2f] overflow-hidden">

          {/* Header */}
          <div className="flex items-start gap-4 px-6 py-5 border-b border-[#1e2040] flex-shrink-0">
            <button
              onClick={() => setSelected(null)}
              className="lg:hidden text-[#6b7080] hover:text-white mt-0.5 flex-shrink-0"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
              </svg>
            </button>

            <Avatar type={selected.type} size="lg" />

            <div className="flex-1 min-w-0">
              <div className="text-[#9ca3af] text-[13px] mb-0.5">{selected.sender}</div>
              <div className="text-white font-semibold text-[17px] leading-snug">{selected.subject}</div>
            </div>

            <div className="flex items-center gap-3 flex-shrink-0 mt-1">
              <span className="text-[#4b5060] text-sm tabular-nums">{msgTime(selected.created_at)}</span>
              <button
                onClick={() => deleteMsg(selected.id)}
                className="text-[#4b5060] hover:text-red-400 transition-colors"
                title="Delete"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                </svg>
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-6 py-6">
            <div className="max-w-2xl">
              <p className="text-[#c4c6d8] text-sm leading-7 whitespace-pre-line font-mono">
                {selected.body}
              </p>
            </div>
          </div>

          {/* Action bar */}
          <div className="flex-shrink-0 border-t border-[#1e2040]">
            <div className="flex items-center gap-4 px-6 py-3.5 bg-gradient-to-r from-violet-900/40 to-transparent">
              <span className="text-[#9ca3af] text-[13px] font-semibold tracking-wide">Action message</span>
              <div className="w-px h-4 bg-[#1e2040]" />
              {selected.type === 'scout_report' && (
                <Link
                  to="/scouting"
                  className="text-[13px] bg-violet-700 hover:bg-violet-600 text-white font-medium px-4 py-1.5 rounded transition-colors"
                >
                  View in Scouting →
                </Link>
              )}
              {(selected.type === 'tip' || selected.type === 'news') && (
                <Link
                  to="/market"
                  className="text-[13px] bg-violet-700 hover:bg-violet-600 text-white font-medium px-4 py-1.5 rounded transition-colors"
                >
                  Open Market →
                </Link>
              )}
              {selected.type === 'bill' && (
                <Link
                  to="/portfolio"
                  className="text-[13px] bg-violet-700 hover:bg-violet-600 text-white font-medium px-4 py-1.5 rounded transition-colors"
                >
                  View Portfolio →
                </Link>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="hidden lg:flex flex-1 items-center justify-center bg-[#1a1b2f]">
          <div className="text-center select-none">
            <div className="text-5xl mb-4 opacity-10">📬</div>
            <p className="text-[#4b5060] text-sm">Select a message to read it</p>
          </div>
        </div>
      )}
    </div>
  )
}

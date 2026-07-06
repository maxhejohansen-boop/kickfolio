import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useTutorial } from '../lib/TutorialContext'

const TOTAL = 11
const PAD = 14

const STEP_TARGETS = {
  1: null, 2: 'balance', 3: 'market-grid', 4: 'player-card', 5: 'grade-badge',
  6: 'market-filters', 7: null, 8: 'portfolio-table', 9: 'leaderboard-table',
  10: 'matchday-info', 11: null,
}

const MESSAGES = {
  1:    "Hi! I'm Bobby. Welcome to Kickfolio — the place where football players are stocks and every match moves the market. Give me two minutes and I'll show you around. Ready?",
  2:    "This is your bank — £100,000 to start. Every trade you make will change this number. Grow it, and you climb the leaderboard.",
  3:    "This is the Market. Every player here is a share you can buy. Each one has a live price that moves after every matchday based on how they actually performed.",
  4:    "Each card shows a player's current price, their recent form chart, and their stats. Green line = price going up. Red line = trouble.",
  5:    "See this letter? That's the grade. It tells you if a player is a smart buy right now. A = Strong Buy. B = Buy. C = Fair Value. D = Overvalued. I calculate it from their recent form vs their price.",
  6:    "Filter by position or grade. Sort by price, recent change, goals — whatever matters to you.",
  '7a': "Let's make your first trade. Click any player card to open it.",
  '7b': "Here's the full view — price chart, stats, form. Try buying 1 share to see how it works. Don't worry, you can always sell later.",
  8:    "Boom — you're a shareholder! This is your Portfolio. Every player you own lives here with their P&L (profit and loss). Green means you're up. Red means... learning experience.",
  9:    "This is where it gets competitive. Every user is ranked by their total portfolio value. Climb the ladder, become a legend.",
  10:   "Matchdays happen automatically. When one runs, every player's stats update and their price moves. That's when your portfolio really comes alive.",
  11:   "You're all set! Buy smart, sell smarter, and check back after every matchday. If you ever want me to walk you through again, hit 'Take the tour' in the menu. Good luck, gaffer!",
}

function Bobby({ celebrate }) {
  return (
    <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" className="w-full h-full" aria-hidden="true">
      {/* Body */}
      <circle cx="50" cy="54" r="38" fill="white" stroke="#e5e7eb" strokeWidth="2"/>
      {/* Patches */}
      <polygon points="50,24 62,33 57,46 43,46 38,33" fill="#1f2937"/>
      <polygon points="22,37 37,28 39,40 26,46" fill="#374151" opacity="0.82"/>
      <polygon points="78,37 63,28 61,40 74,46" fill="#374151" opacity="0.82"/>
      <polygon points="15,57 28,51 30,64 18,70" fill="#374151" opacity="0.52"/>
      <polygon points="85,57 72,51 70,64 82,70" fill="#374151" opacity="0.52"/>
      <polygon points="34,80 42,71 58,71 66,80 50,90" fill="#374151" opacity="0.38"/>
      {/* Cheeks */}
      <ellipse cx="28" cy="36" rx="5" ry="3" fill="#fca5a5" opacity="0.55"/>
      <ellipse cx="72" cy="36" rx="5" ry="3" fill="#fca5a5" opacity="0.55"/>
      {/* Eyes */}
      <circle cx="37" cy="23" r="6.5" fill="#111827"/>
      <circle cx="63" cy="23" r="6.5" fill="#111827"/>
      <circle cx="39" cy="21" r="2.2" fill="white"/>
      <circle cx="65" cy="21" r="2.2" fill="white"/>
      {/* Smile */}
      <path d={celebrate ? "M 28 39 Q 50 56 72 39" : "M 33 38 Q 50 50 67 38"} stroke="#111827" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
      {/* Waving arm */}
      <g className="tutorial-wave" style={{ transformOrigin: '24px 50px' }}>
        <line x1="10" y1="58" x2="24" y2="48" stroke="#e5e7eb" strokeWidth="6" strokeLinecap="round"/>
        <circle cx="8" cy="62" r="7" fill="#f3f4f6" stroke="#e5e7eb" strokeWidth="1.5"/>
      </g>
    </svg>
  )
}

export default function TutorialOverlay() {
  const tutorial = useTutorial()
  const [targetRect, setTargetRect] = useState(null)
  const [visible, setVisible] = useState(false)

  const step = tutorial?.step ?? null
  const subStep = tutorial?.subStep ?? 0
  const nextStep = tutorial?.nextStep
  const prevStep = tutorial?.prevStep
  const skipTutorial = tutorial?.skipTutorial

  const measureTarget = useCallback(() => {
    if (!step) return
    const key = STEP_TARGETS[step]
    if (!key) { setTargetRect(null); return }
    // Step 5: grade badge may not exist (no matchdays yet) — fall back to the card
    let el = document.querySelector(`[data-tutorial="${key}"]`)
    if (!el && step === 5) el = document.querySelector('[data-tutorial="player-card"]')
    if (!el) { setTargetRect(null); return }
    const r = el.getBoundingClientRect()
    setTargetRect({ x: r.left, y: r.top, w: r.width, h: r.height })
  }, [step])

  useEffect(() => {
    if (!step) { setVisible(false); setTargetRect(null); return }

    const fadeIn = setTimeout(() => setVisible(true), 60)
    const key = STEP_TARGETS[step]

    if (!key) {
      setTargetRect(null)
      return () => clearTimeout(fadeIn)
    }

    const el = document.querySelector(`[data-tutorial="${key}"]`)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' })

    const measure = setTimeout(measureTarget, 450)
    return () => { clearTimeout(fadeIn); clearTimeout(measure) }
  }, [step])

  useEffect(() => {
    window.addEventListener('resize', measureTarget)
    window.addEventListener('scroll', measureTarget, { passive: true })
    return () => {
      window.removeEventListener('resize', measureTarget)
      window.removeEventListener('scroll', measureTarget)
    }
  }, [measureTarget])

  if (!step) return null

  const msg = step === 7 ? (subStep === 0 ? MESSAGES['7a'] : MESSAGES['7b']) : MESSAGES[step]
  const isFirst = step === 1
  const isLast = step === 11
  const isInteractive = step === 7
  const showBack = !isFirst && !isInteractive
  const showNext = !isInteractive

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Bobby's tour — step ${step} of ${TOTAL}`}
      style={{ position: 'fixed', inset: 0, zIndex: 10000, pointerEvents: 'none' }}
      className={`transition-opacity duration-300 ${visible ? 'opacity-100' : 'opacity-0'}`}
    >
      {/* Dim with spotlight hole — hidden during interactive steps so the game is fully usable */}
      {!isInteractive && (
        <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} xmlns="http://www.w3.org/2000/svg">
          <defs>
            <mask id="bobby-spotlight">
              <rect width="100%" height="100%" fill="white"/>
              {targetRect && (
                <rect
                  x={targetRect.x - PAD} y={targetRect.y - PAD}
                  width={targetRect.w + PAD * 2} height={targetRect.h + PAD * 2}
                  rx="10" fill="black"
                />
              )}
            </mask>
          </defs>
          <rect width="100%" height="100%" fill="rgba(0,0,0,0.73)" mask="url(#bobby-spotlight)"/>
        </svg>
      )}

      {/* Green glow ring — hidden during interactive steps */}
      {!isInteractive && targetRect && (
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            left: targetRect.x - PAD, top: targetRect.y - PAD,
            width: targetRect.w + PAD * 2, height: targetRect.h + PAD * 2,
            borderRadius: 10,
            border: '2px solid rgba(34,197,94,0.75)',
            boxShadow: '0 0 0 4px rgba(34,197,94,0.10), 0 0 28px rgba(34,197,94,0.20)',
            pointerEvents: 'none',
            animation: 'tutorial-pulse 2s ease-in-out infinite',
          }}
        />
      )}

      {/* Step 5: bouncing arrow pointing at the grade badge */}
      {step === 5 && targetRect && (
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            left: targetRect.x + targetRect.w / 2,
            top: targetRect.y - 48,
            transform: 'translateX(-50%)',
            pointerEvents: 'none',
          }}
        >
          <div className="tutorial-arrow-bounce flex flex-col items-center gap-0.5">
            <svg width="18" height="22" viewBox="0 0 18 22" fill="none">
              <path d="M9 0 L9 14 M9 14 L3 8 M9 14 L15 8" stroke="#4ade80" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M2 18 L16 18" stroke="#4ade80" strokeWidth="2.5" strokeLinecap="round" opacity="0.5"/>
              <path d="M4 21 L14 21" stroke="#4ade80" strokeWidth="2" strokeLinecap="round" opacity="0.25"/>
            </svg>
          </div>
        </div>
      )}

      {/* Progress bar */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'rgba(255,255,255,0.05)' }} aria-hidden="true">
        <div style={{
          height: '100%', width: `${(step / TOTAL) * 100}%`,
          background: 'linear-gradient(90deg, #16a34a, #4ade80)',
          transition: 'width 0.4s ease',
        }}/>
      </div>

      {/* Skip button */}
      <button
        onClick={skipTutorial}
        style={{ position: 'absolute', top: 14, right: 14, pointerEvents: 'all' }}
        className="text-xs text-gray-500 hover:text-white border border-[#2a3040] hover:border-gray-500 rounded-lg px-3 py-1.5 bg-[#0d0f14]/90 backdrop-blur-sm transition-colors"
        aria-label="Skip tutorial"
      >
        Skip tutorial
      </button>

      {/* Bobby bubble */}
      <div
        style={{ pointerEvents: 'all' }}
        className="absolute sm:bottom-6 sm:right-6 sm:w-[390px] sm:inset-x-auto bottom-0 inset-x-0"
      >
        <div
          className="bg-[#0d0f14]/96 backdrop-blur-md border border-green-500/20 rounded-t-2xl sm:rounded-2xl"
          style={{ boxShadow: '0 0 0 1px rgba(34,197,94,0.12), 0 -4px 40px rgba(34,197,94,0.07), 0 20px 60px rgba(0,0,0,0.7)' }}
        >
          <div className="p-4 flex gap-3 items-start">
            {/* Bobby character */}
            <div className={`w-16 h-16 flex-shrink-0 transition-transform ${isLast ? 'animate-bounce' : ''}`} aria-hidden="true">
              <Bobby celebrate={isLast}/>
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-green-400 text-[11px] font-black tracking-widest uppercase">Bobby</span>
                <span className="text-[#2a3040]">·</span>
                <span className="text-gray-600 text-[11px]">{step} / {TOTAL}</span>
              </div>

              <p className="text-white text-sm leading-relaxed">{msg}</p>

              <div className="flex items-center gap-2 mt-3 flex-wrap">
                {showBack && (
                  <button
                    onClick={prevStep}
                    className="text-xs text-gray-500 hover:text-gray-200 border border-[#1e2330] hover:border-gray-600 rounded-lg px-3 py-1.5 transition-colors"
                  >
                    ← Back
                  </button>
                )}

                {isFirst && (
                  <button
                    onClick={skipTutorial}
                    className="text-xs text-gray-600 hover:text-gray-400 transition-colors px-2 py-1.5"
                  >
                    Skip tour
                  </button>
                )}

                {showNext && (
                  <button
                    // eslint-disable-next-line jsx-a11y/no-autofocus
                    autoFocus
                    onClick={nextStep}
                    className={`ml-auto text-xs font-bold rounded-lg px-4 py-2 transition-all duration-150 ${
                      isFirst || isLast
                        ? 'bg-green-500 hover:bg-green-400 text-black shadow-md shadow-green-500/30 hover:scale-[1.02] active:scale-[0.98]'
                        : 'bg-green-500/15 hover:bg-green-500/25 text-green-400 border border-green-500/25'
                    }`}
                  >
                    {isFirst ? "Let's go →" : isLast ? 'Enter the market →' : 'Next →'}
                  </button>
                )}

                {isInteractive && subStep === 1 && (
                  <button
                    onClick={nextStep}
                    className="ml-auto text-xs text-gray-600 hover:text-gray-400 border border-[#1e2330] rounded-lg px-3 py-1.5 transition-colors"
                  >
                    Skip trade →
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}

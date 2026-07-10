import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from './supabase'
import { useAuth } from './AuthContext'

const TutorialContext = createContext(null)

const STEP_ROUTES = {
  1: '/market', 2: '/market', 3: '/market', 4: '/market', 5: '/market',
  6: '/market', 7: '/market', 8: '/portfolio', 9: '/inbox', 10: '/scouting',
  11: '/market', 12: '/leaderboard', 13: '/market',
}

export function TutorialProvider({ children }) {
  const { user, userRecord } = useAuth()
  const navigate = useNavigate()
  const [step, setStep] = useState(null)
  const [subStep, setSubStep] = useState(0)
  const hasAutoStarted = useRef(false)

  // Auto-start for new users, or resume saved progress
  useEffect(() => {
    if (!user || !userRecord) return
    if (hasAutoStarted.current) return
    hasAutoStarted.current = true

    const saved = localStorage.getItem('kickfolio_tutorial_step')
    if (saved === 'done') return
    if (userRecord.tutorial_completed) return

    if (saved) {
      const n = parseInt(saved, 10)
      if (!isNaN(n) && n >= 1 && n <= 13) {
        setStep(n)
        setSubStep(0)
        // Step 7 is interactive — don't forcibly redirect so users can browse freely
        if (n !== 7) navigate(STEP_ROUTES[n])
        return
      }
    }
    localStorage.setItem('kickfolio_tutorial_step', '1')
    setStep(1)
    setSubStep(0)
    navigate('/market')
  }, [user, userRecord])

  // Keyboard shortcuts
  useEffect(() => {
    if (!step) return
    function handleKey(e) {
      if (e.key === 'Escape') skipTutorial()
      if ((e.key === 'Enter' || e.key === 'ArrowRight') && step !== 7) nextStep()
      if (e.key === 'ArrowLeft') prevStep()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [step, subStep])

  function nextStep() {
    if (!step) return
    if (step === 13) { completeTutorial(); return }
    const next = step + 1
    localStorage.setItem('kickfolio_tutorial_step', String(next))
    setStep(next)
    setSubStep(0)
    navigate(STEP_ROUTES[next])
  }

  function prevStep() {
    if (!step || step <= 1) return
    const prev = step - 1
    localStorage.setItem('kickfolio_tutorial_step', String(prev))
    setStep(prev)
    setSubStep(0)
    navigate(STEP_ROUTES[prev])
  }

  async function completeTutorial() {
    localStorage.setItem('kickfolio_tutorial_step', 'done')
    setStep(null)
    if (user) {
      await supabase.from('users').update({ tutorial_completed: true }).eq('id', user.id)
    }
  }

  function skipTutorial() { completeTutorial() }

  function startTutorial() {
    localStorage.setItem('kickfolio_tutorial_step', '1')
    setStep(1)
    setSubStep(0)
    navigate('/market')
  }

  // Called from PlayerModal on mount during step 7
  function onPlayerModalOpen() {
    if (step === 7 && subStep === 0) setSubStep(1)
  }

  // Called from PlayerModal after a successful buy during step 7
  function onTradeCompleted() {
    if (step === 7) nextStep()
  }

  return (
    <TutorialContext.Provider value={{
      step, subStep,
      nextStep, prevStep, skipTutorial, startTutorial, completeTutorial,
      onPlayerModalOpen, onTradeCompleted,
      isActive: step !== null,
    }}>
      {children}
    </TutorialContext.Provider>
  )
}

export function useTutorial() {
  return useContext(TutorialContext)
}

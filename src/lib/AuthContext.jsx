import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from './supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [userRecord, setUserRecord] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchUserRecord(session.user.id)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchUserRecord(session.user.id)
      else setUserRecord(null)
    })

    return () => subscription.unsubscribe()
  }, [])

  async function fetchUserRecord(userId) {
    const { data } = await supabase.from('users').select('*').eq('id', userId).single()
    setUserRecord(data)
  }

  async function refreshUserRecord() {
    if (user) await fetchUserRecord(user.id)
  }

  return (
    <AuthContext.Provider value={{ user, userRecord, loading, refreshUserRecord }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}

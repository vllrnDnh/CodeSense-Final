import React, { createContext, useContext, useState, useEffect } from 'react'
import type { ReactNode } from 'react'
import { DataIsolationService } from '../Dataisolationservice'
import { DatabaseService } from '../services/DatabaseService'
import type { ExplorerProfile } from '../types'
interface AuthContextType {
  user: ExplorerProfile | null
  isGuest: boolean
  isAuthenticated: boolean
  setUser: React.Dispatch<React.SetStateAction<ExplorerProfile | null>>
  login: (playerName: string, secretCode: string) => Promise<void>
  signup: (
    playerName: string,
    secretCode: string,
    email: string,                                  // ← add this
    characterType: ExplorerProfile['characterType']
  ) => Promise<void>
  logout: () => void
  continueAsGuest: () => void
  goBack: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<ExplorerProfile | null>(null)
  const [isGuest, setIsGuest] = useState(false)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  // On app load: restore existing Supabase session (works on refresh)
  useEffect(() => {
    const restoreSession = async () => {
      try {
        // Check for guest mode first
        const guestMode = sessionStorage.getItem('guestMode')
        if (guestMode === 'true') {
          setIsGuest(true)
          setIsLoading(false)
          return
        }

        // Try to restore Supabase auth session
        const profile = await DatabaseService.restoreSession()
        if (profile) {
          setUser(profile)
          setIsAuthenticated(true)
        }
      } catch (error) {
        console.error('Session restore failed:', error)
      } finally {
        setIsLoading(false)
      }
    }

    restoreSession()
  }, [])

  // LOGIN: Supabase Auth handles everything
  const login = async (playerName: string, secretCode: string) => {
    const profile = await DatabaseService.login(playerName, secretCode)
    // No need to store in localStorage — Supabase manages the session token
    sessionStorage.removeItem('guestMode')
    setUser(profile)
    setIsAuthenticated(true)
    setIsGuest(false)
  }

  // SIGNUP: Supabase Auth + public.users row via trigger
const signup = async (
  playerName: string,
  secretCode: string,
  email: string,                                    // ← add this
  characterType: ExplorerProfile['characterType']
) => {
  const profile = await DatabaseService.signUp(
    playerName,
    secretCode,
    email,                                          // ← pass it through
    characterType
  )
  sessionStorage.removeItem('guestMode')

  // Migrate any guest sandbox files to the new user account
  DataIsolationService.migrateGuestToUser(profile.id)

  setUser(profile)
  setIsAuthenticated(true)
  setIsGuest(false)
}

  // LOGOUT: Clears Supabase session
  const logout = () => {
    DatabaseService.logout()
    sessionStorage.removeItem('guestMode')
    setUser(null)
    setIsAuthenticated(false)
    setIsGuest(false)
  }

  // GUEST: Session-only, no Supabase auth
  const continueAsGuest = () => {
    sessionStorage.setItem('guestMode', 'true')
    setIsGuest(true)
    setIsAuthenticated(false)
    setUser(null)
  }

  const goBack = () => {
    window.history.back()
  }

  // Show nothing while restoring session to prevent flash of login screen
  if (isLoading) {
    return (
      <div style={{
        minHeight: '100vh',
        background: '#0d1117',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#8b949e',
        fontSize: '16px'
      }}>
        Loading CodeSense...
      </div>
    )
  }

  return (
    <AuthContext.Provider value={{
      user, setUser, isGuest, isAuthenticated,
      login, signup, logout, continueAsGuest, goBack
    }}>
      {children}
    </AuthContext.Provider>
  )
}
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { api, setUnauthorizedHandler } from '../api/client.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  // 'loading' | 'authenticated' | 'unauthenticated'
  const [status, setStatus] = useState('loading')
  const [user, setUser] = useState(null)

  const refreshStatus = useCallback(async () => {
    try {
      const me = await api.get('/v1/auth/me')
      setUser(me)
      setStatus('authenticated')
    } catch {
      setUser(null)
      setStatus('unauthenticated')
    }
  }, [])

  useEffect(() => {
    refreshStatus()
  }, [refreshStatus])

  useEffect(() => {
    setUnauthorizedHandler(() => {
      setUser(null)
      setStatus((s) => (s === 'authenticated' ? 'unauthenticated' : s))
    })
    return () => setUnauthorizedHandler(null)
  }, [])

  // Does not sign the user in — registration just creates the account.
  const register = async ({ fullName, email, password, confirmPassword }) => {
    await api.post('/v1/auth/register', { fullName, email, password, confirmPassword })
  }

  const login = async ({ email, password }) => {
    const me = await api.post('/v1/auth/login', { email, password })
    setUser(me)
    setStatus('authenticated')
  }

  const logout = async () => {
    try {
      await api.post('/v1/auth/logout')
    } finally {
      setUser(null)
      setStatus('unauthenticated')
    }
  }

  return (
    <AuthContext.Provider value={{ status, user, register, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

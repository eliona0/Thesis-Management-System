import { useCallback, useEffect, useMemo, useState } from 'react'
import AuthContext from './auth-context'
import api, { AUTH_INVALID_EVENT, TOKEN_STORAGE_KEY } from '../services/api'

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_STORAGE_KEY)
    setUser(null)
  }, [])

  const refreshUser = useCallback(async () => {
    const token = localStorage.getItem(TOKEN_STORAGE_KEY)
    if (!token) {
      setUser(null)
      return null
    }
    try {
      const { data } = await api.get('/auth/me')
      setUser(data.user || null)
      return data.user || null
    } catch (error) {
      if (error.response?.status !== 401) throw error
      setUser(null)
      return null
    }
  }, [])

  const login = useCallback(async ({ email, password }) => {
    const { data } = await api.post('/auth/login', { email, password })
    if (!data.token || !data.user) throw new Error('The server returned an incomplete login response.')
    localStorage.setItem(TOKEN_STORAGE_KEY, data.token)
    setUser(data.user)
    return data.user
  }, [])

  useEffect(() => {
    let mounted = true
    const load = async () => {
      try {
        await refreshUser()
      } catch {
        if (mounted) setUser(null)
      } finally {
        if (mounted) setLoading(false)
      }
    }
    const handleInvalid = () => setUser(null)
    window.addEventListener(AUTH_INVALID_EVENT, handleInvalid)
    load()
    return () => {
      mounted = false
      window.removeEventListener(AUTH_INVALID_EVENT, handleInvalid)
    }
  }, [refreshUser])

  const value = useMemo(() => ({
    user,
    loading,
    authenticated: Boolean(user),
    login,
    logout,
    refreshUser,
    loadCurrentUser: refreshUser,
  }), [user, loading, login, logout, refreshUser])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

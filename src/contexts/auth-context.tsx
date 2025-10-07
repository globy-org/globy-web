"use client"

import { createContext, useCallback, useContext, useMemo, useState } from "react"

type User = { id: string; email: string; name?: string } | null

type AuthContextValue = {
  user: User
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User>(null)
  const [isLoading, setIsLoading] = useState(false)

  const login = useCallback(async (email: string, _password: string) => {
    setIsLoading(true)
    try {
      // TODO: ここを実APIに差し替え
      await new Promise((r) => setTimeout(r, 300))
      setUser({ id: "dummy", email })
    } finally {
      setIsLoading(false)
    }
  }, [])

  const logout = useCallback(async () => {
    setIsLoading(true)
    try {
      // TODO: ここを実APIに差し替え
      await new Promise((r) => setTimeout(r, 150))
      setUser(null)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const value = useMemo(() => ({ user, isLoading, login, logout }), [user, isLoading, login, logout])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>")
  return ctx
}

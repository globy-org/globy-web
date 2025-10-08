"use client"

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react"

type User = { id: number; email: string; name?: string } | null

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

  // Cookie中のJWTを使ってセッション復元（/api/me は同一オリジンでCookie自動送信）
  useEffect(() => {
    let aborted = false
    ;(async () => {
      setIsLoading(true)
      try {
        const res = await fetch("/api/me", {
          credentials: "include",
          cache: "no-store",
        })
        if (!aborted) {
          if (res.ok) {
            const data = await res.json()
            setUser(data?.user ?? null)
          } else {
            setUser(null)
          }
        }
      } catch {
        if (!aborted) setUser(null)
      } finally {
        if (!aborted) setIsLoading(false)
      }
    })()
    return () => {
      aborted = true
    }
  }, [])

  // ログイン（Next.js API経由でHttpOnly Cookieをセット）
  const login = useCallback(async (email: string, password: string) => {
    setIsLoading(true)
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include", // Set-Cookie の受信
        body: JSON.stringify({ email, password }),
      })
      if (!res.ok) {
        const msg = await extractErrorMessage(res)
        throw new Error(msg || "Unauthorized")
      }
      const data = await res.json()
      setUser(data?.user ?? null)
    } finally {
      setIsLoading(false)
    }
  }, [])

  // ログアウト（Cookie破棄）
  const logout = useCallback(async () => {
    setIsLoading(true)
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      })
    } finally {
      setUser(null)
      setIsLoading(false)
    }
  }, [])

  const value = useMemo(
    () => ({ user, isLoading, login, logout }),
    [user, isLoading, login, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error("useAuth must be used within <AuthProvider>")
  }
  return ctx
}

async function extractErrorMessage(res: Response): Promise<string> {
  try {
    const json = await res.json()
    if (typeof json?.error === "string") return json.error
    if (Array.isArray(json?.errors)) return json.errors.join(", ")
    return ""
  } catch {
    return ""
  }
}

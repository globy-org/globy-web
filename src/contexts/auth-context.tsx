// src/contexts/auth-context.tsx
"use client"

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"

type User = { id: number; email: string; name?: string } | null

type AuthContextValue = {
  user: User
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User>(null)
  const [isLoading, setIsLoading] = useState(false)

  // -------- helpers --------
  async function fetchMe(signal?: AbortSignal): Promise<User> {
    const res = await fetch("/api/me", {
      credentials: "include",
      cache: "no-store",
      signal,
    })
    if (!res.ok) return null
    const data = (await res.json()) as { user?: User } | null
    return data?.user ?? null
  }

  async function extractErrorMessage(res: Response): Promise<string> {
    try {
      const json = (await res.json()) as unknown
      if (json && typeof json === "object") {
        const obj = json as Record<string, unknown>
        if (typeof obj.error === "string") return obj.error
        if (Array.isArray(obj.errors)) return obj.errors.join(", ")
      }
      return ""
    } catch {
      return ""
    }
  }

  // -------- セッション復元（CookieのJWTを使う） --------
  useEffect(() => {
    const ac = new AbortController()
    ;(async () => {
      setIsLoading(true)
      try {
        const u = await fetchMe(ac.signal)
        setUser(u)
      } catch {
        setUser(null)
      } finally {
        if (!ac.signal.aborted) setIsLoading(false)
      }
    })()
    return () => ac.abort()
  }, [])

  // -------- ログイン（Cookie をサーバ側でセット） --------
  const login = useCallback(async (email: string, password: string) => {
    setIsLoading(true)
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include", // Set-Cookie を受け取る
        body: JSON.stringify({ email, password }),
      })

      if (!res.ok) {
        const msg = await extractErrorMessage(res)
        throw new Error(msg || "Unauthorized")
      }

      // レスポンス本文に user がなくても、Cookie が付いた状態で /api/me を取り直して確実に復元
      const u = await fetchMe()
      setUser(u)
    } finally {
      setIsLoading(false)
    }
  }, [])

  // -------- ログアウト（Cookie破棄） --------
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

  const value = useMemo<AuthContextValue>(
    () => ({ user, isLoading, login, logout }),
    [user, isLoading, login, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>")
  return ctx
}

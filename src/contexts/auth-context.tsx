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

type AuthProviderProps = {
  children: ReactNode
  /** 公開ページ（/login, /signup）では false にすると /api/me を呼ばない */
  autoLoad?: boolean
}

export function AuthProvider({ children, autoLoad = true }: AuthProviderProps) {
  const [user, setUser] = useState<User>(null)
  const [isLoading, setIsLoading] = useState(false)

  // -------- helpers --------
  async function fetchMe(signal?: AbortSignal): Promise<User> {
    const res = await fetch("/api/me", {
      credentials: "include",
      cache: "no-store",
      signal,
    })

    // 200: user を返す
    if (res.status === 200) {
      const data = (await res.json()) as { user?: User } | null
      return data?.user ?? null
    }

    // 401: 未ログインとして null（例外にしない）
    if (res.status === 401) return null

    // それ以外は控えめにログって null
    console.warn("Unexpected /api/me status:", res.status)
    return null
  }

  async function extractErrorMessage(res: Response): Promise<string> {
    try {
      const json = (await res.json()) as unknown
      if (json && typeof json === "object") {
        const obj = json as Record<string, unknown>
        if (typeof obj.detail === "string") return obj.detail
        if (typeof obj.message === "string") return obj.message
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
    // /login と /signup では /api/me を呼ばない
    const pathname = typeof window !== "undefined" ? window.location.pathname : ""
    const isPublicPath = pathname === "/login" || pathname === "/signup"
    if (!autoLoad || isPublicPath) return

    const ac = new AbortController()
    ;(async () => {
      setIsLoading(true)
      try {
        const u = await fetchMe(ac.signal)
        if (!ac.signal.aborted) setUser(u)
      } catch {
        if (!ac.signal.aborted) setUser(null)
      } finally {
        if (!ac.signal.aborted) setIsLoading(false)
      }
    })()
    return () => ac.abort()
  }, [autoLoad])

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

      // Cookie が付与済みなので /api/me を取り直して確実に復元
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
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" })
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

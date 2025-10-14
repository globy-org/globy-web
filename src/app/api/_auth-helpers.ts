// src/app/api/_auth-helpers.ts
import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

export const AUTH_COOKIE_NAME = "auth_token"
export const REFRESH_COOKIE_NAME = "refresh_token" // 未使用なら消してOK

export function resolveApiBase(): string {
  const strip = (v?: string) => v?.replace(/\/$/, "")
  return (
    strip(process.env.API_BASE_URL) ||
    strip(process.env.INTERNAL_API_URL) ||
    strip(process.env.NEXT_PUBLIC_API_BASE_URL) ||
    "http://localhost:3001"
  ) as string
}

/** リクエストからJWT(Access Token)を取得 */
export function getJwtFromReq(req: NextRequest): string | null {
  return req.cookies.get(AUTH_COOKIE_NAME)?.value ?? null
}

/** リクエストからRefresh Tokenを取得（未使用なら削除OK） */
export function getRefreshFromReq(req: NextRequest): string | null {
  return req.cookies.get(REFRESH_COOKIE_NAME)?.value ?? null
}

/** Cookie共通オプション（ローカル優先で安定動作） */
function cookieBase() {
  const isProd = process.env.NODE_ENV === "production"
  return {
    httpOnly: true as const,
    secure: isProd,          // 本番(https): true / ローカル(http): false
    sameSite: "lax" as const,
    path: "/",
  }
}

/**
 * レスポンスに認証クッキー(AT/RT)を付与
 * - atMaxAgeSec: Access Token の寿命（秒） 例: 900 (=15分)
 * - rtMaxAgeSec: Refresh Token の寿命（秒） 例: 2592000 (=30日)
 */
export function setAuthCookies(
  res: NextResponse,
  params: {
    accessToken: string
    refreshToken?: string
    atMaxAgeSec?: number
    rtMaxAgeSec?: number
  },
) {
  const {
    accessToken,
    refreshToken,
    atMaxAgeSec = 900,
    rtMaxAgeSec = 60 * 60 * 24 * 30,
  } = params

  const base = cookieBase()

  // Access Token
  const atExpires = new Date(Date.now() + atMaxAgeSec * 1000)
  res.cookies.set({
    name: AUTH_COOKIE_NAME,
    value: accessToken,
    ...base,
    maxAge: atMaxAgeSec,
    expires: atExpires,
  })

  // Refresh Token（渡ってきたときだけ設定）
  if (refreshToken) {
    const rtExpires = new Date(Date.now() + rtMaxAgeSec * 1000)
    res.cookies.set({
      name: REFRESH_COOKIE_NAME,
      value: refreshToken,
      ...base,
      maxAge: rtMaxAgeSec,
      expires: rtExpires,
    })
  }
}

/** Access Token のみ更新（refresh 成功時など） */
export function rotateAccessToken(
  res: NextResponse,
  accessToken: string,
  atMaxAgeSec = 900,
) {
  const base = cookieBase()
  const atExpires = new Date(Date.now() + atMaxAgeSec * 1000)
  res.cookies.set({
    name: AUTH_COOKIE_NAME,
    value: accessToken,
    ...base,
    maxAge: atMaxAgeSec,
    expires: atExpires,
  })
}

/** 既存互換: ATのみ付与する旧ヘルパ（必要なら残す） */
export function attachAuthCookie(res: NextResponse, token: string) {
  setAuthCookies(res, { accessToken: token, atMaxAgeSec: 900 })
}

/** レスポンスで認証クッキーを削除（AT/RTとも） */
export function clearAuthCookiesOn(res: NextResponse) {
  const base = cookieBase()
  const past = new Date(0) // 1970-01-01
  res.cookies.set({ name: AUTH_COOKIE_NAME, value: "", ...base, maxAge: 0, expires: past })
  res.cookies.set({ name: REFRESH_COOKIE_NAME, value: "", ...base, maxAge: 0, expires: past })
}

/** Authorization: Bearer を付与（BFF→Railsのサーバ間） */
export function withBearerFromReq(
  req: NextRequest,
  headers: HeadersInit = {},
): HeadersInit {
  const jwt = getJwtFromReq(req)
  return jwt ? { ...headers, Authorization: `Bearer ${jwt}` } : headers
}

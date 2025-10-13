// src/app/api/_auth-helpers.ts
import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

/** Cookie 名（Access/Refresh） */
export const AUTH_COOKIE_NAME = "auth_token"         // Access Token 用
export const REFRESH_COOKIE_NAME = "refresh_token"   // Refresh Token 用（未使用なら削除可）

/**
 * API のベースURLを解決
 * - 環境変数の優先順：API_BASE_URL > INTERNAL_API_URL > NEXT_PUBLIC_API_BASE_URL
 * - 何もなければ: Docker想定なら http://api:3000 / それ以外は http://localhost:3001
 */
export function resolveApiBase(): string {
  const strip = (v?: string) => v?.replace(/\/$/, "")
  const inDocker =
    process.env.DOCKER === "1" ||
    process.env.CONTAINER === "true" ||
    process.env.IN_DOCKER === "1"

  return (
    strip(process.env.API_BASE_URL) ||
    strip(process.env.INTERNAL_API_URL) ||
    strip(process.env.NEXT_PUBLIC_API_BASE_URL) ||
    (inDocker ? "http://api:3000" : "http://localhost:3001")
  ) as string
}

/** Cookieの共通オプション（まずはローカル優先で安定動作） */
function cookieBase() {
  const isProd = process.env.NODE_ENV === "production"
  return {
    httpOnly: true as const,
    // 本番(https)は secure:true、ローカル(http)は secure:false
    secure: isProd,
    sameSite: "lax" as const,
    path: "/",
    // サブドメイン共有したくなったら Domain を追加:
    // ...(process.env.COOKIE_DOMAIN ? { domain: process.env.COOKIE_DOMAIN } : {}),
  }
}

/** リクエストから Access Token(JWT) を取得 */
export function getJwtFromReq(req: NextRequest): string | null {
  return req.cookies.get(AUTH_COOKIE_NAME)?.value ?? null
}

/** リクエストから Refresh Token を取得（未使用なら不要） */
export function getRefreshFromReq(req: NextRequest): string | null {
  return req.cookies.get(REFRESH_COOKIE_NAME)?.value ?? null
}

/**
 * レスポンスに認証クッキーを付与（AT/RT をまとめて設定）
 * @param atMaxAgeSec  Access Token の寿命（秒） 例: 900 (=15分)
 * @param rtMaxAgeSec  Refresh Token の寿命（秒） 例: 2592000 (=30日)
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

  // Refresh Token（渡ってきた時のみ設定）
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

/** レスポンスで認証クッキー（AT/RT）を削除 */
export function clearAuthCookiesOn(res: NextResponse) {
  const base = cookieBase()
  const past = new Date(0) // 1970-01-01
  res.cookies.set({ name: AUTH_COOKIE_NAME, value: "", ...base, maxAge: 0, expires: past })
  res.cookies.set({ name: REFRESH_COOKIE_NAME, value: "", ...base, maxAge: 0, expires: past })
}

/**
 * Authorization: Bearer <AT> を付与（BFF→Rails のサーバ間通信用）
 * - クライアントからは AT を露出させず、BFF がヘッダ付与して中継する
 */
export function withBearerFromReq(
  req: NextRequest,
  headers: HeadersInit = {},
): HeadersInit {
  const jwt = getJwtFromReq(req)
  return jwt ? { ...headers, Authorization: `Bearer ${jwt}` } : headers
}

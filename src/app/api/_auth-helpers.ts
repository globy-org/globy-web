// src/app/api/_auth-helpers.ts
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

export const AUTH_COOKIE_NAME = 'auth_token'
export const REFRESH_COOKIE_NAME = 'refresh_token' // 未使用なら消してOK

export function resolveApiBase(): string {
  const strip = (v?: string) => v?.replace(/\/$/, '')
  return (
    strip(process.env.API_BASE_URL) ||
    strip(process.env.INTERNAL_API_URL) ||
    strip(process.env.NEXT_PUBLIC_API_BASE_URL) ||
    'http://localhost:3001'
  ) as string
}

/** リクエストからJWTを取得 */
export function getJwtFromReq(req: NextRequest): string | null {
  return req.cookies.get(AUTH_COOKIE_NAME)?.value ?? null
}

/** レスポンスに認証クッキーを付与 */
export function attachAuthCookie(res: NextResponse, token: string) {
  const secure = process.env.NODE_ENV === 'production'
  res.cookies.set({
    name: AUTH_COOKIE_NAME,
    value: token,
    httpOnly: true,
    sameSite: 'lax',
    secure,
    path: '/',
  })
}

/** レスポンスで認証クッキーを削除 */
export function clearAuthCookiesOn(res: NextResponse) {
  const secure = process.env.NODE_ENV === 'production'
  const base = { httpOnly: true, sameSite: 'lax' as const, secure, path: '/' }
  res.cookies.set({ name: AUTH_COOKIE_NAME, value: '', maxAge: 0, ...base })
  res.cookies.set({ name: REFRESH_COOKIE_NAME, value: '', maxAge: 0, ...base })
}

/** Authorization ヘッダ（Bearer）を付ける */
export function withBearerFromReq(req: NextRequest, headers: HeadersInit = {}): HeadersInit {
  const jwt = getJwtFromReq(req)
  return jwt ? { ...headers, Authorization: `Bearer ${jwt}` } : headers
}

// src/app/api/_auth-helpers.ts
import "server-only"
import { cookies } from "next/headers"
import type { NextResponse } from "next/server"

export const AUTH_COOKIE_NAME = "auth_token"

/** Rails API のベースURLを解決（Docker: api:3000 / ローカル: localhost:3000 を既定） */
export function resolveApiBase(): string {
  const strip = (v?: string) => v?.replace(/\/$/, "")
  return (
    strip(process.env.API_BASE_URL) ||              // サーバ専用（例: http://api:3000）
    strip(process.env.INTERNAL_API_URL) ||          // 代替
    strip(process.env.NEXT_PUBLIC_API_BASE_URL) ||  // 最後の手段（露出注意）
    (process.env.DOCKER === "1" || process.env.CONTAINER === "true"
      ? "http://api:3000"                           // Docker 内
      : "http://localhost:3000")                    // ローカル直起動
  ) as string
}

/** 互換: 直接使いたい場合の定数 */
export const API_BASE = resolveApiBase()

/** JSON を安全に parse */
export function safeJSON<T = unknown>(s: string): T | null {
  try { return JSON.parse(s) as T } catch { return null }
}

/** Cookie から JWT を取得（Next.js 15: cookies() は await 必須） */
export async function readAuthTokenFromCookies(): Promise<string | null> {
  const store = await cookies()
  return store.get(AUTH_COOKIE_NAME)?.value ?? null
}

/** Railsのレスポンスから Authorization ヘッダの JWT を取り出す */
export function pickJwtFrom(res: Response): string | null {
  const auth = res.headers.get("Authorization") // "Bearer xxx"
  return auth?.replace(/^Bearer\s+/i, "") ?? null
}

/** Cookie設定オプション（付与/削除で共有） */
export const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24, // 1日
}

/** 認証Cookieをセット */
export function setAuthCookie(resp: NextResponse, token: string): void {
  resp.cookies.set(AUTH_COOKIE_NAME, token, cookieOptions)
}

/** 認証Cookieを削除（付与時と同属性で無効化） */
export function clearAuthCookie(resp: NextResponse): void {
  resp.cookies.set(AUTH_COOKIE_NAME, "", {
    ...cookieOptions,
    maxAge: 0,
    expires: new Date(0),
  })
}

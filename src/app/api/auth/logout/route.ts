// src/app/api/logout/route.ts
import { NextResponse, type NextRequest } from "next/server"

const AUTH_COOKIE_NAME = "auth_token"
const REFRESH_COOKIE_NAME = "refresh_token" // 使っていなければ削除可

/** Rails API のベースURLを解決（ENV優先→ローカル既定） */
function resolveApiBase(): string {
  const strip = (v?: string) => v?.replace(/\/$/, "")
  // 例: API_BASE_URL="http://localhost:3001" などを .env に設定
  return (
    strip(process.env.API_BASE_URL) ||
    strip(process.env.INTERNAL_API_URL) ||
    strip(process.env.NEXT_PUBLIC_API_BASE_URL) ||
    "http://localhost:3001"
  ) as string
}

/** Rails の sign_out を呼び出し（Bearer に JWT を載せる） */
async function callRailsSignOut(jwt?: string | null) {
  if (!jwt) {
    return { ok: false, status: 0, error: "no_jwt_cookie" as const }
  }
  const apiBase = resolveApiBase()
  try {
    const res = await fetch(`${apiBase}/auth/sign_out`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Devise-JWT など一般的なAPIの失効エンドポイントは Authorization: Bearer を想定
        Authorization: `Bearer ${jwt}`,
      },
      // サーバ間通信なので CORS は対象外。タイムアウト制御を入れたい場合は AbortController を使用。
      cache: "no-store",
    })
    const text = await res.text().catch(() => "")
    return { ok: res.ok, status: res.status, body: text }
  } catch (e) {
    return { ok: false, status: 0, error: "fetch_error" as const }
  }
}

/** クッキー破棄（Max-Age=0） */
function clearAuthCookies(res: NextResponse) {
  const secure = process.env.NODE_ENV === "production"
  const common = { path: "/", httpOnly: true as const, sameSite: "lax" as const, secure }

  res.cookies.set({ name: AUTH_COOKIE_NAME, value: "", maxAge: 0, ...common })
  res.cookies.set({ name: REFRESH_COOKIE_NAME, value: "", maxAge: 0, ...common })
}

export async function POST(req: NextRequest) {
  const jwt = req.cookies.get(AUTH_COOKIE_NAME)?.value ?? null

  // 1) Rails 側へ sign_out 通知（失敗しても続行）
  const rails = await callRailsSignOut(jwt)

  // 2) フロント側ドメインのクッキーは必ず破棄
  const res = NextResponse.json(
    {
      ok: true,
      rails: {
        ok: rails.ok,
        status: rails.status,
        // レスポンス本文がJSONでない可能性もあるため生テキストを返す（ログ用途）
        body: "body" in rails ? rails.body : undefined,
        error: "error" in rails ? rails.error : undefined,
      },
    },
    { status: 200 },
  )
  clearAuthCookies(res)

  return res
}

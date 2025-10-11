// src/app/api/me/route.ts
import { NextResponse } from "next/server"
import {
  API_BASE,
  readAuthTokenFromCookies,
  safeJSON,
} from "../_auth-helpers" // ← 既存ヘルパを再利用（パス注意）

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// Rails 側の「自分情報」エンドポイント（環境で差し替え可）
const RAILS_ME_PATH = process.env.NEXT_PUBLIC_RAILS_ME_PATH || "/me"

type User = { id: number; email: string; name?: string }
type MeResponse = { user?: User }

function isUser(x: unknown): x is User {
  if (typeof x !== "object" || x === null) return false
  const r = x as Record<string, unknown>
  return typeof r.id === "number" && typeof r.email === "string"
}
function isMeResponse(x: unknown): x is MeResponse {
  if (typeof x !== "object" || x === null) return false
  const u = (x as Record<string, unknown>).user
  return u === undefined || isUser(u)
}

export async function GET() {
  // Cookie から JWT
  const token = await readAuthTokenFromCookies()
  if (!token) {
    return NextResponse.json({ user: null }, { status: 401 })
  }

  // Rails の /me に中継
  const railsRes = await fetch(`${API_BASE}${RAILS_ME_PATH}`, {
    method: "GET",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  })

  const raw = await railsRes.text()
  const data = safeJSON<unknown>(raw) ?? null

  // 認証失敗などは 401/403 に揃えて返す（本文は { user: null } に統一）
  if (!railsRes.ok) {
    return NextResponse.json({ user: null }, { status: railsRes.status === 403 ? 401 : railsRes.status })
  }

  // 期待形に正規化
  if (isMeResponse(data)) {
    // Rails 側が { user: {...} } を返す前提。なければ null。
    return NextResponse.json({ user: data?.user ?? null }, { status: 200 })
  }

  // 予期しない本文の場合も安全側で null を返す
  return NextResponse.json({ user: null }, { status: 200 })
}

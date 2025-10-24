// src/app/api/me/route.ts
import { NextResponse } from "next/server"
import { cookies } from "next/headers"

// Rails API のベースURL（環境に合わせて）
// - Docker: "http://api:3000"
// - ローカル別ポート: "http://localhost:3001" など
const API_BASE =
  process.env.API_BASE_URL ||
  process.env.INTERNAL_API_URL ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  "http://api:3000"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

// Cookie 名の候補（どれかが入っていれば Bearer にも積む）
const TOKEN_COOKIE_CANDIDATES = [
  "auth_token",
  "access_token",
  "jwt",
  "token",
  // 必要なら追加
] as const

export async function GET() {
  // Next 15+ 環境では cookies() が Promise の場合があるので await
  const cookieStore = await cookies()

  // 1) Cookie ヘッダーを自前で組み立て（全ての Cookie を Rails にブリッジ）
  const cookieHeader = cookieStore
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join("; ")

  // 2) Authorization / X-Auth-Token を“候補総当たり”で積む
  let bearer: string | undefined
  for (const name of TOKEN_COOKIE_CANDIDATES) {
    const v = cookieStore.get(name)?.value
    if (v && v.trim()) {
      bearer = v
      break
    }
  }

  const headers: Record<string, string> = { Accept: "application/json" }
  if (cookieHeader) headers["Cookie"] = cookieHeader
  if (bearer) {
    headers["Authorization"] = `Bearer ${bearer}`
    headers["X-Auth-Token"] = bearer // 実装差分への保険
  }

  // 3) Rails の /me を叩く
  const upstream = await fetch(`${API_BASE}/me`, {
    method: "GET",
    headers,
    cache: "no-store",
  })

  // 4) 透過レスポンス
  if (!upstream.ok) {
    const text = await upstream.text().catch(() => "")
    // デバッグ用に最小限のヒントを返す（本番では削ってOK）
    return NextResponse.json(
      {
        authenticated: false,
        message: text || "unauthorized",
        hint: bearer ? "sent bearer + cookies" : "sent cookies only",
      },
      { status: 401 },
    )
  }

  const data = await upstream.json().catch(() => ({}))
  return NextResponse.json({ authenticated: true, user: data?.user ?? null })
}

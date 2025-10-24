// src/app/api/session/route.ts
import { NextResponse } from "next/server"
import { cookies } from "next/headers"

// Rails API のベースURL（環境に合わせて）
const API_BASE =
  process.env.API_BASE_URL ||
  process.env.INTERNAL_API_URL ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  "http://localhost:3001" // 例: Rails が :3001 で稼働

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET() {
  // ブラウザの HttpOnly クッキーをサーバ fetch の Cookie ヘッダへ“手動で”転送
  const cookieHeader = cookies().toString()

  const res = await fetch(`${API_BASE}/me`, {
    method: "GET",
    headers: {
      Cookie: cookieHeader,
      Accept: "application/json",
    },
    cache: "no-store",
  })

  if (!res.ok) {
    const text = await res.text().catch(() => "")
    return NextResponse.json(
      { authenticated: false, message: text || "unauthorized" },
      { status: 401 },
    )
  }

  const data = await res.json().catch(() => ({}))
  return NextResponse.json({ authenticated: true, user: data?.user ?? null })
}

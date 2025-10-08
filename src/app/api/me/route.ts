// src/app/api/me/route.ts
import { cookies } from "next/headers"
import { NextResponse } from "next/server"

const API = resolveApiBase()

export async function GET() {
  const store = await cookies() // ← await 必須
  const token = store.get("auth_token")?.value
  if (!token) return NextResponse.json({ user: null }, { status: 401 })

  const res = await fetch(`${API}/me`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  })
  const text = await res.text()
  return new NextResponse(text, { status: res.status })
}

function resolveApiBase() {
  const strip = (s?: string) => s?.replace(/\/$/, "")
  return (
    strip(process.env.API_BASE_URL) ||                 // ← サーバ専用（推奨）
    strip(process.env.INTERNAL_API_URL) ||            // ← 代替
    strip(process.env.NEXT_PUBLIC_API_BASE_URL) ||    // ← 最後の手段
    (process.env.DOCKER === "1" || process.env.CONTAINER === "true"
      ? "http://api:3001"                             // Docker 内
      : "http://localhost:3001")                      // ローカル直起動
  ) as string
}

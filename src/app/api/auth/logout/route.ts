// src/app/api/auth/logout/route.ts
import { cookies } from "next/headers"
import { NextResponse } from "next/server"

const API = resolveApiBase()

export async function POST() {
  const store = await cookies() // ← await 必須
  const token = store.get("auth_token")?.value

  try {
    if (token) {
      await fetch(`${API}/users/sign_out`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      })
    }
  } catch {}

  const resp = NextResponse.json({ ok: true })

  // ✅ 付与時と同じ属性で削除（maxAge: 0 ＆ 期限過去）
  resp.cookies.set("auth_token", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
    expires: new Date(0),
  })

  return resp
}

function resolveApiBase() {
  const strip = (s?: string) => s?.replace(/\/$/, "")
  return (
    strip(process.env.API_BASE_URL) ||
    strip(process.env.INTERNAL_API_URL) ||
    strip(process.env.NEXT_PUBLIC_API_BASE_URL) ||
    (process.env.DOCKER === "1" || process.env.CONTAINER === "true"
      ? "http://api:3001"
      : "http://localhost:3001")
  ) as string
}

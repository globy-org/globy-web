// src/app/api/auth/login/route.ts
import { NextResponse, type NextRequest } from "next/server"
import {
  resolveApiBase,
  setAuthCookies,
  clearAuthCookiesOn,
} from "../../_auth-helpers"

type LoginBody = {
  email: string
  password: string
}

type RailsUser = {
  id: number | string
  name?: string | null
  email: string
}

type RailsSignInResponse = {
  user?: RailsUser | null
  token?: string
  access_token?: string
  refresh_token?: string
  at_expires_in?: number | string
  rt_expires_in?: number | string
  code?: string
  detail?: string
}

const isObject = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === "object"

function pickLoginBody(u: unknown): LoginBody | null {
  if (!isObject(u)) return null
  const email = u["email"]
  const password = u["password"]
  if (typeof email === "string" && typeof password === "string") {
    return { email, password }
  }
  return null
}

export async function POST(req: NextRequest) {
  const raw = (await req.json().catch(() => null)) as unknown
  const body = pickLoginBody(raw)

  if (!body) {
    return NextResponse.json(
      { ok: false, message: "メール/パスワードが未入力です" },
      { status: 400 },
    )
  }

  try {
    const apiBase = resolveApiBase()
    const r = await fetch(`${apiBase}/users/sign_in`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({ user: body }),
    })

    const data =
      ((await r.json().catch(() => ({}))) as Partial<RailsSignInResponse>) ?? {}

    if (!r.ok) {
      const res = NextResponse.json(
        {
          ok: false,
          code: data.code,
          message: data.detail || "ログインに失敗しました",
        },
        { status: r.status },
      )
      clearAuthCookiesOn(res)
      return res
    }

    const accessToken = data.access_token ?? data.token
    const refreshToken = data.refresh_token
    const atMaxAgeSec = Number(data.at_expires_in) || 900 // 15分
    const rtMaxAgeSec = Number(data.rt_expires_in) || 60 * 60 * 24 * 30 // 30日

    const res = NextResponse.json(
      { ok: true, user: data.user ?? null },
      { status: 200 },
    )

    if (accessToken) {
      setAuthCookies(res, {
        accessToken,
        refreshToken,
        atMaxAgeSec,
        rtMaxAgeSec,
      })
    }

    return res
  } catch {
    const res = NextResponse.json(
      { ok: false, message: "サーバに接続できませんでした" },
      { status: 502 },
    )
    clearAuthCookiesOn(res)
    return res
  }
}

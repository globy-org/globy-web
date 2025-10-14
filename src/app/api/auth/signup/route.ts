// src/app/api/auth/signup/route.ts
import { NextResponse, type NextRequest } from "next/server"
import {
  resolveApiBase,
  setAuthCookies,
  clearAuthCookiesOn,
} from "../../_auth-helpers"

type SignupBody = {
  email: string
  password: string
  confirmPassword: string
  name?: string | null
}

type RailsUser = {
  id: number | string
  name?: string | null
  email: string
}

type RailsSignupResponse = {
  user?: RailsUser | null
  // deviseの設定によっては登録時にtokenが返らない場合もある
  token?: string
  access_token?: string
  refresh_token?: string
  at_expires_in?: number | string
  rt_expires_in?: number | string
  code?: string
  detail?: string
  errors?: Record<string, string[]>
}

type RailsLoginResponse = {
  user?: RailsUser | null
  token?: string
  access_token?: string
  refresh_token?: string
  at_expires_in?: number | string
  rt_expires_in?: number | string
}

const isObject = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === "object"

function pickSignupBody(u: unknown): SignupBody | null {
  if (!isObject(u)) return null
  const email = u["email"]
  const password = u["password"]
  const confirmPassword = u["confirmPassword"]
  const name = (u["name"] ?? null) as string | null
  if (
    typeof email === "string" &&
    typeof password === "string" &&
    typeof confirmPassword === "string"
  ) {
    return { email, password, confirmPassword, name }
  }
  return null
}

export async function POST(req: NextRequest) {
  const raw = (await req.json().catch(() => null)) as unknown
  const body = pickSignupBody(raw)

  if (!body) {
    return NextResponse.json(
      { ok: false, message: "必要な項目が未入力です" },
      { status: 400 },
    )
  }
  if (body.password !== body.confirmPassword) {
    return NextResponse.json(
      { ok: false, message: "パスワードが一致しません" },
      { status: 400 },
    )
  }

  try {
    const apiBase = resolveApiBase()

    // 1) ユーザー登録（Devise Registrations: POST /users）
    const signupRes = await fetch(`${apiBase}/users`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({
        user: {
          email: body.email,
          password: body.password,
          password_confirmation: body.confirmPassword,
          ...(body.name ? { name: body.name } : {}),
        },
      }),
    })

    const signupJson =
      ((await signupRes.json().catch(() => ({}))) as Partial<RailsSignupResponse>) ??
      {}

    if (!signupRes.ok) {
      const message =
        signupJson.detail ||
        (signupJson.errors
          ? Object.entries(signupJson.errors)
              .map(([k, v]) => `${k}: ${v.join(", ")}`)
              .join("\n")
          : "サインアップに失敗しました")
      const res = NextResponse.json({ ok: false, message }, { status: signupRes.status })
      clearAuthCookiesOn(res)
      return res
    }

    // 2) トークンの有無を確認。返らない場合は自動ログインで取得
    let accessToken =
      signupJson.access_token ?? signupJson.token ?? undefined
    let refreshToken = signupJson.refresh_token ?? undefined
    let atMaxAgeSec = Number(signupJson.at_expires_in) || 900
    let rtMaxAgeSec = Number(signupJson.rt_expires_in) || 60 * 60 * 24 * 30
    let user = signupJson.user ?? null

    if (!accessToken) {
      // 登録直後にログインしてトークン確保（POST /users/sign_in）
      const loginRes = await fetch(`${apiBase}/users/sign_in`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          user: { email: body.email, password: body.password },
        }),
      })
      if (!loginRes.ok) {
        // ユーザーは作成済みだがトークン取れず → 401 で返して再ログイン誘導
        const res = NextResponse.json(
          {
            ok: false,
            message: "アカウントは作成されました。ログインしてください。",
          },
          { status: 401 },
        )
        clearAuthCookiesOn(res)
        return res
      }
      const loginJson =
        ((await loginRes
          .json()
          .catch(() => ({}))) as Partial<RailsLoginResponse>) ?? {}
      accessToken = loginJson.access_token ?? loginJson.token ?? undefined
      refreshToken = loginJson.refresh_token ?? undefined
      atMaxAgeSec = Number(loginJson.at_expires_in) || atMaxAgeSec
      rtMaxAgeSec = Number(loginJson.rt_expires_in) || rtMaxAgeSec
      user = loginJson.user ?? user
    }

    // 3) Cookie を設定して返却
    const res = NextResponse.json(
      { ok: true, user: user ?? null },
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

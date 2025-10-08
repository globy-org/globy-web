// src/app/api/auth/login/route.ts
import { NextResponse } from "next/server"
import {
  API_BASE,
  pickJwtFrom,
  setAuthCookie,
  safeJSON,
} from "../../_auth-helpers"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type LoginBody = { email: string; password: string }

// ---- 設定（ENVで上書き可） ----
// Devise 既定: /users/sign_in
// devise_for :users, path: "auth" 等なら /auth/sign_in
const RAILS_LOGIN_PATH =
  process.env.NEXT_PUBLIC_RAILS_LOGIN_PATH || "/users/sign_in"

// Devise + devise-jwt なら "devise"（{ user: { email, password } }）
// devise_token_auth なら "token_auth"（{ email, password }）
const BODY_STYLE = process.env.RAILS_LOGIN_BODY_STYLE || "devise" // "devise" | "token_auth"

function buildRailsLoginBody(email: string, password: string): string {
  if (BODY_STYLE === "token_auth") {
    return JSON.stringify({ email, password })
  }
  return JSON.stringify({ user: { email, password } })
}

// レスポンス本文に token が含まれる可能性に備えた型ガード
type MaybeToken = { token?: string }
function hasToken(x: unknown): x is MaybeToken {
  return typeof x === "object" && x !== null && "token" in x
}

export async function POST(req: Request) {
  let body: LoginBody
  try {
    body = (await req.json()) as LoginBody
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  // Rails のログインへ中継
  const railsRes = await fetch(`${API_BASE}${RAILS_LOGIN_PATH}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: buildRailsLoginBody(body.email, body.password),
  })

  const raw = await railsRes.text()
  const data = safeJSON<unknown>(raw) ?? raw

  // そのままステータスを踏襲して返す
  const resp = NextResponse.json(data, { status: railsRes.status })

  // 成功時は JWT を Cookie に保存（ヘッダ優先 → 本文 token フォールバック）
  if (railsRes.ok) {
    const headerToken = pickJwtFrom(railsRes)
    const bodyToken = hasToken(data) ? data.token ?? null : null
    const token = headerToken || bodyToken
    if (token) setAuthCookie(resp, token)
  }

  return resp
}

export async function GET() {
  return NextResponse.json({ error: "Method Not Allowed" }, { status: 405 })
}

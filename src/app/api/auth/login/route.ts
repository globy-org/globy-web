// src/app/api/auth/login/route.ts
import { NextResponse } from "next/server"

const API = resolveApiBase()

export async function POST(req: Request) {
  const { email, password } = await req.json()

  // Railsへフォワード
  let res: Response | null = null
  try {
    res = await fetch(`${API}/users/sign_in`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user: { email, password } }),
      cache: "no-store",
    })
  } catch {
    return NextResponse.json({ error: "APIに接続できませんでした。" }, { status: 502 })
  }

  const text = await res.text() // ユーザーJSON想定
  // JWT は Authorization ヘッダに返る（rack-cors で expose: ["Authorization"] 必須）
  const auth = res.headers.get("Authorization") // "Bearer xxx"
  if (!res.ok || !auth) {
    return new NextResponse(text || JSON.stringify({ error: "Unauthorized" }), {
      status: res.status || 401,
      headers: { "Content-Type": "application/json" },
    })
  }

  const token = auth.replace(/^Bearer\s+/i, "")
  const json = safeJSON(text) ?? {}

  const resp = NextResponse.json(json, { status: 200 })
  // ✅ 正しいシグネチャで Cookie を設定（3 引数）
  resp.cookies.set("auth_token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24, // 1日
  })
  // もしくは下記でもOK（1 引数のオブジェクト形式）
  // resp.cookies.set({
  //   name: "auth_token",
  //   value: token,
  //   httpOnly: true,
  //   secure: process.env.NODE_ENV === "production",
  //   sameSite: "lax",
  //   path: "/",
  //   maxAge: 60 * 60 * 24,
  // })

  return resp
}

function safeJSON(s: string) {
  try {
    return JSON.parse(s)
  } catch {
    return null
  }
}

function resolveApiBase() {
  const strip = (v?: string) => v?.replace(/\/$/, "")
  return (
    strip(process.env.API_BASE_URL) ||              // サーバ専用に推奨（例: http://api:3000）
    strip(process.env.INTERNAL_API_URL) ||          // 代替
    strip(process.env.NEXT_PUBLIC_API_BASE_URL) ||  // 最後の手段（露出注意）
    // ↓ デフォルトを 3000 に
    (process.env.DOCKER === "1" || process.env.CONTAINER === "true"
      ? "http://api:3000"                           // Docker内: サービス名で到達
      : "http://localhost:3000")                    // ローカル直起動
  ) as string
}

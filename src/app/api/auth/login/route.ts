// src/app/api/auth/login/route.ts
import { NextResponse, type NextRequest } from 'next/server'
import { resolveApiBase, attachAuthCookie, clearAuthCookiesOn } from '../../_auth-helpers'

export async function POST(req: NextRequest) {
  const { email, password } = await req.json().catch(() => ({}))
  if (!email || !password) {
    return NextResponse.json({ ok: false, message: 'メール/パスワードが未入力です' }, { status: 400 })
  }

  try {
    const apiBase = resolveApiBase()
    const r = await fetch(`${apiBase}/users/sign_in`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
      body: JSON.stringify({ user: { email, password } }),
    })

    const data = await r.json().catch(() => ({}))

    if (!r.ok) {
      const res = NextResponse.json(
        { ok: false, code: data?.code, message: data?.detail || 'ログインに失敗しました' },
        { status: r.status },
      )
      clearAuthCookiesOn(res)
      return res
    }

    const token = data?.token as string | undefined
    const res = NextResponse.json({ ok: true, user: data?.user ?? null }, { status: 200 })
    if (token) attachAuthCookie(res, token)
    return res
  } catch {
    const res = NextResponse.json({ ok: false, message: 'サーバに接続できませんでした' }, { status: 502 })
    clearAuthCookiesOn(res)
    return res
  }
}

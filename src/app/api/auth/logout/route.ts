// src/app/api/auth/logout/route.ts
import { NextResponse, type NextRequest } from 'next/server'
import { resolveApiBase, clearAuthCookiesOn, getJwtFromReq } from '../../_auth-helpers'

export async function GET() {
  return NextResponse.json({ ok: true, message: 'logout endpoint is alive' })
}

export async function POST(req: NextRequest) {
  const apiBase = resolveApiBase()
  const jwt = getJwtFromReq(req)

  // Railsへ通知（失敗はUX優先で無視）
  if (jwt) {
    try {
      await fetch(`${apiBase}/auth/sign_out`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}` },
        cache: 'no-store',
      })
    } catch {}
  }

  const res = NextResponse.json({ ok: true }, { status: 200 })
  clearAuthCookiesOn(res)
  return res
}

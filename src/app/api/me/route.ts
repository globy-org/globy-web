// src/app/api/me/route.ts
import { NextResponse, type NextRequest } from 'next/server'
import { resolveApiBase, withBearerFromReq } from '../_auth-helpers'

export async function GET(req: NextRequest) {
  const apiBase = resolveApiBase()
  const r = await fetch(`${apiBase}/me`, {
    method: 'GET',
    headers: withBearerFromReq(req),
    cache: 'no-store',
  })

  const data = await r.json().catch(() => ({}))
  if (!r.ok) {
    return NextResponse.json(
      { ok: false, code: data?.code, message: data?.detail || 'Unauthorized' },
      { status: r.status },
    )
  }
  return NextResponse.json({ ok: true, user: data?.user ?? null }, { status: 200 })
}

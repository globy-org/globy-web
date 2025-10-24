// src/app/api/auth/login/route.ts
// cspell:ignore globy
import { NextResponse, type NextRequest } from "next/server"
import { resolveApiBase, clearAuthCookiesOn } from "../../_auth-helpers" // setAuthCookies はもう使わない

type LoginBody = { email: string; password: string }
type RailsUser = { id: number | string; name?: string | null; email: string }
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
  if (typeof email === "string" && typeof password === "string") return { email, password }
  return null
}

/** クロス環境で使えるミリ秒タイマー */
const nowMs = () =>
  typeof performance !== "undefined" && typeof performance.now === "function"
    ? performance.now()
    : Date.now()

/** Server-Timing 用の文字列を安全に連結 */
function appendServerTiming(
  res: NextResponse,
  metrics: Array<{ name: string; dur?: number; desc?: string }>,
) {
  const prev = res.headers.get("Server-Timing")
  const add = metrics
    .filter(Boolean)
    .map((m) => {
      const parts = [m.name]
      if (typeof m.dur === "number" && !Number.isNaN(m.dur)) {
        parts.push(`dur=${Math.max(0, Math.round(m.dur))}`)
      }
      if (m.desc) {
        const safe = m.desc.replace(/"/g, "'")
        parts.push(`desc="${safe}"`)
      }
      return parts.join(";")
    })
    .join(", ")
  res.headers.set("Server-Timing", prev ? `${prev}, ${add}` : add)
}

// ===================== COOKIE_FWD_START:multi_set_cookie =====================
/** Undici の getSetCookie() があれば使い、無ければ単一 set-cookie を配列化して返す */
function getSetCookieList(from: Response): string[] {
  const h = from.headers as unknown as { getSetCookie?: () => string[] }
  if (typeof h.getSetCookie === "function") {
    try {
      const list = h.getSetCookie()
      return Array.isArray(list) ? list : []
    } catch {
      // フォールバックへ
    }
  }
  const single = from.headers.get("set-cookie")
  return single ? [single] : []
}

/** Railsからの複数 Set-Cookie をそのまま前方転送（append） */
function forwardSetCookies(from: Response, to: NextResponse): void {
  for (const v of getSetCookieList(from)) {
    to.headers.append("set-cookie", v)
  }
}
// ===================== COOKIE_FWD_END:multi_set_cookie =====================

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  const t0 = nowMs()

  const raw = (await req.json().catch(() => null)) as unknown
  const body = pickLoginBody(raw)
  if (!body) {
    const res = NextResponse.json({ ok: false, message: "メール/パスワードが未入力です" }, { status: 400 })
    appendServerTiming(res, [{ name: "total", dur: nowMs() - t0, desc: "Total handler time" }])
    return res
  }

  let railsMs = 0
  const reqId = crypto.randomUUID()

  try {
    const apiBase = resolveApiBase()

    const tFetch0 = nowMs()
    // ===================== LOGIN_SWITCH_START:/auth/login =====================
    // Deviseの /users/sign_in ではなく、JWT発行の /auth/login を叩く
    const r = await fetch(`${apiBase}/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Request-ID": reqId, // Rails ログ突合用
        "X-BFF": "globy-web",
      },
      cache: "no-store",
      // Rails 側は params[:email], params[:password] を想定
      body: JSON.stringify({ email: body.email, password: body.password }),
    })
    // ===================== LOGIN_SWITCH_END:/auth/login =====================
    railsMs = nowMs() - tFetch0

    const data = ((await r.json().catch(() => ({}))) as Partial<RailsSignInResponse>) ?? {}

    if (!r.ok) {
      const res = NextResponse.json(
        { ok: false, code: data.code, message: data.detail || "ログインに失敗しました" },
        { status: r.status },
      )
      clearAuthCookiesOn(res)
      // 計測ヘッダ
      appendServerTiming(res, [
        { name: "rails_login", dur: railsMs, desc: "/auth/login" },
        { name: "total", dur: nowMs() - t0, desc: "Total handler time" },
      ])
      res.headers.set("X-Proxy-Request-ID", reqId)
      res.headers.set("X-Login-Timing-Rails-Login", String(Math.round(railsMs)))
      res.headers.set("X-Login-Timing-Total", String(Math.round(nowMs() - t0)))

      console.log(
        JSON.stringify({
          tag: "api/auth/login",
          ok: false,
          status: r.status,
          rails_login_ms: Math.round(railsMs),
          total_ms: Math.round(nowMs() - t0),
          reqId,
        }),
      )
      return res
    }

    // BFFはCookieを自前で作らず、RailsのSet-Cookieを前方転送する
    const res = NextResponse.json({ ok: true, user: data.user ?? null }, { status: 200 })
    // ===================== COOKIE_FWD_START:multi_set_cookie =====================
    forwardSetCookies(r, res)
    // ===================== COOKIE_FWD_END:multi_set_cookie =====================

    appendServerTiming(res, [
      { name: "rails_login", dur: railsMs, desc: "/auth/login" },
      { name: "total", dur: nowMs() - t0, desc: "Total handler time" },
    ])
    res.headers.set("X-Proxy-Request-ID", reqId)
    res.headers.set("X-Login-Timing-Rails-Login", String(Math.round(railsMs)))
    res.headers.set("X-Login-Timing-Total", String(Math.round(nowMs() - t0)))

    console.log(
      JSON.stringify({
        tag: "api/auth/login",
        ok: true,
        rails_login_ms: Math.round(railsMs),
        total_ms: Math.round(nowMs() - t0),
        reqId,
      }),
    )

    return res
  } catch (e) {
    const res = NextResponse.json({ ok: false, message: "サーバに接続できませんでした" }, { status: 502 })
    clearAuthCookiesOn(res)
    appendServerTiming(res, [
      { name: "rails_login", dur: railsMs, desc: "/auth/login (partial)" },
      { name: "total", dur: nowMs() - t0, desc: "Total handler time" },
    ])
    res.headers.set("X-Proxy-Request-ID", reqId)
    res.headers.set("X-Login-Timing-Rails-Login", String(Math.round(railsMs)))
    res.headers.set("X-Login-Timing-Total", String(Math.round(nowMs() - t0)))

    console.log(
      JSON.stringify({
        tag: "api/auth/login",
        ok: false,
        error: (e as Error)?.message ?? String(e),
        rails_login_ms: Math.round(railsMs),
        total_ms: Math.round(nowMs() - t0),
        reqId,
      }),
    )
    return res
  }
}

// src/app/api/auth/refresh/route.ts

// cspell:ignore dlog derr globy reqId
import { NextResponse, type NextRequest } from "next/server"

// ===================== DEBUG_START:refresh =====================
// デバッグON/OFF（.env.local 等で DEBUG_REFRESH=1）
const DEBUG_ON = process.env.DEBUG_REFRESH === "1"

// JWTらしき文字列を伏せつつログの肥大化を抑止
function safe(text: string, limit = 800): string {
  const jwtLike = /eyJ[a-zA-Z0-9_\-.]+/g
  const redacted = text.replace(jwtLike, "[JWT_REDACTED]")
  return redacted.length > limit ? redacted.slice(0, limit) + "…(truncated)" : redacted
}

// any禁止対策：unknownで受けてそのままconsoleへ
function dlog(...args: unknown[]): void {
  if (DEBUG_ON) console.log("[BFF:refresh]", ...args)
}
function derr(...args: unknown[]): void {
  if (DEBUG_ON) console.error("[BFF:refresh]", ...args)
}

// unknownな例外から安全にメッセージ抽出
function toErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message
  if (typeof err === "string") return err
  try {
    return JSON.stringify(err)
  } catch {
    return String(err)
  }
}
// ===================== DEBUG_END:refresh =======================

function getForwardedCookie(req: NextRequest): string {
  // クライアント -> BFF の Cookie を Rails へそのまま前方転送
  return req.headers.get("cookie") ?? ""
}

function resolveApiBase(): string {
  return (
    process.env.API_BASE ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    "http://api:3000" // Docker内の api サービス想定
  )
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

/** Rails からの複数 Set-Cookie をそのまま前方転送（append） */
function forwardSetCookies(from: Response, to: NextResponse): void {
  for (const v of getSetCookieList(from)) {
    to.headers.append("set-cookie", v)
  }
}
// ===================== COOKIE_FWD_END:multi_set_cookie =====================

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  const t0 = Date.now()
  const reqId = crypto.randomUUID()
  const apiBase = resolveApiBase()
  const url = `${apiBase}/auth/refresh`
  const fwdCookie = getForwardedCookie(req)

  // ===================== DEBUG_START:refresh =====================
  dlog("start", {
    reqId,
    url,
    cookiePresent: Boolean(fwdCookie),
    cookieLen: fwdCookie.length,
    apiBase,
  })
  // ===================== DEBUG_END:refresh =======================

  try {
    const tFetch0 = Date.now()
    const res = await fetch(url, {
      method: "POST",
      headers: {
        // Rails へ Cookie をそのまま渡す（超重要）
        cookie: fwdCookie,
        "X-Request-ID": reqId, // Railsログ突合
        "X-BFF": "globy-web",
      },
      cache: "no-store",
    })
    const railsMs = Date.now() - tFetch0

    const rawText = await res.text()
    const out = new NextResponse(rawText, { status: res.status })

    // Rails からの Set-Cookie を全件前方転送
    forwardSetCookies(res, out)

    // 計測・相関ヘッダ
    const total = Date.now() - t0
    out.headers.set("Server-Timing", `rails_refresh;dur=${railsMs}, total;dur=${total}`)
    out.headers.set("X-Refresh-Total-Ms", String(total))
    out.headers.set("X-Proxy-Request-ID", reqId)

    // ===================== DEBUG_START:refresh =====================
    dlog("done", {
      reqId,
      status: res.status,
      railsMs,
      totalMs: total,
      setCookieCount: getSetCookieList(res).length,
      respPreview: safe(rawText),
    })
    // ===================== DEBUG_END:refresh =======================

    return out
  } catch (e: unknown) {
    const total = Date.now() - t0

    // ===================== DEBUG_START:refresh =====================
    derr("error", { reqId, durMs: total, err: toErrorMessage(e) })
    // ===================== DEBUG_END:refresh =======================

    const out = NextResponse.json(
      { ok: false, message: "refresh 呼び出しに失敗しました", reqId },
      { status: 502 },
    )
    out.headers.set("Server-Timing", `refresh_error;dur=${total}`)
    out.headers.set("X-Proxy-Request-ID", reqId)
    return out
  }
}

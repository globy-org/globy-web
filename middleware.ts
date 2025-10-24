// middleware.ts
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

/** ==== 設定 ==== */
const AUTH_COOKIE_NAME = "auth_token"

// ロケールを除いた「ベースパス」で startsWith 判定する保護パス
const PROTECTED_PREFIXES = ["/dashboard"]

// UI公開パスの先頭プレフィックス
const PUBLIC_PREFIXES: readonly string[] = ["/signup", "/logout"]

// サポートするロケール（必要に応じて追加）
const LOCALES = new Set(["ja", "en", "en-US"])

/** ==== ユーティリティ ==== */
function splitPath(pathname: string) {
  return pathname.split("/").filter(Boolean)
}
function getLastSegment(pathname: string): string {
  const segs = splitPath(pathname)
  return segs[segs.length - 1] ?? ""
}
function getFirstSegment(pathname: string): string | null {
  const segs = splitPath(pathname)
  return segs[0] ?? null
}

// /login, /ja/login, /en-US/login など「末尾が login」をログインルートとみなす
function isLoginPath(pathname: string): boolean {
  return getLastSegment(pathname) === "login"
}

// /ja/foo → { locale:'ja', base:'/foo' } という形に分解
function splitLocaleBase(pathname: string): { locale: string | null; base: string } {
  const segs = splitPath(pathname)
  const maybeLocale = segs[0]
  if (maybeLocale && LOCALES.has(maybeLocale)) {
    const rest = "/" + segs.slice(1).join("/")
    return { locale: maybeLocale, base: rest || "/" }
  }
  return { locale: null, base: pathname || "/" }
}

// /dashboard, /ja/dashboard などを保護対象とみなす（ベースで判定）
function isProtectedPath(pathname: string): boolean {
  const { base } = splitLocaleBase(pathname)
  return PROTECTED_PREFIXES.some((p) => base === p || base.startsWith(`${p}/`))
}

// UI公開プレフィックス判定（/signup, /logout など）
function isPublicPath(pathname: string): boolean {
  const { base } = splitLocaleBase(pathname)
  return PUBLIC_PREFIXES.some((p) => base === p || base.startsWith(`${p}/`))
}

// ロケール（先頭セグメントがサポート言語のときだけ採用）
function extractLeadingLocale(pathname: string): string | null {
  const head = getFirstSegment(pathname)
  return head && LOCALES.has(head) ? head : null
}

// ロケールを保ったまま、ベース（login/dashboard など）に差し替える
function buildLocalizedPath(pathname: string, targetBase: string): string {
  const locale = extractLeadingLocale(pathname)
  if (!locale) return `/${targetBase}`
  const segs = splitPath(pathname)
  segs.splice(1) // ロケール以外を捨てる
  return `/${locale}/${targetBase}`
}

// /login へのアクセス時、ログイン済みなら /dashboard へ
function redirectLoginToDashboard(req: NextRequest): NextResponse {
  const url = req.nextUrl.clone()
  url.pathname = buildLocalizedPath(req.nextUrl.pathname, "dashboard")
  url.search = ""
  return NextResponse.redirect(url)
}

// 認証が必要だが未ログイン → /login へ
function redirectToLogin(req: NextRequest, reason?: string): NextResponse {
  const url = req.nextUrl.clone()
  url.pathname = buildLocalizedPath(req.nextUrl.pathname, "login")
  url.search = ""
  if (reason) url.searchParams.set("reason", reason)
  return NextResponse.redirect(url)
}

/** ==== ミドルウェア本体 ==== */
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  const hasAuth = Boolean(req.cookies.get(AUTH_COOKIE_NAME)?.value)

  // 1) 公開パス（UIのみ）: 基本スルー
  if (isPublicPath(pathname)) return NextResponse.next()

  // 2) ログイン画面: ログイン済みなら /dashboard に寄せる
  if (isLoginPath(pathname) && hasAuth) {
    return redirectLoginToDashboard(req)
  }

  // 3) 保護パス: 認証必須
  if (isProtectedPath(pathname)) {
    if (!hasAuth) {
      return redirectToLogin(req, "unauthorized")
    }

    // ---- 厳密検証（/api/me でサーバ検証） ----
    if (process.env.NEXT_ENABLE_STRICT_AUTH === "1") {
      try {
        const origin = req.nextUrl.origin
        const res = await fetch(`${origin}/api/me`, {
          headers: { cookie: req.headers.get("cookie") ?? "" },
          cache: "no-store",
        })
        if (!res.ok) return redirectToLogin(req, "invalid")
      } catch {
        return redirectToLogin(req, "error")
      }
    }
  }

  // 4) 通過
  return NextResponse.next()
}

/** ==== matcher（ミドルウェア適用範囲）==== */
export const config = {
  matcher: [
    "/((?!api|_next|favicon.ico|sitemap.xml|robots.txt|.*\\.(png|jpg|jpeg|gif|svg|webp|ico|txt|xml)$).*)",
  ],
}

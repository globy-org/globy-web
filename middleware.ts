// middleware.ts
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

/** ---- 設定 ---- */
const AUTH_COOKIE_NAME = "auth_token"

// 末尾（last segment）が一致するパスを保護
const PROTECTED_LAST_SEGMENTS = new Set(["dashboard"])

// 公開パスの先頭プレフィックス（ミドルウェア対象外）
//   - /api, /_next, 静的拡張子, メタ系は matcher 側で除外しているため、ここではUI系の明示を中心に。
//   - /login は公開扱い。ただし「ログイン済みなら /dashboard へ」というUI制御はこの中では行わない（下の isLoginPath で個別対応）
const PUBLIC_PREFIXES: readonly string[] = ["/signup", "/logout"]

/** ---- ユーティリティ ---- */
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

// /dashboard, /ja/dashboard など「末尾が dashboard」を保護対象とみなす
function isProtectedPath(pathname: string): boolean {
  return PROTECTED_LAST_SEGMENTS.has(getLastSegment(pathname))
}

// UI公開プレフィックス判定（/signup, /logout など）
function isPublicPath(pathname: string): boolean {
  return PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))
}

// ロケール（最初のセグメントが言語っぽい時に採用したい場合はここを拡張）
// ここでは「存在していればそれを維持」するだけで、i18nの付与は行わない
function extractLeadingLocale(pathname: string): string | null {
  const head = getFirstSegment(pathname)
  // 必要に応じてサポート言語配列で厳密判定: const LOCALES = ['ja','en'] as const
  // 例）return LOCALES.includes(head as any) ? head! : null
  // ここでは「何か最初のセグメントがあればロケールかも」として維持目的で返す
  return head ?? null
}

// ロケールを保ったまま、ベースパス（login/dashboard など）に差し替える
function buildLocalizedPath(pathname: string, targetBase: string): string {
  const locale = extractLeadingLocale(pathname)
  if (!locale) return `/${targetBase}`
  const segs = splitPath(pathname)
  // 既存の最初のセグメントをロケールと仮定し、/<locale>/<targetBase> に寄せる
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

/** ---- ミドルウェア本体 ---- */
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  const hasAuth = Boolean(req.cookies.get(AUTH_COOKIE_NAME)?.value)

  // 1) 公開パス（UIのみ）: 基本スルー
  //    ※ /api, /_next, 静的やメタは config.matcher で除外しているのでここでは見ない
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

    // ---- オプション: 厳密検証（/api/me でサーバ検証） ----
    //   Edge Runtime での外部 fetch は可能ですが、レスポンスを信頼できる同一サイトの検証に限定してください。
    //   署名検証はRails側（/api/meなど）で行う前提。
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

/** ---- matcher（ミドルウェア適用範囲）----
 * Next.js推奨の「負マッチ」スタイルで以下を除外:
 * - /api（Route Handler）
 * - /_next（静的/内部）
 * - 静的拡張子（.png/.jpg/...）
 * - メタファイル（favicon/sitemap/robots）
 */
export const config = {
  matcher: [
    "/((?!api|_next|favicon.ico|sitemap.xml|robots.txt|.*\\.(png|jpg|jpeg|gif|svg|webp|ico|txt|xml)$).*)",
  ],
}

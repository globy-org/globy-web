// middleware.ts
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export function middleware(req: NextRequest) {
  const token = req.cookies.get("auth_token")?.value
  const isProtected = req.nextUrl.pathname.startsWith("/dashboard")
  if (isProtected && !token) {
    const url = new URL("/login", req.url)
    url.searchParams.set("next", req.nextUrl.pathname) // 返し先を保持（任意）
    return NextResponse.redirect(url)
  }
  return NextResponse.next()
}

export const config = {
  matcher: ["/dashboard/:path*"], // 守りたいパスを列挙
}

// src/app/dashboard/layout.tsx ※サーバコンポーネント（デフォルト）
// これを入れると、直接アクセス時もSSR段階で弾けます
import { cookies } from "next/headers"
import { redirect } from "next/navigation"

export const dynamic = "force-dynamic" // 認証ありページはキャッシュ無効が安全

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const store = await cookies()
  const token = store.get("auth_token")?.value
  if (!token) redirect("/login")
  return <>{children}</>
}

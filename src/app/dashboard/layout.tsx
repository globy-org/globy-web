// src/app/dashboard/layout.tsx
import { redirect } from "next/navigation"
import { serverFetchMe } from "@/app/_utils/server/fetchMe"

export const dynamic = "force-dynamic"

export default async function DashboardLayout({
  children,
}: { children: React.ReactNode }) {
  const me = await serverFetchMe()
  if (!me) redirect("/login")
  return <>{children}</>
}

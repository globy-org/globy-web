// app/(public)/layout.tsx
import type { ReactNode } from "react"
import { AuthProvider } from "@/contexts/auth-context"

export default function PublicLayout({ children }: { children: ReactNode }) {
  // /login, /signup では /api/me を初回に呼ばない
  return <AuthProvider autoLoad={false}>{children}</AuthProvider>
}

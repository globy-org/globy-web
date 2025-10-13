// src/app/_utils/server/fetchMe.ts (新規)
import { cookies } from "next/headers"

export type User = { id: number; email: string; name?: string }
type MeResponse = { user?: User }

function isMeResponse(x: unknown): x is MeResponse {
  if (typeof x !== "object" || x === null) return false
  const u = (x as Record<string, unknown>).user
  if (u === undefined) return true
  if (typeof u !== "object" || u === null) return false
  const r = u as Record<string, unknown>
  return typeof r.id === "number" && typeof r.email === "string"
}

export async function serverFetchMe(): Promise<User | null> {
  const store = await cookies()
  // Cookie が無いなら即 null（未認証）
  if (!store.get("auth_token")) return null

  const cookieHeader = store.getAll().map(c => `${c.name}=${c.value}`).join("; ")
  // ここ重要: 絶対URLを使う
  const origin = process.env.NEXT_PUBLIC_APP_ORIGIN || "http://localhost:3000"

  const res = await fetch(`${origin}/api/me`, {
    headers: { cookie: cookieHeader },
    cache: "no-store",
  }).catch(() => null)

  if (!res || !res.ok) return null
  const json: unknown = await res.json().catch(() => null)
  return isMeResponse(json) ? json.user ?? null : null
}

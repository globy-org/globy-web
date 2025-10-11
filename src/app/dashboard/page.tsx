// src/app/dashboard/page.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message
  if (typeof err === 'string') return err
  try {
    return JSON.stringify(err)
  } catch {
    return 'Unknown error'
  }
}

export default function DashboardPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleLogout = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      })

      if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new Error(text || `Logout failed (${res.status})`)
      }

      router.push('/login')
    } catch (err: unknown) {
      setError(getErrorMessage(err))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div style={{ padding: '1rem' }}>
      <h1>Dashboard</h1>
      <p>ここに /api/me の結果などを表示予定</p>

      <div style={{ marginTop: '1.5rem' }}>
        <button
          onClick={handleLogout}
          disabled={isLoading}
          style={{
            padding: '0.6rem 1rem',
            borderRadius: 8,
            border: '1px solid #ddd',
            background: isLoading ? '#f3f3f3' : '#fff',
            cursor: isLoading ? 'not-allowed' : 'pointer',
          }}
          aria-busy={isLoading}
        >
          {isLoading ? 'ログアウト中…' : 'ログアウト（テスト）'}
        </button>
        {error && (
          <p style={{ color: 'crimson', marginTop: '0.5rem' }}>
            {error}
          </p>
        )}
      </div>
    </div>
  )
}

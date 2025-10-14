// src/app/signup/page.tsx
"use client"

import type React from "react"
import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { MessageCircle, Eye, EyeOff } from "lucide-react"
import { ThemeToggle } from "@/components/theme-toggle"

type SignupResponse =
  | { ok: true; user: { id: number | string; name: string; email: string } | null }
  | { ok: false; message?: string }

export default function SignUpPage() {
  const router = useRouter()

  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  })

  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (submitting) return

    // --- クライアント側の最低限バリデーション ---
    if (!formData.name.trim()) {
      setErrorMsg("表示名は必須です")
      return
    }
    if (!formData.email || !formData.password || !formData.confirmPassword) {
      setErrorMsg("必要な項目が未入力です")
      return
    }
    if (formData.password !== formData.confirmPassword) {
      setErrorMsg("パスワードが一致しません")
      return
    }
    if (formData.password.length < 8) {
      setErrorMsg("パスワードは8文字以上にしてください")
      return
    }

    setSubmitting(true)
    setErrorMsg(null)

    try {
      // BFF 経由で Rails へ登録 → Cookie 設定（/api/auth/signup が担当）
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          name: formData.name.trim(),
          email: formData.email,
          password: formData.password,
          confirmPassword: formData.confirmPassword,
        }),
      })

      const json = (await res.json().catch(() => ({}))) as SignupResponse

      if (!res.ok || !("ok" in json) || json.ok !== true) {
        const msg = (json as { ok: false; message?: string }).message || "サインアップに失敗しました"
        setErrorMsg(msg)
        setSubmitting(false)
        return
      }

      // サーバ側で HttpOnly Cookie 済み → ダッシュボードへ
      router.replace("/dashboard")
    } catch {
      setErrorMsg("サーバに接続できませんでした")
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen auth-gradient flex items-center justify-center p-4">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
            <MessageCircle className="w-6 h-6 text-white" />
          </div>
          <span className="text-2xl font-bold text-white">globy</span>
        </div>

        <Card className="border-white/10 bg-white/5 backdrop-blur-xl shadow-2xl">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl text-white">アカウントを作成</CardTitle>
            <CardDescription className="text-white/70">今すぐグローバルな会話に参加しましょう</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* 表示名（必須：DBで NOT NULL） */}
              <div className="space-y-2">
                <Label htmlFor="name" className="text-white/90">
                  表示名
                </Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="例）Taro Yamada"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="bg-white/10 border-white/20 text-white placeholder:text-white/50 focus:border-white/40"
                  required
                  autoComplete="name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email" className="text-white/90">
                  メールアドレス
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="メールアドレスを入力"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="bg-white/10 border-white/20 text-white placeholder:text-white/50 focus:border-white/40"
                  required
                  autoComplete="email"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-white/90">
                  パスワード
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="パスワードを作成（8文字以上）"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="bg-white/10 border-white/20 text-white placeholder:text-white/50 focus:border-white/40 pr-10"
                    required
                    autoComplete="new-password"
                    minLength={8}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 text-white/70 hover:text-white hover:bg-transparent"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? "パスワードを隠す" : "パスワードを表示"}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="text-white/90">
                  パスワード確認
                </Label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="パスワードを再入力"
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                    className="bg-white/10 border-white/20 text-white placeholder:text-white/50 focus:border-white/40 pr-10"
                    required
                    autoComplete="new-password"
                    minLength={8}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 text-white/70 hover:text-white hover:bg-transparent"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    aria-label={showConfirmPassword ? "確認用パスワードを隠す" : "確認用パスワードを表示"}
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </Button>
                </div>
              </div>

              {errorMsg && (
                <p className="text-red-300 text-sm" role="alert">
                  {errorMsg}
                </p>
              )}

              <Button
                type="submit"
                className="w-full bg-white text-primary hover:bg-white/90 font-semibold"
                size="lg"
                disabled={submitting}
              >
                {submitting ? "作成中..." : "サインアップ"}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-white/70">
                すでにアカウントをお持ちの方は{" "}
                <Link
                  href="/login"
                  className="text-white hover:text-white/80 font-semibold underline underline-offset-4"
                >
                  こちらからサインイン
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// src/app/api/whoami/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { apiFetch } from '@/lib/api-fetch';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type MeResponse = {
  user: { id: number; name: string; email: string };
};

// --- ベースURL解決: 環境変数 > Docker想定 > ローカル ---
function resolveApiBase(): string {
  const fromEnv =
    process.env.API_BASE_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    '';

  if (fromEnv.trim()) return fromEnv;

  // コンテナ内かどうかの簡易判定（必要なら docker-compose に IN_DOCKER=1 を追加）
  const inDocker =
    process.env.IN_DOCKER === '1' ||
    process.env.DOCKER === '1' ||
    process.env.CONTAINER === 'true';

  return inDocker ? 'http://api:3000' : 'http://localhost:3001';
}

const API_BASE = resolveApiBase();

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization') ?? '';

  try {
    const result = await apiFetch<MeResponse>(`${API_BASE}/me`, {
      headers: auth ? { Authorization: auth } : {},
      cache: 'no-store',
    });

    if (result.ok) {
      return NextResponse.json(result.data, { status: result.status });
    }

    // BFFはAPIのステータスをそのまま返す
    return NextResponse.json(result.error, { status: result.status });
  } catch (e) {
    const message =
      e instanceof Error ? `${e.name}: ${e.message}` : 'Unknown error';

    // ログ（必要なら base も出す）
    console.error('[BFF /api/whoami] fetch error:', message, 'API_BASE=', API_BASE);

    return NextResponse.json(
      { message: 'BFF failed to fetch /me', details: message },
      { status: 500 },
    );
  }
}

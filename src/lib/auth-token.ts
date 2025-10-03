import { cookies } from 'next/headers';

/** サーバ側で cookie から token を取得（App Router） */
export async function getServerToken(): Promise<string | null> {
  // cookies() は Promise なので await 必須
  const cookieStore = await cookies();
  return cookieStore.get('auth_token')?.value ?? null;
}
/** クライアント側で cookie から token を取得（必要なら） */
export function getClientToken(cookieName = 'auth_token'): string | undefined {
  if (typeof document === 'undefined') return undefined;
  const m = document.cookie.match(new RegExp(`(?:^|; )${cookieName}=([^;]*)`));
  return m ? decodeURIComponent(m[1]) : undefined;
}

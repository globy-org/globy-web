// src/lib/api-fetch.ts

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface ApiFetchOptions<B = unknown> {
  method?: HttpMethod;
  headers?: Record<string, string>;
  body?: B;
  cache?: RequestCache;
  credentials?: RequestCredentials;
  next?: NextFetchRequestConfig;
  baseUrl?: string; // ★ baseUrl を追加
}

export interface ApiSuccess<T> {
  ok: true;
  status: number;
  data: T;
  headers: Headers;
  token?: string;
}

export interface ApiFail {
  ok: false;
  status: number;
  error: {
    message: string;
    code?: string;
    details?: unknown;
  };
  headers: Headers;
}

export type ApiResult<T> = ApiSuccess<T> | ApiFail;

// ---- ユーティリティ ----
function readJwtFromHeaders(headers: Headers): string | undefined {
  const auth = headers.get('authorization');
  if (!auth) return undefined;
  const prefix = 'Bearer ';
  return auth.startsWith(prefix) ? auth.slice(prefix.length) : undefined;
}

function safeJsonParse(text: string): unknown {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function toErrorMessage(payload: unknown): string {
  if (typeof payload === 'string') return payload;

  if (payload && typeof payload === 'object') {
    const obj = payload as Record<string, unknown>;
    if (typeof obj.message === 'string') return obj.message;

    if (Array.isArray(obj.errors)) {
      const arr = obj.errors as unknown[];
      const texts = arr.map((e) => (typeof e === 'string' ? e : '')).filter(Boolean);
      if (texts.length) return texts.join(', ');
    }

    if (typeof obj.error === 'string') return obj.error;
  }

  return 'Request failed';
}

// ---- 本体 ----
export async function apiFetch<T, B = unknown>(
  path: string,
  options: ApiFetchOptions<B> = {},
): Promise<ApiResult<T>> {
  const {
    method = 'GET',
    headers: userHeaders,
    body,
    cache = 'no-store',
    credentials,
    next,
    baseUrl,
  } = options;

  const headers = new Headers(userHeaders ?? {});
  const init: RequestInit & { next?: NextFetchRequestConfig } = {
    method,
    headers,
    cache,
    credentials,
    next,
  };

  if (body !== undefined) {
    const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
    if (isFormData) {
      init.body = body as unknown as BodyInit;
      headers.delete('Content-Type');
    } else {
      headers.set('Content-Type', 'application/json');
      init.body = JSON.stringify(body);
    }
  }

  // ★ baseUrl があれば組み立てる
  const url = baseUrl ? new URL(path, baseUrl).toString() : path;

  const res = await fetch(url, init);
  const token = readJwtFromHeaders(res.headers);

  const text = await res.text();
  const json = safeJsonParse(text);

  if (res.ok) {
    return {
      ok: true,
      status: res.status,
      data: json as T,
      headers: res.headers,
      token,
    };
  }

  return {
    ok: false,
    status: res.status,
    error: {
      message: toErrorMessage(json),
      details: json,
    },
    headers: res.headers,
  };
}

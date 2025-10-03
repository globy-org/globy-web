export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json }
  | Json[];

export type ApiResult<T> = {
  ok: true;
  data: T;
  status: number;
  headers: Headers;
} | {
  ok: false;
  error: ApiError;
  status: number;
  headers: Headers;
};

export class ApiError extends Error {
  status: number;
  code?: string;
  details?: unknown;

  constructor(message: string, status: number, code?: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

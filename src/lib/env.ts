/**
 * API のベースURLを一元管理。
 * - BFF経由にするなら '/api' 固定
 * - 直接 Rails API を叩くなら NEXT_PUBLIC_API_BASE をセット
 */
export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE?.replace(/\/+$/, '') || '/api';

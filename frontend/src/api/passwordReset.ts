// 再設定リンクからのパスワード再設定。バックエンド Api::PasswordResetsController に対応する。
import { request } from './http'
import type { User } from '../types/auth'

export interface PasswordResetInput {
  token: string
  password: string
  password_confirmation: string
}

// GET /api/password_reset?token= （リンクが使えれば対象のメールアドレス。無効なら 422 → ApiError）
export function checkPasswordResetToken(token: string): Promise<{ email: string }> {
  return request<{ email: string }>('/password_reset', { query: { token } })
}

// PATCH /api/password_reset （成功するとこの端末でログイン状態になり、ユーザーを返す）
export function resetPassword(input: PasswordResetInput): Promise<User> {
  return request<User>('/password_reset', { method: 'PATCH', body: input })
}

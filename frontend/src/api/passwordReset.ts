// 再設定リンクからのパスワード再設定。バックエンド Api::PasswordResetsController に対応する。
import { request } from './http'
import type { User } from '../types/auth'

export interface PasswordResetInput {
  token: string
  password: string
  password_confirmation: string
}

// PATCH /api/password_reset （成功するとこの端末でログイン状態になり、ユーザーを返す）
export function resetPassword(input: PasswordResetInput): Promise<User> {
  return request<User>('/password_reset', { method: 'PATCH', body: input })
}

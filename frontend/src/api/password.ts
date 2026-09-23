// パスワード変更 API。バックエンド Api::PasswordsController に対応する。
import { request } from './http'

export interface PasswordChangeInput {
  current_password: string
  password: string
  password_confirmation: string
}

// PATCH /api/password （成功は 204。他端末のセッションは失効する）
export function changePassword(input: PasswordChangeInput): Promise<void> {
  return request<void>('/password', { method: 'PATCH', body: input })
}

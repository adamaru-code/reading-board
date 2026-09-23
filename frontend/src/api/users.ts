// ユーザー管理（管理者のみ）。バックエンド Api::UsersController / PasswordResetLinksController に対応する。
import { request } from './http'
import type { UserSummary, PasswordResetLink } from '../types/auth'

// GET /api/users （登録順）
export function listUsers(): Promise<UserSummary[]> {
  return request<UserSummary[]>('/users')
}

// POST /api/users/:user_id/password_reset_link （24 時間有効・1 回限り）
export function createPasswordResetLink(userId: number): Promise<PasswordResetLink> {
  return request<PasswordResetLink>(`/users/${userId}/password_reset_link`, { method: 'POST' })
}

// 再設定リンク（開くと再設定画面になる）
export function passwordResetUrl(token: string): string {
  return `${window.location.origin}/?reset=${encodeURIComponent(token)}`
}

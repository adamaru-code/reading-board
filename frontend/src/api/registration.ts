// 招待コードによるアカウント登録。バックエンド Api::RegistrationsController に対応する。
import { request } from './http'
import type { User } from '../types/auth'

export interface RegistrationInput {
  invitation_code: string
  email: string
  password: string
  password_confirmation: string
}

// POST /api/registration （成功するとログイン状態になり、ユーザーを返す）
export function register(input: RegistrationInput): Promise<User> {
  return request<User>('/registration', { method: 'POST', body: input })
}

// DELETE /api/registration （現在のパスワードで確認してアカウントを削除。本もすべて消える）
export function deleteAccount(currentPassword: string): Promise<void> {
  return request<void>('/registration', {
    method: 'DELETE',
    body: { current_password: currentPassword },
  })
}

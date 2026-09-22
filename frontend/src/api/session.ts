// 認証 API（セッション Cookie）。フロントは同一オリジン（Vite プロキシ）なので
// Cookie は既定（same-origin）で送受信される。
import { request } from './http'
import type { User } from '../types/auth'

// GET /api/session （ログイン中のユーザー。未認証は 401 → ApiError）
export function fetchCurrentUser(): Promise<User> {
  return request<User>('/session')
}

// POST /api/session
export function login(email: string, password: string): Promise<User> {
  return request<User>('/session', { method: 'POST', body: { email, password } })
}

// DELETE /api/session
export function logout(): Promise<void> {
  return request<void>('/session', { method: 'DELETE' })
}

// ログイン中のユーザー（Api::SessionsController の JSON 契約に一致）
export interface User {
  id: number
  email: string
  // 管理者（招待コードを発行できる）
  admin: boolean
}

// 招待の状態（未使用 / 使用済み / 期限切れ）
export type InvitationStatus = 'unused' | 'used' | 'expired'

// 招待コード（Api::InvitationsController の JSON 契約に一致）
export interface Invitation {
  id: number
  code: string
  status: InvitationStatus
  expires_at: string
  used_at: string | null
  used_by_email: string | null
  created_at: string
}

// ユーザー一覧の 1 件（Api::UsersController の JSON 契約に一致）
export interface UserSummary extends User {
  created_at: string
}

// 発行したパスワード再設定リンクのトークン（保存されない。発行時にだけ受け取る）
export interface PasswordResetLink {
  token: string
  expires_at: string
}

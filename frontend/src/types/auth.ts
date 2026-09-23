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

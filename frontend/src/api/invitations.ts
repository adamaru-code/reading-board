// 招待コードの管理（管理者のみ）。バックエンド Api::InvitationsController に対応する。
import { request } from './http'
import type { Invitation } from '../types/auth'

// GET /api/invitations （自分が発行した招待。新しい順）
export function listInvitations(): Promise<Invitation[]> {
  return request<Invitation[]>('/invitations')
}

// POST /api/invitations
export function createInvitation(): Promise<Invitation> {
  return request<Invitation>('/invitations', { method: 'POST' })
}

// DELETE /api/invitations/:id （未使用のものだけ）
export function deleteInvitation(id: number): Promise<void> {
  return request<void>(`/invitations/${id}`, { method: 'DELETE' })
}

// 招待リンク（開くと登録画面にコードが入った状態になる）
export function invitationUrl(code: string): string {
  return `${window.location.origin}/?invite=${encodeURIComponent(code)}`
}

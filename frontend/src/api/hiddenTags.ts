// タグ候補から隠したタグ。バックエンド Api::HiddenTagsController に対応する。
import { request } from './http'
import type { HiddenTag } from '../types/book'

// GET /api/hidden_tags （名前順）
export function listHiddenTags(): Promise<HiddenTag[]> {
  return request<HiddenTag[]>('/hidden_tags')
}

// POST /api/hidden_tags （既に隠していれば同じものが返る）
export function hideTag(name: string): Promise<HiddenTag> {
  return request<HiddenTag>('/hidden_tags', { method: 'POST', body: { name } })
}

// DELETE /api/hidden_tags/:id （候補に戻す）
export function unhideTag(id: number): Promise<void> {
  return request<void>(`/hidden_tags/${id}`, { method: 'DELETE' })
}

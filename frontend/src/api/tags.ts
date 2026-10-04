// 自分の本のタグ（アカウント画面の「タグ」）。バックエンド Api::TagsController に対応する。
// タグは全ユーザーで共有しているので、バックエンドは自分の本のつながりだけを付け替える・外す
import { request } from './http'

// 自分の本に付いているタグと冊数
export interface MyTag {
  name: string
  count: number
}

// 付け替えた（外した）冊数と、既にある名前にまとめたか
export interface TagChangeResult {
  count: number
  merged: boolean
}

// GET /api/tags （冊数の多い順）
export function listMyTags(): Promise<MyTag[]> {
  return request<MyTag[]>('/tags')
}

// PATCH /api/tags/rename （既にある名前にすると 1 つにまとめる）
export function renameTag(from: string, to: string): Promise<TagChangeResult> {
  return request<TagChangeResult>('/tags/rename', { method: 'PATCH', body: { from, to } })
}

// DELETE /api/tags/remove?name= （自分のすべての本から外す）
export function removeTag(name: string): Promise<TagChangeResult> {
  return request<TagChangeResult>('/tags/remove', { method: 'DELETE', query: { name } })
}

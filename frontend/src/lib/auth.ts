// ログイン中のユーザーを、画面（ルート）をまたいで共有する小さな仕組み。
// ルーターのナビゲーションガード（router/index.ts）と App.vue が使う
import { ref } from 'vue'
import { fetchCurrentUser } from '../api/session'
import type { User } from '../types/auth'

export const currentUser = ref<User | null>(null)
// 最初の「ログインしているか」の確認が終わったか（終わるまで「読み込み中…」を出す）
export const authChecked = ref(false)

let checking: Promise<void> | null = null

// 最初の 1 回だけサーバーに確認する（以降は結果を使い回す）
export function ensureAuthChecked(): Promise<void> {
  checking ||= fetchCurrentUser()
    .then((user) => {
      currentUser.value = user
    })
    .catch(() => {
      currentUser.value = null // 未ログイン（401 など）
    })
    .finally(() => {
      authChecked.value = true
    })
  return checking
}

export function setUser(user: User) {
  currentUser.value = user
  authChecked.value = true
}

export function clearUser() {
  currentUser.value = null
}

// テスト用：確認をやり直せるようにする
export function resetAuthForTest() {
  checking = null
  currentUser.value = null
  authChecked.value = false
}

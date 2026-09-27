<script setup lang="ts">
import { useRouter } from 'vue-router'
import { currentUser, authChecked, setUser, clearUser } from './lib/auth'
import type { User } from './types/auth'

// 画面の切り替えは vue-router（src/router/index.ts）が URL を見て行う。
// App は、各画面が出す「ログインした」「ログイン画面へ」などの知らせを受けて URL を移すだけ
const router = useRouter()

// ログイン・登録・再設定が済んだらボードへ（URL の招待コード・トークンも消える）
function onLoggedIn(user: User) {
  setUser(user)
  router.replace({ name: 'board' })
}

// ログアウト、または操作中に 401 になったとき
function onLoggedOut() {
  clearUser()
  router.replace({ name: 'login' })
}
</script>

<template>
  <p v-if="!authChecked" class="app-loading">読み込み中…</p>
  <RouterView v-else v-slot="{ Component, route }">
    <!-- ログインが必要な画面（ボード・読了一覧）にだけログイン中のユーザーを渡す。
         ログアウト直後（ユーザーを消してから /login へ移るまで）は描かない -->
    <component
      :is="Component"
      v-if="!route.meta.requiresAuth || currentUser"
      v-bind="route.meta.requiresAuth ? { user: currentUser } : {}"
      @logged-in="onLoggedIn"
      @show-register="router.push({ name: 'register' })"
      @show-login="router.push({ name: 'login' })"
      @logout="onLoggedOut"
    />
  </RouterView>
</template>

<style scoped>
.app-loading {
  padding: 24px;
  color: var(--text-sub);
}
</style>

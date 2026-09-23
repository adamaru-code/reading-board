<script setup lang="ts">
import { ref, onMounted } from 'vue'
import KanbanBoard from './components/KanbanBoard.vue'
import LoginView from './components/LoginView.vue'
import RegisterView from './components/RegisterView.vue'
import { fetchCurrentUser } from './api/session'
import type { User } from './types/auth'

const user = ref<User | null>(null)
const authChecked = ref(false)

// 招待リンク（?invite=CODE）で開いたら登録画面をコード入力済みで出す
const inviteCode = new URLSearchParams(window.location.search).get('invite') ?? ''
const authView = ref<'login' | 'register'>(inviteCode ? 'register' : 'login')

onMounted(async () => {
  try {
    user.value = await fetchCurrentUser()
  } catch {
    user.value = null // 未ログイン（401 など）
  } finally {
    authChecked.value = true
  }
})

function onLoggedIn(loggedIn: User) {
  user.value = loggedIn
  // 使い終わった招待コードを URL から消す
  if (inviteCode) window.history.replaceState(null, '', window.location.pathname)
}

// ログアウト、または操作中に 401 になったときに呼ぶ
function onLoggedOut() {
  user.value = null
  authView.value = 'login'
}
</script>

<template>
  <p v-if="!authChecked" class="app-loading">読み込み中…</p>
  <template v-else-if="!user">
    <RegisterView
      v-if="authView === 'register'"
      :initial-code="inviteCode"
      @logged-in="onLoggedIn"
      @show-login="authView = 'login'"
    />
    <LoginView v-else @logged-in="onLoggedIn" @show-register="authView = 'register'" />
  </template>
  <KanbanBoard v-else :user="user" @logout="onLoggedOut" />
</template>

<style scoped>
.app-loading {
  padding: 24px;
  color: var(--text-sub);
}
</style>

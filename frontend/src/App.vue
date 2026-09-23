<script setup lang="ts">
import { ref, onMounted } from 'vue'
import KanbanBoard from './components/KanbanBoard.vue'
import LoginView from './components/LoginView.vue'
import RegisterView from './components/RegisterView.vue'
import ResetPasswordView from './components/ResetPasswordView.vue'
import { fetchCurrentUser } from './api/session'
import type { User } from './types/auth'

const user = ref<User | null>(null)
const authChecked = ref(false)

// 招待リンク（?invite=CODE）で開いたら登録画面をコード入力済みで出す
const query = new URLSearchParams(window.location.search)
const inviteCode = query.get('invite') ?? ''
// 再設定リンク（?reset=TOKEN）はログイン状態に関係なく再設定画面を出す
const resetToken = ref(query.get('reset') ?? '')
const authView = ref<'login' | 'register'>(inviteCode ? 'register' : 'login')

// 使い終わった招待コード・再設定トークンを URL から消す
function clearQuery() {
  if (window.location.search) window.history.replaceState(null, '', window.location.pathname)
}

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
  resetToken.value = ''
  clearQuery()
}

// 再設定画面からログイン画面へ戻る
function leaveReset() {
  resetToken.value = ''
  clearQuery()
}

// ログアウト、または操作中に 401 になったときに呼ぶ
function onLoggedOut() {
  user.value = null
  authView.value = 'login'
}
</script>

<template>
  <p v-if="!authChecked" class="app-loading">読み込み中…</p>
  <ResetPasswordView
    v-else-if="resetToken"
    :token="resetToken"
    @logged-in="onLoggedIn"
    @show-login="leaveReset"
  />
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

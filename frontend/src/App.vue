<script setup lang="ts">
import { ref, onMounted } from 'vue'
import KanbanBoard from './components/KanbanBoard.vue'
import LoginView from './components/LoginView.vue'
import { fetchCurrentUser } from './api/session'
import type { User } from './types/auth'

const user = ref<User | null>(null)
const authChecked = ref(false)

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
}

// ログアウト、または操作中に 401 になったときに呼ぶ
function onLoggedOut() {
  user.value = null
}
</script>

<template>
  <p v-if="!authChecked" class="app-loading">読み込み中…</p>
  <LoginView v-else-if="!user" @logged-in="onLoggedIn" />
  <KanbanBoard v-else :user="user" @logout="onLoggedOut" />
</template>

<style scoped>
.app-loading {
  padding: 24px;
  color: var(--text-sub);
}
</style>

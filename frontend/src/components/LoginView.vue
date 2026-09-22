<script setup lang="ts">
import { ref } from 'vue'
import { login } from '../api/session'
import { ApiError } from '../api/http'
import type { User } from '../types/auth'

const emit = defineEmits<{ 'logged-in': [user: User] }>()

const email = ref('')
const password = ref('')
const error = ref('')
const submitting = ref(false)

async function onSubmit() {
  error.value = ''
  submitting.value = true
  try {
    const user = await login(email.value.trim(), password.value)
    emit('logged-in', user)
  } catch (e) {
    error.value =
      e instanceof ApiError && e.errors.length > 0
        ? e.errors[0]
        : 'ログインに失敗しました。時間をおいて再度お試しください。'
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="login">
    <form class="login-card" @submit.prevent="onSubmit">
      <h1 class="login-title">📚 読書管理ボード</h1>
      <p class="login-sub">ログインしてください</p>

      <p v-if="error" class="login-error" role="alert">{{ error }}</p>

      <label class="field">
        <span class="field-label">メールアドレス</span>
        <input v-model="email" type="email" autocomplete="username" required autofocus />
      </label>

      <label class="field">
        <span class="field-label">パスワード</span>
        <input v-model="password" type="password" autocomplete="current-password" required />
      </label>

      <button type="submit" class="login-btn" :disabled="submitting">
        {{ submitting ? 'ログイン中…' : 'ログイン' }}
      </button>
    </form>
  </div>
</template>

<style scoped>
.login {
  min-height: 100svh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px 16px;
}
.login-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 28px 24px;
  width: 100%;
  max-width: 360px;
  box-shadow: 0 4px 16px rgba(9, 30, 66, 0.12);
}
.login-title {
  font-size: 20px;
  font-weight: 700;
  margin: 0;
}
.login-sub {
  color: var(--text-sub);
  font-size: 13px;
  margin: 4px 0 20px;
}
.login-error {
  margin: 0 0 16px;
  padding: 10px 12px;
  background: #ffeceb;
  border: 1px solid var(--danger);
  border-radius: 6px;
  color: var(--danger);
  font-size: 13px;
}
.field {
  display: block;
  margin-bottom: 14px;
}
.field-label {
  display: block;
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 4px;
}
.field input {
  width: 100%;
  padding: 8px 10px;
  border: 1px solid var(--border);
  border-radius: 6px;
  font: inherit;
  box-sizing: border-box;
}
.login-btn {
  width: 100%;
  margin-top: 6px;
  background: var(--primary);
  color: #fff;
  border: none;
  border-radius: 6px;
  padding: 10px 16px;
  font: inherit;
  cursor: pointer;
}
.login-btn:disabled {
  opacity: 0.6;
  cursor: default;
}
</style>

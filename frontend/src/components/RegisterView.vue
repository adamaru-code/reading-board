<script setup lang="ts">
import { ref, computed } from 'vue'
import { register } from '../api/registration'
import { ApiError } from '../api/http'
import { PASSWORD_MIN_LENGTH as MIN_LENGTH } from '../lib/password'
import type { User } from '../types/auth'

const props = defineProps<{ initialCode?: string }>()
const emit = defineEmits<{ 'logged-in': [user: User]; 'show-login': [] }>()

const invitationCode = ref(props.initialCode ?? '')
const email = ref('')
const password = ref('')
const passwordConfirmation = ref('')
const error = ref('')
const submitting = ref(false)

// 送信前にわかる不備（最終判定はバックエンド）
const clientError = computed(() => {
  if (password.value.length > 0 && password.value.length < MIN_LENGTH)
    return `パスワードは ${MIN_LENGTH} 文字以上にしてください`
  if (passwordConfirmation.value.length > 0 && password.value !== passwordConfirmation.value)
    return 'パスワード（確認）が一致しません'
  return ''
})

async function onSubmit() {
  if (clientError.value) return
  error.value = ''
  submitting.value = true
  try {
    const user = await register({
      invitation_code: invitationCode.value.trim(),
      email: email.value.trim(),
      password: password.value,
      password_confirmation: passwordConfirmation.value,
    })
    emit('logged-in', user)
  } catch (e) {
    error.value =
      e instanceof ApiError && e.errors.length > 0
        ? e.errors[0]
        : '登録に失敗しました。時間をおいて再度お試しください。'
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="login">
    <form class="login-card" @submit.prevent="onSubmit">
      <h1 class="login-title">📚 読書管理ボード</h1>
      <p class="login-sub">招待コードで新規登録</p>

      <p v-if="error" class="login-error" role="alert">{{ error }}</p>

      <label class="field">
        <span class="field-label">招待コード</span>
        <input v-model="invitationCode" type="text" autocomplete="off" required />
      </label>

      <label class="field">
        <span class="field-label">メールアドレス</span>
        <input v-model="email" type="email" autocomplete="username" required />
      </label>

      <label class="field">
        <span class="field-label">パスワード（{{ MIN_LENGTH }} 文字以上）</span>
        <input
          v-model="password"
          type="password"
          autocomplete="new-password"
          :minlength="MIN_LENGTH"
          required
        />
      </label>

      <label class="field">
        <span class="field-label">パスワード（確認）</span>
        <input
          v-model="passwordConfirmation"
          type="password"
          autocomplete="new-password"
          required
        />
      </label>

      <p v-if="clientError" class="field-hint">{{ clientError }}</p>

      <button type="submit" class="login-btn" :disabled="submitting || !!clientError">
        {{ submitting ? '登録中…' : '登録してはじめる' }}
      </button>

      <button type="button" class="switch-link" @click="emit('show-login')">
        アカウントをお持ちの方はログイン
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
.field-hint {
  margin: -6px 0 8px;
  font-size: 12px;
  color: var(--danger);
}
.switch-link {
  display: block;
  width: 100%;
  margin-top: 14px;
  background: none;
  border: none;
  color: var(--primary);
  font: inherit;
  font-size: 13px;
  cursor: pointer;
  text-decoration: underline;
}
</style>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { changePassword } from '../api/password'
import { ApiError } from '../api/http'

// バックエンド User::PASSWORD_MIN_LENGTH と揃える
const MIN_LENGTH = 8

const emit = defineEmits<{ close: []; unauthorized: [] }>()

const currentPassword = ref('')
const password = ref('')
const passwordConfirmation = ref('')
const errors = ref<string[]>([])
const submitting = ref(false)
const done = ref(false)

// 送信前にわかる不備（最終判定はバックエンド）
const clientError = computed(() => {
  if (password.value.length > 0 && password.value.length < MIN_LENGTH)
    return `新しいパスワードは ${MIN_LENGTH} 文字以上にしてください`
  if (passwordConfirmation.value.length > 0 && password.value !== passwordConfirmation.value)
    return '新しいパスワード（確認）が一致しません'
  return ''
})

async function onSubmit() {
  if (clientError.value) return
  errors.value = []
  submitting.value = true
  try {
    await changePassword({
      current_password: currentPassword.value,
      password: password.value,
      password_confirmation: passwordConfirmation.value,
    })
    done.value = true
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) {
      emit('unauthorized')
      return
    }
    errors.value =
      e instanceof ApiError && e.errors.length > 0
        ? e.errors
        : ['パスワードの変更に失敗しました。時間をおいて再度お試しください。']
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="modal-overlay" @click.self="emit('close')" @keydown.esc="emit('close')">
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="password-modal-title">
      <h2 id="password-modal-title" class="modal-title">パスワード変更</h2>

      <template v-if="done">
        <p class="done-message" role="status">
          パスワードを変更しました。他の端末ではログアウトされています。
        </p>
        <div class="modal-actions">
          <span class="spacer"></span>
          <button type="button" class="btn btn-primary" @click="emit('close')">閉じる</button>
        </div>
      </template>

      <form v-else @submit.prevent="onSubmit">
        <ul v-if="errors.length" class="form-errors" role="alert">
          <li v-for="(msg, i) in errors" :key="i">{{ msg }}</li>
        </ul>

        <label class="field">
          <span class="field-label">現在のパスワード</span>
          <input
            v-model="currentPassword"
            type="password"
            autocomplete="current-password"
            required
            autofocus
          />
        </label>

        <label class="field">
          <span class="field-label">新しいパスワード（{{ MIN_LENGTH }} 文字以上）</span>
          <input
            v-model="password"
            type="password"
            autocomplete="new-password"
            :minlength="MIN_LENGTH"
            required
          />
        </label>

        <label class="field">
          <span class="field-label">新しいパスワード（確認）</span>
          <input v-model="passwordConfirmation" type="password" autocomplete="new-password" required />
        </label>

        <p v-if="clientError" class="field-hint">{{ clientError }}</p>

        <div class="modal-actions">
          <span class="spacer"></span>
          <button type="button" class="btn btn-ghost" :disabled="submitting" @click="emit('close')">
            キャンセル
          </button>
          <button type="submit" class="btn btn-primary" :disabled="submitting || !!clientError">
            {{ submitting ? '変更中…' : '変更する' }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(9, 30, 66, 0.5);
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 48px 16px;
  z-index: 100;
}
.modal {
  background: var(--surface);
  border-radius: 10px;
  padding: 20px;
  width: 100%;
  max-width: 400px;
  box-shadow: 0 8px 24px rgba(9, 30, 66, 0.25);
}
.modal-title {
  font-size: 18px;
  font-weight: 700;
  margin-bottom: 16px;
}
.form-errors {
  margin: 0 0 16px;
  padding: 10px 12px 10px 28px;
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
.field-hint {
  margin: -6px 0 0;
  font-size: 12px;
  color: var(--danger);
}
.done-message {
  font-size: 14px;
}
.modal-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 20px;
}
.spacer {
  flex: 1;
}
.btn {
  border: 1px solid transparent;
  border-radius: 6px;
  padding: 8px 16px;
  font: inherit;
  cursor: pointer;
}
.btn:disabled {
  opacity: 0.6;
  cursor: default;
}
.btn-primary {
  background: var(--primary);
  color: #fff;
}
.btn-ghost {
  background: var(--surface);
  border-color: var(--border);
}
</style>

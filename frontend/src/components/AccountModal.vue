<script setup lang="ts">
import { ref, computed } from 'vue'
import { changePassword } from '../api/password'
import { deleteAccount } from '../api/registration'
import { ApiError } from '../api/http'

// バックエンド User::PASSWORD_MIN_LENGTH と揃える
const MIN_LENGTH = 8

const emit = defineEmits<{ close: []; unauthorized: []; deleted: [] }>()

// パスワード変更 / アカウント削除 の切り替え
const tab = ref<'password' | 'delete'>('password')

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

// ---------- アカウント削除 ----------
const deletePassword = ref('')
const deleteConfirmed = ref(false)
const deleteErrors = ref<string[]>([])
const deleting = ref(false)

async function onDelete() {
  if (!deleteConfirmed.value) return
  deleteErrors.value = []
  deleting.value = true
  try {
    await deleteAccount(deletePassword.value)
    emit('deleted')
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) {
      emit('unauthorized')
      return
    }
    deleteErrors.value =
      e instanceof ApiError && e.errors.length > 0
        ? e.errors
        : ['アカウントの削除に失敗しました。時間をおいて再度お試しください。']
  } finally {
    deleting.value = false
  }
}

// ---------- パスワード変更 ----------
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
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="account-modal-title">
      <h2 id="account-modal-title" class="modal-title">アカウント</h2>

      <div class="tabs" role="tablist">
        <button
          type="button"
          role="tab"
          class="tab"
          :aria-selected="tab === 'password'"
          @click="tab = 'password'"
        >
          パスワード変更
        </button>
        <button
          type="button"
          role="tab"
          class="tab"
          :aria-selected="tab === 'delete'"
          @click="tab = 'delete'"
        >
          アカウント削除
        </button>
      </div>

      <form v-if="tab === 'delete'" class="delete-form" @submit.prevent="onDelete">
        <ul v-if="deleteErrors.length" class="form-errors" role="alert">
          <li v-for="(msg, i) in deleteErrors" :key="i">{{ msg }}</li>
        </ul>

        <p class="delete-warning">
          アカウントを削除すると、登録した本・メモ・タグの紐づけがすべて削除され、元に戻せません。
        </p>

        <label class="field">
          <span class="field-label">現在のパスワード</span>
          <input
            v-model="deletePassword"
            type="password"
            autocomplete="current-password"
            required
          />
        </label>

        <label class="confirm-check">
          <input v-model="deleteConfirmed" type="checkbox" />
          すべてのデータが削除されることを理解しました
        </label>

        <div class="modal-actions">
          <span class="spacer"></span>
          <button type="button" class="btn btn-ghost" :disabled="deleting" @click="emit('close')">
            キャンセル
          </button>
          <button type="submit" class="btn btn-danger" :disabled="deleting || !deleteConfirmed">
            {{ deleting ? '削除中…' : 'アカウントを削除' }}
          </button>
        </div>
      </form>

      <template v-else-if="done">
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
          <input
            v-model="passwordConfirmation"
            type="password"
            autocomplete="new-password"
            required
          />
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
  margin-bottom: 12px;
}
.tabs {
  display: flex;
  gap: 4px;
  margin-bottom: 16px;
  border-bottom: 1px solid var(--border);
}
.tab {
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  padding: 6px 10px;
  font: inherit;
  font-size: 13px;
  color: var(--text-sub);
  cursor: pointer;
}
.tab[aria-selected='true'] {
  color: var(--primary);
  border-bottom-color: var(--primary);
  font-weight: 600;
}
.delete-warning {
  margin: 0 0 14px;
  font-size: 13px;
  color: var(--danger);
}
.confirm-check {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
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
.btn-danger {
  background: var(--danger);
  color: #fff;
}
</style>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { listUsers, createPasswordResetLink, passwordResetUrl } from '../api/users'
import { ApiError } from '../api/http'
import type { UserSummary } from '../types/auth'

// 管理モーダル（AdminModal）の「ユーザー」タブ
const emit = defineEmits<{ unauthorized: [] }>()

const users = ref<UserSummary[]>([])
const loading = ref(true)
const busy = ref(false)
const error = ref('')
// 発行した再設定リンク（保存されないので、このタブを開いている間だけ表示する）
const issued = ref<{ userId: number; url: string; expiresAt: string } | null>(null)
const copied = ref(false)

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('ja-JP', { dateStyle: 'short', timeStyle: 'short' })
}

// 401 はログイン画面へ、それ以外はメッセージを出す
function handleError(e: unknown, fallback: string) {
  if (e instanceof ApiError && e.status === 401) {
    emit('unauthorized')
    return
  }
  error.value = e instanceof ApiError && e.errors.length > 0 ? e.errors[0] : fallback
}

onMounted(async () => {
  try {
    users.value = await listUsers()
  } catch (e) {
    handleError(e, 'ユーザーの取得に失敗しました。')
  } finally {
    loading.value = false
  }
})

async function onIssue(user: UserSummary) {
  error.value = ''
  busy.value = true
  try {
    const link = await createPasswordResetLink(user.id)
    issued.value = { userId: user.id, url: passwordResetUrl(link.token), expiresAt: link.expires_at }
    copied.value = false
  } catch (e) {
    handleError(e, '再設定リンクの発行に失敗しました。')
  } finally {
    busy.value = false
  }
}

async function onCopy() {
  if (!issued.value) return
  error.value = ''
  try {
    await navigator.clipboard.writeText(issued.value.url)
    copied.value = true
  } catch {
    error.value = 'コピーできませんでした。リンクを手動でコピーしてください。'
  }
}
</script>

<template>
  <div>
    <p class="panel-sub">
      パスワードを忘れた人に再設定リンクを発行して渡します。リンクは 24 時間有効で、1 回使うと無効になります。
    </p>

    <p v-if="error" class="form-error" role="alert">{{ error }}</p>

    <p v-if="loading" class="state">読み込み中…</p>
    <ul v-else class="user-list">
      <li v-for="user in users" :key="user.id" class="user">
        <div class="user-main">
          <span class="user-email">{{ user.email }}</span>
          <span v-if="user.admin" class="badge">管理者</span>
        </div>
        <p class="user-meta">登録 {{ formatDateTime(user.created_at) }}</p>
        <button
          type="button"
          class="btn btn-ghost btn-small"
          :disabled="busy"
          @click="onIssue(user)"
        >
          再設定リンクを発行
        </button>

        <div v-if="issued && issued.userId === user.id" class="issued" role="status">
          <input class="issued-url" :value="issued.url" readonly aria-label="再設定リンク" />
          <div class="issued-actions">
            <button type="button" class="btn btn-primary btn-small" @click="onCopy">
              {{ copied ? 'コピーしました' : 'リンクをコピー' }}
            </button>
            <span class="user-meta">期限 {{ formatDateTime(issued.expiresAt) }}</span>
          </div>
        </div>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.panel-sub {
  margin: 0 0 12px;
  font-size: 12px;
  color: var(--text-sub);
}
.form-error {
  margin: 0 0 12px;
  padding: 10px 12px;
  background: #ffeceb;
  border: 1px solid var(--danger);
  border-radius: 6px;
  color: var(--danger);
  font-size: 13px;
}
.state {
  margin: 16px 0 0;
  font-size: 13px;
  color: var(--text-sub);
}
.user-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.user {
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: 8px;
}
.user-main {
  display: flex;
  align-items: center;
  gap: 8px;
}
.user-email {
  font-weight: 600;
  word-break: break-all;
}
.badge {
  font-size: 11px;
  border-radius: 4px;
  padding: 2px 6px;
  background: #e9f2ff;
  color: var(--primary);
}
.user-meta {
  margin: 4px 0 8px;
  font-size: 12px;
  color: var(--text-sub);
}
.issued {
  margin-top: 10px;
  padding: 8px;
  background: var(--bg);
  border-radius: 6px;
}
.issued-url {
  width: 100%;
  padding: 6px 8px;
  border: 1px solid var(--border);
  border-radius: 6px;
  font: inherit;
  font-size: 12px;
  box-sizing: border-box;
}
.issued-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 6px;
}
.issued-actions .user-meta {
  margin: 0;
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
.btn-small {
  padding: 4px 10px;
  font-size: 12px;
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

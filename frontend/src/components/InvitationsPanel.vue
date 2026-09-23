<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { listInvitations, createInvitation, deleteInvitation, invitationUrl } from '../api/invitations'
import { ApiError } from '../api/http'
import type { Invitation, InvitationStatus } from '../types/auth'

// 管理モーダル（AdminModal）の「招待」タブ
const emit = defineEmits<{ unauthorized: [] }>()

const STATUS_LABELS: Record<InvitationStatus, string> = {
  unused: '未使用',
  used: '使用済み',
  expired: '期限切れ',
}

const invitations = ref<Invitation[]>([])
const loading = ref(true)
const busy = ref(false)
const error = ref('')
// 直近にリンクをコピーした招待（「コピーしました」表示用）
const copiedId = ref<number | null>(null)

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
    invitations.value = await listInvitations()
  } catch (e) {
    handleError(e, '招待の取得に失敗しました。')
  } finally {
    loading.value = false
  }
})

async function onCreate() {
  error.value = ''
  busy.value = true
  try {
    invitations.value.unshift(await createInvitation())
  } catch (e) {
    handleError(e, '招待の発行に失敗しました。')
  } finally {
    busy.value = false
  }
}

async function onCopy(invitation: Invitation) {
  error.value = ''
  try {
    await navigator.clipboard.writeText(invitationUrl(invitation.code))
    copiedId.value = invitation.id
  } catch {
    error.value = 'コピーできませんでした。コードを手動でコピーしてください。'
  }
}

async function onDelete(invitation: Invitation) {
  error.value = ''
  busy.value = true
  try {
    await deleteInvitation(invitation.id)
    invitations.value = invitations.value.filter((i) => i.id !== invitation.id)
  } catch (e) {
    handleError(e, '招待の削除に失敗しました。')
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div>
    <p class="panel-sub">コードは 1 回だけ使え、発行から 7 日で期限切れになります。</p>

    <p v-if="error" class="form-error" role="alert">{{ error }}</p>

    <button type="button" class="btn btn-primary" :disabled="busy" @click="onCreate">
      ＋ 招待コードを発行
    </button>

    <p v-if="loading" class="state">読み込み中…</p>
    <p v-else-if="invitations.length === 0" class="state">まだ招待はありません</p>
    <ul v-else class="invitation-list">
      <li v-for="invitation in invitations" :key="invitation.id" class="invitation">
        <div class="invitation-main">
          <code class="invitation-code">{{ invitation.code }}</code>
          <span class="status" :class="`status-${invitation.status}`">
            {{ STATUS_LABELS[invitation.status] }}
          </span>
        </div>
        <p class="invitation-meta">
          <template v-if="invitation.status === 'used'">
            {{ invitation.used_by_email ?? '削除済みのユーザー' }} が登録
          </template>
          <template v-else>期限 {{ formatDateTime(invitation.expires_at) }}</template>
        </p>
        <div v-if="invitation.status === 'unused'" class="invitation-actions">
          <button type="button" class="btn btn-ghost btn-small" @click="onCopy(invitation)">
            {{ copiedId === invitation.id ? 'コピーしました' : 'リンクをコピー' }}
          </button>
          <button
            type="button"
            class="btn btn-danger btn-small"
            :disabled="busy"
            @click="onDelete(invitation)"
          >
            削除
          </button>
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
.invitation-list {
  list-style: none;
  margin: 16px 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.invitation {
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: 8px;
}
.invitation-main {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.invitation-code {
  font-size: 15px;
  font-weight: 600;
  letter-spacing: 0.04em;
}
.status {
  font-size: 11px;
  border-radius: 4px;
  padding: 2px 6px;
  background: #ebecf0;
  color: var(--text-sub);
}
.status-unused {
  background: #e9f2ff;
  color: var(--primary);
}
.status-used {
  background: #dcfff1;
  color: var(--col-read);
}
.invitation-meta {
  margin: 4px 0 0;
  font-size: 12px;
  color: var(--text-sub);
  word-break: break-all;
}
.invitation-actions {
  display: flex;
  gap: 6px;
  margin-top: 8px;
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
.btn-danger {
  background: var(--surface);
  border-color: var(--danger);
  color: var(--danger);
}
</style>

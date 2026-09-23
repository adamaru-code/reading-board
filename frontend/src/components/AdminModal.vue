<script setup lang="ts">
import { ref } from 'vue'
import InvitationsPanel from './InvitationsPanel.vue'
import UsersPanel from './UsersPanel.vue'

// 管理者向けのモーダル（招待 / ユーザー）
defineProps<{ currentUserId: number }>()
const emit = defineEmits<{ close: []; unauthorized: [] }>()

const tab = ref<'invitations' | 'users'>('invitations')
</script>

<template>
  <div class="modal-overlay" @click.self="emit('close')" @keydown.esc="emit('close')">
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="admin-modal-title">
      <h2 id="admin-modal-title" class="modal-title">管理</h2>

      <div class="tabs" role="tablist">
        <button
          type="button"
          role="tab"
          class="tab"
          :aria-selected="tab === 'invitations'"
          @click="tab = 'invitations'"
        >
          招待
        </button>
        <button
          type="button"
          role="tab"
          class="tab"
          :aria-selected="tab === 'users'"
          @click="tab = 'users'"
        >
          ユーザー
        </button>
      </div>

      <InvitationsPanel v-if="tab === 'invitations'" @unauthorized="emit('unauthorized')" />
      <UsersPanel
        v-else
        :current-user-id="currentUserId"
        @unauthorized="emit('unauthorized')"
      />

      <div class="modal-actions">
        <span class="spacer"></span>
        <button type="button" class="btn-close" @click="emit('close')">閉じる</button>
      </div>
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
  max-width: 460px;
  max-height: calc(100svh - 96px);
  overflow-y: auto;
  box-shadow: 0 8px 24px rgba(9, 30, 66, 0.25);
}
.modal-title {
  font-size: 18px;
  font-weight: 700;
  margin: 0 0 12px;
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
.modal-actions {
  display: flex;
  align-items: center;
  margin-top: 20px;
}
.spacer {
  flex: 1;
}
.btn-close {
  border: 1px solid var(--border);
  background: var(--surface);
  border-radius: 6px;
  padding: 8px 16px;
  font: inherit;
  cursor: pointer;
}
</style>

<script setup lang="ts">
import { ref } from 'vue'
import InvitationsPanel from './InvitationsPanel.vue'
import UsersPanel from './UsersPanel.vue'
import BaseModal from './BaseModal.vue'

// 管理者向けのモーダル（招待 / ユーザー）
defineProps<{ currentUserId: number }>()
const emit = defineEmits<{ close: []; unauthorized: [] }>()

const tab = ref<'invitations' | 'users'>('invitations')
</script>

<template>
  <BaseModal title="管理" :max-width="460" @close="emit('close')">
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
    <UsersPanel v-else :current-user-id="currentUserId" @unauthorized="emit('unauthorized')" />

    <div class="modal-actions">
      <span class="spacer"></span>
      <button type="button" class="btn-close" @click="emit('close')">閉じる</button>
    </div>
  </BaseModal>
</template>

<style scoped>
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

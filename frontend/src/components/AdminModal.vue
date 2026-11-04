<script setup lang="ts">
import { ref } from 'vue'
import InvitationsPanel from './InvitationsPanel.vue'
import UsersPanel from './UsersPanel.vue'
import BaseModal from './BaseModal.vue'
import BaseTabs from './BaseTabs.vue'

// 管理者向けのモーダル（招待 / ユーザー）
defineProps<{ currentUserId: number }>()
const emit = defineEmits<{ close: []; unauthorized: [] }>()

const TABS = [
  { key: 'invitations', label: '招待' },
  { key: 'users', label: 'ユーザー' },
] as const
const tab = ref<(typeof TABS)[number]['key']>('invitations')
</script>

<template>
  <BaseModal title="管理" :max-width="460" @close="emit('close')">
    <BaseTabs v-model="tab" :tabs="TABS">
      <InvitationsPanel v-if="tab === 'invitations'" @unauthorized="emit('unauthorized')" />
      <UsersPanel v-else :current-user-id="currentUserId" @unauthorized="emit('unauthorized')" />
    </BaseTabs>

    <div class="modal-actions">
      <span class="spacer"></span>
      <button type="button" class="btn-close" @click="emit('close')">閉じる</button>
    </div>
  </BaseModal>
</template>

<style scoped>
.modal-actions {
  display: flex;
  align-items: center;
  margin-top: 20px;
  gap: normal; /* 全体の .modal-actions のすき間を付けない（今までどおり） */
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

<script setup lang="ts">
import type { User } from '../types/auth'

// ボード上部のヘッダ：タイトル・「＋ 追加」・アカウントまわりのボタン。
// 絞り込み（BoardFilters）は親がスロットに入れる。ボタンは押されたことを親に伝えるだけ
defineProps<{ user: User }>()
const emit = defineEmits<{ add: []; admin: []; account: []; logout: [] }>()
</script>

<template>
  <header class="app-header">
    <h1 class="app-title">📚 読書管理ボード</h1>
    <div class="filters">
      <slot />
      <button type="button" class="add-btn" @click="emit('add')">＋ 追加</button>
      <span class="user-email" :title="user.email">{{ user.email }}</span>
      <button v-if="user.admin" type="button" class="header-btn" @click="emit('admin')">
        管理
      </button>
      <button type="button" class="header-btn" @click="emit('account')">アカウント</button>
      <button type="button" class="header-btn" @click="emit('logout')">ログアウト</button>
    </div>
  </header>
</template>

<style scoped>
.app-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 14px 24px;
  background: var(--surface);
  border-bottom: 1px solid var(--border);
}
.app-title {
  font-size: 20px;
  font-weight: 700;
}
.filters {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
}
.add-btn {
  background: var(--primary);
  color: #fff;
  border: none;
  border-radius: 6px;
  padding: 8px 16px;
  font: inherit;
  cursor: pointer;
}
.user-email {
  font-size: 12px;
  color: var(--text-sub);
  max-width: 160px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.header-btn {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 7px 12px;
  font: inherit;
  cursor: pointer;
}
</style>

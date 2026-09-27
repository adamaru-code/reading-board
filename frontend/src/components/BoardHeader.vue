<script setup lang="ts">
import type { User } from '../types/auth'

// ボード上部のヘッダ：タイトル・「＋ 本を追加」・アカウントまわりのボタン。
// 絞り込み（BoardFilters）は親がスロットに入れる。ボタンは押されたことを親に伝えるだけ
defineProps<{ user: User }>()
const emit = defineEmits<{ add: []; admin: []; account: []; logout: [] }>()
</script>

<template>
  <!-- 3 つのグループ（追加・絞り込み・アカウント）に分け、狭い画面ではグループごとに折り返す。
       よく使う「＋ 本を追加」はタイトルの右に固定し、絞り込みの「クリア」が出ても動かないようにする -->
  <header class="app-header">
    <div class="header-main">
      <h1 class="app-title">📚 読書管理ボード</h1>
      <button type="button" class="add-btn" @click="emit('add')">＋ 本を追加</button>
    </div>
    <div class="header-filters">
      <slot />
    </div>
    <div class="header-account">
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
  flex-wrap: wrap;
  gap: 12px 24px;
  padding: 14px 24px;
  background: var(--surface);
  border-bottom: 1px solid var(--border);
}
.header-main,
.header-filters,
.header-account {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
}
.header-main {
  gap: 16px;
}
/* アカウントまわりは右端に寄せる */
.header-account {
  margin-left: auto;
}
.app-title {
  font-size: 20px;
  font-weight: 700;
}
/* 「読みたい」カラムと同じ紫（追加した本は既定で「読みたい」に入る）。白文字とのコントラスト 5.86:1 */
.add-btn {
  background: var(--col-want);
  color: #fff;
  border: none;
  border-radius: 6px;
  padding: 8px 16px;
  font: inherit;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
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

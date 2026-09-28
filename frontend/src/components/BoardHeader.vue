<script setup lang="ts">
import type { User } from '../types/auth'
import type { BoardView } from '../types/view'

// ボード上部のヘッダ：タイトル・「＋ 本を追加」・画面の切り替え（ボード｜読了一覧）・アカウントまわりのボタン。
// 絞り込み（BoardFilters）は親がスロットに入れる。ボタンは押されたことを親に伝えるだけ。
// 切り替えは URL（/ と /read）を移るリンクで、view（今の画面）の方を強調する
defineProps<{ user: User; view: BoardView }>()
const emit = defineEmits<{ add: []; admin: []; account: []; logout: [] }>()
</script>

<template>
  <!-- 3 つのグループ（追加・絞り込み・アカウント）に分け、狭い画面ではグループごとに折り返す。
       よく使う「＋ 本を追加」はタイトルの右に固定し、絞り込みの「クリア」が出ても動かないようにする -->
  <header class="app-header">
    <div class="header-main">
      <h1 class="app-title">📚 読書管理ボード</h1>
      <button type="button" class="add-btn" @click="emit('add')">＋ 本を追加</button>
      <nav class="view-switch" aria-label="表示の切り替え">
        <RouterLink
          :to="{ name: 'board' }"
          class="to-board"
          :class="{ current: view === 'board' }"
          :aria-current="view === 'board' ? 'page' : undefined"
        >
          ボード
        </RouterLink>
        <RouterLink
          :to="{ name: 'read' }"
          class="to-read"
          :class="{ current: view === 'read' }"
          :aria-current="view === 'read' ? 'page' : undefined"
        >
          読了一覧
        </RouterLink>
      </nav>
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
/* 画面の切り替え（ボード｜読了一覧）。今いる方を色で塗る：ボード＝読書中カラムと同じピンク、読了一覧＝読了カラムと同じ緑。
   白文字を載せるので線の色より少し濃い --col-*-strong を使う（コントラスト ピンク 5.03:1 / 緑 4.66:1） */
.view-switch {
  display: inline-flex;
  border: 1px solid var(--border);
  border-radius: 6px;
  overflow: hidden;
}
.view-switch a {
  padding: 7px 14px;
  color: var(--text-sub);
  background: var(--surface);
  text-decoration: none;
  white-space: nowrap;
}
.view-switch a + a {
  border-left: 1px solid var(--border);
}
.view-switch a.current {
  color: #fff;
  font-weight: 600;
}
.view-switch a.to-board.current {
  background: var(--col-reading-strong);
}
.view-switch a.to-read.current {
  background: var(--col-read-strong);
}
.view-switch a:focus-visible {
  outline: 2px solid var(--primary);
  outline-offset: -2px;
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

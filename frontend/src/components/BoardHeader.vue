<script setup lang="ts">
import { computed, ref, useId } from 'vue'
import type { User } from '../types/auth'
import type { BoardView } from '../types/view'

// ボード上部のヘッダ：タイトル・「＋ 本を追加」・画面の切り替え（ボード｜読了一覧｜統計）・アカウントまわりのボタン。
// 絞り込み（BoardFilters）は親がスロットに入れる。ボタンは押されたことを親に伝えるだけ。
// 切り替えは URL（/・/read・/stats）を移るリンクで、view（今の画面）の方を強調する。
// スマホの幅（640px 以下）では「タイトル・＋ 追加・絞り込み ▼」の 1 行だけを画面の上に固定し、絞り込みは押すと開く
// （2026-10-29、ヘッダが画面の上半分を占めていたため。見本 3 案から選んだ）。activeFilters：使っている絞り込みの数
const props = withDefaults(defineProps<{ user: User; view: BoardView; activeFilters?: number }>(), {
  activeFilters: 0,
})
const emit = defineEmits<{ add: []; admin: []; account: []; logout: [] }>()

// 統計画面は絞り込みを出さない（親もスロットを空にする）
const filterable = computed(() => props.view !== 'stats')
const filtersOpen = ref(false)
const filtersId = useId()
</script>

<template>
  <!-- パソコン：1 つの並び（タイトル・追加 → 切り替え → 絞り込み → アカウント）を狭くなったら折り返す。
       header-bar と header-sub は display: contents で中身だけを並びに加え、order で順番を決める。
       スマホ：header-bar（タイトル・＋ 追加・絞り込み ▼ と、開いた絞り込み）を上に固定し、header-sub は下に流す -->
  <header class="app-header">
    <div class="header-bar">
      <h1 class="app-title">📚 読書管理ボード</h1>
      <button type="button" class="add-btn" @click="emit('add')">
        ＋ <span class="add-long">本を</span>追加
      </button>
      <button
        v-if="filterable"
        type="button"
        class="filters-toggle"
        :class="{ open: filtersOpen, active: activeFilters > 0 }"
        :aria-expanded="filtersOpen"
        :aria-controls="filtersId"
        @click="filtersOpen = !filtersOpen"
      >
        絞り込み<span v-if="activeFilters > 0" class="filters-count">{{ activeFilters }}</span>
        <span aria-hidden="true">{{ filtersOpen ? '▲' : '▼' }}</span>
      </button>
      <div :id="filtersId" class="header-filters" :class="{ open: filtersOpen }">
        <slot />
      </div>
    </div>
    <div class="header-sub">
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
        <RouterLink
          :to="{ name: 'stats' }"
          class="to-stats"
          :class="{ current: view === 'stats' }"
          :aria-current="view === 'stats' ? 'page' : undefined"
        >
          統計
        </RouterLink>
      </nav>
      <div class="header-account">
        <span class="user-email" :title="user.email">{{ user.email }}</span>
        <button v-if="user.admin" type="button" class="header-btn" @click="emit('admin')">
          管理
        </button>
        <button type="button" class="header-btn" @click="emit('account')">アカウント</button>
        <button type="button" class="header-btn" @click="emit('logout')">ログアウト</button>
      </div>
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
/* パソコン：中身だけを .app-header の並びに加える */
.header-bar,
.header-sub {
  display: contents;
}
.header-filters,
.header-account {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
}
/* 並ぶ順番：タイトル・追加（0）→ 切り替え（1）→ 絞り込み（2）→ アカウント（3） */
.view-switch {
  order: 1;
}
.header-filters {
  order: 2;
}
/* アカウントまわりは右端に寄せる */
.header-account {
  order: 3;
  margin-left: auto;
}
.app-title {
  font-size: 20px;
  font-weight: 700;
}
/* 「絞り込み ▼」はスマホの幅だけで使う */
.filters-toggle {
  display: none;
}
/* パソコン：タイトル・追加・切り替えの間は 16px（ほかのまとまりの間の 24px より詰める。以前と同じ間隔） */
@media (min-width: 641px) {
  .add-btn,
  .view-switch {
    margin-left: -8px;
  }
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
.view-switch a.to-stats.current {
  background: var(--slate);
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

/* スマホの幅：上の 1 行（header-bar）だけを固定する。固定は親（.app。ページ全体）の中で効くよう、.app-header は箱を作らない */
@media (max-width: 640px) {
  .app-header {
    display: contents;
  }
  .header-bar {
    position: sticky;
    top: 0;
    /* カラムの中の部品（z-index: 10）より手前、モーダル（100）より奥 */
    z-index: 20;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    padding: 10px 16px;
    background: var(--surface);
    border-bottom: 1px solid var(--border);
  }
  .app-title {
    font-size: 16px;
    white-space: nowrap;
    margin-right: auto;
  }
  /* 1 行に収めるため「＋ 本を追加」を「＋ 追加」に */
  .add-long {
    display: none;
  }
  .add-btn {
    padding: 7px 12px;
  }
  .filters-toggle {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 7px 12px;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--surface);
    font: inherit;
    color: var(--text);
    white-space: nowrap;
    cursor: pointer;
  }
  .filters-toggle.open {
    background: var(--slate-tint);
  }
  /* 絞り込み中は、使っている欄と同じ濃紺グレーの枠で目立たせる */
  .filters-toggle.active {
    border: 2px solid var(--slate);
    padding: 6px 11px;
    font-weight: 600;
  }
  .filters-count {
    min-width: 18px;
    padding: 0 5px;
    border-radius: 9px;
    background: var(--slate);
    color: #fff;
    font-size: 12px;
    text-align: center;
  }
  /* 閉じているときは隠し、開いたら 1 行の下に全幅で出す（中の並べ方は BoardFilters.vue） */
  .header-filters {
    display: none;
  }
  .header-filters.open {
    display: block;
    flex-basis: 100%;
  }
  .header-sub {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 10px;
    padding: 10px 16px;
    background: var(--surface);
    border-bottom: 1px solid var(--border);
  }
  .user-email {
    display: none;
  }
}
</style>

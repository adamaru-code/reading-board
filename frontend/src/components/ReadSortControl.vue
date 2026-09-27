<script setup lang="ts">
import type { BookSortKey, SortDir } from '../types/book'

// 読了本の並び替え（キーの選択＋昇順・降順の切り替え）。ボードの読了カラムと読了一覧で使う。
// 値は v-model:sort-key / v-model:dir
const sortKey = defineModel<BookSortKey>('sortKey', { required: true })
const dir = defineModel<SortDir>('dir', { required: true })

const SORT_KEYS: readonly { key: BookSortKey; label: string }[] = [
  { key: 'finished_on', label: '読了日' },
  { key: 'rating', label: '評価' },
  { key: 'registered_on', label: '登録日' },
  { key: 'duration_days', label: '所要日数' },
]

function toggleDir() {
  dir.value = dir.value === 'asc' ? 'desc' : 'asc'
}
</script>

<template>
  <div class="sort-control">
    <select v-model="sortKey" aria-label="読了本の並び替え">
      <option v-for="s in SORT_KEYS" :key="s.key" :value="s.key">{{ s.label }}</option>
    </select>
    <button
      type="button"
      class="sort-dir"
      :aria-label="dir === 'asc' ? '昇順' : '降順'"
      @click="toggleDir"
    >
      {{ dir === 'asc' ? '▲' : '▼' }}
    </button>
  </div>
</template>

<style scoped>
.sort-control {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 4px;
}
.sort-control select {
  font-size: 11px;
  padding: 2px 4px;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--surface);
}
.sort-dir {
  font-size: 11px;
  line-height: 1;
  padding: 3px 6px;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--surface);
  cursor: pointer;
}
</style>

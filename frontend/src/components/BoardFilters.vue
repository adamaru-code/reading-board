<script setup lang="ts">
import { computed } from 'vue'
import { BOOK_GENRES, GENRE_LABELS } from '../types/book'
import type { BookGenre } from '../types/book'

// 絞り込み（著者名・ジャンル・タグ）。値は v-model:author / v-model:genre / v-model:tag。
// 条件が変わったら change（著者名は入力が落ち着いてから）、「クリア」で clear を親に伝える
const author = defineModel<string>('author', { required: true })
const genre = defineModel<'' | BookGenre>('genre', { required: true })
const tag = defineModel<string>('tag', { required: true })

// tagOptions：タグの選択肢（未絞り込みの一覧から集めたもの）
defineProps<{ tagOptions: string[] }>()
const emit = defineEmits<{ change: []; clear: [] }>()

const hasFilters = computed(
  () => genre.value !== '' || author.value.trim() !== '' || tag.value !== '',
)

let authorTimer: ReturnType<typeof setTimeout> | undefined
function onAuthorInput() {
  clearTimeout(authorTimer)
  authorTimer = setTimeout(() => emit('change'), 300) // 入力が落ち着いてから再取得
}
</script>

<template>
  <!-- display: contents：この div は並びに影響させず、中の部品をヘッダの並びに直接加える -->
  <div class="board-filters">
    <input
      v-model="author"
      type="search"
      class="filter-author"
      placeholder="著者名で絞り込み"
      aria-label="著者名で絞り込み"
      @input="onAuthorInput"
    />
    <label class="filter-field">
      ジャンル
      <select v-model="genre" @change="emit('change')">
        <option value="">すべて</option>
        <option v-for="g in BOOK_GENRES" :key="g" :value="g">{{ GENRE_LABELS[g] }}</option>
      </select>
    </label>
    <label class="filter-field">
      タグ
      <select v-model="tag" @change="emit('change')">
        <option value="">すべて</option>
        <option v-for="t in tagOptions" :key="t" :value="t">{{ t }}</option>
      </select>
    </label>
    <button v-if="hasFilters" type="button" class="clear-btn" @click="emit('clear')">クリア</button>
  </div>
</template>

<style scoped>
.board-filters {
  display: contents;
}
.filter-author {
  padding: 7px 10px;
  border: 1px solid var(--border);
  border-radius: 6px;
  font: inherit;
}
.filter-field {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--text-sub);
}
.filter-field select {
  padding: 6px 8px;
  border: 1px solid var(--border);
  border-radius: 6px;
  font: inherit;
}
.clear-btn {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 7px 12px;
  font: inherit;
  cursor: pointer;
}
</style>

<script setup lang="ts">
import { computed, useId } from 'vue'
import { BOOK_GENRES, GENRE_LABELS, RATING_FILTER_OPTIONS } from '../types/book'
import type { BookGenre, RatingFilter } from '../types/book'

// 絞り込み（キーワード＝タイトルまたは著者・ジャンル・タグ・評価）。絞り込み中は、使っている欄と「✕ クリア」を濃紺グレーで目立たせる。
// 値は v-model:keyword / v-model:genre / v-model:tag / v-model:rating。
// 条件が変わったら change（キーワードは入力が落ち着いてから）、「クリア」で clear を親に伝える
const keyword = defineModel<string>('keyword', { required: true })
const genre = defineModel<'' | BookGenre>('genre', { required: true })
const tag = defineModel<string>('tag', { required: true })
const rating = defineModel<'' | RatingFilter>('rating', { required: true })

// tagOptions：タグの選択肢（未絞り込みの一覧から集めたもの）
defineProps<{ tagOptions: string[] }>()
const emit = defineEmits<{ change: []; clear: [] }>()

const hasFilters = computed(
  () =>
    genre.value !== '' || keyword.value.trim() !== '' || tag.value !== '' || rating.value !== '',
)

// 先頭の見出し「絞り込み：」と、まとまり（role="group"）を結ぶ id
const headingId = useId()

let keywordTimer: ReturnType<typeof setTimeout> | undefined
function onKeywordInput() {
  clearTimeout(keywordTimer)
  keywordTimer = setTimeout(() => emit('change'), 300) // 入力が落ち着いてから再取得
}
</script>

<template>
  <!-- display: contents：この div は並びに影響させず、中の部品をヘッダの並びに直接加える -->
  <!-- 先頭に「絞り込み：」を 1 回だけ置き、各欄の見出しは何で絞るか（キーワード・ジャンル・タグ・評価）にそろえる -->
  <div class="board-filters" role="group" :aria-labelledby="headingId">
    <span :id="headingId" class="filters-heading">絞り込み：</span>
    <label class="filter-field">
      キーワード
      <input
        v-model="keyword"
        type="search"
        class="filter-keyword"
        :class="{ active: keyword.trim() !== '' }"
        placeholder="タイトル・著者"
        aria-label="タイトル・著者で絞り込み"
        @input="onKeywordInput"
      />
    </label>
    <label class="filter-field">
      ジャンル
      <select v-model="genre" :class="{ active: genre !== '' }" @change="emit('change')">
        <option value="">すべて</option>
        <option v-for="g in BOOK_GENRES" :key="g" :value="g">{{ GENRE_LABELS[g] }}</option>
      </select>
    </label>
    <label class="filter-field">
      タグ
      <select v-model="tag" :class="{ active: tag !== '' }" @change="emit('change')">
        <option value="">すべて</option>
        <option v-for="t in tagOptions" :key="t" :value="t">{{ t }}</option>
      </select>
    </label>
    <label class="filter-field">
      評価
      <select v-model="rating" :class="{ active: rating !== '' }" @change="emit('change')">
        <option value="">すべて</option>
        <option v-for="o in RATING_FILTER_OPTIONS" :key="o.value" :value="o.value">
          {{ o.label }}
        </option>
      </select>
    </label>
    <button
      v-if="hasFilters"
      type="button"
      class="clear-btn"
      aria-label="絞り込みをクリア"
      @click="emit('clear')"
    >
      <span aria-hidden="true">✕</span> クリア
    </button>
  </div>
</template>

<style scoped>
.board-filters {
  display: contents;
}
.filter-keyword {
  padding: 7px 10px;
  border: 1px solid var(--border);
  border-radius: 6px;
  font: inherit;
  /* 見出し（小さい灰色の文字）の中に入れても、入力する文字は今までどおりの大きさ・色にする */
  font-size: 1rem;
  color: var(--text);
}
.filters-heading {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-sub);
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
  background: var(--slate);
  color: #fff;
  border: 1px solid var(--slate);
  border-radius: 6px;
  padding: 7px 12px;
  font: inherit;
  font-weight: 600;
  white-space: nowrap;
  cursor: pointer;
}
/* 絞り込みに使っている欄：枠を濃紺グレーで太く、地をうっすら色付き（どの条件が効いているか分かる）。
   枠が 1px 太くなる分 padding を 1px 減らし、大きさを変えない */
.filter-keyword.active {
  border: 2px solid var(--slate);
  background: var(--slate-tint);
  padding: 6px 9px;
}
.filter-field select.active {
  border: 2px solid var(--slate);
  background: var(--slate-tint);
  font-weight: 600;
  padding: 5px 7px;
}
</style>

<script setup lang="ts">
import { computed } from 'vue'
import { BOOK_GENRES, GENRE_LABELS } from '../types/book'
import type { BookGenre } from '../types/book'

// 今年のジャンル別の読了冊数の横棒グラフ。冊数の多い順（同じならいつものジャンルの並び順）で、0 冊のジャンルも出す。
// 棒の長さはいちばん多いジャンルを 100% にした割合。色はジャンルバッジ（src/style.css の .genre-*）の文字色を使う
const props = defineProps<{
  counts: Record<BookGenre, number>
  year: number
}>()

const max = computed(() => Math.max(1, ...BOOK_GENRES.map((genre) => props.counts[genre] ?? 0)))

const rows = computed(() =>
  BOOK_GENRES.map((genre, order) => ({ genre, order, count: props.counts[genre] ?? 0 }))
    .sort((a, b) => b.count - a.count || a.order - b.order)
    .map((row) => ({
      ...row,
      label: GENRE_LABELS[row.genre],
      width: Math.round((row.count / max.value) * 100),
    })),
)
</script>

<template>
  <section class="genre-chart" aria-labelledby="genre-chart-title">
    <h3 id="genre-chart-title" class="chart-title">{{ year }}年 ジャンル別の読了冊数</h3>
    <ol class="rows">
      <li
        v-for="row in rows"
        :key="row.genre"
        class="row"
        :aria-label="`${row.label} ${row.count}冊`"
      >
        <span class="genre-badge" :class="`genre-${row.genre}`" aria-hidden="true">
          {{ row.label }}
        </span>
        <span class="bar-area" aria-hidden="true">
          <span class="bar" :class="`genre-${row.genre}`" :style="{ width: `${row.width}%` }" />
        </span>
        <span class="count" aria-hidden="true">{{ row.count }}冊</span>
      </li>
    </ol>
  </section>
</template>

<style scoped>
.genre-chart {
  background: var(--surface);
  border-radius: 8px;
  padding: 14px 18px 12px;
  margin-top: 14px;
  box-shadow: 0 1px 1px rgba(9, 30, 66, 0.12);
}
.chart-title {
  margin: 0 0 10px;
  font-size: 12px;
  font-weight: 700;
  color: var(--text-sub);
}
.rows {
  display: grid;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}
/* ジャンル名（バッジ）｜棒｜冊数 の 3 列。ジャンル名の幅をそろえて棒の始まりを合わせる */
.row {
  display: grid;
  grid-template-columns: 8.5rem minmax(0, 1fr) 3rem;
  align-items: center;
  gap: 10px;
}
.row .genre-badge {
  justify-self: start;
}
.bar-area {
  height: 14px;
}
/* 棒はジャンルバッジの文字色（.genre-* の color）で塗る */
.bar {
  display: block;
  height: 100%;
  background: currentColor;
  border-radius: 0 3px 3px 0;
}
.count {
  font-size: 12px;
  color: var(--text-sub);
  text-align: right;
  font-variant-numeric: tabular-nums;
}
</style>

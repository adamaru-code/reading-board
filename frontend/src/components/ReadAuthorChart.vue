<script setup lang="ts">
import { computed } from 'vue'

// 選んだ年によく読んだ著者の横棒グラフ（上位 5 人。並びはサーバーが決める：冊数の多い順、同じなら名前順）。
// 見た目はジャンル別（ReadGenreChart.vue）と同じ「名前｜棒｜冊数」。棒の長さはいちばん多い人を 100% にした割合。
// 色は月ごとのグラフと同じ読了の緑（#376）
const props = defineProps<{
  authors: { author: string; count: number }[]
  year: number
}>()

const rows = computed(() => {
  const max = Math.max(1, ...props.authors.map((a) => a.count))
  return props.authors.map((a) => ({ ...a, width: Math.round((a.count / max) * 100) }))
})
</script>

<template>
  <section class="author-chart" aria-labelledby="author-chart-title">
    <h3 id="author-chart-title" class="chart-title">{{ year }}年 よく読んだ著者</h3>
    <p v-if="rows.length === 0" class="empty">まだありません</p>
    <ol v-else class="rows">
      <li
        v-for="row in rows"
        :key="row.author"
        class="row"
        :aria-label="`${row.author} ${row.count}冊`"
      >
        <span class="author" :title="row.author" aria-hidden="true">{{ row.author }}</span>
        <span class="bar-area" aria-hidden="true">
          <span class="bar" :style="{ width: `${row.width}%` }" />
        </span>
        <span class="count" aria-hidden="true">{{ row.count }}冊</span>
      </li>
    </ol>
  </section>
</template>

<style scoped>
.author-chart {
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
.empty {
  margin: 0;
  font-size: 13px;
  color: var(--text-sub);
}
.rows {
  display: grid;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}
/* 著者名｜棒｜冊数 の 3 列。ジャンル別と同じ幅にして棒の始まりをそろえる。長い名前は … で切る（全体は title で出る） */
.row {
  display: grid;
  grid-template-columns: 8.5rem minmax(0, 1fr) 3rem;
  align-items: center;
  gap: 10px;
}
.author {
  font-size: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.bar-area {
  height: 14px;
}
.bar {
  display: block;
  height: 100%;
  background: var(--col-read);
  border-radius: 0 3px 3px 0;
}
.count {
  font-size: 12px;
  color: var(--text-sub);
  text-align: right;
  font-variant-numeric: tabular-nums;
}
</style>

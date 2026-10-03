<script setup lang="ts">
import { computed } from 'vue'
import type { BookStats } from '../types/book'
import ReadMonthlyChart from './ReadMonthlyChart.vue'
import ReadGenreChart from './ReadGenreChart.vue'

// 統計（/stats）：読了冊数（今年・今月・これまで）と、選んだ年の月ごと・ジャンル別の読了冊数のグラフ。
// 値は親（KanbanBoard.vue）が GET /api/books/stats で取って渡す。年を選ぶと change-year で親に伝え、親が取り直す。
// 絞り込みには連動しない
const props = withDefaults(
  defineProps<{
    stats: BookStats | null
    failed?: boolean // 取得に失敗した
    today?: Date // 今年・今月（テストで日付を決めるため。ふだんは今日）
  }>(),
  { failed: false, today: () => new Date() },
)
const emit = defineEmits<{ 'change-year': [year: number] }>()

// 今年を選んでいるときだけ今月を渡す（まだ来ていない月を線だけにし、今月を強調する）
const currentMonth = computed(() =>
  props.stats?.year === props.today.getFullYear() ? props.today.getMonth() + 1 : undefined,
)

function onYearChange(event: Event) {
  emit('change-year', Number((event.target as HTMLSelectElement).value))
}
</script>

<template>
  <main class="stats-page">
    <h2 class="visually-hidden">統計</h2>
    <p v-if="failed" class="stats-state" role="alert">
      統計を取得できませんでした。時間をおいて再度お試しください。
    </p>
    <p v-else-if="!stats" class="stats-state">読み込み中…</p>
    <template v-else>
      <dl class="tiles">
        <div class="tile">
          <dt>今年の読了</dt>
          <dd>{{ stats.finished_this_year }} <small>冊</small></dd>
        </div>
        <div class="tile">
          <dt>今月の読了</dt>
          <dd>{{ stats.finished_this_month }} <small>冊</small></dd>
        </div>
        <div class="tile">
          <dt>これまでの読了</dt>
          <dd>{{ stats.finished_total }} <small>冊</small></dd>
        </div>
      </dl>
      <div class="year-bar">
        <label class="year-select">
          表示する年
          <select :value="stats.year" @change="onYearChange">
            <option v-for="y in stats.years" :key="y" :value="y">{{ y }}年</option>
          </select>
        </label>
        <span class="year-count">{{ stats.year }}年の読了 {{ stats.finished_in_year }} 冊</span>
      </div>
      <ReadMonthlyChart
        :counts="stats.finished_by_month"
        :year="stats.year"
        :current-month="currentMonth"
      />
      <ReadGenreChart :counts="stats.finished_by_genre" :year="stats.year" />
    </template>
  </main>
</template>

<style scoped>
.stats-page {
  margin: 24px;
  max-width: 880px;
}
.stats-state {
  color: var(--text-sub);
}
.tiles {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin: 0 0 14px;
}
.tile {
  background: var(--surface);
  border-radius: 8px;
  padding: 12px 16px;
  min-width: 120px;
  box-shadow: 0 1px 1px rgba(9, 30, 66, 0.12);
}
.tile dt {
  font-size: 12px;
  color: var(--text-sub);
}
.tile dd {
  margin: 2px 0 0;
  font-size: 26px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
.tile small {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-sub);
}
.year-bar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px 16px;
  margin: 0 0 10px;
}
.year-select {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: var(--text-sub);
}
.year-select select {
  padding: 5px 8px;
  border: 1px solid var(--border);
  border-radius: 6px;
  font: inherit;
  color: var(--text);
}
.year-count {
  font-size: 13px;
  font-weight: 600;
}
.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}
</style>

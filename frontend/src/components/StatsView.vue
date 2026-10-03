<script setup lang="ts">
import type { BookStats } from '../types/book'
import ReadMonthlyChart from './ReadMonthlyChart.vue'
import ReadGenreChart from './ReadGenreChart.vue'

// 統計（/stats）：読了冊数（今年・今月・これまで）と、今年の月ごと・ジャンル別の読了冊数のグラフ。
// 値は親（KanbanBoard.vue）が GET /api/books/stats で取って渡す。絞り込みには連動しない
withDefaults(
  defineProps<{
    stats: BookStats | null
    failed?: boolean // 取得に失敗した
    today?: Date // 今年・今月（テストで日付を決めるため。ふだんは今日）
  }>(),
  { failed: false, today: () => new Date() },
)
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
      <ReadMonthlyChart
        :counts="stats.finished_by_month"
        :year="today.getFullYear()"
        :current-month="today.getMonth() + 1"
      />
      <ReadGenreChart :counts="stats.finished_by_genre" :year="today.getFullYear()" />
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
.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}
</style>

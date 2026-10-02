<script setup lang="ts">
import { computed } from 'vue'

// 今年の月ごとの読了冊数の棒グラフ（1〜12 月）。グラフ用の道具は使わず、HTML と CSS の棒で描く。
// 棒の高さはいちばん多い月を 100% にした割合。まだ来ていない月は棒を出さず線だけ、今月は濃い緑
const props = defineProps<{
  counts: number[] // 1〜12 月の冊数（12 個）
  year: number
  currentMonth: number // 1〜12
}>()

const max = computed(() => Math.max(1, ...props.counts))

const months = computed(() =>
  props.counts.map((count, i) => {
    const month = i + 1
    const future = month > props.currentMonth
    return {
      month,
      count,
      future,
      current: month === props.currentMonth,
      height: future ? 0 : Math.round((count / max.value) * 100),
      label: future ? `${month}月 まだ` : `${month}月 ${count}冊`,
    }
  }),
)
</script>

<template>
  <section class="monthly-chart" aria-labelledby="monthly-chart-title">
    <h3 id="monthly-chart-title" class="chart-title">{{ year }}年 月ごとの読了冊数</h3>
    <ol class="months">
      <li
        v-for="m in months"
        :key="m.month"
        class="month"
        :class="{ future: m.future, current: m.current }"
        :aria-label="m.label"
      >
        <span class="count" aria-hidden="true">{{ m.future ? '' : m.count }}</span>
        <span class="bar-area" aria-hidden="true">
          <span class="bar" :style="{ height: `${m.height}%` }" />
        </span>
        <span class="month-label" aria-hidden="true">{{ m.month }}月</span>
      </li>
    </ol>
  </section>
</template>

<style scoped>
.monthly-chart {
  background: var(--surface);
  border-radius: 8px;
  padding: 14px 18px 10px;
  box-shadow: 0 1px 1px rgba(9, 30, 66, 0.12);
}
.chart-title {
  margin: 0 0 8px;
  font-size: 12px;
  font-weight: 700;
  color: var(--text-sub);
}
.months {
  display: grid;
  grid-template-columns: repeat(12, minmax(0, 1fr));
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.month {
  display: flex;
  flex-direction: column;
  align-items: center;
}
.count {
  min-height: 1.2em;
  font-size: 11px;
  color: var(--text-sub);
  font-variant-numeric: tabular-nums;
}
/* 棒を置く場所。下の線がグラフの横軸 */
.bar-area {
  display: flex;
  align-items: flex-end;
  justify-content: center;
  width: 100%;
  height: 140px;
  border-bottom: 1px solid #c1c7d0;
}
.bar {
  width: 100%;
  max-width: 28px;
  background: var(--col-read);
  border-radius: 3px 3px 0 0;
}
.month.current .bar {
  background: var(--col-read-strong);
}
/* まだ来ていない月は棒を出さない（横軸の線だけ） */
.month.future .bar {
  display: none;
}
.month-label {
  margin-top: 3px;
  font-size: 11px;
  color: var(--text-sub);
}
.month.current .month-label {
  color: var(--col-read-strong);
  font-weight: 700;
}
</style>

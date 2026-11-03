<script setup lang="ts">
import { computed } from 'vue'

// 月ごとの読了冊数の棒グラフ（1〜12 月）。グラフ用の道具は使わず、HTML と CSS の棒で描く。
// 棒の高さはいちばん多い月を 100% にした割合。今年なら、まだ来ていない月は棒を出さず線だけ、今月は濃い緑。
// previousCounts を渡すと、月ごとに左に前の年（灰色）、右に選んだ年（緑）の棒を並べて比べる（#378。見本 A を左右入れ替え）
const props = defineProps<{
  counts: number[] // 1〜12 月の冊数（12 個）
  year: number
  currentMonth?: number // 今年なら今月（1〜12）。過去の年は渡さない（12 か月すべて棒を出し、強調しない）
  previousCounts?: number[] // 前の年の 1〜12 月の冊数。前の年に読了が無ければ渡さない（今までどおりの見た目）
}>()

const comparing = computed(() => props.previousCounts !== undefined)
const max = computed(() => Math.max(1, ...props.counts, ...(props.previousCounts ?? [])))

const months = computed(() =>
  props.counts.map((count, i) => {
    const month = i + 1
    const future = props.currentMonth !== undefined && month > props.currentMonth
    return {
      month,
      count,
      future,
      current: month === props.currentMonth,
      height: future ? 0 : Math.round((count / max.value) * 100),
      label: future ? `${month}月 まだ` : `${month}月 ${count}冊`,
      ...previousOf(i),
    }
  }),
)

// 前の年の棒の高さと、読み上げ・マウスを乗せたときの文（「（2025年 5冊）」）
function previousOf(i: number) {
  if (!props.previousCounts) return { previousHeight: 0, previousLabel: '' }
  const count = props.previousCounts[i] ?? 0
  return {
    previousHeight: Math.round((count / max.value) * 100),
    previousLabel: `（${props.year - 1}年 ${count}冊）`,
  }
}
</script>

<template>
  <section class="monthly-chart" :class="{ comparing }" aria-labelledby="monthly-chart-title">
    <h3 id="monthly-chart-title" class="chart-title">
      {{ year }}年 月ごとの読了冊数
      <!-- 比べるときの色の説明（凡例）。左の棒から順に -->
      <span v-if="comparing" class="legend" aria-hidden="true">
        <span><i class="swatch previous" />{{ year - 1 }}年</span>
        <span><i class="swatch" />{{ year }}年</span>
      </span>
    </h3>
    <ol class="months">
      <li
        v-for="m in months"
        :key="m.month"
        class="month"
        :class="{ future: m.future, current: m.current }"
        :aria-label="m.label + m.previousLabel"
        :title="comparing ? m.label + m.previousLabel : undefined"
      >
        <span class="count" aria-hidden="true">{{ m.future ? '' : m.count }}</span>
        <span class="bar-area" aria-hidden="true">
          <span v-if="comparing" class="bar previous" :style="{ height: `${m.previousHeight}%` }" />
          <span class="bar now" :style="{ height: `${m.height}%` }" />
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
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 12px;
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
.month.current .bar.now {
  background: var(--col-read-strong);
}
/* まだ来ていない月は棒を出さない（横軸の線だけ） */
.month.future .bar.now {
  display: none;
}
/* 前の年と比べるとき：月ごとに 2 本（左に前の年の灰色、右に選んだ年の緑）。棒は細くする */
.comparing .bar-area {
  gap: 2px;
}
.comparing .bar {
  max-width: 13px;
}
/* 棒の上の数字は選んだ年（右の緑の棒）の冊数なので、緑の棒の真上へずらす（左の灰色の棒の数字に見えないように） */
.comparing .count {
  transform: translateX(7.5px);
}
.bar.previous {
  background: var(--star-empty); /* 灰色。白とのコントラスト 3.23:1（空の ☆ と同じ） */
}
.legend {
  display: inline-flex;
  gap: 10px;
  font-weight: 400;
}
.swatch {
  display: inline-block;
  width: 10px;
  height: 10px;
  margin-right: 3px;
  border-radius: 2px;
  vertical-align: -1px;
  background: var(--col-read);
}
.swatch.previous {
  background: var(--star-empty);
}
/* 「10月」などを途中で折らない（幅 375px だと 1 か月分の列は 18px ほど） */
.month-label {
  margin-top: 3px;
  font-size: 11px;
  color: var(--text-sub);
  white-space: nowrap;
}
.month.current .month-label {
  color: var(--col-read-strong);
  font-weight: 700;
}
@media (max-width: 640px) {
  .month-label,
  .count {
    font-size: 10px;
  }
}
</style>

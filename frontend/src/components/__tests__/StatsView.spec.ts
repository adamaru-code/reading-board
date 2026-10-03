import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import StatsView from '../StatsView.vue'
import ReadMonthlyChart from '../ReadMonthlyChart.vue'
import type { BookStats } from '../../types/book'

const stats: BookStats = {
  finished_total: 128,
  finished_this_year: 42,
  finished_this_month: 3,
  finished_by_month: [4, 6, 3, 5, 2, 7, 4, 3, 5, 3, 0, 0],
}
const today = new Date(2026, 9, 3) // 2026-10-03

describe('StatsView（統計）', () => {
  it('今年・今月・これまでの読了冊数を出す', () => {
    const wrapper = mount(StatsView, { props: { stats, today } })
    const tiles = wrapper.findAll('.tile').map((t) => t.text())
    expect(tiles).toEqual(['今年の読了42 冊', '今月の読了3 冊', 'これまでの読了128 冊'])
  })

  it('取得前は「読み込み中…」、失敗したらお知らせを出す', () => {
    expect(mount(StatsView, { props: { stats: null } }).text()).toContain('読み込み中…')
    const failed = mount(StatsView, { props: { stats: null, failed: true } })
    expect(failed.find('[role="alert"]').text()).toContain('統計を取得できませんでした')
  })
})

describe('ReadMonthlyChart（月ごとの読了冊数）', () => {
  const mountChart = () =>
    mount(ReadMonthlyChart, {
      props: { counts: stats.finished_by_month, year: 2026, currentMonth: 10 },
    })

  it('見出しに年を出し、1〜12 月の 12 本を並べる（読み上げ用に「6月 7冊」）', () => {
    const wrapper = mountChart()
    expect(wrapper.find('.chart-title').text()).toBe('2026年 月ごとの読了冊数')
    const months = wrapper.findAll('.month')
    expect(months).toHaveLength(12)
    expect(months[5].attributes('aria-label')).toBe('6月 7冊')
    expect(months[5].find('.count').text()).toBe('7')
  })

  it('いちばん多い月の棒を 100% にし、今月は強調、まだ来ていない月は冊数も棒も出さない', () => {
    const months = mountChart().findAll('.month')
    expect(months[5].find('.bar').attributes('style')).toContain('height: 100%')
    expect(months[0].find('.bar').attributes('style')).toContain('height: 57%') // 4 / 7
    expect(months[9].classes()).toContain('current')
    expect(months[10].classes()).toContain('future')
    expect(months[10].find('.count').text()).toBe('')
    expect(months[10].attributes('aria-label')).toBe('11月 まだ')
  })

  it('1 冊も無い年でも棒の高さは 0%（0 で割らない）', () => {
    const wrapper = mount(ReadMonthlyChart, {
      props: { counts: Array(12).fill(0), year: 2026, currentMonth: 1 },
    })
    expect(wrapper.findAll('.month')[0].find('.bar').attributes('style')).toContain('height: 0%')
  })
})

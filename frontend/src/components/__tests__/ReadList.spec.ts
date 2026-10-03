import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ReadList from '../ReadList.vue'
import type { Book } from '../../types/book'

function makeBook(id: number, overrides: Partial<Book> = {}): Book {
  return {
    id,
    title: `本${id}`,
    author: `著者${id}`,
    status: 'read',
    genre: 'classic_novel',
    media_type: 'book',
    rating: null,
    memo: null,
    position: null,
    isbn: null,
    cover_url: null,
    tags: [],
    registered_on: '2026-09-01',
    started_on: '2026-09-10',
    finished_on: '2026-09-20',
    duration_days: 10,
    created_at: '2026-09-01T00:00:00Z',
    updated_at: '2026-09-01T00:00:00Z',
    ...overrides,
  }
}

function mountList(items: Book[], total = items.length, hasMore = false) {
  return mount(ReadList, { props: { items, total, hasMore, loadingMore: false } })
}

describe('ReadList（読了一覧）', () => {
  it('見出しの横に今年・今月の読了冊数を出し、stats が無ければ出さない', () => {
    const withStats = mount(ReadList, {
      props: {
        items: [],
        total: 0,
        hasMore: false,
        loadingMore: false,
        stats: {
          finished_total: 30,
          finished_this_year: 12,
          years: [2026],
          year: 2026,
          finished_in_year: 12,
          finished_this_month: 3,
          finished_by_month: [1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 0, 0],
          finished_by_genre: {
            classic_novel: 12,
            liberal_arts: 0,
            health_body: 0,
            practical: 0,
            it_tech: 0,
            other: 0,
          },
        },
      },
    })
    expect(withStats.find('.list-stats').text()).toBe('今年 12 冊・今月 3 冊')
    expect(mountList([]).find('.list-stats').exists()).toBe(false)
  })

  it('各段の上に列の見出しを出す（形態の列は文字なし）', () => {
    // 右の段ができる 26 冊で、両方の段に見出しが付くことを見る
    const wrapper = mountList(Array.from({ length: 26 }, (_, i) => makeBook(i + 1)))
    const heads = wrapper.findAll('.row-head')
    expect(heads).toHaveLength(2)
    expect(heads[0].findAll('span').map((s) => s.text())).toEqual([
      'タイトル',
      '著者',
      'ジャンル',
      '',
      '評価',
      '読了日',
      '日数',
    ])
  })

  it('1 行にタイトル・著者・ジャンル・★・読了日・日数を出す', () => {
    const wrapper = mountList([makeBook(1, { title: 'こころ', author: '夏目 漱石', rating: 4 })])
    const row = wrapper.find('.row')
    expect(row.find('.row-title').text()).toBe('こころ')
    expect(row.find('.row-author').text()).toBe('夏目 漱石')
    expect(row.find('.genre-badge').text()).toBe('古典・名作小説')
    expect(row.findAll('.row-stars .on')).toHaveLength(4)
    expect(row.find('.row-date').text()).toBe('2026-09-20')
    expect(row.find('.row-days').text()).toBe('10日')
  })

  it('開始日と読了日が同じ本の日数は「当日」、未評価の本の評価は「—」', () => {
    const wrapper = mountList([makeBook(1, { duration_days: 0, rating: null })])
    const row = wrapper.find('.row')
    expect(row.find('.row-days').text()).toBe('当日')
    expect(row.find('.row-stars').text()).toBe('—')
    expect(row.find('.row-stars').attributes('aria-label')).toBe('未評価')
  })

  it('「雑誌」バッジは雑誌だけに出し、書籍には出さない', () => {
    const wrapper = mountList([makeBook(1), makeBook(2, { media_type: 'magazine' })])
    const rows = wrapper.findAll('.row')
    expect(rows[0].find('.media-badge').exists()).toBe(false)
    expect(rows[1].find('.media-badge').text()).toBe('雑誌')
  })

  const books = (count: number) => Array.from({ length: count }, (_, i) => makeBook(i + 1))
  const paneTitles = (count: number) =>
    mountList(books(count))
      .findAll('.pane')
      .map((pane) => pane.findAll('.row-title').map((t) => t.text()))

  it('25 冊までは左の段だけに上から縦に並べる（横には並べない）', () => {
    expect(paneTitles(5)).toEqual([['本1', '本2', '本3', '本4', '本5']])
    expect(paneTitles(25)).toHaveLength(1)
  })

  it('26 冊目から右の段へ続け（50 冊で 25・25）、もっと見るで 50 冊を超えたら左右半分ずつ', () => {
    const [left, right] = paneTitles(26)
    expect(left).toHaveLength(25)
    expect(right).toEqual(['本26'])
    const sizes = (count: number) => paneTitles(count).map((pane) => pane.length)
    expect(sizes(50)).toEqual([25, 25])
    expect(sizes(51)).toEqual([26, 25])
    expect(sizes(100)).toEqual([50, 50])
  })

  it('行のクリック・Enter で open を伝える', async () => {
    const book = makeBook(1)
    const wrapper = mountList([book])
    await wrapper.find('.row').trigger('click')
    await wrapper.find('.row').trigger('keydown', { key: 'Enter' })
    expect(wrapper.emitted('open')).toEqual([[book], [book]])
  })

  it('続きがあれば「もっと見る（残り N 件）」を出し、押すと load-more を伝える', async () => {
    const wrapper = mountList([makeBook(1), makeBook(2)], 70, true)
    const button = wrapper.find('.load-more-btn')
    expect(button.text()).toBe('もっと見る（残り 68 件）')
    await button.trigger('click')
    expect(wrapper.emitted('load-more')).toHaveLength(1)
  })

  it('本が無ければ「まだありません」、絞り込んで 0 件なら「当てはまる本はありません」を出す', () => {
    const wrapper = mountList([])
    expect(wrapper.find('.list-empty').text()).toBe('まだありません')
    expect(wrapper.find('.row-head').exists()).toBe(false)

    const filtered = mount(ReadList, {
      props: { items: [], total: 0, hasMore: false, loadingMore: false, filtered: true },
    })
    expect(filtered.find('.list-empty').text()).toBe('当てはまる本はありません')
  })
})

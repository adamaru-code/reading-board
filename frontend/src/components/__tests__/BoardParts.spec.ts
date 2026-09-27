import { describe, it, expect, vi, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import BoardHeader from '../BoardHeader.vue'
import BoardFilters from '../BoardFilters.vue'
import KanbanColumn from '../KanbanColumn.vue'
import type { Book } from '../../types/book'

const owner = { id: 1, email: 'owner@example.com', admin: true }

function makeBook(id: number, title: string): Book {
  return {
    id,
    title,
    author: null,
    status: 'want_to_read',
    genre: 'other',
    media_type: 'book',
    rating: null,
    memo: null,
    position: null,
    tags: [],
    registered_on: null,
    started_on: null,
    finished_on: null,
    duration_days: null,
    created_at: '2026-09-01T00:00:00Z',
    updated_at: '2026-09-01T00:00:00Z',
  }
}

describe('BoardHeader', () => {
  it('ボタンを押すと add / admin / account / logout を伝える', async () => {
    const wrapper = mount(BoardHeader, { props: { user: owner } })
    const byText = (text: string) => wrapper.findAll('button').find((b) => b.text().includes(text))!

    await byText('追加').trigger('click')
    await byText('管理').trigger('click')
    await byText('アカウント').trigger('click')
    await byText('ログアウト').trigger('click')

    expect(Object.keys(wrapper.emitted())).toEqual(
      expect.arrayContaining(['add', 'admin', 'account', 'logout']),
    )
  })

  it('管理者でなければ「管理」ボタンを出さない', () => {
    const wrapper = mount(BoardHeader, { props: { user: { ...owner, admin: false } } })
    const labels = wrapper.findAll('button').map((b) => b.text())
    expect(labels).not.toContain('管理')
    expect(labels).toContain('アカウント')
  })
})

describe('BoardFilters', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  const mountFilters = (author = '', genre = '' as const, tag = '') =>
    mount(BoardFilters, { props: { author, genre, tag, tagOptions: ['歴史', '宗教'] } })

  it('ジャンルを選ぶとすぐ change、著者名は入力が落ち着いてから change', async () => {
    vi.useFakeTimers()
    const wrapper = mountFilters()

    await wrapper.findAll('select')[0].setValue('other')
    expect(wrapper.emitted('update:genre')).toEqual([['other']])
    expect(wrapper.emitted('change')).toHaveLength(1)

    await wrapper.find('input[type="search"]').setValue('漱石')
    expect(wrapper.emitted('change')).toHaveLength(1) // まだ
    vi.advanceTimersByTime(300)
    expect(wrapper.emitted('change')).toHaveLength(2)
  })

  it('先頭に「絞り込み：」を出してまとまりと結び、著者欄の見出しは「著者」', () => {
    const wrapper = mountFilters()
    const group = wrapper.find('[role="group"]')
    const heading = wrapper.find('.filters-heading')
    expect(heading.text()).toBe('絞り込み：')
    expect(group.attributes('aria-labelledby')).toBe(heading.attributes('id'))

    const input = wrapper.find('input[type="search"]')
    expect(input.element.closest('label')?.textContent).toContain('著者')
    expect(input.attributes('aria-label')).toContain('著者')
  })

  it('条件があるときだけ「クリア」を出し、押すと clear', async () => {
    expect(mountFilters().text()).not.toContain('クリア')

    const wrapper = mountFilters('', '', '歴史')
    await wrapper
      .findAll('button')
      .find((b) => b.text() === 'クリア')!
      .trigger('click')
    expect(wrapper.emitted('clear')).toHaveLength(1)
  })
})

describe('KanbanColumn', () => {
  const items = [makeBook(1, 'A'), makeBook(2, 'B')]
  const mountColumn = (extra = {}) =>
    mount(KanbanColumn, {
      props: {
        status: 'want_to_read',
        title: '読みたい',
        items,
        total: 5,
        hasMore: true,
        loadingMore: false,
        draggingId: null,
        ...extra,
      },
    })

  it('見出し・件数・カードを出し、カードを押すと open', async () => {
    const wrapper = mountColumn()
    expect(wrapper.find('.column-title').text()).toBe('読みたい')
    expect(wrapper.find('.column-count').text()).toBe('5')

    await wrapper.findAll('.card')[1].trigger('click')
    expect(wrapper.emitted('open')).toEqual([[items[1]]])
  })

  it('「もっと見る」に残りの件数を出し、押すと load-more', async () => {
    const wrapper = mountColumn()
    const more = wrapper.find('.load-more-btn')
    expect(more.text()).toBe('もっと見る（残り 3 件）')
    await more.trigger('click')
    expect(wrapper.emitted('load-more')).toHaveLength(1)
  })

  it('ドロップ位置からカラム内の挿入位置を求めて drop を伝える', async () => {
    const wrapper = mountColumn({ draggingId: 99 })
    // jsdom はレイアウトしないので、カードの位置（上端 0 / 100、高さ 80）を仮に与える
    wrapper.findAll('.card').forEach((card, i) => {
      card.element.getBoundingClientRect = () => ({ top: i * 100, height: 80 }) as DOMRect
    })

    await wrapper.find('.column').trigger('drop', { clientY: 120 }) // 1 枚目の下・2 枚目の中央より上
    expect(wrapper.emitted('drop')).toEqual([[1]])
  })
})

import { describe, it, expect, vi, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import BoardHeader from '../BoardHeader.vue'
import BoardFilters from '../BoardFilters.vue'
import KanbanColumn from '../KanbanColumn.vue'
import BookCard from '../BookCard.vue'
import type { Book } from '../../types/book'
import type { User } from '../../types/auth'
import type { BoardView } from '../../types/view'

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
    isbn: null,
    cover_url: null,
    tags: [],
    registered_on: null,
    started_on: null,
    finished_on: null,
    duration_days: null,
    created_at: '2026-09-01T00:00:00Z',
    updated_at: '2026-09-01T00:00:00Z',
  }
}

// ヘッダは「ボード｜読了一覧｜統計」の切り替えに RouterLink を使うので、ルーターを付けて描く
async function mountHeader(user: User = owner, view: BoardView = 'board') {
  const Empty = { template: '<div />' }
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'board', component: Empty },
      { path: '/read', name: 'read', component: Empty },
      { path: '/stats', name: 'stats', component: Empty },
    ],
  })
  await router.push({ board: '/', read: '/read', stats: '/stats' }[view])
  const wrapper = mount(BoardHeader, { props: { user, view }, global: { plugins: [router] } })
  return { wrapper, router }
}

describe('BoardHeader', () => {
  it('ボタンを押すと add / admin / account / logout を伝える', async () => {
    const { wrapper } = await mountHeader()
    const byText = (text: string) => wrapper.findAll('button').find((b) => b.text().includes(text))!

    await byText('追加').trigger('click')
    await byText('管理').trigger('click')
    await byText('アカウント').trigger('click')
    await byText('ログアウト').trigger('click')

    expect(Object.keys(wrapper.emitted())).toEqual(
      expect.arrayContaining(['add', 'admin', 'account', 'logout']),
    )
  })

  it('管理者でなければ「管理」ボタンを出さない', async () => {
    const { wrapper } = await mountHeader({ ...owner, admin: false })
    const labels = wrapper.findAll('button').map((b) => b.text())
    expect(labels).not.toContain('管理')
    expect(labels).toContain('アカウント')
  })

  it('「ボード」「読了一覧」のリンクで / と /read を行き来し、今の画面を強調する', async () => {
    const { wrapper, router } = await mountHeader(owner, 'board')
    const link = (text: string) => wrapper.findAll('.view-switch a').find((a) => a.text() === text)!

    expect(link('ボード').attributes('aria-current')).toBe('page')
    expect(link('ボード').classes()).toContain('current')
    expect(link('読了一覧').classes()).not.toContain('current')

    await link('読了一覧').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.name).toBe('read')

    await wrapper.setProps({ view: 'read' })
    expect(link('読了一覧').attributes('aria-current')).toBe('page')
    expect(link('読了一覧').classes()).toContain('current')

    await link('統計').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.name).toBe('stats')
    await wrapper.setProps({ view: 'stats' })
    expect(link('統計').attributes('aria-current')).toBe('page')
    expect(link('読了一覧').classes()).not.toContain('current')
  })
})

describe('BoardFilters', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  const mountFilters = (keyword = '', genre = '' as const, tag = '') =>
    mount(BoardFilters, { props: { keyword, genre, tag, tagOptions: ['歴史', '宗教'] } })

  it('ジャンルを選ぶとすぐ change、キーワードは入力が落ち着いてから change', async () => {
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

  it('先頭に「絞り込み：」を出してまとまりと結び、文字の欄は「キーワード」（タイトル・著者）', () => {
    const wrapper = mountFilters()
    const group = wrapper.find('[role="group"]')
    const heading = wrapper.find('.filters-heading')
    expect(heading.text()).toBe('絞り込み：')
    expect(group.attributes('aria-labelledby')).toBe(heading.attributes('id'))

    const input = wrapper.find('input[type="search"]')
    expect(input.element.closest('label')?.textContent).toContain('キーワード')
    expect(input.attributes('placeholder')).toBe('タイトル・著者')
    expect(input.attributes('aria-label')).toBe('タイトル・著者で絞り込み')
  })

  it('条件があるときだけ「クリア」を出し、押すと clear', async () => {
    expect(mountFilters().text()).not.toContain('クリア')

    const wrapper = mountFilters('', '', '歴史')
    const clear = wrapper.find('.clear-btn')
    expect(clear.text()).toContain('クリア')
    expect(clear.attributes('aria-label')).toBe('絞り込みをクリア')
    await clear.trigger('click')
    expect(wrapper.emitted('clear')).toHaveLength(1)
  })

  it('ジャンルの選択肢に「IT・技術」を「実用・暮らし」と「その他・未分類」の間に出す', () => {
    const options = mountFilters()
      .findAll('select')[0]
      .findAll('option')
      .map((o) => o.text())
    expect(options.slice(-3)).toEqual(['実用・暮らし', 'IT・技術', 'その他・未分類'])
  })

  it('絞り込みに使っている欄だけ強調する（active）', () => {
    const wrapper = mountFilters('漱石', '', '歴史')
    const [genreSelect, tagSelect] = wrapper.findAll('select')
    expect(wrapper.find('input[type="search"]').classes()).toContain('active')
    expect(genreSelect.classes()).not.toContain('active')
    expect(tagSelect.classes()).toContain('active')

    expect(mountFilters().findAll('.active')).toHaveLength(0)
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

  it('本が無ければ「まだありません」、絞り込んで 0 件なら「当てはまる本はありません」', () => {
    const empty = { items: [], total: 0, hasMore: false }
    expect(mountColumn(empty).find('.column-empty').text()).toBe('まだありません')
    expect(
      mountColumn({ ...empty, filtered: true })
        .find('.column-empty')
        .text(),
    ).toBe('当てはまる本はありません')
    // 本があれば文言は出さない
    expect(mountColumn({ filtered: true }).find('.column-empty').exists()).toBe(false)
  })

  it('titleTo を渡すと見出し（名前と件数）がその画面へのリンクになる。渡さなければリンクにしない', async () => {
    expect(mountColumn().find('.column-title-link').exists()).toBe(false)

    const Empty = { template: '<div />' }
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/', name: 'board', component: Empty },
        { path: '/read', name: 'read', component: Empty },
      ],
    })
    await router.push('/')
    const wrapper = mount(KanbanColumn, {
      props: {
        status: 'read',
        title: '読了',
        items,
        total: 2,
        hasMore: false,
        loadingMore: false,
        draggingId: null,
        titleTo: { name: 'read' },
        titleLinkLabel: '読了一覧を開く',
      },
      global: { plugins: [router] },
    })
    const link = wrapper.find('.column-title-link')
    expect(link.find('.column-title').text()).toBe('読了')
    expect(link.find('.column-count').text()).toBe('2')
    // 説明はブラウザ標準の title ではなく自前の吹き出し（リンクと aria-describedby で結ぶ）
    expect(link.attributes('title')).toBeUndefined()
    const tooltip = link.find('[role="tooltip"]')
    expect(tooltip.text()).toBe('読了一覧を開く')
    expect(link.attributes('aria-describedby')).toBe(tooltip.attributes('id'))
    await link.trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.name).toBe('read')
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

describe('BookCard', () => {
  const readBook = (duration: number): Book => ({
    ...makeBook(1, '読了した本'),
    status: 'read',
    started_on: '2026-09-20',
    finished_on: '2026-09-20',
    duration_days: duration,
  })

  it('読了までの日数を「N日で読了」、開始日と読了日が同じなら「当日に読了」と出す', () => {
    expect(
      mount(BookCard, { props: { book: readBook(10) } })
        .find('.duration')
        .text(),
    ).toBe('10日で読了')
    expect(
      mount(BookCard, { props: { book: readBook(0) } })
        .find('.duration')
        .text(),
    ).toBe('当日に読了')
  })
})

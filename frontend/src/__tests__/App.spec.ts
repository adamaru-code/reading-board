import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createMemoryHistory } from 'vue-router'
import App from '../App.vue'
import { createAppRouter } from '../router'
import { resetAuthForTest } from '../lib/auth'
import * as sessionApi from '../api/session'
import * as booksApi from '../api/books'
import * as hiddenTagsApi from '../api/hiddenTags'
import { ApiError } from '../api/http'

const owner = { id: 1, email: 'owner@example.com', admin: true }
const emptyPage = { items: [], pagination: { page: 1, per_page: 20, total: 0, total_pages: 0 } }

async function mountAt(url: string) {
  const router = createAppRouter(createMemoryHistory())
  await router.push(url)
  const wrapper = mount(App, { global: { plugins: [router] } })
  await flushPromises()
  return { wrapper, router }
}

describe('App（画面の切り替え）', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    resetAuthForTest()
    // ボードが開いたときの読み込みは空で返す
    vi.spyOn(booksApi, 'listBooks').mockResolvedValue(emptyPage as never)
    vi.spyOn(booksApi, 'listAllBooks').mockResolvedValue([])
    vi.spyOn(hiddenTagsApi, 'listHiddenTags').mockResolvedValue([])
  })

  it('ログイン画面の「新規登録」で /register へ、登録画面の「ログイン」で /login へ戻る', async () => {
    vi.spyOn(sessionApi, 'fetchCurrentUser').mockRejectedValue(new ApiError(401, []))
    const { wrapper, router } = await mountAt('/login')

    await wrapper.find('.switch-link').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.name).toBe('register')

    await wrapper.find('.switch-link').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.name).toBe('login')
  })

  it('ログインするとボード（/）へ移り、ログアウトで /login へ戻る', async () => {
    vi.spyOn(sessionApi, 'fetchCurrentUser').mockRejectedValue(new ApiError(401, []))
    vi.spyOn(sessionApi, 'login').mockResolvedValue(owner)
    vi.spyOn(sessionApi, 'logout').mockResolvedValue()
    const { wrapper, router } = await mountAt('/login')

    await wrapper.find('input[type="email"]').setValue('owner@example.com')
    await wrapper.find('input[type="password"]').setValue('password')
    await wrapper.find('form').trigger('submit')
    await flushPromises()
    expect(router.currentRoute.value.name).toBe('board')
    expect(wrapper.text()).toContain('owner@example.com')

    const logoutBtn = wrapper.findAll('button').find((b) => b.text() === 'ログアウト')!
    await logoutBtn.trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.name).toBe('login')
  })

  it('「読了一覧」で /read に切り替わり、読了本を 60 件まで読み込む。「ボード」で戻る', async () => {
    vi.spyOn(sessionApi, 'fetchCurrentUser').mockResolvedValue(owner)
    // 読了は 70 冊（1 回の取得で頼まれた件数だけ返す）。ほかのカラムは空
    const readBooks = Array.from({ length: 70 }, (_, i) => ({
      id: i + 1,
      title: `読了本${i + 1}`,
      author: null,
      status: 'read',
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
      finished_on: '2026-09-20',
      duration_days: null,
      created_at: '2026-09-01T00:00:00Z',
      updated_at: '2026-09-01T00:00:00Z',
    }))
    const listSpy = vi.spyOn(booksApi, 'listBooks').mockImplementation(async (params, paging) => {
      if (params?.status !== 'read') return emptyPage as never
      const offset = paging?.offset ?? 0
      const perPage = paging?.perPage ?? 100
      return {
        items: readBooks.slice(offset, offset + perPage),
        pagination: { page: 1, per_page: perPage, total: 70, total_pages: 1 },
      } as never
    })
    const { wrapper, router } = await mountAt('/')
    expect(wrapper.findAll('.card')).toHaveLength(20) // ボードの読了カラムは 20 件

    const link = (text: string) => wrapper.findAll('.view-switch a').find((a) => a.text() === text)!
    await link('読了一覧').trigger('click')
    await flushPromises()

    expect(router.currentRoute.value.name).toBe('read')
    expect(listSpy).toHaveBeenLastCalledWith(
      { status: 'read' },
      { offset: 20, perPage: 40, sort: 'finished_on', dir: 'desc' },
    )
    expect(wrapper.findAll('.row')).toHaveLength(60)
    expect(wrapper.find('.load-more-btn').text()).toBe('もっと見る（残り 10 件）')

    await link('ボード').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.name).toBe('board')
    expect(wrapper.find('.board').exists()).toBe(true)
  })
})

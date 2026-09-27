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
})

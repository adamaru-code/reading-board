import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createMemoryHistory } from 'vue-router'
import { createAppRouter } from '../index'
import { resetAuthForTest } from '../../lib/auth'
import * as sessionApi from '../../api/session'
import { ApiError } from '../../api/http'

const owner = { id: 1, email: 'owner@example.com', admin: true }

function loggedIn() {
  vi.spyOn(sessionApi, 'fetchCurrentUser').mockResolvedValue(owner)
}
function loggedOut() {
  vi.spyOn(sessionApi, 'fetchCurrentUser').mockRejectedValue(
    new ApiError(401, ['ログインが必要です']),
  )
}

// URL を開いて、最終的にどの URL に落ち着いたかを返す
async function open(url: string) {
  const router = createAppRouter(createMemoryHistory())
  await router.push(url)
  return router.currentRoute.value
}

describe('router（画面の切り替え）', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    resetAuthForTest()
  })

  it('未ログインでボード（/）を開くとログイン画面へ', async () => {
    loggedOut()
    expect((await open('/')).name).toBe('login')
  })

  it('読了一覧（/read）はログイン必須で、ボードと同じ部品に view=read を渡す', async () => {
    loggedOut()
    expect((await open('/read')).name).toBe('login')
    resetAuthForTest()
    loggedIn()
    const read = await open('/read')
    expect(read.name).toBe('read')
    expect(read.matched[0].props).toEqual({ default: { view: 'read' } })
  })

  it('ログイン済みでログイン・登録画面を開くとボードへ', async () => {
    loggedIn()
    expect((await open('/login')).name).toBe('board')
    resetAuthForTest()
    loggedIn()
    expect((await open('/register')).name).toBe('board')
  })

  it('今までの招待リンク /?invite= は /register?invite= へ移る', async () => {
    loggedOut()
    const route = await open('/?invite=ABC123')
    expect(route.name).toBe('register')
    expect(route.query.invite).toBe('ABC123')
  })

  it('今までの再設定リンク /?reset= は /reset?token= へ移る', async () => {
    loggedOut()
    const route = await open('/?reset=TOKEN')
    expect(route.name).toBe('reset')
    expect(route.query.token).toBe('TOKEN')
  })

  it('再設定画面はログイン中でも開ける', async () => {
    loggedIn()
    expect((await open('/reset?token=TOKEN')).name).toBe('reset')
  })

  it('知らない URL はボードへ（未ログインならログイン画面へ）', async () => {
    loggedIn()
    expect((await open('/no-such-page')).name).toBe('board')
    resetAuthForTest()
    loggedOut()
    expect((await open('/no-such-page')).name).toBe('login')
  })

  it('登録画面・再設定画面に URL のコード・トークンを渡す', async () => {
    loggedOut()
    const register = await open('/register?invite=ABC')
    const props = register.matched[0].props as { default: (r: typeof register) => unknown }
    expect(props.default(register)).toEqual({ initialCode: 'ABC' })

    const reset = await open('/reset?token=T')
    const resetProps = reset.matched[0].props as { default: (r: typeof reset) => unknown }
    expect(resetProps.default(reset)).toEqual({ token: 'T' })
  })
})

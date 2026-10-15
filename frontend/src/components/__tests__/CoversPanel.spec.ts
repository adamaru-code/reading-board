import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import CoversPanel from '../CoversPanel.vue'
import * as booksApi from '../../api/books'
import { ApiError } from '../../api/http'
import type { FetchCoversResult } from '../../types/book'

function result(over: Partial<FetchCoversResult>): FetchCoversResult {
  return {
    updated: 0,
    not_found: 0,
    last_id: 0,
    remaining: 0,
    stopped: null,
    message: null,
    ...over,
  }
}

async function mountPanel(count: number) {
  vi.spyOn(booksApi, 'countMissingCovers').mockResolvedValue(count)
  const wrapper = mount(CoversPanel)
  await flushPromises()
  return wrapper
}

describe('CoversPanel（表紙のまとめて取得）', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('開くと、ISBN があって表紙が無い本の冊数を出す。0 冊ならボタンを押せない', async () => {
    const wrapper = await mountPanel(0)
    expect(wrapper.find('.covers-count').text()).toBe('ISBN があって表紙が無い本：0 冊')
    expect(wrapper.find('.covers-actions button').attributes('disabled')).toBeDefined()
  })

  it('残りが 0 になるまで last_id を after_id に渡して繰り返し、結果を出して updated を伝える', async () => {
    const wrapper = await mountPanel(12)
    const spy = vi
      .spyOn(booksApi, 'fetchCovers')
      .mockResolvedValueOnce(result({ updated: 9, not_found: 1, last_id: 10, remaining: 2 }))
      .mockResolvedValueOnce(result({ updated: 1, not_found: 1, last_id: 12, remaining: 0 }))
    await wrapper.find('.covers-actions button').trigger('click')
    await flushPromises()

    expect(spy.mock.calls).toEqual([[0], [10]])
    expect(wrapper.find('.done-message').text()).toBe(
      '表紙を付けた本 10 冊・見つからなかった本 2 冊',
    )
    expect(wrapper.find('.stop-message').exists()).toBe(false)
    expect(wrapper.emitted('updated')).toHaveLength(1)
  })

  it('止まったら繰り返さず、サーバーの理由を出す', async () => {
    const wrapper = await mountPanel(5)
    const message =
      'Google の 1 日の回数の上限に達したので止めました。残り 4 冊は、明日以降にもう一度押してください'
    const spy = vi
      .spyOn(booksApi, 'fetchCovers')
      .mockResolvedValue(
        result({ updated: 1, last_id: 3, remaining: 4, stopped: 'limited', message }),
      )
    await wrapper.find('.covers-actions button').trigger('click')
    await flushPromises()

    expect(spy).toHaveBeenCalledTimes(1)
    expect(wrapper.find('.stop-message').text()).toBe(message)
    expect(wrapper.find('.done-message').text()).toBe(
      '表紙を付けた本 1 冊・見つからなかった本 0 冊',
    )
  })

  it('1 冊も付かなかったら updated を伝えない', async () => {
    const wrapper = await mountPanel(1)
    vi.spyOn(booksApi, 'fetchCovers').mockResolvedValue(result({ not_found: 1, last_id: 1 }))
    await wrapper.find('.covers-actions button').trigger('click')
    await flushPromises()

    expect(wrapper.emitted('updated')).toBeUndefined()
  })

  it('ログインが切れていたら unauthorized を伝える', async () => {
    const wrapper = await mountPanel(1)
    vi.spyOn(booksApi, 'fetchCovers').mockRejectedValue(new ApiError(401, []))
    await wrapper.find('.covers-actions button').trigger('click')
    await flushPromises()

    expect(wrapper.emitted('unauthorized')).toHaveLength(1)
  })
})

import { describe, it, expect, vi } from 'vitest'
import { request, ApiError } from '../http'

function mockFetch(status: number, body?: unknown) {
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(body === undefined ? null : JSON.stringify(body), { status }),
  )
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

describe('request', () => {
  it('/api を基点にし、空のクエリ値は除外する', async () => {
    const fetchMock = mockFetch(200, [])
    await request('/books', { query: { status: 'read', genre: undefined, author: '' } })
    expect(fetchMock).toHaveBeenCalledWith('/api/books?status=read', expect.anything())
  })

  it('body を JSON 化して Content-Type を付ける', async () => {
    const fetchMock = mockFetch(200, {})
    await request('/books', { method: 'POST', body: { book: { title: 'x' } } })
    const [, init] = fetchMock.mock.calls[0]
    expect(init).toMatchObject({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{"book":{"title":"x"}}',
    })
  })

  it('204 は undefined を返す', async () => {
    mockFetch(204)
    await expect(request('/books/1', { method: 'DELETE' })).resolves.toBeUndefined()
  })

  it('エラー時は { errors } を ApiError に変換する', async () => {
    mockFetch(422, { errors: ['タイトルを入力してください'] })
    const error = await request('/books').catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 422, errors: ['タイトルを入力してください'] })
  })

  it('エラーボディが JSON でなくてもステータス付きで例外化する', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('oops', { status: 500 })))
    await expect(request('/books')).rejects.toMatchObject({ status: 500, errors: [] })
  })
})

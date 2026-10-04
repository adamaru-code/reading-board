import { describe, it, expect, vi } from 'vitest'
import { listMyTags, removeTag, renameTag } from '../tags'

describe('tags API', () => {
  it('一覧・名前を変える・外すを、決まった URL とメソッドで送る', async () => {
    const fetchMock = vi
      .fn()
      .mockImplementation(async () => new Response(JSON.stringify({ count: 1, merged: false })))
    vi.stubGlobal('fetch', fetchMock)

    await listMyTags()
    await renameTag('健康法', '健康')
    await removeTag('名著')

    const calls = fetchMock.mock.calls.map(([url, init]) => ({
      url: new URL(url, 'http://localhost'),
      init,
    }))
    expect(calls[0].url.pathname).toBe('/api/tags')
    expect(calls[1].url.pathname).toBe('/api/tags/rename')
    expect(calls[1].init.method).toBe('PATCH')
    expect(JSON.parse(calls[1].init.body)).toEqual({ from: '健康法', to: '健康' })
    expect(calls[2].url.pathname).toBe('/api/tags/remove')
    expect(calls[2].init.method).toBe('DELETE')
    expect(calls[2].url.searchParams.get('name')).toBe('名著')
  })
})
